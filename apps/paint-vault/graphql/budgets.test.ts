import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  buildSchema,
  GraphQLError,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  typeFromAST,
  type GraphQLType,
} from "graphql";
import { createSchema } from "graphql-yoga";

import { checkOperation, GRAPHQL_BODY_BYTES, OPERATION_BYTES, QUERY_LIMITS } from "./budgets.ts";
import { Sequence } from "./sequence.ts";

const schema = createSchema({
  typeDefs: readFileSync(new URL("./schema.graphql", import.meta.url), "utf8"),
  resolvers: { Sequence },
});
// The public schema is deliberately shallow. A recursive fixture isolates depth and
// expanded-work limits without depending on a database or future public fields.
// Keep the collection root named library: its first argument drives the cost model.
const recursiveSchema = buildSchema(`
  type Query { library(first: Int! = 48, after: String): Branch! }
  type Branch { next: Branch, value: String }
  type Mutation { update: Boolean }
`);
const libraryQuery = "{ library { nodes { id } } }";
const streamQuery =
  "subscription Changes($epoch: String!, $since: Sequence!) { vaultChanges(epoch: $epoch, since: $since) { epoch seq reset } }";

function check(query: string, variables?: Record<string, unknown>, target = schema, stream = false) {
  return checkOperation(target, { query, variables }, stream);
}

function budgetError(run: () => unknown, message: RegExp) {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof GraphQLError);
    assert.equal(error.extensions.code, "QUERY_BUDGET");
    assert.match(error.message, message);
    return true;
  });
}

function repeatedValue(count: number) {
  return Array.from({ length: count }, () => "value").join(" ");
}

function nestedQuery(depth: number) {
  return `{ library(first: 1) { ${"next { ".repeat(depth - 2)}value${" }".repeat(depth - 2)} } }`;
}

test("budget constants retain the documented caps", () => {
  assert.equal(GRAPHQL_BODY_BYTES, 128 * 1024);
  assert.equal(OPERATION_BYTES, 32 * 1024);
  assert.deepEqual(QUERY_LIMITS, { depth: 10, aliases: 10, roots: 3, fields: 500, cost: 10_000 });
});

test("accepts the public library query and a named operation", () => {
  assert.doesNotThrow(() => check(libraryQuery));
  assert.doesNotThrow(() =>
    checkOperation(schema, { query: `query Library ${libraryQuery}`, operationName: "Library" }, false),
  );
  budgetError(
    () => checkOperation(schema, { query: `query Library ${libraryQuery}`, operationName: "Missing" }, false),
    /accepts queries only/,
  );
});

test("depth includes the root field and accepts ten levels but not eleven", () => {
  assert.doesNotThrow(() => check(nestedQuery(10), undefined, recursiveSchema));
  budgetError(() => check(nestedQuery(11), undefined, recursiveSchema), /depth limit/);
});

test("fragment wrappers do not add depth; their selected fields do", () => {
  const query = `{
    library(first: 1) { ...Outer }
  }
  fragment Outer on Branch { ... on Branch { ...Inner } }
  fragment Inner on Branch { ${"next { ".repeat(8)}value${" }".repeat(8)} }`;
  assert.doesNotThrow(() => check(query, undefined, recursiveSchema));
  budgetError(
    () =>
      check(
        query.replace("fragment Inner on Branch {", "fragment Inner on Branch { next {") + " }",
        undefined,
        recursiveSchema,
      ),
    /depth limit/,
  );
});

test("counts three root selections, including repeated fields, but rejects four", () => {
  const root = "library(first: 1) { value }";
  assert.doesNotThrow(() => check(`{ ${Array(3).fill(root).join(" ")} }`, undefined, recursiveSchema));
  budgetError(
    () => check(`{ ${Array(4).fill(root).join(" ")} }`, undefined, recursiveSchema),
    /Root field limit/,
  );
});

test("root selections in fragments are counted on every use", () => {
  const query = (uses: number) =>
    `{ ${Array(uses).fill("...Root").join(" ")} } fragment Root on Query { library(first: 1) { value } }`;
  assert.doesNotThrow(() => check(query(3), undefined, recursiveSchema));
  budgetError(() => check(query(4), undefined, recursiveSchema), /Root field limit/);
});

