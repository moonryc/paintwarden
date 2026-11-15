import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { releaseNotes } from "./release-notes.mjs";

const source =
  "# Changelog\n\n## [Unreleased]\n\nsecret future\n\n## [1.0.0-beta.1] - 2026-11-14\n\n### Added\n\n- Hello!\n\n## [0.9.0]\n\nOld news\n";
test("extracts exactly this version, excluding headings and neighboring versions", () => {
  assert.equal(releaseNotes(source, "1.0.0-beta.1"), "### Added\n\n- Hello!\n");
  assert.equal(releaseNotes(source.replaceAll("\n", "\r\n"), "1.0.0-beta.1"), "### Added\n\n- Hello!\n");
  assert.equal(releaseNotes(source, "0.9.0"), "Old news\n");
});
test("rejects missing, duplicate, empty and malformed sections", () => {
  assert.throws(() => releaseNotes(source, "1.0.0"), /exactly one/);
  assert.throws(() => releaseNotes(source + source, "1.0.0-beta.1"), /exactly one/);
  assert.throws(() => releaseNotes("## [1.0.0]\n\n## [0.9.0]\nOld", "1.0.0"), /Empty/);
  for (const version of ["1.0.0-beta.01", "1.0.0-rc.1", "Unreleased", "1.0.0\n", "01.0.0"])
    assert.throws(() => releaseNotes(source, version), /Expected/);
});
test("current beta ships a real changelog entry", () => {
  const notes = releaseNotes(
    readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8"),
    "1.0.0-beta.1",
  );
  for (const feature of [
    "inventory",
    "miniatures",
    "recipes",
    "schemes",
    "templates",
    "plugins",
    "Swatch Scan",
    "complementary",
    "Projects",
    "13",
    "backups",
    "desktop",
    "Docker",
  ])
    assert.ok(notes.includes(feature), feature);
});
