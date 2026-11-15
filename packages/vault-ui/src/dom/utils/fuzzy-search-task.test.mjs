import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `
    export { createFuzzySearchTask } from "./fuzzy-search-task.ts";
    import { useFuzzySearch } from "./use-fuzzy-search.ts";
    import { createElement } from "react";
    import { renderToString } from "react-dom/server";
    export function renderSearch(items, getText) {
      function Fixture() { return createElement("div", {}, useFuzzySearch(items, "typo", getText).length); }
      return renderToString(createElement(Fixture));
    }
  `,
    resolveDir: fileURLToPath(new URL(".", import.meta.url)),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
// CommonJS React server bundles need Node builtins through createRequire.
const { createFuzzySearchTask, renderSearch } = await import(
  `data:text/javascript;base64,${Buffer.from(
    `import {createRequire} from 'node:module';const require=createRequire(${JSON.stringify(import.meta.url)});\n` +
      bundled.outputFiles[0].text,
  ).toString("base64")}`
);

test("render does no text extraction or fuzzy matching", () => {
  assert.match(
    renderSearch(["red", "blue"], () => {
      throw Error("work during render");
    }),
    />2</,
  );
});

test("fallback defers indexing, debounces input, reuses index and cancels disposal", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let texts = 0;
  const task = createFuzzySearchTask(["red", "blue"], (v) => {
    texts++;
    return v;
  });
  const results = [];
  task.search("r", undefined, (v) => results.push(v));
  task.search("blue", undefined, (v) => results.push(v));
  assert.equal(texts, 0);
  assert.deepEqual(results, []);
  t.mock.timers.tick(79);
  assert.equal(texts, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(results, [["blue"]]);
  assert.equal(texts, 2);
  task.search("red", 1, (v) => results.push(v));
  t.mock.timers.tick(80);
  assert.equal(texts, 2);
  assert.deepEqual(results[1], ["red"]);
  task.search("blue", 1, (v) => results.push(v));
  task.dispose();
  t.mock.timers.tick(100);
  assert.equal(results.length, 2);
});

test("worker receives table once, small debounced queries, rejects stale replies", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const sent = [],
    results = [];
  let terminated = false;
  const worker = {
    postMessage: (m) => sent.push(m),
    terminate: () => {
      terminated = true;
    },
  };
  const task = createFuzzySearchTask(["red", "blue"], String, () => worker);
  assert.deepEqual(sent, []);
  task.search("red", 1, (v) => results.push(v));
  t.mock.timers.tick(80);
  assert.deepEqual(sent[0], { texts: ["red", "blue"] });
  assert.deepEqual(sent[1], { request: 1, query: "red", limit: 1 });
  task.search("blue", 1, (v) => results.push(v));
  worker.onmessage({ data: { request: 1, indices: [0] } });
  assert.deepEqual(results, []);
  t.mock.timers.tick(80);
  worker.onmessage({ data: { request: 2, indices: [1] } });
  assert.deepEqual(results, [["blue"]]);
  assert.equal(sent.filter((m) => m.texts).length, 1);
  task.dispose();
  worker.onmessage({ data: { request: 2, indices: [1] } });
  assert.equal(results.length, 1);
  assert.equal(terminated, true);
});

test("worker startup failure falls back asynchronously and changed table gets fresh index", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const results = [];
  const first = createFuzzySearchTask(["red"], String, () => {
    throw Error("blocked worker");
  });
  first.search("red", 1, (v) => results.push(v));
  assert.deepEqual(results, []);
  t.mock.timers.tick(80);
  assert.deepEqual(results, [["red"]]);
  first.dispose();
  const second = createFuzzySearchTask(["blue"], String);
  second.search("blue", 1, (v) => results.push(v));
  t.mock.timers.tick(80);
  assert.deepEqual(results, [["red"], ["blue"]]);
  second.dispose();
});
