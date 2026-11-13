import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { GraphQLError } from "graphql";
import { createSchema, createYoga, maskError } from "graphql-yoga";

import { getSqlite } from "../db/index.ts";
import { PaintStockError, setPaintStock } from "../lib/paint-stock.ts";

import { checkOperation, GRAPHQL_BODY_BYTES } from "./budgets.ts";
import { invalidationSince, subscribeChanges, type Family } from "./changes.ts";
import type { GraphQLContext } from "./context.ts";
import type { Resolvers } from "./generated/resolvers.ts";
import {
  paintSubstitutions,
  paintUsages,
  readLibrary,
  readPaint,
  readPaintOptions,
  readRevision,
  readSubstitution,
  similarPaints,
  substitutionIngredients,
} from "./library.ts";
import { acquireOperation } from "./rate-limit.ts";
import { Sequence } from "./sequence.ts";

const resolvers: Resolvers<GraphQLContext> = {
  Sequence,
  Query: {
    library: (_root, args, context) => {
      const page = readLibrary(args);
      if (context.metrics) context.metrics.rows += page.nodes.length;
      return page;
    },
    paint: (_root, args) => readPaint(args.id),
    substitution: (_root, args) => readSubstitution(args.id),
    paintOptions: (_root, args, context) => {
      const view = readPaintOptions(args);
      if (context.metrics) context.metrics.rows += view.items.length;
      return view;
    },
    vaultRevision: () => getSqlite().transaction(readRevision)(),
    vaultInvalidation: (_root, args) => invalidationSince(args),
  },
  PaintView: {
    substitutions: (parent, args) => paintSubstitutions(parent, args),
    usedBy: (parent, args) => paintUsages(parent, args),
    similar: (parent, args) => similarPaints(parent, args.first),
  },
  Substitution: { ingredients: (parent, args) => substitutionIngredients(parent, args) },
  Mutation: {
    setPaintStock: (_root, args) => {
      try {
        return getSqlite().transaction(() => {
          setPaintStock(args);
          const view = readPaint(args.paintId);
          return {
            revision: view.revision,
            paint: view.paint,
            clientMutationId: args.clientMutationId,
            invalidatedFamilies: [
              "LIBRARY",
              "PAINT",
              "OPTIONS",
              "HOME",
              "MINIATURES",
              "WISHLIST",
              "SCHEMES",
            ] as Family[],
          };
        })();
      } catch (error) {
        if (error instanceof PaintStockError)
          throw new GraphQLError(error.message, {
            extensions: { code: error.status === 404 ? "NOT_FOUND" : "BAD_USER_INPUT" },
          });
        throw error;
      }
    },
  },
  Subscription: {
    vaultChanges: { subscribe: (_root, args, context) => subscribeChanges(context.request, args) },
  },
};

export const schema = createSchema({
  typeDefs: readFileSync(new URL("./schema.graphql", import.meta.url), "utf8"),
  resolvers,
});

function makeYoga(endpoint: string) {
  return createYoga<{ metrics?: { rows: number } }, GraphQLContext>({
    graphqlEndpoint: endpoint,
    schema,
    graphiql: false,
    landingPage: false,
    cors: false,
    logging: false,
    batching: false,
    multipart: false,
    parserAndValidationCache: false,
    maxRequestBodySize: GRAPHQL_BODY_BYTES,
    requestId: { trustHeader: false },
    maskedErrors: {
      isDev: false,
      maskError(error, message) {
        const masked = maskError(error, message, false);
        if (masked !== error) {
          const correlationId = randomUUID();
          process.stderr.write(JSON.stringify({ event: "graphql.error", correlationId }) + "\n");
          return new GraphQLError("Unexpected server error", {
            extensions: { code: "INTERNAL_SERVER_ERROR", correlationId },
          });
        }
        return masked;
      },
    },
  });
}
const queryYoga = makeYoga("/api/graphql");
const streamYoga = makeYoga("/api/graphql/stream");

const failure = (message: string, status: number, code = "BAD_REQUEST") =>
  Response.json(
    { errors: [{ message, extensions: { code } }] },
    { status, headers: { "cache-control": "no-store" } },
  );

// Called only after the router's common host, Origin and vault authorization gates.
export async function graphqlResponse(request: Request, stream: boolean): Promise<Response> {
  if (request.method !== "POST") return failure("Use JSON POST", 405);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return failure("Content-Type must be application/json", 415);
  if (
    stream &&
    !request.headers
      .get("accept")
      ?.split(",")
      .some((value) => value.trim().split(";")[0] === "text/event-stream")
  )
    return failure("Subscriptions require Accept: text/event-stream", 406);
  const release = acquireOperation(request, stream);
  if (!release) return failure("Too many GraphQL operations", 429, "RATE_LIMITED");
  let streaming = false;
  const start = performance.now();
  let operationName: unknown;
  const metrics = { rows: 0 };
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure("Invalid JSON", 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return failure("HTTP batching is disabled", 400);
    const params = body as Record<string, unknown>;
    if (Object.keys(params).some((key) => !["query", "variables", "operationName"].includes(key)))
      return failure("Unsupported GraphQL request parameter", 400);
    operationName = params.operationName;
    checkOperation(schema, params, stream);
    // Rebuild the consumed JSON request without client-controlled length/transfer headers.
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.delete("transfer-encoding");
    // The ordinary endpoint must never negotiate incremental/SSE delivery.
    headers.set("accept", stream ? "text/event-stream" : "application/graphql-response+json");
    const forwarded = new Request(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
      signal: request.signal,
    });
    const response = await (stream ? streamYoga : queryYoga).fetch(forwarded, { metrics });
    response.headers.set("cache-control", "no-store");
    if (!stream || !response.body || !response.headers.get("content-type")?.startsWith("text/event-stream"))
      return response;
    response.headers.set("x-accel-buffering", "no");
    streaming = true;
    const reader = response.body.getReader();
    const abort = () => {
      release();
      void reader.cancel().catch(() => {});
    };
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    const finish = () => {
      release();
      request.signal.removeEventListener("abort", abort);
    };
    return new Response(
      new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const chunk = await reader.read();
            if (chunk.done) {
              finish();
              controller.close();
            } else controller.enqueue(chunk.value);
          } catch (error) {
            finish();
            controller.error(error);
          }
        },
        async cancel(reason) {
          finish();
          await reader.cancel(reason);
        },
      }),
      { status: response.status, headers: response.headers },
    );
  } catch (error) {
    if (error instanceof GraphQLError)
      return failure(
        error.message,
        400,
        typeof error.extensions.code === "string" ? error.extensions.code : "GRAPHQL_VALIDATION_FAILED",
      );
    const correlationId = randomUUID();
    process.stderr.write(JSON.stringify({ event: "graphql.error", correlationId }) + "\n");
    return failure(`Unexpected server error (${correlationId})`, 500, "INTERNAL_SERVER_ERROR");
  } finally {
    if (!streaming) release();
    if (process.env.NODE_ENV !== "test")
      process.stdout.write(
        JSON.stringify({
          event: "graphql.operation",
          operationName: typeof operationName === "string" ? operationName.slice(0, 128) : null,
          durationMs: Math.round(performance.now() - start),
          rowCount: metrics.rows,
          stream,
        }) + "\n",
      );
  }
}
