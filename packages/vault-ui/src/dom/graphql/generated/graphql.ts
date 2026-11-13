/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type LibraryPaintFragment = {
  id: string;
  brand: string;
  range: string;
  name: string;
  colorHex: string | null;
  type: string | null;
  discontinued: boolean;
  inventory: { state: string; stockLevel: string; quantity: number } | null;
} & { " $fragmentName"?: "LibraryPaintFragment" };

export type LibraryPageQueryVariables = Exact<{
  first?: number;
  after?: string | null | undefined;
}>;

export type LibraryPageQuery = {
  library: {
    nodes: Array<{ " $fragmentRefs"?: { LibraryPaintFragment: LibraryPaintFragment } }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    revision: { epoch: string; seq: number };
  };
};

export type VaultChangesSubscriptionVariables = Exact<{
  epoch: string;
  since: number;
}>;

export type VaultChangesSubscription = { vaultChanges: { epoch: string; seq: number; reset: boolean } };

export const LibraryPaintFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "LibraryPaint" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Paint" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "brand" } },
          { kind: "Field", name: { kind: "Name", value: "range" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "colorHex" } },
          { kind: "Field", name: { kind: "Name", value: "type" } },
          { kind: "Field", name: { kind: "Name", value: "discontinued" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "inventory" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "state" } },
                { kind: "Field", name: { kind: "Name", value: "stockLevel" } },
                { kind: "Field", name: { kind: "Name", value: "quantity" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<LibraryPaintFragment, unknown>;
export const LibraryPageDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "LibraryPage" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "first" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "Int" } } },
          defaultValue: { kind: "IntValue", value: "48" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "after" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "library" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "Variable", name: { kind: "Name", value: "first" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "after" },
                value: { kind: "Variable", name: { kind: "Name", value: "after" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "nodes" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "LibraryPaint" } }],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pageInfo" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
                      { kind: "Field", name: { kind: "Name", value: "endCursor" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "revision" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "epoch" } },
                      { kind: "Field", name: { kind: "Name", value: "seq" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "LibraryPaint" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Paint" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "brand" } },
          { kind: "Field", name: { kind: "Name", value: "range" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "colorHex" } },
          { kind: "Field", name: { kind: "Name", value: "type" } },
          { kind: "Field", name: { kind: "Name", value: "discontinued" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "inventory" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "state" } },
                { kind: "Field", name: { kind: "Name", value: "stockLevel" } },
                { kind: "Field", name: { kind: "Name", value: "quantity" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<LibraryPageQuery, LibraryPageQueryVariables>;
export const VaultChangesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: { kind: "Name", value: "VaultChanges" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "epoch" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "since" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "Int" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "vaultChanges" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "epoch" },
                value: { kind: "Variable", name: { kind: "Name", value: "epoch" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "since" },
                value: { kind: "Variable", name: { kind: "Name", value: "since" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "epoch" } },
                { kind: "Field", name: { kind: "Name", value: "seq" } },
                { kind: "Field", name: { kind: "Name", value: "reset" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<VaultChangesSubscription, VaultChangesSubscriptionVariables>;
