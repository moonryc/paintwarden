const { readFileSync } = require("node:fs");
const { build, version } = require("./package.json");
const { signingConfiguration } = require("./build-signing.cjs");

const signing = signingConfiguration(process.platform, process.env);
Object.assign(process.env, signing.env);
// The ad-hoc signer still initializes builder's keychain info. An empty CSC_LINK
// is treated as a certificate filename (the workspace directory), not absence.
if (!signing.signed && process.platform === "darwin") delete process.env.CSC_LINK;
console.log(
  `Desktop packaging: ${signing.signed ? "signed" : "unsigned (complete signing secrets not configured)"}`,
);
module.exports = {
  ...build,
  publish: build.publish.map((provider) => ({
    ...provider,
    channel: version.includes("-beta.") ? "beta" : "latest",
  })),
  // Complete credentials must produce a signed build or fail, never silently unsigned.
  forceCodeSigning: signing.signed,
  // "-" runs builder's inside-out signer (including native extraResources), not Electron's
  // stale linker signature. It confers integrity, not Developer ID/Gatekeeper trust.
  afterSign: "build/check-mac-signature.cjs",
  afterPack: "build/afterpack.cjs",
  mac: {
    ...build.mac,
    icon: "build/icon.icon",
    notarize: signing.signed,
    ...(signing.signed ? {} : { identity: "-" }),
  },
  win: { ...build.win, icon: "build/icon.ico" },
  // GitHubProvider selects prereleases via its feed and stable releases via /latest.
  // Do not generate a latest.yml pointing to a beta or force a beta channel into stable builds.
  generateUpdatesFilesForAllChannels: false,
  ...(process.env.PAINTWARDEN_RELEASE_NOTES_FILE
    ? { releaseInfo: { releaseNotes: readFileSync(process.env.PAINTWARDEN_RELEASE_NOTES_FILE, "utf8") } }
    : {}),
};
