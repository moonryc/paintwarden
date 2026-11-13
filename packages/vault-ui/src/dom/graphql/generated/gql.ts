/* eslint-disable */
import * as types from "./graphql";
import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
  "fragment LibraryPaint on Paint {\n  id\n  brand\n  range\n  name\n  colorHex\n  type\n  discontinued\n  inventory {\n    state\n    stockLevel\n    quantity\n  }\n}\n\nquery LibraryPage($first: Int! = 48, $after: String) {\n  library(first: $first, after: $after) {\n    nodes {\n      ...LibraryPaint\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    revision {\n      epoch\n      seq\n    }\n  }\n}\n\nsubscription VaultChanges($epoch: String!, $since: Sequence!) {\n  vaultChanges(epoch: $epoch, since: $since) {\n    epoch\n    seq\n    reset\n  }\n}": typeof types.LibraryPaintFragmentDoc;
};
const documents: Documents = {
  "fragment LibraryPaint on Paint {\n  id\n  brand\n  range\n  name\n  colorHex\n  type\n  discontinued\n  inventory {\n    state\n    stockLevel\n    quantity\n  }\n}\n\nquery LibraryPage($first: Int! = 48, $after: String) {\n  library(first: $first, after: $after) {\n    nodes {\n      ...LibraryPaint\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    revision {\n      epoch\n      seq\n    }\n  }\n}\n\nsubscription VaultChanges($epoch: String!, $since: Sequence!) {\n  vaultChanges(epoch: $epoch, since: $since) {\n    epoch\n    seq\n    reset\n  }\n}":
    types.LibraryPaintFragmentDoc,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "fragment LibraryPaint on Paint {\n  id\n  brand\n  range\n  name\n  colorHex\n  type\n  discontinued\n  inventory {\n    state\n    stockLevel\n    quantity\n  }\n}\n\nquery LibraryPage($first: Int! = 48, $after: String) {\n  library(first: $first, after: $after) {\n    nodes {\n      ...LibraryPaint\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    revision {\n      epoch\n      seq\n    }\n  }\n}\n\nsubscription VaultChanges($epoch: String!, $since: Sequence!) {\n  vaultChanges(epoch: $epoch, since: $since) {\n    epoch\n    seq\n    reset\n  }\n}",
): (typeof documents)["fragment LibraryPaint on Paint {\n  id\n  brand\n  range\n  name\n  colorHex\n  type\n  discontinued\n  inventory {\n    state\n    stockLevel\n    quantity\n  }\n}\n\nquery LibraryPage($first: Int! = 48, $after: String) {\n  library(first: $first, after: $after) {\n    nodes {\n      ...LibraryPaint\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    revision {\n      epoch\n      seq\n    }\n  }\n}\n\nsubscription VaultChanges($epoch: String!, $since: Sequence!) {\n  vaultChanges(epoch: $epoch, since: $since) {\n    epoch\n    seq\n    reset\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> =
  TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;
