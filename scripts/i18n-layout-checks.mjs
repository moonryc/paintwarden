import { languages } from "../packages/paint-i18n/languages.ts";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { flatten } from "./check-i18n.mjs";

export const root = fileURLToPath(new URL("..", import.meta.url));
export async function translationDictionary(language) {
  const directory = path.join(root, "packages/paint-i18n/locales", language === "en-XA" ? "en" : language);
  const pseudo = language === "en-XA" ? (await import("../packages/paint-i18n/runtime.ts")).pseudoText : null;
  const values = languages.map(({ name }) => name);
  for (const namespace of await readdir(directory)) {
    const translated = flatten(JSON.parse(await readFile(path.join(directory, namespace), "utf8")));
    const english = flatten(
      JSON.parse(await readFile(path.join(root, "packages/paint-i18n/locales/en", namespace), "utf8")),
    );
    for (const [key, text] of Object.entries(translated)) {
      if (pseudo || language === "en" || text !== english[key]) values.push(pseudo ? pseudo(text) : text);
    }
  }
  return [...new Set(values)];
}
// User/plugin titles are data, not translations. Inspect actual translated text
// nodes (including interpolated plurals), their own boxes AND clipping ancestors.
export function measureLayout(translations) {
  const dictionary = new Set(translations);
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = translations
    .filter(
      (text) =>
        text.includes("{{") &&
        [...text.matchAll(/\{\{([^,}]+).*?\}\}/g)].every(([, name]) =>
          /^(count|total|available|owned|needed|quantity|amount|percent|index)$/.test(name.trim()),
        ),
    )
    .map(
      (text) =>
        new RegExp(
          "^" +
            text
              .split(/\{\{.*?\}\}/)
              .map(escape)
              .join("[\\s\\S]+?") +
            "$",
        ),
    );
  const clipped = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (!text || (!dictionary.has(text) && !patterns.some((pattern) => pattern.test(text)))) continue;
    const element = node.parentElement;
    if (!element?.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const textRect = range.getBoundingClientRect();
    if (!textRect.width || !textRect.height) continue;
    let violation = null;
    let visuallyHidden = false;
    for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const rect = ancestor.getBoundingClientRect();
      if (rect.width <= 2 && rect.height <= 2) {
        visuallyHidden = true;
        break;
      }
      const ownOverflow =
        ancestor === element &&
        ancestor.clientWidth > 0 &&
        !["inline", "contents"].includes(style.display) &&
        ancestor.scrollWidth > ancestor.clientWidth + 2;
      const ancestorClip =
        /hidden|clip/.test(style.overflowX) &&
        (textRect.left < rect.left - 2 || textRect.right > rect.right + 2);
      if (ownOverflow || ancestorClip)
        violation ??= {
          text,
          tag: element.tagName,
          width: Math.round(rect.width),
          contentWidth: Math.round(textRect.width),
          whiteSpace: style.whiteSpace,
          overflow: style.overflowX,
          clippedBy: ancestor.tagName,
        };
    }
    if (violation && !visuallyHidden) clipped.push(violation);
  }
  return {
    language: document.documentElement.lang,
    width: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    clipped,
    unresolvedKeys:
      document.body.innerText.match(
        /\b(?:shell|pages|components|errors):[A-Za-z]\w*|\blayout(?:Workbench|Collection|Miniatures|Paints|Wishlist|Painting|Schemes|Templates|PaintTools)\b/g,
      ) ?? [],
  };
}
export async function platformFonts(page, selector) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (!nodeId) return [];
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    return fonts;
  } finally {
    await cdp.detach();
  }
}
