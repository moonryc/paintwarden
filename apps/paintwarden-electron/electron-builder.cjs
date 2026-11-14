const { readFileSync } = require("node:fs");
const { build, version } = require("./package.json");
const { signingConfiguration } = require("./build-signing.cjs");

const signing = signingConfiguration(process.platform, process.env);
Object.assign(process.env, signing.env);
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
  mac: { ...build.mac, notarize: signing.signed, ...(signing.signed ? {} : { identity: null }) },
  // GitHubProvider selects prereleases via its feed and stable releases via /latest.
  // Do not generate a latest.yml pointing to a beta or force a beta channel into stable builds.
  generateUpdatesFilesForAllChannels: false,
  ...(process.env.PAINTWARDEN_RELEASE_NOTES_FILE
    ? { releaseInfo: { releaseNotes: readFileSync(process.env.PAINTWARDEN_RELEASE_NOTES_FILE, "utf8") } }
    : {}),
};
