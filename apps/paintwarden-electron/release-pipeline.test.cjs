const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { SemVer } = require("semver");
const { GitHubProvider } = require("electron-updater/out/providers/GitHubProvider");
const { createUpdater } = require("./desktop-update.cjs");
const { plainReleaseNotes } = require("./desktop-release-notes.cjs");
const { signingConfiguration } = require("./build-signing.cjs");

function updaterFor(version) {
  const autoUpdater = new EventEmitter();
  createUpdater({ autoUpdater, currentVersion: version, enabled: true, onChange() {} });
  autoUpdater.currentVersion = new SemVer(version);
  return autoUpdater;
}
for (const [version, channel, allowPrerelease] of [
  ["1.0.0-beta.1", "beta", true],
  ["1.0.0", "latest", false],
]) {
  test(`${version} configures the correct updater channel without downgrades`, () => {
    const updater = updaterFor(version);
    assert.equal(updater.channel, channel);
    assert.equal(updater.allowPrerelease, allowPrerelease);
    assert.equal(updater.allowDowngrade, false);
  });
}
// Exercise the locked library's REAL provider: stubbing just network bytes, not selection logic.
async function resolveFeed(version, tags, latestStable) {
  const requests = [];
  const provider = new GitHubProvider(
    { provider: "github", owner: "moonryc", repo: "paintwarden" },
    updaterFor(version),
    {
      platform: "win32",
      executor: {
        request: async (options) => {
          const requestPath = options.path;
          requests.push(requestPath);
          if (requestPath.endsWith(".atom"))
            return `<feed>${tags.map((tag) => `<entry><title>${tag}</title><link href="https://github.com/moonryc/paintwarden/releases/tag/v${tag}"/><content>Notes</content></entry>`).join("")}</feed>`;
          if (requestPath.endsWith("/latest")) return JSON.stringify({ tag_name: `v${latestStable}` });
          const tag = /\/download\/v([^/]+)\//.exec(requestPath)?.[1];
          assert.ok(tag, `unexpected network request ${requestPath}`);
          // Stable artifacts have latest.yml only: beta clients must successfully follow promotion.
          if (tag === latestStable && requestPath.endsWith("/beta.yml")) {
            const { HttpError } = require("builder-util-runtime");
            throw new HttpError(404, "Not Found");
          }
          return `version: ${tag}\nfiles:\n  - url: Paintwarden.exe\n    sha512: synthetic\n`;
        },
      },
    },
  );
  return { result: await provider.getLatestVersion(), requests };
}
test("stable GitHub installs ignore newer beta releases", async () => {
  const { result, requests } = await resolveFeed("1.0.0", ["1.2.0-beta.1", "1.1.0"], "1.1.0");
  assert.equal(result.version, "1.1.0");
  assert.ok(requests.some((p) => p.endsWith("/latest")));
  assert.ok(!requests.some((p) => p.includes("/download/v1.2.0-beta.1/")));
});
test("beta GitHub installs take later betas, skip alpha", async () => {
  const { result, requests } = await resolveFeed(
    "1.0.0-beta.1",
    ["1.0.0-alpha.9", "1.0.0-beta.2", "0.9.0"],
    "0.9.0",
  );
  assert.equal(result.version, "1.0.0-beta.2");
  assert.ok(requests.some((p) => p.endsWith("/v1.0.0-beta.2/beta.yml")));
});
test("a beta install can graduate to stable, using the provider's latest.yml fallback", async () => {
  const { result, requests } = await resolveFeed("1.0.0-beta.2", ["1.0.0", "1.0.0-beta.2"], "1.0.0");
  assert.equal(result.version, "1.0.0");
  assert.ok(requests.some((p) => p.endsWith("/v1.0.0/latest.yml")));
});
test("release notes accept HTML, Markdown and arrays and remain bounded plain text", () => {
  assert.equal(
    plainReleaseNotes("<p>Hi &amp; bye</p><script>alert(1)</script><p>&#x1f3a8; &#39;paint&#39;</p>"),
    "Hi & bye\n🎨 'paint'",
  );
  assert.equal(
    plainReleaseNotes([{ version: "2", note: "## Hello" }, { note: "World" }]),
    "## Hello\n\nWorld",
  );
  assert.equal(plainReleaseNotes({ html: "ignored" }), "");
  assert.equal(plainReleaseNotes("x".repeat(100000)).length, 16000);
  assert.equal(plainReleaseNotes("&#99999999;\u0000"), "");
});
test("updater transports notes for the selected version and clears stale notes", () => {
  const autoUpdater = new EventEmitter();
  const updater = createUpdater({ autoUpdater, currentVersion: "1.0.0", enabled: true, onChange() {} });
  autoUpdater.emit("update-available", { version: "2.0.0", releaseNotes: "<p>Hello</p>" });
  assert.equal(updater.state().releaseNotes, "Hello");
  autoUpdater.emit("update-available", { version: "2.1.0" });
  assert.equal(updater.state().releaseNotes, "");
});
for (const platform of ["darwin", "win32"]) {
  test(`${platform} defaults unsigned with absent or partial secrets`, () => {
    for (const env of [
      {},
      {
        MAC_CERTIFICATE_P12_BASE64: "partial",
        APPLE_ID: "partial",
        WINDOWS_CERTIFICATE_P12_BASE64: "partial",
      },
    ]) {
      const config = signingConfiguration(platform, env);
      assert.equal(config.signed, false);
      assert.equal(config.env.CSC_LINK, "");
      assert.equal(config.env.APPLE_ID, "");
      assert.equal(config.env.CSC_IDENTITY_AUTO_DISCOVERY, "false");
    }
  });
  test(`${platform} opts in with a complete signing set`, () => {
    const env = Object.fromEntries(
      [
        "MAC_CERTIFICATE_P12_BASE64",
        "MAC_CERTIFICATE_PASSWORD",
        "APPLE_ID",
        "APPLE_APP_SPECIFIC_PASSWORD",
        "APPLE_TEAM_ID",
        "WINDOWS_CERTIFICATE_P12_BASE64",
        "WINDOWS_CERTIFICATE_PASSWORD",
      ].map((key) => [key, `synthetic-${key}`]),
    );
    const config = signingConfiguration(platform, env);
    assert.equal(config.signed, true);
    assert.match(config.env.CSC_LINK, /^synthetic-/);
    assert.equal(config.env.APPLE_ID, platform === "darwin" ? env.APPLE_ID : "");
  });
}

