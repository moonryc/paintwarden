import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Run with: node --test apps/paintwarden-site/tests/release-gate.test.mjs
// Uses the existing scoped site dependencies; builds to disposable directories.
const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(site, "../..");
const repository = "https://github.com/moonryc/paintwarden";
const notice = "Downloads coming soon: Paintwarden is in a private beta";

function build(outDir, available) {
  const env = { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" };
  delete env.PUBLIC_RELEASES_AVAILABLE;
  if (available !== undefined) env.PUBLIC_RELEASES_AVAILABLE = available;
  const result = spawnSync(
    process.execPath,
    [join(root, "node_modules/astro/bin/astro.mjs"), "build", "--outDir", outDir],
    { cwd: site, env, encoding: "utf8", timeout: 120_000 },
  );
  assert.equal(result.status, 0, `${result.error || ""}\n${result.stdout}\n${result.stderr}`);
  return (page) => readFileSync(join(outDir, page, "index.html"), "utf8");
}

function hrefs(html) {
  return Array.from(html.matchAll(/\bhref="([^"]*)"/g), (match) => match[1]);
}

test("release gate is a strict, default-off build-time opt-in", async () => {
  const source = readFileSync(join(site, "src/site/links.ts"), "utf8");
  for (const value of [undefined, "", "false", "TRUE", "1", "true"]) {
    const transformed = source.replace(
      "import.meta.env.PUBLIC_RELEASES_AVAILABLE",
      JSON.stringify(value) ?? "undefined",
    );
    const module = await import(`data:text/javascript,${encodeURIComponent(transformed)}`);
    assert.equal(module.releasesAvailable, value === "true");
  }
});

test("coming-soon notice is translated in every supported locale", () => {
  const locales = join(root, "packages/paint-i18n/locales");
  const languages = readdirSync(locales).filter((name) => !name.startsWith("."));
  assert.equal(languages.length, 13);
  for (const language of languages) {
    const messages = JSON.parse(readFileSync(join(locales, language, "site.json"), "utf8"));
    assert.ok(messages["download.comingSoon"]?.includes("Paintwarden"), language);
    if (language === "en") assert.equal(messages["download.comingSoon"], notice);
    else assert.notEqual(messages["download.comingSoon"], notice, language);
  }
});

test("built default site hides private links and setup; opt-in restores them", { timeout: 300_000 }, () => {
  const temporary = mkdtempSync(join(tmpdir(), "paintwarden-release-gate-"));
  try {
    const hidden = build(join(temporary, "private"));
    for (const page of ["", "download", "docs", "faq", "licenses", "phone"]) {
      assert.ok(!/demo[- ]plugin|demo ZIP|starter plugin/i.test(hidden(page)), `${page}: demo promotion`);
      const links = hrefs(hidden(page));
      assert.ok(!links.some((href) => href.startsWith(repository)), `${page}: private link`);
      assert.ok(links.includes("/licenses/"), `${page}: local notices`);
      assert.ok(links.includes("/LICENSE"), `${page}: local license`);
    }
    const homepage = hidden("");
    assert.ok(homepage.includes("Use Paintwarden on your phone"));
    assert.ok(homepage.includes("The Paintwarden app doesn’t collect your data."));
    assert.ok(homepage.includes("/phone/"));
    const phone = hidden("phone");
    for (const text of ["3000", "127.0.0.1", "Tailscale", "same network", "Home Screen", "within 7 days"]) {
      assert.ok(phone.includes(text), `phone guide missing ${text}`);
    }
    for (const href of ["/privacy.md", "/phone-access.md"]) assert.ok(hrefs(phone).includes(href));
    for (const [file, source] of [
      ["privacy.md", "privacy.md"],
      ["phone-access.md", "phone-access.md"],
    ]) {
      assert.equal(
        readFileSync(join(temporary, "private", file), "utf8"),
        readFileSync(join(root, "docs", source), "utf8"),
      );
    }
    assert.ok(homepage.includes('srcSet="/images/app/workbench-720.webp 720w'));
    assert.ok(!/illustrative|mock-up/i.test(homepage));
    const download = hidden("download");
    assert.ok(download.includes(notice));
    for (const forbidden of [
      "git clone",
      "docker compose",
      "desktop-panel",
      "server-panel",
      "npm run desktop:package",
    ]) {
      assert.ok(!download.includes(forbidden), `default download contains ${forbidden}`);
    }
    assert.ok(hrefs(download).includes("/docs/"));

    const publicSite = build(join(temporary, "public"), "true");
    for (const page of ["", "download", "docs", "faq", "licenses"]) {
      assert.ok(!/demo[- ]plugin|demo ZIP|starter plugin/i.test(publicSite(page)), `${page}: demo promotion`);
    }
    const publicDownload = publicSite("download");
    assert.ok(!publicDownload.includes(notice));
    assert.ok(publicDownload.includes("git clone"));
    assert.ok(publicDownload.includes("docker compose up -d --build"));
    assert.ok(publicDownload.includes('id="desktop-panel"'));
    assert.ok(publicDownload.includes('id="server-panel"'));
    assert.ok(hrefs(publicDownload).includes(`${repository}/releases`));
    for (const href of [
      repository,
      `${repository}/blob/main/LICENSE`,
      `${repository}/blob/main/docs/beta-testers.md`,
      "/privacy.md",
      `${repository}/security/policy`,
    ]) {
      assert.ok(hrefs(publicSite("")).includes(href), `public footer missing ${href}`);
    }
    for (const href of [
      `${repository}/blob/main/docs/source-format.md`,
      `${repository}#storage-and-backups`,
    ]) {
      assert.ok(hrefs(publicSite("docs")).includes(href), `public docs missing ${href}`);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
