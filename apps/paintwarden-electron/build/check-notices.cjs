const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Fail before signing/uploading any installer if the real packaged filesystem
// lost notices, the Chromium license, or libvips's replaceable shared library.
module.exports = async function checkNotices(context) {
  const root = path.resolve(__dirname, "../../..");
  const { checkNoticeArtifact } = await import(
    pathToFileURL(path.join(root, "scripts/check-notice-artifact.mjs")).href
  );
  const resources =
    context.electronPlatformName === "darwin"
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          "Contents",
          "Resources",
        )
      : path.join(context.appOutDir, "resources");
  await checkNoticeArtifact({ resources, root });
};
