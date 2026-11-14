import {
  GraphQLError,
  Kind,
  getArgumentValues,
  getNamedType,
  isObjectType,
  getOperationAST,
  getVariableValues,
  parse,
  validate,
  type DocumentNode,
  type GraphQLSchema,
  type GraphQLObjectType,
  type SelectionSetNode,
} from "graphql";

export const GRAPHQL_BODY_BYTES = 128 * 1024;
export const OPERATION_BYTES = 32 * 1024;
export const QUERY_LIMITS = { depth: 10, aliases: 10, roots: 3, fields: 500, cost: 10_000 } as const;
function reject(message: string): never {
  throw new GraphQLError(message, { extensions: { code: "QUERY_BUDGET" } });
}

function boundedInput(value: unknown, key: string, depth = 0) {
  if (depth > 8) reject("Input nesting limit exceeded");
  if (Array.isArray(value)) {
    if (key === "ids" && value.length > 1000) reject("Move at most 1000 items per operation");
    for (const item of value) boundedInput(item, key, depth + 1);
  } else if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(value)) boundedInput(item, name, depth + 1);
  } else if (
    typeof value === "string" &&
    (/(?:^ids?$|Ids?$)/.test(key) || ["steps", "step"].includes(key)) &&
    value.length > 256
  ) {
    reject(`${key} exceeds argument length limit`);
  }
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
  if (
    !operation ||
    (stream ? operation.operation !== "subscription" : !["query", "mutation"].includes(operation.operation))
  )
    reject(stream ? "This endpoint accepts subscriptions only" : "This endpoint accepts queries only");
  const coerced = getVariableValues(
    schema,
    operation.variableDefinitions ?? [],
    (body.variables ?? {}) as Record<string, unknown>,
    { maxErrors: 10 },
  );
  if (coerced.errors) throw coerced.errors[0];
  checkExpandedBudget(
    schema,
    document,
    operation.selectionSet,
    coerced.variableValues,
    stream,
    operation.operation === "mutation",
  );
}

// Expand fragments on every use, including aliases and skipped selections (conservative).
// Coerced list arguments multiply descendant cost; the traversal stops at the first exceeded cap.
function checkExpandedBudget(
  schema: GraphQLSchema,
  document: DocumentNode,
  selection: SelectionSetNode,
  variables: Parameters<typeof getArgumentValues>[2],
  stream: boolean,
  mutation: boolean,
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
  function walk(set: SelectionSetNode, depth: number, multiplier: number, parent?: GraphQLObjectType | null) {
    if (depth > QUERY_LIMITS.depth) reject("Query depth limit exceeded");
    for (const node of set.selections) {
      if (node.kind === Kind.FRAGMENT_SPREAD) {
        const fragment = fragments.get(node.name.value)!;
        const condition = schema.getType(fragment.typeCondition.name.value);
        walk(
          fragment.selectionSet,
          depth,
          multiplier,
          condition && isObjectType(condition) ? condition : parent,
        );
      } else if (node.kind === Kind.INLINE_FRAGMENT) {
        const condition = node.typeCondition && schema.getType(node.typeCondition.name.value);
        walk(node.selectionSet, depth, multiplier, condition && isObjectType(condition) ? condition : parent);
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
        const field = parent?.getFields()[node.name.value];
        if (field) {
          const args = getArgumentValues(field, node, variables);
          if (args.first !== undefined) {
            const max = ["paintOptions", "schemePaintOptions", "ownedPaintOptions", "substitutions"].includes(
              node.name.value,
            )
              ? 30
              : 100;
            if (
              typeof args.first !== "number" ||
              !Number.isInteger(args.first) ||
              args.first < 1 ||
              args.first > max
            )
              reject(`first must be between 1 and ${max}`);
            childMultiplier *= args.first;
            cost += 100;
          }
          // Wishlist has independently paged shopping and global-missing windows.
          // Charge both through the largest bound, not their Cartesian product.
          if (args.missingFirst !== undefined) {
            if (
              typeof args.missingFirst !== "number" ||
              !Number.isInteger(args.missingFirst) ||
              args.missingFirst < 1 ||
              args.missingFirst > 100
            )
              reject("missingFirst must be between 1 and 100");
            childMultiplier =
              multiplier * Math.max(typeof args.first === "number" ? args.first : 1, args.missingFirst);
            cost += 100;
          }
          for (const [name, value] of Object.entries(args)) {
            const isCursor = name === "after" || name === "missingAfter";
            const max = isCursor ? 8192 : name === "epoch" ? 128 : 256;
            if (typeof value === "string" && value.length > max)
              reject(
                isCursor
                  ? "Invalid Library cursor"
                  : name === "epoch"
                    ? "Invalid revision cursor"
                    : `${name} exceeds argument length limit`,
              );
            if (
              name === "excludeIds" &&
              (!Array.isArray(value) ||
                value.some((id: unknown) => typeof id !== "string" || id.length > 256))
            )
              reject("excludeIds must contain bounded IDs");
          }
          // Mutations use nested inputs; top-level string checks do not constrain their IDs/lists.
          // Text field business limits remain in the shared command validators.
          for (const [name, value] of Object.entries(args)) boundedInput(value, name);
          if (
            node.name.value === "setPaintStock" &&
            args.quantity != null &&
            (typeof args.quantity !== "number" || args.quantity < 0 || args.quantity > 2147483647)
          )
            reject("Invalid quantity");
          if (
            ["vaultChanges", "vaultInvalidation"].includes(node.name.value) &&
            (typeof args.epoch !== "string" ||
              args.epoch.length > 128 ||
              typeof args.since !== "number" ||
              !Number.isSafeInteger(args.since) ||
              args.since < 0)
          )
            reject("Invalid revision cursor");
        }
        if (node.name.value === "previewSwatches") childMultiplier *= 8;
        if (node.name.value === "relatedProjectsPreview") childMultiplier *= 3;
        if (node.name.value === "recipeSteps") cost += multiplier * 17;
        cost += multiplier;
        if (fields > QUERY_LIMITS.fields) reject("Expanded field limit exceeded");
        if (aliases > QUERY_LIMITS.aliases) reject("Alias limit exceeded");
        if (roots > QUERY_LIMITS.roots) reject("Root field limit exceeded");
        if (cost > QUERY_LIMITS.cost) reject("Query cost limit exceeded");
        if (node.selectionSet) {
          const child = field && getNamedType(field.type);
          walk(
            node.selectionSet,
            depth + 1,
            childMultiplier,
            child && isObjectType(child) ? child : undefined,
          );
        }
      }
    }
  }
  walk(
    selection,
    1,
    1,
    stream ? schema.getSubscriptionType() : mutation ? schema.getMutationType() : schema.getQueryType(),
  );
}