test("allows ten aliases and rejects eleven across nested selections", () => {
  const query = (aliases: number) =>
    `{ library(first: 1) { ${Array.from({ length: aliases }, (_, i) => `v${i}: value`).join(" ")} } }`;
  assert.doesNotThrow(() => check(query(10), undefined, recursiveSchema));
  budgetError(() => check(query(11), undefined, recursiveSchema), /Alias limit/);
});

test("the root alias counts and cannot hide the library multiplier", () => {
  const aliases = Array.from({ length: 10 }, (_, i) => `v${i}: value`).join(" ");
  budgetError(
    () => check(`{ collection: library(first: 1) { ${aliases} } }`, undefined, recursiveSchema),
    /Alias limit/,
  );
  budgetError(
    () => check(`{ collection: library(first: 100) { ${repeatedValue(99)} } }`, undefined, recursiveSchema),
    /cost limit/,
  );
});

test("aliases inside reused fragments count separately each time", () => {
  const query = `{ library(first: 1) { ...Fields ...Fields } }
    fragment Fields on Branch { ${Array.from({ length: 6 }, (_, i) => `v${i}: value`).join(" ")} }`;
  budgetError(() => check(query, undefined, recursiveSchema), /Alias limit/);
});

test("allows exactly 500 expanded fields including the root, not 501", () => {
  assert.doesNotThrow(() =>
    check(`{ library(first: 1) { ${repeatedValue(499)} } }`, undefined, recursiveSchema),
  );
  budgetError(
    () => check(`{ library(first: 1) { ${repeatedValue(500)} } }`, undefined, recursiveSchema),
    /Expanded field limit/,
  );
});

test("nested named and inline fragments expand on every use", () => {
  const query = (count: number) => `{
    library(first: 1) { ...Outer ...Outer }
  }
  fragment Outer on Branch { ... on Branch { next { ...Fields } } }
  fragment Fields on Branch { ${repeatedValue(count)} }`;
  // 1 root + 2 next fields + 2 copies of the leaf fragment.
  assert.doesNotThrow(() => check(query(248), undefined, recursiveSchema));
  budgetError(() => check(query(249), undefined, recursiveSchema), /Expanded field limit/);
});

test("multiplicative descendant cost accepts exactly 10000 and rejects extra work", () => {
  // Two root overheads (100 + 1 each), plus 96*100 + 2*99 = 10000.
  const query = (extra: number) => `{
    a: library(first: 100) { ${repeatedValue(96)} }
    b: library(first: 99) { ${repeatedValue(2 + extra)} }
  }`;
  assert.doesNotThrow(() => check(query(0), undefined, recursiveSchema));
  budgetError(() => check(query(1), undefined, recursiveSchema), /cost limit/);
});

test("cost multiplies all descendant levels and every fragment use", () => {
  const query = (count: number, first: number) => `{
    library(first: ${first}) { next { ...Fields } next { ...Fields } }
  } fragment Fields on Branch { ${repeatedValue(count)} }`;
  assert.doesNotThrow(() => check(query(49, 1), undefined, recursiveSchema));
  assert.doesNotThrow(() => check(query(48, 100), undefined, recursiveSchema));
  budgetError(() => check(query(49, 100), undefined, recursiveSchema), /cost limit/);
});

test("skipped selections still consume the conservative budget", () => {
  const fields = Array.from({ length: 500 }, () => "value @skip(if: true)").join(" ");
  budgetError(
    () => check(`{ library(first: 1) { ${fields} } }`, undefined, recursiveSchema),
    /Expanded field limit/,
  );
  budgetError(
    () =>
      check(
        `query($include: Boolean!) { library(first: 1) @include(if: $include) { ${repeatedValue(500)} } }`,
        { include: false },
        recursiveSchema,
      ),
    /Expanded field limit/,
  );
});

