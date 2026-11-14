const assert = require("node:assert/strict");
const test = require("node:test");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { t, getLanguage, setLanguage, supportedLanguages, resolveLanguage } = require("./desktop-i18n.cjs");
const { createPreferences } = require("./desktop-preferences.cjs");
const { menuTemplate } = require("./desktop-menu.cjs");
const { versionMismatch } = require("./desktop-core.cjs");

test("all shipped languages load native strings with English fallback and interpolation", () => {
  try {
    for (const language of supportedLanguages) {
      assert.equal(setLanguage(language), language);
      assert.equal(getLanguage(), language);
      assert.ok(t("menu.file"));
      const message = versionMismatch("1.0.0", "2.0.0").message;
      assert.ok(message.includes("1.0.0"));
      assert.ok(message.includes("2.0.0"));
      assert.ok(!message.includes("{{"));
    }
    assert.throws(() => setLanguage("../../en"));
    assert.throws(() => setLanguage("xx"));
  } finally {
    setLanguage("en");
  }
});

test("native menus explicitly translate every visible label and keep native roles", () => {
  for (const platform of ["darwin", "win32"]) {
    const seen = [];
    const template = menuTemplate({
      platform,
      appName: "Paint Vault",
      t: (key) => {
        seen.push(key);
        return `translated:${key}`;
      },
      openWebsite() {},
    });
    function check(items) {
      for (const item of items) {
        if (item.type === "separator") continue;
        assert.ok(item.label.startsWith("translated:menu."));
        if (item.submenu) check(item.submenu);
      }
    }
    check(template);
    assert.ok(seen.includes("menu.quit"));
    assert.ok(seen.includes("menu.copy"));
    assert.ok(seen.includes("menu.fullscreen"));
  }
});

test("per-device language survives restart and concurrent connection switches", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "paint-vault-language-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "client-connection.json");
  assert.equal((await createPreferences(file, "ja").read()).language, "ja");
  const preferences = createPreferences(file);
  assert.deepEqual(await preferences.read(), { mode: null, language: "en" });
  await writeFile(file, JSON.stringify({ mode: "remote", serverUrl: "https://vault.example.com" }));
  assert.equal((await preferences.read()).language, "en");
  await Promise.all([preferences.setLanguage("ja"), preferences.setConnection({ mode: "local" })]);
  assert.deepEqual(await createPreferences(file).read(), { mode: "local", language: "ja" });
  await Promise.all([
    preferences.setConnection({ mode: "remote", serverUrl: "https://vault.example.com" }),
    preferences.setLanguage("zh-Hant"),
  ]);
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), {
    mode: "remote",
    serverUrl: "https://vault.example.com",
    language: "zh-Hant",
  });
  await assert.rejects(preferences.setLanguage("xx"));
  assert.equal((await preferences.read()).language, "zh-Hant");
  await writeFile(file, "invalid json");
  assert.deepEqual(await preferences.read(), { mode: null, language: "en" });
});

test("OS locale detection chooses the same canonical language as the renderer", () => {
  for (const [input, expected] of [
    ["es-MX", "es"],
    ["pt-PT", "pt-BR"],
    ["zh-TW", "zh-Hant"],
    ["zh-HK", "zh-Hant"],
    ["zh-CN", "zh-Hans"],
    ["xx", "en"],
  ]) {
    assert.equal(resolveLanguage(input), expected);
  }
});