test("remote compatibility recognizes exact beta versions and reports the correct update side", () => {
  const { versionMismatch } = require("./desktop-core.cjs");
  assert.equal(versionMismatch("1.0.0-beta.1", "1.0.0-beta.1"), null);
  assert.equal(versionMismatch("1.0.0-beta.2", "1.0.0-beta.1").update, "server");
  assert.equal(versionMismatch("1.0.0-beta.2", "1.0.0-beta.10").update, "app");
  assert.equal(versionMismatch("1.0.0", "1.0.0-beta.10").update, "server");
  assert.equal(versionMismatch("1.0.0-beta.10", "1.0.0").update, "app");
});

// Verify the actual config consumed by builder, isolated from any host credentials.
for (const releaseVersion of ["1.0.0-beta.1", "1.0.0"]) {
  for (const platform of ["darwin", "win32"]) {
    for (const signed of [false, true]) {
      test(`${releaseVersion} ${platform} builder config enforces its ${signed ? "signed" : "unsigned"} policy`, () => {
        const env = Object.fromEntries(
          ["PATH", "SystemRoot", "TEMP", "TMP", "HOME"]
            .filter((key) => process.env[key])
            .map((key) => [key, process.env[key]]),
        );
        Object.assign(env, {
          CSC_NAME: "unrelated",
          WIN_CSC_LINK: "unrelated",
          WIN_CSC_KEY_PASSWORD: "unrelated",
        });
        if (signed) {
          for (const key of [
            "MAC_CERTIFICATE_P12_BASE64",
            "MAC_CERTIFICATE_PASSWORD",
            "APPLE_ID",
            "APPLE_APP_SPECIFIC_PASSWORD",
            "APPLE_TEAM_ID",
            "WINDOWS_CERTIFICATE_P12_BASE64",
            "WINDOWS_CERTIFICATE_PASSWORD",
          ])
            env[key] = `synthetic-${key}`;
        }
        const child = spawnSync(
          process.execPath,
          [
            "-e",
            `
        Object.defineProperty(process, "platform", { value: ${JSON.stringify(platform)} });
        require(${JSON.stringify(require.resolve("./package.json"))}).version = ${JSON.stringify(releaseVersion)};
        const config = require(${JSON.stringify(require.resolve("./electron-builder.cjs"))});
        console.log(JSON.stringify({ force: config.forceCodeSigning, mac: config.mac,
          link: process.env.CSC_LINK, discovery: process.env.CSC_IDENTITY_AUTO_DISCOVERY, name: process.env.CSC_NAME,
          winLink: process.env.WIN_CSC_LINK, winPassword: process.env.WIN_CSC_KEY_PASSWORD,
          channel: config.publish[0].channel, fanout: config.generateUpdatesFilesForAllChannels }));
      `,
          ],
          { env, encoding: "utf8" },
        );
        assert.equal(child.status, 0, child.stderr);
        const config = JSON.parse(child.stdout.trim().split("\n").at(-1));
        assert.equal(config.force, signed);
        if (platform === "darwin")
          assert.equal(config.link, signed ? "synthetic-MAC_CERTIFICATE_P12_BASE64" : undefined);
        assert.equal(config.discovery, signed && platform === "darwin" ? "true" : "false");
        assert.equal(config.name, "");
        assert.equal(
          config.winLink,
          signed && platform === "win32" ? "synthetic-WINDOWS_CERTIFICATE_P12_BASE64" : "",
        );
        assert.equal(
          config.winPassword,
          signed && platform === "win32" ? "synthetic-WINDOWS_CERTIFICATE_PASSWORD" : "",
        );
        assert.equal(config.channel, releaseVersion.includes("-beta.") ? "beta" : "latest");
        assert.equal(config.fanout, false);
        if (platform === "darwin") {
          assert.equal(config.mac.notarize, signed);
          assert.equal(config.mac.identity, signed ? undefined : "-");
        }
      });
    }
  }
}

