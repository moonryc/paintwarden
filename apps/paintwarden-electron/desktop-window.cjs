const path = require("node:path");

function windowOptions(platform, resources) {
  // One source for the MUI/CSS canvas and the native window's first frame.
  const colors = require(
    resources ? path.join(resources, "theme-shell.json") : "../../packages/vault-ui/src/dom/theme-shell.json",
  );
  return {
    backgroundColor: colors.canvas,
    titleBarStyle: "hidden",
    ...(platform === "darwin"
      ? { trafficLightPosition: { x: 7, y: 7 }, vibrancy: undefined }
      : { titleBarOverlay: { color: colors.canvas, symbolColor: colors.inkSoft, height: 28 } }),
  };
}

function windowState(window) {
  return { focused: window.isFocused(), fullScreen: window.isFullScreen() };
}

function titleBarDoubleClick(window, preferences) {
  const action = preferences.getUserDefault("AppleActionOnDoubleClick", "string");
  if (action === "Minimize") window.minimize();
  else if (action !== "None") {
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  }
}

module.exports = { windowOptions, windowState, titleBarDoubleClick };