test("coerces first variables and accepts both page-size boundaries", () => {
  const query = "query($first: Int!) { library(first: $first) { nodes { id } } }";
  for (const first of [1, 100]) assert.doesNotThrow(() => check(query, { first }));
  for (const first of [0, 101, -1])
    budgetError(() => check(query, { first }), /first must be between 1 and 100/);
  for (const first of ["1", 1.5, true, null]) {
    assert.throws(() => check(query, { first }), /Variable.*first/);
  }
  assert.throws(() => check(query, {}), /Variable.*first/);
});

test("literal first values receive the same range and GraphQL type checks", () => {
  for (const first of [0, 101])
    budgetError(() => check(`{ library(first: ${first}) { nodes { id } } }`), /first must/);
  for (const first of ['"1"', "1.5", "true", "null"]) {
    assert.throws(() => check(`{ library(first: ${first}) { nodes { id } } }`), GraphQLError);
  }
});

test("variable coercion happens before traversal budget checks", () => {
  const query = `query($first: Int!) { ${Array(4).fill("library(first: $first) { value }").join(" ")} }`;
  assert.throws(
    () => check(query, { first: "bad" }, recursiveSchema),
    (error: unknown) => {
      assert.ok(error instanceof GraphQLError);
      assert.match(error.message, /Variable.*first/);
      assert.notEqual(error.extensions.code, "QUERY_BUDGET");
      return true;
    },
  );
});

test("schema and operation defaults are included in the cost calculation", () => {
  const query = (count: number) => `{ library { ${repeatedValue(count)} } }`;
  assert.doesNotThrow(() => check(query(206), undefined, recursiveSchema));
  budgetError(() => check(query(207), undefined, recursiveSchema), /cost limit/);
  budgetError(
    () => check("query($first: Int! = 101) { library(first: $first) { value } }", {}, recursiveSchema),
    /first must/,
  );
  const variableDefault = `query($first: Int! = 100) { library(first: $first) { ${repeatedValue(99)} } }`;
  budgetError(() => check(variableDefault, {}, recursiveSchema), /cost limit/);
  assert.doesNotThrow(() => check(variableDefault, { first: 1 }, recursiveSchema));
});

test("operation text permits exactly 32 KiB and rejects one byte more", () => {
  const prefix = `${libraryQuery}\n#`;
  const query = prefix + "x".repeat(OPERATION_BYTES - Buffer.byteLength(prefix));
  assert.equal(Buffer.byteLength(query), OPERATION_BYTES);
  assert.doesNotThrow(() => check(query));
  budgetError(() => check(query + "x"), /at most 32 KiB/);
});

test("operation size is measured in UTF-8 bytes rather than characters", () => {
  const prefix = `${libraryQuery}\n#`;
  const remaining = OPERATION_BYTES - Buffer.byteLength(prefix);
  const query = prefix + "é".repeat(Math.floor(remaining / 2)) + "x".repeat(remaining % 2);
  assert.ok(query.length < OPERATION_BYTES);
  assert.equal(Buffer.byteLength(query), OPERATION_BYTES);
  assert.doesNotThrow(() => check(query));
  budgetError(() => check(query + "é"), /at most 32 KiB/);
});

test("rejects malformed request envelopes", () => {
  for (const query of [undefined, null, 1, {}]) {
    budgetError(() => checkOperation(schema, { query }, false), /Operation text/);
  }
  for (const operationName of [1, [], {}]) {
    budgetError(
      () => checkOperation(schema, { query: libraryQuery, operationName }, false),
      /operation name/,
    );
  }
  for (const variables of [1, "bad", true, []]) {
    budgetError(
      () => checkOperation(schema, { query: libraryQuery, variables }, false),
      /Variables must be an object/,
    );
  }
  assert.doesNotThrow(() =>
    checkOperation(schema, { query: libraryQuery, variables: null, operationName: null }, false),
  );
});

test("rejects multiple operations even when an operation name selects one", () => {
  const query = `query A ${libraryQuery} query B ${libraryQuery}`;
  budgetError(() => checkOperation(schema, { query, operationName: "A" }, false), /Exactly one operation/);
  budgetError(() => check(query), /Exactly one operation/);
  budgetError(() => check("fragment Fields on Paint { id }"), /Exactly one operation/);
});

