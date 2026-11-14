import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

import { graphql, GraphQLError } from "graphql";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-folders-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
process.env.NODE_ENV = "test";
const { getSqlite } = await import("../db/index.ts");
const { schema } = await import("./server.ts");
const { checkOperation } = await import("./budgets.ts");
const { readFolder, readFolderBrowser, moveItems } = await import("./folders.ts");
const { readMiniatures } = await import("./miniatures.ts");
const { readTemplates } = await import("./templates.ts");
const { readRevision } = await import("./library.ts");
const { invalidationSince } = await import("./changes.ts");
const { saveImage, imageExists } = await import("../lib/image-store.ts");
const sqlite = getSqlite();
const contextValue = { request: new Request("http://localhost/api/graphql") };
const selection = "revision { epoch seq } invalidatedFamilies";
async function gql(source: string, variableValues?: Record<string, unknown>) {
  checkOperation(schema, { query: source, variables: variableValues }, false);
  return graphql({ schema, source, variableValues, contextValue });
}
async function create(kind = "MINIATURE", name = "Project", parentId: string | null = null) {
  const result = await gql(
    `mutation($kind:FolderKind!,$name:String!,$parentId:ID){createFolder(kind:$kind,name:$name,parentId:$parentId){${selection}}}`,
    { kind, name, parentId },
  );
  assert.equal(result.errors, undefined);
  return sqlite.prepare("SELECT id FROM folders ORDER BY rowid DESC LIMIT 1").pluck().get() as string;
}
function mini(folderId: string | null, title = "Knight", imageKey: string | null = null) {
  const id = randomUUID();
  sqlite
    .prepare(
      "INSERT INTO miniatures(id,title,status,folder_id,image_key,created_at) VALUES(?,?,'OWNED',?,?,1)",
    )
    .run(id, title, folderId, imageKey);
  return id;
}
function template(folderId: string | null, name = "Knight", imageKey: string | null = null) {
  const id = `user:${randomUUID()}`;
  sqlite
    .prepare("INSERT INTO miniature_templates(id,name,folder_id,image_key,created_at) VALUES(?,?,?,?,1)")
    .run(id, name, folderId, imageKey);
  return id;
}
beforeEach(() => {
  sqlite.exec(
    "DELETE FROM folders; DELETE FROM miniatures; DELETE FROM miniature_templates; DELETE FROM paint_catalog; DELETE FROM color_schemes; DELETE FROM catalog_sources;",
  );
});
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

void test("nested folder create/rename and direct/recursive count + cover projection", async () => {
  const root = await create(),
    child = await create("MINIATURE", "Child", root);
  mini(root, "Direct");
  const item = mini(child, "Descendant");
  sqlite
    .prepare("UPDATE miniatures SET source_image_url='https://example.com/cover.jpg' WHERE id=?")
    .run(item);
  const p = readFolder(root)!;
  assert.equal(p.directCount, 1);
  assert.equal(p.recursiveCount, 2);
  assert.equal(p.childFolderCount, 1);
  assert.equal(p.coverImageUrl, "https://example.com/cover.jpg");
  assert.ok(p.coverThumbnailUrl);
  const result = await gql(
    `mutation($id:ID!){renameFolder(id:$id,name:"Renamed",clientMutationId:"client"){${selection}}}`,
    { id: child },
  );
  assert.equal(result.errors, undefined);
  assert.equal(readFolder(child)!.name, "Renamed");
  assert.equal(readFolder(child)!.parentId, root);
});

