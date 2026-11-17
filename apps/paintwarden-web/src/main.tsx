import Vault from "@paintwarden/ui";
import { LanguageProvider } from "@paintwarden/ui/i18n";
import { createRoot } from "react-dom/client";

import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff2?url";
import inter700 from "@fontsource/inter/files/inter-latin-700-normal.woff2?url";
import fraunces from "@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url";

import DesktopConnection from "./desktop-connection";
import { DesktopTitleBar } from "./desktop-titlebar";

for (const [family, source, weight] of [
  ["Inter", inter400, "400"],
  ["Inter", inter600, "600"],
  ["Inter", inter700, "700"],
  ["Fraunces", fraunces, "100 900"],
] as const) {
  void new FontFace(family, `url(${source})`, { weight })
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => undefined);
}

if (window.paintwardenDesktop?.titleBar) {
  const chromeStyles = document.createElement("style");
  chromeStyles.textContent = `
  body { padding-top: var(--desktop-titlebar-height, 0px) !important; }
  .MuiModal-root { top: var(--desktop-titlebar-height, 0px) !important; }
`;
  document.head.append(chromeStyles);
}

const webPage = ["http:", "https:"].includes(location.protocol) && !window.paintwardenDesktop;

if (webPage && import.meta.env.DEV && "serviceWorker" in navigator) {
  Promise.all([
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))),
    "caches" in window
      ? caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys.filter((key) => key.startsWith("paintwarden-shell")).map((key) => caches.delete(key)),
            ),
          )
      : Promise.resolve(),
  ])
    .then(() => {
      if (navigator.serviceWorker.controller && !sessionStorage.getItem("paintwarden-dev-cache-reset")) {
        sessionStorage.setItem("paintwarden-dev-cache-reset", "1");
        location.reload();
      }
    })
    .catch(() => undefined);
} else if (webPage && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <DesktopTitleBar />
    {window.paintwardenDesktop ? <DesktopConnection bridge={window.paintwardenDesktop} /> : <Vault />}
  </LanguageProvider>,
);
