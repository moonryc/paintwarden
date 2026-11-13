import { parseManifest } from "./source-format";

// Reads a catalog source from GitHub: its repository address, default branch, manifest, files
// and logo.

const githubRepository = /^https:\/\/github\.com\/([a-z\d](?:[a-z\d-]{0,38}))\/([a-z\d_.-]+?)(?:\.git)?\/?$/i;

export function normalizeRepository(input: string) {
  const value = input
    .trim()
    .replace(/^github:/i, "https://github.com/")
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "https://github.com/")
    .replace(/^(?=[a-z\d][a-z\d-]{0,38}\/[a-z\d_.-]+\/?$)/i, "https://github.com/");
  const match = githubRepository.exec(value);
  if (!match) throw new Error("Use a public GitHub repository URL");
  return {
    id: `${match[1].toLowerCase()}/${match[2].toLowerCase()}`,
    url: `https://github.com/${match[1]}/${match[2]}`,
  };
}

// Reads a response, stopping as soon as it passes maxBytes. Returns null if it does.
async function readCapped(response: Response, maxBytes: number) {
  if (Number(response.headers.get("content-length") ?? 0) > maxBytes) {
    await response.body?.cancel();
    return null;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (!response.body) return Buffer.alloc(0);
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength;
    if (total > maxBytes) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function requestBytes(url: string, maxBytes: number) {
  const response = await fetch(url, {
    headers: { "user-agent": "Paint-Vault" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Source request failed (${response.status})`);
  const bytes = await readCapped(response, maxBytes);
  if (!bytes) throw new Error("Source file is too large");
  return bytes;
}

export async function requestJson(url: string, maxBytes: number): Promise<unknown> {
  return JSON.parse((await requestBytes(url, maxBytes)).toString("utf8"));
}

export const rawUrl = (id: string, revision: string, filename: string) =>
  `https://raw.githubusercontent.com/${id}/${revision}/${filename}`;

export const LOGO_MAX_BYTES = 100_000;

const svgDocument =
  /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE svg[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i;

// Accepts a standalone SVG document; anything else is treated as no logo.
export function validLogoSvg(bytes: Buffer) {
  if (bytes.byteLength === 0 || bytes.byteLength > LOGO_MAX_BYTES) return null;
  const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
  return svgDocument.test(text) && /<\/svg>\s*$/i.test(text) ? text : null;
}

// Returns the logo text, null when the repository has no usable logo.svg, or undefined
// when the check itself failed so a previously stored logo is kept.
export async function fetchSourceLogo(id: string, revision: string) {
  try {
    const response = await fetch(rawUrl(id, revision, "logo.svg"), {
      headers: { "user-agent": "Paint-Vault" },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) return undefined;
    const bytes = await readCapped(response, LOGO_MAX_BYTES);
    return bytes && validLogoSvg(bytes);
  } catch {
    return undefined;
  }
}

export async function defaultBranch(id: string) {
  const body = (await requestJson(`https://api.github.com/repos/${id}`, 100_000)) as {
    default_branch?: unknown;
    private?: unknown;
  };
  if (body.private || typeof body.default_branch !== "string" || !/^[\w./-]+$/.test(body.default_branch))
    throw new Error("The GitHub repository must be public and have a default branch");
  return body.default_branch;
}

export async function sourceManifest(id: string, branch: string) {
  const commit = (await requestJson(
    `https://api.github.com/repos/${id}/commits/${encodeURIComponent(branch)}`,
    100_000,
  )) as { sha?: unknown };
  if (typeof commit.sha !== "string" || !/^[a-f\d]{40}$/i.test(commit.sha))
    throw new Error("Invalid source revision response");
  const file = (await requestJson(
    `https://api.github.com/repos/${id}/contents/source.json?ref=${commit.sha}`,
    300_000,
  )) as { encoding?: unknown; content?: unknown };
  if (file.encoding !== "base64" || typeof file.content !== "string" || file.content.length > 200_000)
    throw new Error("Invalid source manifest response");
  let manifest: unknown;
  try {
    manifest = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  } catch {
    throw new Error("source.json isn't valid JSON");
  }
  return { manifest: parseManifest(manifest), revision: commit.sha };
}
