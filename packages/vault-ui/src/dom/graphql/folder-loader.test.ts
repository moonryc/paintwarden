import assert from "node:assert/strict";
import { test } from "node:test";

import { createVaultGraphQLClient } from "./client";
import { readFolderTree } from "./folder-loader";
import { readFolderSearch } from "./folder-search-loader";

function folder(index: number) {
  return {
    __typename: "Folder",
    id: `folder-${index}`,
    name: `Project ${index}`,
    parentId: index ? "folder-0" : null,
    directCount: 1,
    recursiveCount: 2,
    coverThumbnailUrl: null,
  };
}
function page(index: number, more: boolean, seq = "1") {
  return {
    revision: { epoch: "fixture", seq },
    folders: [folder(index)],
    totalCount: 13,
    pageInfo: { hasNextPage: more, endCursor: more ? `cursor-${index}` : null },
  };
}
function json(data: unknown) {
  return new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } });
}
function scope(respond: (variables: Record<string, unknown>) => Response) {
  return createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
        variables: Record<string, unknown>;
      };
      return respond(body.variables);
    },
  });
}

void test("complete folder picker tree traverses more than five pages without partial cache writes", async () => {
  const requests: Record<string, unknown>[] = [];
  const client = scope((variables) => {
    requests.push(variables);
    return json({ folderBrowser: page(requests.length, requests.length < 13) });
  });
  try {
    const data = await readFolderTree(client.client, "MINIATURE");
    assert.equal(data.folderBrowser.folders.length, 13);
    assert.equal(requests.length, 13);
    assert.equal(requests[0].after, null);
    assert.equal(requests[12].after, "cursor-12");
    assert.ok(requests.every((variables) => variables.kind === "MINIATURE" && variables.first === 100));
    assert.deepEqual(client.client.cache.extract(), {});
  } finally {
    client.dispose();
  }
});

void test("folder tree restarts its whole window after a revision changes between pages", async () => {
  let calls = 0;
  const client = scope(() => {
    calls += 1;
    return json({ folderBrowser: page(calls, calls === 1 || calls === 3, calls === 1 ? "1" : "2") });
  });
  try {
    const data = await readFolderTree(client.client, "TEMPLATE");
    assert.equal(calls, 4);
    assert.deepEqual(
      data.folderBrowser.folders.map((row) => row.id),
      ["folder-3", "folder-4"],
    );
    assert.equal(data.folderBrowser.revision.seq, "2");
    assert.deepEqual(client.client.cache.extract(), {});
  } finally {
    client.dispose();
  }
});

void test("folder tree rejects repeated cursors instead of looping or publishing a partial tree", async () => {
  const client = scope(() => json({ folderBrowser: page(1, true) }));
  try {
    await assert.rejects(readFolderTree(client.client, "MINIATURE"));
    assert.deepEqual(client.client.cache.extract(), {});
  } finally {
    client.dispose();
  }
});

void test("mixed search preserves subtree and item filters across every loaded page", async () => {
  const requests: Record<string, unknown>[] = [];
  const client = scope((variables) => {
    requests.push(variables);
    const tree = page(requests.length, requests.length < 7);
    return json({
      folderSearch: {
        revision: tree.revision,
        results: { nodes: tree.folders, totalCount: 13, pageInfo: tree.pageInfo },
      },
    });
  });
  try {
    const data = await readFolderSearch(
      client.client,
      {
        kind: "TEMPLATE",
        search: "Project",
        folderId: "army",
        category: "Infantry",
        sourceId: "source",
        noSource: false,
      },
      20,
    );
    assert.equal(data.folderSearch.results.nodes.length, 7);
    assert.equal(requests.length, 7);
    assert.ok(
      requests.every(
        (variables) =>
          variables.folderId === "army" &&
          variables.search === "Project" &&
          variables.sourceId === "source" &&
          variables.category === "Infantry" &&
          variables.first === 48,
      ),
    );
    assert.deepEqual(client.client.cache.extract(), {});
  } finally {
    client.dispose();
  }
});

void test("mixed search retries revision races atomically and refuses a cyclic page cursor", async () => {
  let calls = 0;
  const client = scope(() => {
    calls += 1;
    const tree = page(calls, calls === 1 || calls === 3, calls === 1 ? "1" : "2");
    return json({
      folderSearch: {
        revision: tree.revision,
        results: { nodes: tree.folders, totalCount: 2, pageInfo: tree.pageInfo },
      },
    });
  });
  try {
    const data = await readFolderSearch(
      client.client,
      { kind: "MINIATURE", search: "Project", ownership: "OWNED", stage: "PRIMED" },
      2,
    );
    assert.equal(calls, 4);
    assert.deepEqual(
      data.folderSearch.results.nodes.map((row) => ("id" in row ? row.id : null)),
      ["folder-3", "folder-4"],
    );
    assert.deepEqual(client.client.cache.extract(), {});
  } finally {
    client.dispose();
  }
  const cyclic = scope(() => {
    const tree = page(1, true);
    return json({
      folderSearch: {
        revision: tree.revision,
        results: { nodes: tree.folders, totalCount: 2, pageInfo: tree.pageInfo },
      },
    });
  });
  try {
    await assert.rejects(readFolderSearch(cyclic.client, { kind: "MINIATURE", search: "Project" }, 3));
  } finally {
    cyclic.dispose();
  }
});
