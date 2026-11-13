import {
  GraphQLError,
  Kind,
  getArgumentValues,
  getOperationAST,
  getVariableValues,
  parse,
  validate,
  type DocumentNode,
  type GraphQLSchema,
  type SelectionSetNode,
} from "graphql";

export const GRAPHQL_BODY_BYTES = 128 * 1024;
export const OPERATION_BYTES = 32 * 1024;
export const QUERY_LIMITS = { depth: 10, aliases: 10, roots: 3, fields: 500, cost: 10_000 } as const;
function reject(message: string): never {
  throw new GraphQLError(message, { extensions: { code: "QUERY_BUDGET" } });
}

export function checkOperation(schema: GraphQLSchema, body: Record<string, unknown>, stream: boolean) {
  if (typeof body.query !== "string" || Buffer.byteLength(body.query) > OPERATION_BYTES)
    reject("Operation text must be at most 32 KiB");
  if (body.operationName != null && typeof body.operationName !== "string") reject("Invalid operation name");
  if (body.variables != null && (typeof body.variables !== "object" || Array.isArray(body.variables)))
    reject("Variables must be an object");
  const document = parse(body.query, { maxTokens: 8000 });
  if (document.definitions.filter((node) => node.kind === Kind.OPERATION_DEFINITION).length !== 1)
    reject("Exactly one operation is required; batching is disabled");
  const errors = validate(schema, document, undefined, { maxErrors: 20 });
  if (errors.length) throw errors[0];
  const operation = getOperationAST(document, body.operationName);
  if (!operation || operation.operation !== (stream ? "subscription" : "query"))
    reject(stream ? "This endpoint accepts subscriptions only" : "This endpoint accepts queries only");
  const coerced = getVariableValues(
    schema,
    operation.variableDefinitions ?? [],
    (body.variables ?? {}) as Record<string, unknown>,
    { maxErrors: 10 },
  );
  if (coerced.errors) throw coerced.errors[0];
  checkExpandedBudget(schema, document, operation.selectionSet, coerced.variableValues, stream);
}

// Expand fragments on every use, including aliases and skipped selections (conservative).
// Coerced list arguments multiply descendant cost; the traversal stops at the first exceeded cap.
function checkExpandedBudget(
  schema: GraphQLSchema,
  document: DocumentNode,
  selection: SelectionSetNode,
  variables: Parameters<typeof getArgumentValues>[2],
  stream: boolean,
) {
  const fragments = new Map(
    document.definitions.flatMap((node) =>
      node.kind === Kind.FRAGMENT_DEFINITION ? [[node.name.value, node] as const] : [],
    ),
  );
  let fields = 0,
    aliases = 0,
    roots = 0,
    cost = 0;
  function walk(set: SelectionSetNode, depth: number, multiplier: number) {
    if (depth > QUERY_LIMITS.depth) reject("Query depth limit exceeded");
    for (const node of set.selections) {
      if (node.kind === Kind.FRAGMENT_SPREAD) {
        walk(fragments.get(node.name.value)!.selectionSet, depth, multiplier);
      } else if (node.kind === Kind.INLINE_FRAGMENT) {
        walk(node.selectionSet, depth, multiplier);
      } else {
        fields++;
        aliases += node.alias ? 1 : 0;
        roots += depth === 1 ? 1 : 0;
        if (
          process.env.NODE_ENV !== "development" &&
          node.name.value.startsWith("__") &&
          node.name.value !== "__typename"
        )
          reject("Introspection is available in development only");
        let childMultiplier = multiplier;
        if (depth === 1) {
          const root = stream ? schema.getSubscriptionType() : schema.getQueryType();
          const field = root?.getFields()[node.name.value];
          if (field) {
            const args = getArgumentValues(field, node, variables);
            if (node.name.value === "library") {
              if (
                typeof args.first !== "number" ||
                !Number.isInteger(args.first) ||
                args.first < 1 ||
                args.first > 100
              )
                reject("first must be between 1 and 100");
              if (args.after != null && (typeof args.after !== "string" || args.after.length > 8192))
                reject("Invalid Library cursor");
              childMultiplier *= args.first;
              cost += 100;
            }
            if (
              node.name.value === "vaultChanges" &&
              (typeof args.epoch !== "string" ||
                args.epoch.length > 128 ||
                typeof args.since !== "number" ||
                !Number.isSafeInteger(args.since) ||
                args.since < 0)
            )
              reject("Invalid revision cursor");
          }
        }
        cost += multiplier;
        if (fields > QUERY_LIMITS.fields) reject("Expanded field limit exceeded");
        if (aliases > QUERY_LIMITS.aliases) reject("Alias limit exceeded");
        if (roots > QUERY_LIMITS.roots) reject("Root field limit exceeded");
        if (cost > QUERY_LIMITS.cost) reject("Query cost limit exceeded");
        if (node.selectionSet) walk(node.selectionSet, depth + 1, childMultiplier);
      }
    }
  }
  walk(selection, 1, 1);
}
