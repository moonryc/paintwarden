import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// One exact, non-empty version section; never accidentally publish Unreleased or another version.
export function releaseNotes(changelog, version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/.test(version))
    throw new Error("Expected a stable or beta.N version");
  const lines = changelog.replaceAll("\r\n", "\n").split("\n");
  const starts = lines.flatMap((line, index) =>
    line.startsWith(`## [${version}]`) &&
    /^(?: - \d{4}-\d{2}-\d{2})?$/.test(line.slice(`## [${version}]`.length))
      ? [index]
      : [],
  );
  if (starts.length !== 1) throw new Error(`Expected exactly one CHANGELOG section for ${version}`);
  const end = lines.findIndex((line, index) => index > starts[0] && /^## /.test(line));
  const notes = lines
    .slice(starts[0] + 1, end < 0 ? undefined : end)
    .join("\n")
    .trim();
  if (!notes) throw new Error(`Empty CHANGELOG section for ${version}`);
  return `${notes}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const version = (process.argv[2] ?? "").replace(/^v/, "");
  const notes = releaseNotes(
    readFileSync(path.join(import.meta.dirname, "../CHANGELOG.md"), "utf8"),
    version,
  );
  if (process.argv[3]) writeFileSync(process.argv[3], notes);
  else process.stdout.write(notes);
}
