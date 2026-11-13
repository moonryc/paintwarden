import assert from "node:assert/strict";
import test from "node:test";

import { QueryClient, QueryObserver } from "@tanstack/react-query";

import { TEMPLATES_QUERY, templateCatalogOptions, templateRecipeOptions } from "./template-query.ts";

const headers = () => ({ authorization: "Bearer fixture" });
const catalog = { sourceVersion: null, categories: [], templates: [{ id: "user:one", name: "One" }] };

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

test("catalog consumers share one request and reuse the cache after unmount", async (t) => {
  const queryClient = client();
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    requests += 1;
    assert.equal(init.headers.authorization, "Bearer fixture");
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json(catalog);
  });
  try {
    const options = templateCatalogOptions(headers);
    const [page, picker] = await Promise.all([
      queryClient.fetchQuery(options),
      queryClient.fetchQuery(options),
    ]);
    assert.strictEqual(page, picker);
    assert.strictEqual(await queryClient.fetchQuery(options), page);
    assert.equal(requests, 1);
    assert.equal(options.gcTime, Infinity);
  } finally {
    queryClient.clear();
  }
});

test("recipes load only on selection, use an independent key, and invalidate with summaries", async (t) => {
  const queryClient = client();
  const urls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    urls.push(url);
    return Response.json(url.endsWith("/recipe") ? { schemeIds: ["s"], paints: [] } : catalog);
  });
  try {
    await queryClient.fetchQuery(templateCatalogOptions(headers));
    assert.deepEqual(urls, ["/api/miniature-templates"]);
    const recipe = await queryClient.fetchQuery(templateRecipeOptions("user:one/two", headers));
    assert.deepEqual(recipe, { schemeIds: ["s"], paints: [] });
    assert.equal(urls[1], "/api/miniature-templates/user%3Aone%2Ftwo/recipe");
    await queryClient.invalidateQueries({ queryKey: TEMPLATES_QUERY });
    for (const query of queryClient.getQueryCache().findAll({ queryKey: TEMPLATES_QUERY })) {
      assert.equal(query.state.isInvalidated, true);
    }
    await queryClient.fetchQuery(templateCatalogOptions(headers));
    await queryClient.fetchQuery(templateRecipeOptions("user:one/two", headers));
    assert.equal(urls.length, 4);
  } finally {
    queryClient.clear();
  }
});

test("active consumers refresh together; separate vault clients never share template data", async (t) => {
  const first = client();
  const second = client();
  let revision = 1;
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests += 1;
    return Response.json({ ...catalog, sourceVersion: revision });
  });
  const options = templateCatalogOptions(headers);
  const page = new QueryObserver(first, options);
  const picker = new QueryObserver(first, options);
  const unsubPage = page.subscribe(() => {});
  const unsubPicker = picker.subscribe(() => {});
  try {
    await first.fetchQuery(options);
    assert.equal(requests, 1);
    revision = 2;
    await first.invalidateQueries({ queryKey: TEMPLATES_QUERY });
    assert.equal(page.getCurrentResult().data.sourceVersion, 2);
    assert.equal(picker.getCurrentResult().data.sourceVersion, 2);
    assert.equal(requests, 2);
    await second.fetchQuery(options);
    assert.equal(requests, 3);
    assert.notStrictEqual(first.getQueryData(options.queryKey), second.getQueryData(options.queryKey));
  } finally {
    unsubPage();
    unsubPicker();
    first.clear();
    second.clear();
  }
});

test("account reset cancels an old recipe response and discards inactive account data", async (t) => {
  const queryClient = client();
  let resolve;
  let signal;
  t.mock.method(globalThis, "fetch", (_url, init) => {
    signal = init.signal;
    return new Promise((done) => {
      resolve = done;
    });
  });
  try {
    queryClient.setQueryData(templateCatalogOptions(headers).queryKey, catalog);
    const options = templateRecipeOptions("user:one", headers);
    const pending = queryClient.fetchQuery(options).catch(() => undefined);
    await queryClient.resetQueries({ queryKey: TEMPLATES_QUERY });
    assert.equal(signal.aborted, true);
    assert.equal(queryClient.getQueryData(templateCatalogOptions(headers).queryKey), undefined);
    resolve(Response.json({ schemeIds: ["old-account"], paints: [] }));
    await pending;
    assert.equal(queryClient.getQueryData(options.queryKey), undefined);
  } finally {
    queryClient.clear();
  }
});

test("failed requests surface an error and can retry", async (t) => {
  const queryClient = client();
  let ok = false;
  t.mock.method(globalThis, "fetch", async () =>
    ok ? Response.json(catalog) : new Response("failed", { status: 500 }),
  );
  try {
    const options = templateCatalogOptions(headers);
    await assert.rejects(queryClient.fetchQuery(options), /Could not load miniature templates/);
    ok = true;
    assert.deepEqual(await queryClient.fetchQuery(options), catalog);
  } finally {
    queryClient.clear();
  }
});
