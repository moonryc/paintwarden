# Desktop window chrome

The desktop shell uses the shared `theme-shell.json` canvas and secondary-text
tokens for both `BrowserWindow.backgroundColor` and the renderer title strip.
The app currently has only a dark theme; OS light mode does not select a
nonexistent app theme. Web/server pages never enable the desktop strip.

On macOS, `titleBarStyle: hidden` retains native traffic lights at `{x:7,y:7}`.
The renderer recreates the 28px title strip with a centered system-font title;
it is **not** the native title text. This avoids a native addon: Electron's
normal macOS title bar cannot be recolored by `backgroundColor` alone.
Windows/Linux use the matching `titleBarOverlay` colors and native controls.

Space is reserved before the first React frame, including the connection
chooser and owner setup. Sidebar, sticky header, full-height screens and modal
roots honor the same inset. No toggle or page load changes this reservation.
Native focus/blur dims the title; fullscreen hides the strip and removes its
inset. The strip uses Electron's native draggable region, retaining native
window drag and title-bar gestures. The double-click IPC handler also honors
`AppleActionOnDoubleClick` (None, Minimize, or maximize/restore).

`npm run e2e:native` checks the actual packaged app with an isolated profile,
`PAINTWARDEN_E2E=1` and `--hidden`: exact strip pixel color, native button
position, focus/fullscreen event wiring and overflow. `capturePage` includes
the renderer strip, **not** the native traffic-light pixels. It does not certify
real pointer drag, OS double-click gestures or fullscreen Space transitions:
those require a visible manual acceptance pass. Tests never make the window
visible to perform them.

For the optional 13-locale desktop/phone acceptance matrix and screenshots:

```sh
node e2e/native-smoke.mjs --ui-quick3 --artifacts outputs/ui-quick3
```
