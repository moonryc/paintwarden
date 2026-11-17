import { colors } from "@paintwarden/ui/theme-tokens";
import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";

const chrome = window.paintwardenDesktop?.titleBar;
const height = chrome ? "28px" : "0px";
// Set before the first React frame; neither the connection chooser nor lazy pages
// can briefly render underneath the native window buttons.
document.documentElement.style.setProperty("--desktop-titlebar-height", height);

export function DesktopTitleBar() {
  const [state, setState] = useState({ focused: false, fullScreen: false });
  useEffect(() => {
    if (!chrome) return;
    let current = true;
    let eventReceived = false;
    const off = chrome.onState((value) => {
      eventReceived = true;
      setState(value);
    });
    void chrome
      .getState()
      .then((value) => {
        if (current && !eventReceived) setState(value);
      })
      .catch(() => undefined);
    return () => {
      current = false;
      off();
    };
  }, []);
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      "--desktop-titlebar-height",
      state.fullScreen ? "0px" : height,
    );
  }, [state.fullScreen]);
  if (!chrome || state.fullScreen) return null;
  return (
    <div
      aria-hidden="true"
      onDoubleClick={() => void chrome.doubleClick()}
      style={
        {
          position: "fixed",
          inset: "0 0 auto",
          height,
          zIndex: 2000,
          background: colors.surface,
          color: colors.inkSoft,
          display: "grid",
          placeItems: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 13,
          fontWeight: 400,
          userSelect: "none",
          WebkitAppRegion: "drag",
        } as CSSProperties
      }
    >
      <span style={{ opacity: state.focused ? 1 : 0.55 }}>Paintwarden</span>
    </div>
  );
}