void test("server and SQLite reject cycles/cross-kind links and immutable kind", async () => {
  const root = await create(),
    child = await create("MINIATURE", "Child", root),
    other = await create("TEMPLATE");
  for (const parentId of [root, child, other]) {
    const result = await gql(
      "mutation($id:ID!,$parent:ID){moveFolder(id:$id,parentId:$parent){revision{seq}}}",
      { id: root, parent: parentId },
    );
    assert.equal(result.errors?.[0].extensions.code, "BAD_USER_INPUT");
  }
  assert.throws(() => sqlite.prepare("UPDATE folders SET parent_id=? WHERE id=?").run(child, root), /cycle/i);
  assert.throws(
    () => sqlite.prepare("UPDATE folders SET parent_id=? WHERE id=?").run(root, root),
    /cycle|check/i,
  );
  assert.throws(
    () => sqlite.prepare("UPDATE folders SET parent_id=? WHERE id=?").run(other, child),
    /same kind/i,
  );
  assert.throws(
    () => sqlite.prepare("UPDATE folders SET kind='template' WHERE id=?").run(root),
    /immutable/i,
  );
  assert.throws(
    () =>
      sqlite
        .prepare("INSERT INTO folders(id,kind,name,parent_id,created_at) VALUES(?,'miniature','Bad',?,1)")
        .run(randomUUID(), other),
    /same kind/i,
  );
  assert.throws(() => mini(other), /miniature kind/i);
  assert.throws(() => template(root), /template kind/i);
  const m = mini(root),
    t = template(other);
  assert.throws(
    () => sqlite.prepare("UPDATE miniatures SET folder_id=? WHERE id=?").run(other, m),
    /miniature kind/i,
  );
  assert.throws(
    () => sqlite.prepare("UPDATE miniature_templates SET folder_id=? WHERE id=?").run(root, t),
    /template kind/i,
  );
  assert.equal((sqlite.pragma("foreign_key_check") as unknown[]).length, 0);
});

void test("atomic item bulk move validates every ID and same kind; unfile to root", async () => {
  const root = await create(),
    other = await create("TEMPLATE"),
    a = mini(null),
    b = mini(null);
  assert.throws(() => moveItems("miniature", [a, randomUUID()], root), /not found/i);
  assert.equal(readMiniatures({ first: 100, flat: false }).miniatures.totalCount, 2);
  assert.throws(() => moveItems("miniature", [a, b], other), /same kind/i);
  const result = await gql(
    `mutation($ids:[ID!]!,$folder:ID){moveFolderItems(kind:MINIATURE,ids:$ids,folderId:$folder){${selection}}}`,
    { ids: [a, b, a], folder: root },
  );
  assert.equal(result.errors, undefined);
  assert.equal(readMiniatures({ first: 100, folderId: root }).miniatures.totalCount, 2);
  assert.equal(readFolder(root)!.recursiveCount, 2);
  assert.equal(moveItems("miniature", [a, b], null), 2);
  assert.equal(readFolder(root)!.recursiveCount, 0);
});

void test("MOVE_UP promotes direct items and child folders, retaining deeper descendants", async () => {
  const root = await create(),
    child = await create("MINIATURE", "Child", root),
    nested = await create("MINIATURE", "Nested", child);
  const a = mini(child),
    b = mini(nested);
  const result = await gql(`mutation($id:ID!){deleteFolder(id:$id,mode:MOVE_UP){${selection}}}`, {
    id: child,
  });
  assert.equal(result.errors, undefined);
  assert.equal(readFolder(child), null);
  assert.equal(readFolder(nested)!.parentId, root);
  assert.equal(sqlite.prepare("SELECT folder_id FROM miniatures WHERE id=?").pluck().get(a), root);
  assert.equal(sqlite.prepare("SELECT folder_id FROM miniatures WHERE id=?").pluck().get(b), nested);
  await gql(`mutation($id:ID!){deleteFolder(id:$id,mode:MOVE_UP){revision{seq}}}`, { id: root });
  assert.equal(readFolder(nested)!.parentId, null);
  assert.equal(sqlite.prepare("SELECT folder_id FROM miniatures WHERE id=?").pluck().get(a), null);
});

void test("DELETE_CONTENTS cascades miniature recipe links and deletes only unused images", async () => {
  const root = await create(),
    child = await create("MINIATURE", "Child", root);
  const unused = await saveImage(new File(["unique"], "unique.png", { type: "image/png" })),
    shared = await saveImage(new File(["shared"], "shared.png", { type: "image/png" }));
  const a = mini(root, "Unique", unused),
    b = mini(child, "Shared", shared),
    survivor = mini(null, "Keep", shared);
  sqlite.prepare("INSERT INTO miniature_recipe_steps(miniature_id,step) VALUES(?,'BASECOAT')").run(a);
  const result = await gql(`mutation($id:ID!){deleteFolder(id:$id,mode:DELETE_CONTENTS){${selection}}}`, {
    id: root,
  });
  assert.equal(result.errors, undefined);
  assert.equal(readFolder(root), null);
  assert.equal(readFolder(child), null);
  assert.deepEqual(sqlite.prepare("SELECT id FROM miniatures ORDER BY id").pluck().all(), [survivor]);
  assert.equal(sqlite.prepare("SELECT count(*) FROM miniature_recipe_steps").pluck().get(), 0);
  assert.equal(await imageExists(unused), false);
  assert.equal(await imageExists(shared), true);
  assert.equal(sqlite.prepare("SELECT id FROM miniatures WHERE id=?").get(b), undefined);
});

