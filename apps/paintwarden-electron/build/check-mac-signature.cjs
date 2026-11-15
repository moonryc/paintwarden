const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { signingConfiguration } = require("../build-signing.cjs");

// This hook only verifies: never re-sign or downgrade a failed Developer ID build.
module.exports = async function checkMacSignature(context) {
  if (context.electronPlatformName !== "darwin") return;
  const { checkMacSignature } = await import(
    pathToFileURL(path.resolve(__dirname, "../../../scripts/check-mac-signature.mjs")).href
  );
  await checkMacSignature(
    path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`),
    { adhoc: !signingConfiguration("darwin", process.env).signed },
  );
  // Signing must preserve the notices and separately replaceable dynamic libvips.
  await require("./check-notices.cjs")(context);
};