test("locked builder can discover a supplied Mac identity only in the signed policy", async () => {
  // Seed builder's own cached security output, not its identity-selection logic:
  // no /usr/bin/security invocation, keychain mutation or real certificate required.
  const signer = require("app-builder-lib/out/codeSign/macCodeSign");
  const previousCache = signer.findIdentityRawResult;
  const previousDiscovery = process.env.CSC_IDENTITY_AUTO_DISCOVERY;
  const previousName = process.env.CSC_NAME;
  const complete = Object.fromEntries(
    [
      "MAC_CERTIFICATE_P12_BASE64",
      "MAC_CERTIFICATE_PASSWORD",
      "APPLE_ID",
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_TEAM_ID",
    ].map((key) => [key, "synthetic"]),
  );
  try {
    signer.findIdentityRawResult = Promise.resolve([
      '0000000000000000000000000000000000000000 "Developer ID Application: Synthetic Test (SYNTHETIC)"',
    ]);
    delete process.env.CSC_NAME;
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = signingConfiguration(
      "darwin",
      complete,
    ).env.CSC_IDENTITY_AUTO_DISCOVERY;
    const found = await signer.findIdentity("Developer ID Application");
    assert.equal(found.name, "Developer ID Application: Synthetic Test (SYNTHETIC)");
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = signingConfiguration(
      "darwin",
      {},
    ).env.CSC_IDENTITY_AUTO_DISCOVERY;
    assert.equal(await signer.findIdentity("Developer ID Application"), null);
  } finally {
    signer.findIdentityRawResult = previousCache;
    for (const [key, value] of [
      ["CSC_IDENTITY_AUTO_DISCOVERY", previousDiscovery],
      ["CSC_NAME", previousName],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("locked Windows builder receives the selected certificate and password, never ambient aliases", () => {
  require("app-builder-lib"); // Initialize the library entry point before its mutually dependent packagers.
  const { PlatformPackager } = require("app-builder-lib/out/platformPackager");
  const { WinPackager } = require("app-builder-lib/out/winPackager");
  const fake = { info: { config: {} }, platformSpecificBuildOptions: {} };
  const complete = {
    WINDOWS_CERTIFICATE_P12_BASE64: "synthetic-certificate",
    WINDOWS_CERTIFICATE_PASSWORD: "synthetic-password",
  };
  const keys = Object.keys(signingConfiguration("win32", complete).env);
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, signingConfiguration("win32", complete).env);
    assert.equal(PlatformPackager.prototype.getCscLink.call(fake, "WIN_CSC_LINK"), "synthetic-certificate");
    assert.equal(WinPackager.prototype.doGetCscPassword.call(fake), "synthetic-password");
    Object.assign(process.env, signingConfiguration("win32", {}).env);
    assert.equal(PlatformPackager.prototype.getCscLink.call(fake, "WIN_CSC_LINK"), "");
    assert.equal(WinPackager.prototype.doGetCscPassword.call(fake), "");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("locked Mac builder resolves explicit ad-hoc identity with an empty keychain", async () => {
  require("app-builder-lib");
  const { MacTargetHelper } = require("app-builder-lib/out/mac/MacTargetHelper");
  const signer = require("app-builder-lib/out/codeSign/macCodeSign");
  const previousCache = signer.findIdentityRawResult;
  const previous = process.env.CSC_IDENTITY_AUTO_DISCOVERY;
  try {
    // An explicit qualifier (including "-") queries builder's identity cache even
    // with discovery disabled. Seed the real cache, not identity-selection logic,
    // so Linux/Windows tests never invoke the macOS-only security executable.
    signer.findIdentityRawResult = Promise.resolve([]);
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
    const helper = new MacTargetHelper({ forceCodeSigning: false });
    const identity = await helper.findSigningIdentity(false, false, "-", undefined, {
      hardenedRuntime: true,
    });
    assert.equal(identity.name, "-");
    assert.equal(identity.hash, undefined);
  } finally {
    signer.findIdentityRawResult = previousCache;
    if (previous === undefined) delete process.env.CSC_IDENTITY_AUTO_DISCOVERY;
    else process.env.CSC_IDENTITY_AUTO_DISCOVERY = previous;
  }
});
