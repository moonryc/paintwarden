import assert from "node:assert/strict";
import path from "node:path";
import http from "node:http";
import { expect as playwrightExpect } from "playwright/test";
import sharp from "sharp";

const expect = playwrightExpect.configure({ timeout: 15000 });
async function navigate(page, name) {
  const menu = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await menu.isVisible()) await menu.click();
  if (name === "Settings") {
    await page.getByRole("button", { name: /Data & settings/ }).click();
    await page.getByRole("heading", { name: "Data & settings", exact: true, level: 1 }).waitFor();
    return;
  }
  await page
    .getByRole("navigation", { name: "Primary", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
  await page.getByRole("heading", { name, exact: true, level: 1 }).waitFor();
}

// Runs only against a packaged app with its isolated temporary vault. The phone
// window has a separate, nonpersistent Electron session and NO desktop preload.
export async function runPhoneAccessFlow({ application, page, artifacts, record }) {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await navigate(page, "Settings");
  const toggle = page.getByRole("switch", { name: "Allow access from my other devices", exact: true });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  const state = await page.evaluate(() => window.paintwardenDesktop.getPhoneAccess());
  assert.equal(state.enabled, true);
  assert.ok(state.addresses.length, "Native fixture needs a LAN interface");
  const address = state.addresses.find((url) => !url.includes("100.")) ?? state.addresses[0];
  await page.getByRole("radio", { name: address, exact: true }).check();
  await expect(page.getByRole("img", { name: /QR code/ })).toHaveAttribute("src", /^data:image\/png;base64,/);
  await toggle.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, "settings-qr-1440.png"), animations: "disabled" });
  record("Desktop Settings enables a LAN listener and renders a locally generated QR code");

  // Disabling the desktop's optional sign-in must never make LAN data public.
  const signInOff = await page.evaluate(
    async () =>
      (
        await fetch("/api/auth/settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requireSignIn: false }),
        })
      ).status,
  );
  assert.equal(signInOff, 200);
  assert.equal(
    (
      await fetch(`${address}/api/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "{vaultRevision{epoch seq}}" }),
      })
    ).status,
    401,
  );
  assert.equal((await fetch(`${address}/api/auth/status`)).status, 200);
  assert.equal(
    (await fetch(`${address}/api/auth/status`).then((response) => response.json())).requireSignIn,
    true,
  );
  assert.equal(
    (await fetch(`${address}/api/auth/status`, { headers: { origin: "https://outside.example" } })).status,
    403,
  );
  assert.equal(
    await new Promise((resolve, reject) => {
      http
        .get(`${address}/api/auth/status`, { headers: { host: "rebind.example" } }, (response) => {
          response.resume();
          resolve(response.statusCode);
        })
        .on("error", reject);
    }),
    403,
  );
  record(
    "LAN always requires the same account, including when desktop sign-in is off; foreign hosts/origins refused",
  );

  const opening = application.waitForEvent("window");
  await application.evaluate(({ BrowserWindow }, url) => {
    const phone = new BrowserWindow({
      show: false,
      width: 390,
      height: 844,
      webPreferences: {
        partition: `phone-access-${Date.now()}`,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    void phone.loadURL(url);
  }, address);
  const phone = await opening;
  phone.setDefaultTimeout(15000);
  const errors = [];
  phone.on("pageerror", (error) => errors.push(error.message));
  const streams = [];
  phone.on("requestfailed", (request) =>
    console.error("Phone request failed:", new URL(request.url()).pathname, request.failure()),
  );
  phone.on("response", (response) => {
    if (response.status() >= 400)
      console.error("Phone HTTP failure:", new URL(response.url()).pathname, response.status());
    if (response.url().includes("/api/graphql/stream")) streams.push(response.status());
  });
  try {
    await phone.setViewportSize({ width: 390, height: 844 });
    assert.equal(await phone.evaluate(() => typeof window.paintwardenDesktop), "undefined");
    await phone.getByRole("textbox", { name: "Username", exact: true }).fill("native-smoke-owner");
    await phone.locator('input[autocomplete="current-password"]').fill("Synthetic-native-smoke-2026!");
    await phone.getByRole("button", { name: "Sign in", exact: true }).click();
    await phone.getByRole("heading", { name: "Workbench", exact: true, level: 1 }).waitFor();
    const cookies = await application.evaluate(({ BrowserWindow }) => {
      const phone = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().startsWith("http://"),
      );
      return phone?.webContents.session.cookies.get({ name: "pv_session" }) ?? [];
    });
    assert.equal(cookies.length, 1);
    assert.equal(cookies[0].httpOnly, true);
    assert.equal(cookies[0].secure, false, "HTTP LAN cookies cannot be Secure");
    record(
      "Independent phone browser session signs in over LAN using the desktop account and HTTP-safe HttpOnly cookie",
    );

    await navigate(phone, "Miniatures");
    const title = "Phone access scout";
    const created = await page.evaluate(async (title) => {
      const response = await fetch("/api/miniatures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error(`Create miniature HTTP ${response.status}`);
      return response.json();
    }, title);
    await expect(phone.getByText(title, { exact: true })).toBeVisible();
    assert.ok(streams.includes(200), "Phone opens the same-origin SSE subscription");
    record("Desktop mutation appears live in the phone's existing view via same-origin SSE");

    const photo = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#427ea8" } })
      .png()
      .toBuffer();
    const upload = await phone.evaluate(
      async ({ id, bytes }) => {
        const form = new FormData();
        form.append("image", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "phone-photo.png");
        return (await fetch(`/api/miniatures/${id}/image`, { method: "POST", body: form })).status;
      },
      { id: created.id, bytes: [...photo] },
    );
    assert.equal(upload, 200);
    await phone.getByText(title, { exact: true }).click();
    const scan = phone.getByRole("button", { name: "Swatch Scan Beta", exact: true });
    await expect(scan).toBeEnabled();
    await scan.click();
    const dialog = phone.getByRole("dialog", { name: "Swatch Scan", exact: true });
    const image = dialog.getByRole("img", { name: title, exact: true });
    await expect(dialog.getByRole("button", { name: "Sample at crosshair" })).toBeEnabled();
    assert.equal(await image.evaluate((img) => new URL(img.src).origin === location.origin), true);
    await image.scrollIntoViewIfNeeded();
    const box = await image.boundingBox();
    assert.ok(box);
    await phone.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(dialog.getByRole("heading", { name: /^Sampled color:/ })).toContainText("#427ea8", {
      ignoreCase: true,
    });
    await phone.screenshot({
      path: path.join(artifacts, "phone-swatch-scan-390.png"),
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await phone.screenshot({ path: path.join(artifacts, "phone-view-390.png"), animations: "disabled" });
    record(
      "Phone LAN upload, authenticated image rendering and untainted same-origin Swatch Scan sampling work at 390px",
    );
    assert.deepEqual(errors, []);

    await toggle.click();
    await expect(toggle).not.toBeChecked();
    assert.equal((await page.evaluate(() => window.paintwardenDesktop.getPhoneAccess())).enabled, false);
    await assert.rejects(fetch(`${address}/api/auth/status`, { signal: AbortSignal.timeout(3000) }));
    await expect(page.getByRole("img", { name: /QR code/ })).toHaveCount(0);
    record("Disabling access immediately closes the LAN listener and removes the QR; desktop stays usable");
  } catch (error) {
    await phone.screenshot({ path: path.join(artifacts, "phone-failure.png") });
    console.error("Phone failure UI:", await phone.locator("body").innerText());
    console.error(
      "Phone auth:",
      await phone.evaluate(async () => {
        const r = await fetch("/api/auth/status");
        return r.json();
      }),
    );
    throw error;
  } finally {
    await phone.close();
  }
}
