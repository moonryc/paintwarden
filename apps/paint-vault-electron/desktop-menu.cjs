// Explicit labels avoid Electron's implicit English-only default menu. Native role
// behavior and familiar keyboard accelerators are retained on both supported hosts.
function menuTemplate({ platform, appName, t, openWebsite }) {
  const item = (role, key = role, accelerator) => ({
    role,
    label: t(`menu.${key}`, { appName }),
    ...(accelerator ? { accelerator } : {}),
  });
  const separator = { type: "separator" };
  return [
    ...(platform === "darwin"
      ? [
          {
            label: t("menu.app", { appName }),
            submenu: [
              item("about"),
              separator,
              item("services"),
              separator,
              item("hide"),
              item("hideOthers"),
              item("unhide"),
              separator,
              item("quit"),
            ],
          },
        ]
      : []),
    { label: t("menu.file"), submenu: [item("close"), ...(platform === "darwin" ? [] : [item("quit")])] },
    {
      label: t("menu.edit"),
      submenu: [
        item("undo"),
        item("redo"),
        separator,
        item("cut"),
        item("copy"),
        item("paste"),
        item("delete"),
        separator,
        item("selectAll"),
      ],
    },
    {
      label: t("menu.view"),
      submenu: [
        item("reload"),
        item("forceReload"),
        item("toggleDevTools", "devTools"),
        separator,
        item("resetZoom"),
        item("zoomIn"),
        item("zoomOut"),
        separator,
        item("togglefullscreen", "fullscreen"),
      ],
    },
    {
      label: t("menu.window"),
      submenu: [item("minimize"), item("zoom"), ...(platform === "darwin" ? [separator, item("front")] : [])],
    },
    { label: t("menu.help"), submenu: [{ label: t("menu.website"), click: openWebsite }] },
  ];
}
module.exports = { menuTemplate };