void test("template folder deletion cascades only its own templates and recipe links", async () => {
  const root = await create("TEMPLATE"),
    child = await create("TEMPLATE", "Child", root),
    a = template(child),
    outside = template(null);
  const paint = randomUUID();
  sqlite.prepare("INSERT INTO paint_catalog(id,brand,range,name) VALUES(?,'B','R','Paint')").run(paint);
  sqlite
    .prepare("INSERT INTO miniature_template_paints(template_id,sort_order,paint_id) VALUES(?,0,?)")
    .run(a, paint);
  await gql("mutation($id:ID!){deleteFolder(id:$id,mode:DELETE_CONTENTS){revision{seq}}}", { id: root });
  assert.deepEqual(
    readTemplates({ first: 100 }).templates.nodes.map((n) => n.id),
    [outside],
  );
  assert.equal(sqlite.prepare("SELECT count(*) FROM miniature_template_paints").pluck().get(), 0);
  assert.equal(sqlite.prepare("SELECT count(*) FROM paint_catalog").pluck().get(), 1);
});

void test("folder browser pages are revision- and scope-bound, include all folders without an authoring cap", async () => {
  sqlite.transaction(() => {
    for (let i = 0; i < 1005; i++)
      sqlite
        .prepare("INSERT INTO folders(id,kind,name,created_at) VALUES(?,'miniature',?,1)")
        .run(randomUUID(), `Project ${String(i).padStart(4, "0")}`);
  })();
  const ids: string[] = [];
  let after: string | null = null;
  do {
    const page = readFolderBrowser({ kind: "MINIATURE", flat: true, first: 100, after });
    assert.equal(page.totalCount, 1005);
    ids.push(...page.folders.map((n) => n.id));
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  assert.equal(new Set(ids).size, 1005);
  const page = readFolderBrowser({ kind: "MINIATURE", flat: true, first: 1 });
  assert.throws(
    () => readFolderBrowser({ kind: "TEMPLATE", flat: true, first: 1, after: page.pageInfo.endCursor }),
    /cursor/i,
  );
  await create();
  assert.throws(
    () => readFolderBrowser({ kind: "MINIATURE", flat: true, first: 1, after: page.pageInfo.endCursor }),
    (e) => e instanceof GraphQLError && e.extensions.code === "STALE_CURSOR",
  );
});

void test("mixed search resolves Folder, Miniature and TemplateSummary union members", async () => {
  const root = await create("MINIATURE", "Knight project");
  mini(root, "Knight champion");
  const templates = await create("TEMPLATE", "Knight designs");
  template(templates, "Knight template");
  for (const kind of ["MINIATURE", "TEMPLATE"]) {
    const result = await gql(
      `query($kind:FolderKind!){folderSearch(kind:$kind,search:"Knight",first:20){revision{seq} results{nodes{__typename ... on Folder{id name recursiveCount} ... on Miniature{id title folderId} ... on TemplateSummary{id name folderId}} pageInfo{hasNextPage} totalCount}}}`,
      { kind },
    );
    assert.equal(result.errors, undefined);
    assert.deepEqual(
      new Set(
        (result.data!.folderSearch as { results: { nodes: { __typename: string }[] } }).results.nodes.map(
          (n) => n.__typename,
        ),
      ),
      new Set(["Folder", kind === "MINIATURE" ? "Miniature" : "TemplateSummary"]),
    );
  }
});

void test("create/update miniature folder assignment is atomic and preserves omitted folder", async () => {
  const root = await create(),
    wrong = await create("TEMPLATE");
  let result = await gql(
    'mutation($folder:ID){createMiniature(input:{title:"New",folderId:$folder}){miniatureId}}',
    { folder: root },
  );
  assert.equal(result.errors, undefined);
  const id = (result.data!.createMiniature as { miniatureId: string }).miniatureId;
  result = await gql('mutation($id:ID!){updateMiniature(id:$id,input:{title:"Updated"}){miniatureId}}', {
    id,
  });
  assert.equal(result.errors, undefined);
  assert.equal(sqlite.prepare("SELECT folder_id FROM miniatures WHERE id=?").pluck().get(id), root);
  result = await gql(
    'mutation($id:ID!,$folder:ID){updateMiniature(id:$id,input:{title:"Should rollback",folderId:$folder}){miniatureId}}',
    { id, folder: wrong },
  );
  assert.equal(result.errors?.[0].extensions.code, "BAD_USER_INPUT");
  assert.equal(sqlite.prepare("SELECT title FROM miniatures WHERE id=?").pluck().get(id), "Updated");
  result = await gql(
    'mutation($folder:ID){createMiniature(input:{title:"Bad",folderId:$folder}){miniatureId}}',
    { folder: wrong },
  );
  assert.equal(result.errors?.[0].extensions.code, "BAD_USER_INPUT");
  assert.equal(sqlite.prepare("SELECT count(*) FROM miniatures").pluck().get(), 1);
});

void test("folder mutations and direct SQL changes invalidate SSE families and cached metadata", async () => {
  const before = readRevision(),
    root = await create();
  let changes = invalidationSince({ epoch: before.epoch, since: before.seq });
  for (const family of ["HOME", "MINIATURES", "TEMPLATES"])
    assert.ok(changes.families.includes(family as "HOME"));
  const current = readRevision();
  readFolder(root);
  sqlite.prepare("UPDATE folders SET name='Changed externally' WHERE id=?").run(root);
  changes = invalidationSince({ epoch: current.epoch, since: current.seq });
  assert.ok(changes.seq > current.seq);
  assert.equal(readFolder(root)!.name, "Changed externally");
});

void test("folder budgets bound paging, union fragment expansion and bulk IDs", () => {
  for (const first of [0, 101])
    assert.throws(
      () =>
        checkOperation(
          schema,
          { query: `{folderBrowser(kind:MINIATURE,first:${first}){folders{id}}}` },
          false,
        ),
      (e) => e instanceof GraphQLError && e.extensions.code === "QUERY_BUDGET",
    );
  for (const source of [
    '{folderSearch(kind:MINIATURE,search:"x",first:100){results{nodes{... on Miniature{previewSwatches{' +
      Array(13).fill("colorHex").join(" ") +
      "}}}}}}",
    "fragment Heavy on Miniature {previewSwatches{" +
      Array(13).fill("colorHex").join(" ") +
      '}} {folderSearch(kind:MINIATURE,search:"x",first:100){results{nodes{...Heavy}}}}',
  ])
    assert.throws(
      () => checkOperation(schema, { query: source }, false),
      (e) => e instanceof GraphQLError && e.extensions.code === "QUERY_BUDGET",
    );
  assert.throws(
    () =>
      checkOperation(
        schema,
        {
          query: "mutation($ids:[ID!]!){moveFolderItems(kind:MINIATURE,ids:$ids){revision{seq}}}",
          variables: { ids: Array(1001).fill(randomUUID()) },
        },
        false,
      ),
    (e) => e instanceof GraphQLError && e.extensions.code === "QUERY_BUDGET",
  );
});

void test("mixed union pages bind filters/scope/revision and preserve full metadata search", async () => {
  const root = await create("MINIATURE", "Scarlet project"),
    child = await create("MINIATURE", "Scarlet child", root),
    other = await create("MINIATURE", "Scarlet outside");
  const a = mini(root, "Scarlet owned"),
    b = mini(child, "Scarlet child item"),
    outside = mini(other, "Scarlet outside item"),
    wish = mini(child, "Scarlet wishlist");
  sqlite.prepare("UPDATE miniatures SET status='WISHLIST' WHERE id=?").run(wish);
  const { searchFolders } = await import("./folders.ts");
  const args = {
    kind: "MINIATURE" as const,
    search: "Scarlet",
    folderId: root,
    ownership: "OWNED" as const,
    first: 1,
  };
  const first = searchFolders(args);
  assert.equal(first.results.totalCount, 3);
  const all = first.results.nodes.slice();
  let after = first.results.pageInfo.endCursor;
  while (after) {
    const next = searchFolders({ ...args, after });
    all.push(...next.results.nodes);
    after = next.results.pageInfo.hasNextPage ? next.results.pageInfo.endCursor : null;
  }
  assert.deepEqual(new Set(all.map((n) => n.id)), new Set([child, a, b]));
  assert.ok(!all.some((n) => n.id === outside || n.id === wish));
  for (const changed of [
    { folderId: other },
    { ownership: "WISHLIST" as const },
    { search: "Different" },
    { kind: "TEMPLATE" as const },
    { stage: "PRIMED" as const },
  ])
    assert.throws(
      () => searchFolders({ ...args, ...changed, after: first.results.pageInfo.endCursor }),
      (e) => e instanceof GraphQLError && e.extensions.code === "BAD_USER_INPUT",
    );
  sqlite.prepare("UPDATE miniatures SET notes='Unique metadata needle' WHERE id=?").run(b);
  assert.throws(
    () => searchFolders({ ...args, after: first.results.pageInfo.endCursor }),
    (e) => e instanceof GraphQLError && e.extensions.code === "STALE_CURSOR",
  );
  assert.deepEqual(
    searchFolders({ ...args, search: "Unique metadata needle" }).results.nodes.map((n) => n.id),
    [b],
  );
  const ready = searchFolders({ ...args, stage: "PRIMED" });
  assert.deepEqual(
    ready.results.nodes.map((n) => n.id),
    [child],
    "folder name matches survive item filters",
  );
});

void test("template mixed search respects folder/category/source filters before ranking", async () => {
  const root = await create("TEMPLATE", "Infantry designs"),
    child = await create("TEMPLATE", "Infantry subfolder", root),
    other = await create("TEMPLATE", "Other");
  const wanted = template(child, "Infantry design"),
    excluded = template(other, "Infantry outside");
  const { searchFolders } = await import("./folders.ts");
  const args = { kind: "TEMPLATE" as const, search: "Infantry", folderId: root, first: 100 };
  const result = searchFolders({ ...args, category: "My templates", noSource: true });
  assert.deepEqual(new Set(result.results.nodes.map((n) => n.id)), new Set([child, wanted]));
  assert.ok(!result.results.nodes.some((n) => n.id === excluded));
  assert.deepEqual(
    searchFolders({ ...args, category: "Absent category" }).results.nodes.map((n) => n.id),
    [child],
  );
  sqlite.prepare("UPDATE miniature_templates SET manufacturer='Rare company' WHERE id=?").run(wanted);
  assert.deepEqual(
    searchFolders({ ...args, search: "Rare company" }).results.nodes.map((n) => n.id),
    [wanted],
  );
});

void test("invalid names, missing folder membership and missing parents fail without writes", async () => {
  for (const name of ["   ", "x".repeat(201)]) {
    const result = await gql(
      "mutation($name:String!){createFolder(kind:MINIATURE,name:$name){revision{seq}}}",
      { name },
    );
    assert.equal(result.errors?.[0].extensions.code, "BAD_USER_INPUT");
  }
  const result = await gql(
    'mutation($parent:ID){createFolder(kind:MINIATURE,name:"Orphan",parentId:$parent){revision{seq}}}',
    { parent: randomUUID() },
  );
  assert.equal(result.errors?.[0].extensions.code, "NOT_FOUND");
  assert.equal(sqlite.prepare("SELECT count(*) FROM folders").pluck().get(), 0);
  assert.throws(() => mini(randomUUID()), /miniature kind/i);
  assert.throws(() => template(randomUUID()), /template kind/i);
});

void test("recursive deletion supports folder trees deeper than SQLite's cascade trigger limit", async () => {
  const ids = Array.from({ length: 1005 }, () => randomUUID());
  sqlite.transaction(() => {
    const insert = sqlite.prepare(
      "INSERT INTO folders(id,kind,name,parent_id,created_at) VALUES(?,'miniature','Deep',?,1)",
    );
    for (let i = 0; i < ids.length; i++) insert.run(ids[i], i ? ids[i - 1] : null);
    mini(ids.at(-1)!);
  })();
  const result = await gql("mutation($id:ID!){deleteFolder(id:$id,mode:DELETE_CONTENTS){revision{seq}}}", {
    id: ids[0],
  });
  assert.equal(result.errors, undefined);
  assert.equal(sqlite.prepare("SELECT count(*) FROM folders").pluck().get(), 0);
  assert.equal(sqlite.prepare("SELECT count(*) FROM miniatures").pluck().get(), 0);
  assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
});

void test("bulk move rejects overlong lowercase ids at the request budget", () => {
  assert.throws(
    () =>
      checkOperation(
        schema,
        {
          query: "mutation($ids:[ID!]!){moveFolderItems(kind:MINIATURE,ids:$ids){revision{seq}}}",
          variables: { ids: ["x".repeat(257)] },
        },
        false,
      ),
    (e) => e instanceof GraphQLError && e.extensions.code === "QUERY_BUDGET",
  );
});