test("rejects syntax errors, unknown fields and cyclic fragments", () => {
  assert.throws(() => check("{ library {"), /Syntax Error/);
  assert.throws(() => check("{ missing }"), /Cannot query field/);
  assert.throws(
    () => check("{ library { ...Loop } } fragment Loop on PaintConnection { ...Loop }"),
    /Cannot spread fragment/,
  );
});

test("the JSON endpoint accepts bounded mutations but rejects subscriptions", () => {
  assert.doesNotThrow(() => check("mutation { update }", undefined, recursiveSchema));
  budgetError(() => check(streamQuery, { epoch: "epoch", since: "0" }), /accepts queries only/);
});

test("the stream endpoint accepts subscriptions, not queries or mutations", () => {
  assert.doesNotThrow(() => check(streamQuery, { epoch: "epoch", since: "0" }, schema, true));
  budgetError(() => check(libraryQuery, undefined, schema, true), /accepts subscriptions only/);
  budgetError(
    () => check("mutation { update }", undefined, recursiveSchema, true),
    /accepts subscriptions only/,
  );
});

test("production blocks introspection, including aliased fields, but allows __typename", (t) => {
  const previous = process.env.NODE_ENV;
  t.after(() => {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  });
  for (const environment of ["production", "test", undefined]) {
    if (environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = environment;
    for (const query of [
      "{ __schema { queryType { name } } }",
      '{ hidden: __type(name: "Paint") { name } }',
    ]) {
      budgetError(() => check(query), /Introspection is available in development only/);
    }
    assert.doesNotThrow(() => check("{ library { __typename nodes { __typename id } } }"));
  }
});

test("development allows introspection under the same query budgets", (t) => {
  const previous = process.env.NODE_ENV;
  t.after(() => {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  });
  process.env.NODE_ENV = "development";
  assert.doesNotThrow(() => check("{ __schema { queryType { name } } }"));
  assert.doesNotThrow(() => check('{ __type(name: "Paint") { name } }'));
  budgetError(
    () =>
      check(`{ ${Array.from({ length: 4 }, (_, i) => `t${i}: __type(name: "Paint") { name }`).join(" ")} }`),
    /Root field limit/,
  );
});

test("library cursor length allows 8192 characters but not 8193", () => {
  const query = "query($after: String) { library(first: 1, after: $after) { nodes { id } } }";
  for (const after of [null, "", "x".repeat(8192)]) assert.doesNotThrow(() => check(query, { after }));
  budgetError(() => check(query, { after: "x".repeat(8193) }), /Invalid Library cursor/);
  assert.throws(() => check(query, { after: 123 }), /Variable.*after/);
  budgetError(
    () => check(`{ library(after: "${"x".repeat(8193)}") { nodes { id } } }`),
    /Invalid Library cursor/,
  );
});

test("stream revision cursors enforce epoch length and canonical safe decimal sequence", () => {
  for (const variables of [
    { epoch: "e", since: "0" },
    { epoch: "e".repeat(128), since: "2147483648" },
    { epoch: "e", since: "9007199254740991" },
  ])
    assert.doesNotThrow(() => check(streamQuery, variables, schema, true));
  budgetError(
    () => check(streamQuery, { epoch: "e".repeat(129), since: "0" }, schema, true),
    /Invalid revision cursor/,
  );
  for (const since of ["-1", "01", "1.5", "1e3", " 1", "+1", "9007199254740992", "", 0, 0.5, null])
    assert.throws(() => check(streamQuery, { epoch: "e", since }, schema, true), /Variable/);
  for (const variables of [{ epoch: 1, since: "0" }, { epoch: null, since: "0" }, { epoch: "e" }])
    assert.throws(() => check(streamQuery, variables, schema, true), /Variable/);
  assert.doesNotThrow(() =>
    check('subscription { vaultChanges(epoch: "e", since: "2147483648") { seq } }', undefined, schema, true),
  );
  for (const literal of ["0", "-1", '"01"', '"9007199254740992"'])
    assert.throws(
      () =>
        check(
          `subscription { vaultChanges(epoch: "e", since: ${literal}) { seq } }`,
          undefined,
          schema,
          true,
        ),
      /Sequence/,
    );
});

test("all generated screen documents fit their declared bounded defaults", async () => {
  const { print } = await import("graphql");
  const documents = await import("../../../packages/vault-ui/src/dom/graphql/generated/graphql.ts");
  const fixtureValue = (type: GraphQLType): unknown => {
    if (isNonNullType(type)) return fixtureValue(type.ofType);
    if (isListType(type)) return [];
    if (isInputObjectType(type))
      return Object.fromEntries(
        Object.values(type.getFields())
          .filter((field) => isNonNullType(field.type) && field.defaultValue === undefined)
          .map((field) => [field.name, fixtureValue(field.type)]),
      );
    if (isEnumType(type)) return type.getValues()[0].name;
    if (type.name === "Boolean") return true;
    if (["Int", "Float"].includes(type.name)) return 1;
    return type.name === "Sequence" ? "0" : "fixture";
  };
  for (const [key, doc] of Object.entries(documents)) {
    if (!key.endsWith("Document")) continue;
    const operation = doc.definitions.find((d) => d.kind === "OperationDefinition");
    if (!operation || operation.kind !== "OperationDefinition") continue;
    const variables = Object.fromEntries(
      (operation.variableDefinitions ?? [])
        .filter((definition) => definition.type.kind === "NonNullType" && !definition.defaultValue)
        .map((definition) => [
          definition.variable.name.value,
          fixtureValue(typeFromAST(schema, definition.type)!),
        ]),
    );
    assert.doesNotThrow(
      () => check(print(doc), variables, schema, operation.operation === "subscription"),
      key,
    );
  }
});

test("nested connection and picker argument budgets reject work before resolvers", () => {
  for (const query of [
    '{paint(id:"p"){substitutions(first:31){nodes{id}}}}',
    '{paint(id:"p"){usedBy(first:101){nodes{id}}}}',
    '{paint(id:"p"){similar(first:31){id}}}',
    '{substitution(id:"s"){substitution{ingredients(first:101){nodes{parts}}}}}',
    "{paintOptions(first:31){items{id}}}",
  ])
    budgetError(() => check(query), /first must be between/);
  assert.doesNotThrow(() =>
    check("{paintOptions(excludeIds:[" + Array(101).fill('"p"').join(",") + "]){items{id}}}"),
  );
  budgetError(() => check('{paintOptions(excludeIds:["' + "p".repeat(257) + '"]){items{id}}}'), /excludeIds/);
  budgetError(() => check('{library(search:"' + "x".repeat(257) + '"){nodes{id}}}'), /search exceeds/);
  budgetError(() => check('{paint(id:"' + "x".repeat(257) + '"){paint{id}}}'), /id exceeds/);
  budgetError(
    () => check('mutation{setPaintStock(paintId:"p",quantity:-1){revision{seq}}}'),
    /Invalid quantity/,
  );
  budgetError(
    () =>
      check(
        '{paint(id:"p"){substitutions(first:30){nodes{ingredients(first:100){nodes{paint{id name brand range sourceUrl colorHex discontinued available}}}}}}}',
      ),
    /cost limit/,
  );
});

test("miniature nested mutation inputs and preview expansion remain bounded", () => {
  const recipe =
    'mutation($entries:[MiniatureRecipeEntryInput!]!){setMiniatureRecipe(id:"m",entries:$entries){miniatureId}}';
  budgetError(() => check(recipe, { entries: [{ paintId: "x".repeat(257) }] }), /paintId exceeds/);
  budgetError(
    () =>
      check('mutation($ids:[ID!]!){setMiniatureSchemes(id:"m",schemeIds:$ids){miniatureId}}', {
        ids: ["x".repeat(257)],
      }),
    /schemeIds exceeds/,
  );
  assert.doesNotThrow(() =>
    check("mutation($input:MiniatureInput!){createMiniature(input:$input){miniatureId}}", {
      input: { title: "A", notes: "n".repeat(1000) },
    }),
  );
  budgetError(
    () =>
      check(
        "{home(first:100){miniatures{nodes{previewSwatches{" + Array(13).fill("colorHex").join(" ") + "}}}}}",
      ),
    /cost limit/,
  );
});
