import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import path from "node:path";

type Choice = { mode: "local" | "remote"; serverUrl?: string };
function configPath() {
  const directory = process.env.DATA_DIR;
  if (!directory) throw new Error("Desktop data directory is not configured");
  mkdirSync(directory, { recursive: true });
  return path.join(directory, "client-connection.json");
}
function localOnly(request: Request) {
  const address = new URL(request.url).hostname;
  return process.env.PAINT_VAULT_DESKTOP === "1" && ["127.0.0.1", "localhost", "[::1]"].includes(address);
}
export async function clientConfig(request: Request) {
  if (!localOnly(request)) return new Response("Not found", { status: 404 });
  if (request.method === "GET") {
    try {
      return Response.json(JSON.parse(readFileSync(configPath(), "utf8")) as Choice, {
        headers: { "cache-control": "no-store" },
      });
    } catch {
      return Response.json({ mode: null }, { headers: { "cache-control": "no-store" } });
    }
  }
  if (request.method !== "PUT") return new Response("Method not allowed", { status: 405 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return new Response("Invalid origin", { status: 403 });
  let body: Choice;
  try {
    body = (await request.json()) as Choice;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (body.mode !== "local" && body.mode !== "remote") return new Response("Invalid mode", { status: 400 });
  if (body.mode === "remote") {
    try {
      const url = new URL(body.serverUrl ?? "");
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw new Error();
      body.serverUrl = url.origin;
    } catch {
      return new Response("Enter a server URL such as https://vault.example.com", { status: 400 });
    }
  } else body = { mode: "local" };
  const target = configPath(),
    temporary = `${target}.${randomBytes(8).toString("hex")}.tmp`;
  writeFileSync(temporary, JSON.stringify(body), { mode: 0o600 });
  renameSync(temporary, target);
  return Response.json(body);
}
