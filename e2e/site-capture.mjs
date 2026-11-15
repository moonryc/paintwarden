// Capture a real production app in a fresh, synthetic-only vault. Never uses a running app.
// npm run build && node e2e/site-capture.mjs [absolute artifacts directory]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import { chromium } from "playwright";
import { expect as playwrightExpect } from "playwright/test";
import sharp from "sharp";
import { buildSyntheticPlugin } from "../scripts/synthetic-plugin.mjs";

const expect = playwrightExpect.configure({ timeout: 20_000 });
const repo = fileURLToPath(new URL("../", import.meta.url));
const artifacts = path.resolve(
  process.argv[2] || (await mkdtemp(path.join(os.tmpdir(), "paintwarden-site-shots-"))),
);
await mkdir(artifacts, { recursive: true });
const dataDir = await mkdtemp(path.join(os.tmpdir(), "paintwarden-site-vault-"));
const id = (n) => `b1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const names = [
  "Harbor Sentinel",
  "Lantern Keeper",
  "Mosswood Scout",
  "Dune Walker",
  "Cloud Warden",
  "Copper Automaton",
  "Moonlit Ranger",
  "Winter Courier",
];
const palette = [
  ["Harbor Blue", "#2a4d8f"],
  ["Sky Highlight", "#6f9be0"],
  ["Midnight Ink", "#14233d"],
  ["Copper Glow", "#bf793d"],
  ["Sea Glass", "#5fa9a4"],
  ["Moss Velvet", "#537a51"],
  ["Parchment", "#e1d5ae"],
  ["Warm Slate", "#87919b"],
  ["Rose Ember", "#b65368"],
  ["Plum Dusk", "#68457c"],
  ["Golden Lantern", "#dbb34e"],
  ["Glacier", "#b7d9e7"],
  ["Terracotta", "#b05e45"],
  ["Pine Shadow", "#23473f"],
  ["Cloud White", "#f0eee3"],
  ["Volcanic Ash", "#33343b"],
  ["Citron Brass", "#505203"],
  ["Periwinkle", "#7081c1"],
  ["Deepwater", "#001f45"],
];
// Original procedural miniature dioramas. Geometry, colors and lighting are generated here;
// these are not photographs of anyone's miniature or manufacturer artwork.
async function photo(i) {
  const color = palette[(i * 2) % palette.length][1];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000">
  <defs>
    <radialGradient id="bg"><stop stop-color="#525d6a"/><stop offset="1" stop-color="#19212c"/></radialGradient>
    <linearGradient id="armor"><stop stop-color="#d1e0ee"/><stop offset=".22" stop-color="${color}"/><stop offset=".7" stop-color="${color}"/><stop offset="1" stop-color="#172738"/></linearGradient>
    <linearGradient id="gold"><stop stop-color="#f0d68b"/><stop offset=".4" stop-color="#a6823e"/><stop offset="1" stop-color="#493b25"/></linearGradient>
    <linearGradient id="cape"><stop stop-color="#294753"/><stop offset=".5" stop-color="#172a36"/><stop offset="1" stop-color="#334c58"/></linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="15"/></filter>
  </defs>
  <rect width="1200" height="1000" fill="url(#bg)"/>
  <ellipse cx="600" cy="888" rx="260" ry="45" fill="#090d13" opacity=".7" filter="url(#blur)"/>
  <path d="M380 805 Q600 740 820 805 L820 866 Q600 930 380 866Z" fill="#1b2025"/>
  <ellipse cx="600" cy="806" rx="220" ry="53" fill="#63635b"/>
  <path d="M420 800 l30 -17 50 12 55 -15 70 12 55 -5 77 20 -27 18 -110 17 -120 -10Z" fill="#8b8a78"/>
  <path d="M465 377 Q405 580 409 777 L566 816 723 785 Q710 576 678 382Z" fill="url(#cape)" stroke="#49606b" stroke-width="5"/>
  <path d="M480 735 l42 10 -18 81 -67 1 -7 -21Z" fill="url(#armor)" stroke="#1c2939" stroke-width="8"/>
  <path d="M633 728 l48 -3 44 80 -6 22 -76 2 -18 -32Z" fill="url(#armor)" stroke="#1c2939" stroke-width="8"/>
  <path d="M489 563 l70 11 -9 98 -29 83 -56 -12 23 -99Z M593 577 l72 -4 16 160 -51 14 -39 -97Z" fill="url(#armor)" stroke="#1c2939" stroke-width="8"/>
  <path d="M478 554 L577 594 681 554 665 625 579 651 490 610Z" fill="url(#gold)" stroke="#493e2c" stroke-width="6"/>
  <path d="M484 356 L659 356 690 488 656 564 578 591 495 554 462 480Z" fill="url(#armor)" stroke="#1b2e42" stroke-width="8"/>
  <path d="M500 365 l73 28 71 -27 -17 118 -53 27 -58 -28Z" fill="${color}" stroke="#8aacc5" stroke-width="4"/>
  <path d="M574 393 v108 M520 465 l54 27 53 -29" fill="none" stroke="#b9cbd7" stroke-width="3" opacity=".65"/>
  <path d="M552 426 l22 -28 23 28 -23 33Z" fill="url(#gold)"/>
  <ellipse cx="450" cy="391" rx="66" ry="52" fill="url(#armor)" stroke="#a48a4f" stroke-width="9"/>
  <ellipse cx="694" cy="391" rx="63" ry="52" fill="url(#armor)" stroke="#a48a4f" stroke-width="9"/>
  <path d="M415 427 l55 17 -14 103 -42 53 -36 -22 27 -74Z M681 436 l54 -11 30 104 -39 57 -31 -26 6 -49Z" fill="url(#armor)" stroke="#24364b" stroke-width="8"/>
  <path d="M401 577 l30 8 -20 46 -30 -9Z M714 562 l30 -3 13 34 -32 10Z" fill="url(#gold)"/>
  <path d="M737 310 l12 0 1 474 -16 0Z" fill="url(#gold)"/>
  <path d="M719 310 l24 -64 27 64 -27 24Z" fill="#d8dfd8" stroke="#a68947" stroke-width="6"/>
  <path d="M528 268 Q527 213 575 207 Q626 211 627 268 L617 331 577 358 539 328Z" fill="url(#armor)" stroke="#203249" stroke-width="8"/>
  <path d="M541 269 l31 11 41 -10 -6 21 -33 8 -31 -9Z" fill="#101d29"/>
  <path d="M548 277 l19 6 M584 284 l20 -6" stroke="#efcc76" stroke-width="7"/>
  <path d="M576 220 l-1 41 M550 319 l25 8 27 -10" fill="none" stroke="#9cb5ca" stroke-width="4"/>
  <path d="M565 208 l9 -65 12 66Z" fill="url(#gold)"/>
  <g fill="#b9b29a"><path d="M402 794 l12 -26 16 30Z"/><path d="M738 803 l15 -30 19 29Z"/></g>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function demoPlugin() {
  const files = {},
    assets = {},
    catalog = { paints: [], schemes: [], templates: [] };
  for (const [i, [name, colorHex]] of palette.entries())
    catalog.paints.push({
      id: id(i),
      name,
      brand: "Fable & Finch (fictional)",
      range: "Studio colors",
      type: "BASE",
      colorHex,
    });
  for (let i = 0; i < names.length; i++) {
    const bytes = await photo(i),
      name = `images/figure-${i}.png`;
    files[name] = bytes;
    assets[name] = { sha256: createHash("sha256").update(bytes).digest("hex") };
    const schemeId = id(100 + i);
    catalog.schemes.push({
      id: schemeId,
      name:
        ["Harbor patrol", "Copper lantern", "Mosswood expedition", "Desert dusk"][i % 4] +
        (i >= 4 ? " · alternate" : ""),
      category: "BLUE",
      entries: [
        { id: id(1000 + i * 10), type: "STEP", label: "BASECOAT" },
        { id: id(1001 + i * 10), type: "PAINT", paintId: id((i * 2) % 16) },
        { id: id(1002 + i * 10), type: "PAINT", paintId: id(3) },
        { id: id(1003 + i * 10), type: "STEP", label: "EDGE_HIGHLIGHT" },
        { id: id(1004 + i * 10), type: "PAINT", paintId: id(1) },
        { id: id(1005 + i * 10), type: "IMAGE", imageUrl: name },
      ],
    });
    catalog.templates.push({
      id: id(200 + i),
      name: names[i],
      manufacturer: "Imaginary Workshop",
      faction: "Clockwork coast",
      categories: ["Demo"],
      imageUrl: name,
      schemeIds: [schemeId],
      paints: [
        { paintId: id(2), step: "PRIMER", notes: "A thin, even undercoat", sortOrder: 0 },
        { paintId: id((i * 2) % 16), step: "BASECOAT", notes: "Two thin coats on the armor", sortOrder: 1 },
        { paintId: id(3), step: "DETAIL", notes: "Lantern, buckles and staff", sortOrder: 2 },
        { paintId: id(1), step: "EDGE_HIGHLIGHT", notes: "Catch the upper edges", sortOrder: 3 },
      ],
    });
  }
  files["source.json"] = Buffer.from(
    JSON.stringify({
      formatVersion: 1,
      name: "Fable & Finch · fictional demo",
      version: "1.0.0",
      license: "CC0-1.0",
      attribution: "Original procedural demo artwork; no manufacturer data or images",
      dependencies: [],
      catalog: "catalog.json",
      assets: "assets.json",
    }),
  );
  files["catalog.json"] = Buffer.from(JSON.stringify(catalog));
  files["assets.json"] = Buffer.from(JSON.stringify(assets));
  return zipSync(files);
}
const socket = net.createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const env = {
  ...process.env,
  NODE_ENV: "production",
  HOST: "127.0.0.1",
  PORT: String(port),
  DATA_DIR: dataDir,
};
for (const key of [
  "DATABASE_PATH",
  "PAINTWARDEN_DESKTOP",
  "PAINTWARDEN_TRUST_PROXY",
  "PAINTWARDEN_ALLOWED_HOSTS",
  "WEB_DIST",
])
  delete env[key];
let logs = "",
  browser;
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: path.join(repo, "apps/paintwarden/dist"),
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (b) => (logs += b));
child.stderr.on("data", (b) => (logs += b));
const timer = setTimeout(() => {
  child.kill();
  void browser?.close();
}, 240_000);
const checks = [],
  errors = [];
try {
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(Error("Readiness timeout: " + logs)), 30_000);
    child.stdout.on("data", () => {
      if (logs.includes('"phase":"ready"')) {
        clearTimeout(deadline);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(deadline);
      reject(Error("Server exit " + code + logs));
    });
  });
  browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await page.getByRole("textbox", { name: "Username", exact: true }).fill("demo-painter");
  await page.locator('input[autocomplete="new-password"]').fill("Fictional-vault-only-2026!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workbench", exact: true, level: 1 })).toBeVisible();
  const gql = async (query, variables = {}) => {
    const r = await page.request.post("/api/graphql", { data: { query, variables } });
    const b = await r.json();
    assert.equal(b.errors, undefined, JSON.stringify(b.errors));
    return b.data;
  };
  const demo = await demoPlugin();
  const install = await page.request.post("/api/catalog-sources", {
    data: Buffer.from(demo),
    headers: { "content-type": "application/zip" },
  });
  assert.equal(install.status(), 202, await install.text());
  await expect
    .poll(async () => {
      const job = (await gql("{ pluginInstallJob { stage error errorCode errorParameters{name value} } }"))
        .pluginInstallJob;
      if (job?.stage === "FAILED") throw Error(JSON.stringify(job));
      return job?.stage;
    })
    .toBe("SUCCEEDED");
  for (let i = 0; i < palette.length; i++)
    await gql(
      "mutation($id:ID!, $state:Ownership!){setPaintStock(paintId:$id,state:$state,stockLevel:FULL,quantity:1){revision{seq}}}",
      { id: id(i), state: [7, 10, 12].includes(i) ? "WISHLIST" : "OWNED" },
    );
  await gql('mutation { createFolder(kind:MINIATURE,name:"Clockwork coast"){revision{seq}} }');
  await gql('mutation { createFolder(kind:MINIATURE,name:"Next adventures"){revision{seq}} }');
  const folders = (await gql("{folderBrowser(kind:MINIATURE){folders{id name}}}")).folderBrowser.folders;
  const ids = [];
  for (let i = 0; i < names.length; i++) {
    const created = await gql(
      "mutation($input:MiniatureInput!){createMiniature(input:$input){miniatureId}}",
      {
        input: {
          title: names[i],
          templateId: id(200 + i),
          includeTemplateImage: true,
          status: i === 7 ? "WISHLIST" : "OWNED",
          paintingStatus: ["IN_PROGRESS", "PRIMED", "COMPLETE", "ASSEMBLED", "NOT_STARTED"][i % 5],
          notes: "A fictional clockwork traveler. Blue armor, warm copper details, soft edge highlights.",
          folderId: i < 3 ? folders[0].id : i === 7 ? folders[1].id : null,
        },
      },
    );
    ids.push(created.createMiniature.miniatureId);
  }
  const storage = await context.storageState();
  const largePath = path.join(artifacts, "synthetic-progress.zip");
  await writeFile(
    largePath,
    (await buildSyntheticPlugin({ paints: 300, schemes: 30, templates: 50, images: 650 })).zip,
  );
  const capture = async (p, name, phone) => {
    await p.mouse.move(0, 0);
    await p.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
    });
    await p.screenshot({
      path: path.join(artifacts, `${phone ? "phone-" : ""}${name}.png`),
      animations: "disabled",
    });
    checks.push(`${phone ? "phone" : "desktop"}: ${name}`);
    console.log(checks.at(-1));
  };
  const nav = async (p, label) => {
    const b = p.getByRole("button", {
      name: new RegExp(label === "Data & settings" ? label : `^${label}(?: |$)`),
    });
    if (!(await b.isVisible())) await p.getByRole("button", { name: "Open navigation", exact: true }).click();
    await b.click();
  };
  for (const phone of [false, true]) {
    const ctx = await browser.newContext({
      baseURL: `http://127.0.0.1:${port}`,
      storageState: storage,
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      deviceScaleFactor: phone ? 2 : 1,
      isMobile: phone,
      hasTouch: phone,
    });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.goto("/");
    await expect(p.getByRole("heading", { name: "Workbench", exact: true, level: 1 })).toBeVisible();
    const folderToggle = p.getByRole("button", { name: "Folder view", exact: true });
    if ((await folderToggle.getAttribute("aria-pressed")) !== "true") await folderToggle.click();
    await expect(p.getByText("Clockwork coast", { exact: true })).toBeVisible();
    await expect(p.getByText("Plugin installation finished", { exact: true })).toBeHidden();
    await capture(p, "workbench", phone);
    await p.getByTitle("Open Clockwork coast", { exact: true }).click();
    await p.getByText(names[0], { exact: true }).click();
    await expect(p.getByRole("button", { name: "Edit recipe", exact: true })).toBeVisible();
    await capture(p, "miniature", phone);
    await p.getByText("Paint recipe", { exact: true }).evaluate((e) => e.scrollIntoView({ block: "start" }));
    await capture(p, "recipe", phone);
    await p.getByRole("button", { name: "Edit recipe", exact: true }).click();
    await p.getByRole("button", { name: /Swatch Scan.*Beta/ }).click();
    const dialog = p.getByRole("dialog", { name: "Swatch Scan", exact: true });
    await expect(dialog.getByRole("button", { name: "Sample at crosshair" })).toBeEnabled();
    const photoBox = await dialog.getByRole("img", { name: names[0], exact: true }).boundingBox();
    for (const [x, y] of [
      [0.48, 0.43],
      [0.52, 0.24],
      [0.61, 0.62],
    ])
      await p.mouse.click(photoBox.x + photoBox.width * x, photoBox.y + photoBox.height * y);
    await expect(dialog.getByRole("list", { name: "Sample pins" }).getByRole("button")).toHaveCount(3);
    await capture(p, "scan", phone);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await p.getByRole("button", { name: "Close project", exact: true }).click();
    await nav(p, "Paint Tools");
    await p.locator("#paint-tool-complementary").click();
    await p.getByRole("combobox", { name: "Paint", exact: true }).fill("Harbor Blue");
    await p.getByRole("option", { name: /Harbor Blue/ }).click();
    await expect(p.getByText("Copper Glow", { exact: true }).first()).toBeVisible();
    if (phone)
      await p
        .getByText("Your palette", { exact: true })
        .evaluate((e) => e.scrollIntoView({ block: "center" }));
    await capture(p, "complement", phone);
    await p.locator("#paint-tool-convert").click();
    await p.getByRole("combobox").fill("Harbor patrol");
    await p.getByRole("option", { name: "Harbor patrol", exact: true }).click();
    await capture(p, "converter", phone);
    await nav(p, "Paints");
    await expect(p.getByText("Harbor Blue", { exact: true })).toBeVisible();
    await capture(p, "paints", phone);
    await nav(p, "Wishlist");
    await expect(p.getByRole("heading", { name: "Wishlist", exact: true, level: 1 })).toBeVisible();
    await capture(p, "wishlist", phone);
    await nav(p, "Schemes");
    await expect(p.getByText("Harbor patrol", { exact: true })).toBeVisible();
    await capture(p, "schemes", phone);
    await nav(p, "Data & settings");
    await expect(p.getByRole("heading", { name: "Data & settings", exact: true, level: 1 })).toBeVisible();
    await capture(p, "settings", phone);
    await p.getByRole("button", { name: "Manage plugins", exact: true }).click();
    const [chooser] = await Promise.all([
      p.waitForEvent("filechooser"),
      p
        .getByRole("dialog", { name: "Plugins", exact: true })
        .getByRole("button", { name: /Upload.*zip/i })
        .click(),
    ]);
    await chooser.setFiles(largePath);
    const progress = p.getByRole("progressbar", { name: "Plugin installation", exact: true });
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute("aria-valuenow", /[1-9]/);
    await capture(p, "plugins", phone);
    await p.getByRole("button", { name: "Cancel installation", exact: true }).click();
    await expect(progress).toBeHidden();
    await ctx.close();
  }
  assert.deepEqual(errors, []);
} finally {
  clearTimeout(timer);
  await browser?.close();
  child.kill("SIGTERM");
  await writeFile(
    path.join(artifacts, "capture-results.json"),
    JSON.stringify(
      {
        dataDir,
        checks,
        errors,
        source: "Production app, synthetic-only vault; procedural artwork generated by e2e/site-capture.mjs",
      },
      null,
      2,
    ),
  );
  await writeFile(path.join(artifacts, "server.log"), logs);
}
