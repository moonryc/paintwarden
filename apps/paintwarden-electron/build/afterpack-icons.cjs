const { copyFile } = require("node:fs/promises");
const path = require("node:path");

// actool's .icon fallback omits large legacy representations. Keep the complete
// 16..1024px fallback without changing the modern Assets.car/CFBundleIconName.
module.exports = async function afterPackIcons(context) {
  if (!["darwin", "mas"].includes(context.electronPlatformName)) return;
  const resources = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    "Contents",
    "Resources",
  );
  await copyFile(path.join(__dirname, "icon.icns"), path.join(resources, "icon.icns"));
};
