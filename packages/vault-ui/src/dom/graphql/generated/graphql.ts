/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type BrokenReason = "CYCLE" | "EMPTY";

export type LibraryFilter = "ALL" | "OWNED" | "UNTRACKED" | "WISHLIST";

export type Ownership = "OWNED" | "WISHLIST";

export type StockLevel = "EMPTY" | "FULL" | "LOW";

export type VaultFamily =
  "HOME" | "LIBRARY" | "MINIATURES" | "OPTIONS" | "PAINT" | "SCHEMES" | "SOURCES" | "TEMPLATES" | "WISHLIST";

export type DetailPaintFragment = {
  id: string;
  brand: string;
  range: string;
  name: string;
  colorHex: string | null;
  sourceUrl: string | null;
  isCustom: boolean;
  sourceName: string | null;
  sourceLogoUrl: string | null;
  available: boolean;
  hasActiveSubstitution: boolean;
  brokenReason: BrokenReason | null;
  missingStock: boolean;
  brokenSubstitution: boolean;
  inventory: { state: string; stockLevel: string; quantity: number } | null;
  activeSubstitution: { id: string; name: string } | null;
} & { " $fragmentName"?: "DetailPaintFragment" };

export type DetailSubstitutionFragment = {
  id: string;
  targetPaintId: string;
  name: string;
  isDefault: boolean;
  available: boolean;
  brokenReason: BrokenReason | null;
  ingredients: {
    totalCount: number;
    nodes: Array<{
      parts: number;
      sortOrder: number;
      paint: { " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } };
    }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
} & { " $fragmentName"?: "DetailSubstitutionFragment" };

export type PaintDetailsQueryVariables = Exact<{
  id: string | number;
  substitutionsAfter?: string | null | undefined;
  usedByAfter?: string | null | undefined;
}>;

export type PaintDetailsQuery = {
  paint: {
    revision: { epoch: string; seq: string };
    paint: { " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } } | null;
    substitutions: {
      totalCount: number;
      nodes: Array<{ " $fragmentRefs"?: { DetailSubstitutionFragment: DetailSubstitutionFragment } }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
    usedBy: {
      totalCount: number;
      nodes: Array<{ id: string; title: string }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
};

export type PaintSubstitutionIngredientsQueryVariables = Exact<{
  id: string | number;
  after?: string | null | undefined;
}>;

export type PaintSubstitutionIngredientsQuery = {
  substitution: {
    revision: { epoch: string; seq: string };
    substitution: {
      id: string;
      ingredients: {
        totalCount: number;
        nodes: Array<{
          parts: number;
          sortOrder: number;
          paint: { " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } };
        }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } | null;
  };
};

export type PaintPickerOptionsQueryVariables = Exact<{
  search: string;
  excludeIds: Array<string | number> | string | number;
  first: number;
}>;

export type PaintPickerOptionsQuery = {
  paintOptions: {
    revision: { epoch: string; seq: string };
    items: Array<{ " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } }>;
  };
};

export type LibraryPaintFragment = {
  id: string;
  brand: string;
  range: string;
  name: string;
  colorHex: string | null;
  sourceUrl: string | null;
  isCustom: boolean;
  sourceName: string | null;
  sourceLogoUrl: string | null;
  type: string | null;
  discontinued: boolean;
  available: boolean;
  brokenSubstitution: boolean;
  brokenReason: BrokenReason | null;
  missingStock: boolean;
  inventory: { state: string; stockLevel: string; quantity: number } | null;
  activeSubstitution: { id: string; name: string } | null;
} & { " $fragmentName"?: "LibraryPaintFragment" };

export type LibraryPageQueryVariables = Exact<{
  first?: number;
  after?: string | null | undefined;
  filter?: LibraryFilter | null | undefined;
  search?: string | null | undefined;
  brand?: string | null | undefined;
  sourceName?: string | null | undefined;
  noSource?: boolean | null | undefined;
}>;

export type LibraryPageQuery = {
  library: {
    totalCount: number;
    catalogCount: number;
    availableCount: number;
    explicitWishlistCount: number;
    nodes: Array<{ " $fragmentRefs"?: { LibraryPaintFragment: LibraryPaintFragment } }>;
    facets: {
      brands: Array<{ key: string; label: string; count: number }>;
      sources: Array<{ key: string; label: string; count: number }>;
      inventory: Array<{ key: string; label: string; count: number }>;
    };
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    revision: { epoch: string; seq: string };
  };
};

export type VaultChangesSubscriptionVariables = Exact<{
  epoch: string;
  since: string;
}>;

export type VaultChangesSubscription = {
  vaultChanges: { epoch: string; seq: string; reset: boolean; families: Array<VaultFamily> };
};

export type VaultInvalidationQueryVariables = Exact<{
  epoch: string;
  since: string;
}>;

export type VaultInvalidationQuery = {
  vaultInvalidation: { epoch: string; seq: string; reset: boolean; families: Array<VaultFamily> };
};

export type VaultRevisionQueryVariables = Exact<{ [key: string]: never }>;

export type VaultRevisionQuery = { vaultRevision: { epoch: string; seq: string } };

export type PaintStockFragment = {
  id: string;
  inventory: { state: string; stockLevel: string; quantity: number } | null;
} & { " $fragmentName"?: "PaintStockFragment" };

export type SetPaintStockMutationVariables = Exact<{
  paintId: string | number;
  state?: Ownership | null | undefined;
  stockLevel?: StockLevel | null | undefined;
  quantity?: number | null | undefined;
  clientMutationId?: string | null | undefined;
}>;

export type SetPaintStockMutation = {
  setPaintStock: {
    clientMutationId: string | null;
    invalidatedFamilies: Array<VaultFamily>;
    revision: { epoch: string; seq: string };
    paint: { " $fragmentRefs"?: { PaintStockFragment: PaintStockFragment } } | null;
  };
};

export const DetailPaintFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "DetailPaint" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Paint" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "brand" } },
          { kind: "Field", name: { kind: "Name", value: "range" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "colorHex" } },
          { kind: "Field", name: { kind: "Name", value: "sourceUrl" } },
          { kind: "Field", name: { kind: "Name", value: "isCustom" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
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
          { kind: "Field", name: { kind: "Name", value: "available" } },
          { kind: "Field", name: { kind: "Name", value: "hasActiveSubstitution" } },
          { kind: "Field", name: { kind: "Name", value: "brokenReason" } },
          { kind: "Field", name: { kind: "Name", value: "missingStock" } },
          { kind: "Field", name: { kind: "Name", value: "brokenSubstitution" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "activeSubstitution" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DetailPaintFragment, unknown>;
export const DetailSubstitutionFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "DetailSubstitution" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Substitution" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "targetPaintId" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "isDefault" } },
          { kind: "Field", name: { kind: "Name", value: "available" } },
          { kind: "Field", name: { kind: "Name", value: "brokenReason" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "ingredients" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "20" },
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
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "paint" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "FragmentSpread", name: { kind: "Name", value: "DetailPaint" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "parts" } },
                      { kind: "Field", name: { kind: "Name", value: "sortOrder" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
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
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "DetailPaint" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Paint" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "brand" } },
          { kind: "Field", name: { kind: "Name", value: "range" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "colorHex" } },
          { kind: "Field", name: { kind: "Name", value: "sourceUrl" } },
          { kind: "Field", name: { kind: "Name", value: "isCustom" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
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
          { kind: "Field", name: { kind: "Name", value: "available" } },
          { kind: "Field", name: { kind: "Name", value: "hasActiveSubstitution" } },
          { kind: "Field", name: { kind: "Name", value: "brokenReason" } },
          { kind: "Field", name: { kind: "Name", value: "missingStock" } },
          { kind: "Field", name: { kind: "Name", value: "brokenSubstitution" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "activeSubstitution" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DetailSubstitutionFragment, unknown>;
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
          { kind: "Field", name: { kind: "Name", value: "sourceUrl" } },
          { kind: "Field", name: { kind: "Name", value: "isCustom" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
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
          { kind: "Field", name: { kind: "Name", value: "available" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "activeSubstitution" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
          { kind: "Field", name: { kind: "Name", value: "brokenSubstitution" } },
          { kind: "Field", name: { kind: "Name", value: "brokenReason" } },
          { kind: "Field", name: { kind: "Name", value: "missingStock" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<LibraryPaintFragment, unknown>;
export const PaintStockFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "PaintStock" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Paint" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
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
} as unknown as DocumentNode<PaintStockFragment, unknown>;
export const PaintDetailsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PaintDetails" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "substitutionsAfter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "usedByAfter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "paint" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "paint" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "DetailPaint" } }],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "substitutions" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "10" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: { kind: "Variable", name: { kind: "Name", value: "substitutionsAfter" } },
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
                          selections: [
                            { kind: "FragmentSpread", name: { kind: "Name", value: "DetailSubstitution" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "totalCount" } },
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
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "usedBy" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "30" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: { kind: "Variable", name: { kind: "Name", value: "usedByAfter" } },
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
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "title" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "totalCount" } },
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
      name: { kind: "Name", value: "DetailPaint" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Paint" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "brand" } },
          { kind: "Field", name: { kind: "Name", value: "range" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "colorHex" } },
          { kind: "Field", name: { kind: "Name", value: "sourceUrl" } },
          { kind: "Field", name: { kind: "Name", value: "isCustom" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
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
          { kind: "Field", name: { kind: "Name", value: "available" } },
          { kind: "Field", name: { kind: "Name", value: "hasActiveSubstitution" } },
          { kind: "Field", name: { kind: "Name", value: "brokenReason" } },
          { kind: "Field", name: { kind: "Name", value: "missingStock" } },
          { kind: "Field", name: { kind: "Name", value: "brokenSubstitution" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "activeSubstitution" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "DetailSubstitution" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Substitution" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "targetPaintId" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "isDefault" } },
          { kind: "Field", name: { kind: "Name", value: "available" } },
          { kind: "Field", name: { kind: "Name", value: "brokenReason" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "ingredients" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "20" },
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
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "paint" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "FragmentSpread", name: { kind: "Name", value: "DetailPaint" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "parts" } },
                      { kind: "Field", name: { kind: "Name", value: "sortOrder" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PaintDetailsQuery, PaintDetailsQueryVariables>;
export const PaintSubstitutionIngredientsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PaintSubstitutionIngredients" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
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
            name: { kind: "Name", value: "substitution" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "substitution" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "ingredients" },
                        arguments: [
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "first" },
                            value: { kind: "IntValue", value: "100" },
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
                                selections: [
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "paint" },
                                    selectionSet: {
                                      kind: "SelectionSet",
                                      selections: [
                                        {
                                          kind: "FragmentSpread",
                                          name: { kind: "Name", value: "DetailPaint" },
                                        },
                                      ],
                                    },
                                  },
                                  { kind: "Field", name: { kind: "Name", value: "parts" } },
                                  { kind: "Field", name: { kind: "Name", value: "sortOrder" } },
                                ],
                              },
                            },
                            { kind: "Field", name: { kind: "Name", value: "totalCount" } },
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
                          ],
                        },
                      },
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
      name: { kind: "Name", value: "DetailPaint" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Paint" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "brand" } },
          { kind: "Field", name: { kind: "Name", value: "range" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "colorHex" } },
          { kind: "Field", name: { kind: "Name", value: "sourceUrl" } },
          { kind: "Field", name: { kind: "Name", value: "isCustom" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
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
          { kind: "Field", name: { kind: "Name", value: "available" } },
          { kind: "Field", name: { kind: "Name", value: "hasActiveSubstitution" } },
          { kind: "Field", name: { kind: "Name", value: "brokenReason" } },
          { kind: "Field", name: { kind: "Name", value: "missingStock" } },
          { kind: "Field", name: { kind: "Name", value: "brokenSubstitution" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "activeSubstitution" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PaintSubstitutionIngredientsQuery, PaintSubstitutionIngredientsQueryVariables>;
export const PaintPickerOptionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PaintPickerOptions" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "excludeIds" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "ListType",
              type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "first" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "Int" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "paintOptions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "excludeIds" },
                value: { kind: "Variable", name: { kind: "Name", value: "excludeIds" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "Variable", name: { kind: "Name", value: "first" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "items" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "DetailPaint" } }],
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
      name: { kind: "Name", value: "DetailPaint" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Paint" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "brand" } },
          { kind: "Field", name: { kind: "Name", value: "range" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "colorHex" } },
          { kind: "Field", name: { kind: "Name", value: "sourceUrl" } },
          { kind: "Field", name: { kind: "Name", value: "isCustom" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
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
          { kind: "Field", name: { kind: "Name", value: "available" } },
          { kind: "Field", name: { kind: "Name", value: "hasActiveSubstitution" } },
          { kind: "Field", name: { kind: "Name", value: "brokenReason" } },
          { kind: "Field", name: { kind: "Name", value: "missingStock" } },
          { kind: "Field", name: { kind: "Name", value: "brokenSubstitution" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "activeSubstitution" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PaintPickerOptionsQuery, PaintPickerOptionsQueryVariables>;
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
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "filter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "LibraryFilter" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "brand" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "sourceName" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "noSource" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
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
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: { kind: "Variable", name: { kind: "Name", value: "filter" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "brand" },
                value: { kind: "Variable", name: { kind: "Name", value: "brand" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "sourceName" },
                value: { kind: "Variable", name: { kind: "Name", value: "sourceName" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "noSource" },
                value: { kind: "Variable", name: { kind: "Name", value: "noSource" } },
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
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "catalogCount" } },
                { kind: "Field", name: { kind: "Name", value: "availableCount" } },
                { kind: "Field", name: { kind: "Name", value: "explicitWishlistCount" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "facets" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "brands" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "key" } },
                            { kind: "Field", name: { kind: "Name", value: "label" } },
                            { kind: "Field", name: { kind: "Name", value: "count" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "sources" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "key" } },
                            { kind: "Field", name: { kind: "Name", value: "label" } },
                            { kind: "Field", name: { kind: "Name", value: "count" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "inventory" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "key" } },
                            { kind: "Field", name: { kind: "Name", value: "label" } },
                            { kind: "Field", name: { kind: "Name", value: "count" } },
                          ],
                        },
                      },
                    ],
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
          { kind: "Field", name: { kind: "Name", value: "sourceUrl" } },
          { kind: "Field", name: { kind: "Name", value: "isCustom" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
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
          { kind: "Field", name: { kind: "Name", value: "available" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "activeSubstitution" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
          { kind: "Field", name: { kind: "Name", value: "brokenSubstitution" } },
          { kind: "Field", name: { kind: "Name", value: "brokenReason" } },
          { kind: "Field", name: { kind: "Name", value: "missingStock" } },
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
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Sequence" } },
          },
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
                { kind: "Field", name: { kind: "Name", value: "families" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<VaultChangesSubscription, VaultChangesSubscriptionVariables>;
export const VaultInvalidationDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "VaultInvalidation" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "epoch" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "since" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Sequence" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "vaultInvalidation" },
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
                { kind: "Field", name: { kind: "Name", value: "families" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<VaultInvalidationQuery, VaultInvalidationQueryVariables>;
export const VaultRevisionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "VaultRevision" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "vaultRevision" },
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
} as unknown as DocumentNode<VaultRevisionQuery, VaultRevisionQueryVariables>;
export const SetPaintStockDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "SetPaintStock" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "paintId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "state" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Ownership" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "stockLevel" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "StockLevel" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "quantity" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "clientMutationId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "setPaintStock" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "paintId" },
                value: { kind: "Variable", name: { kind: "Name", value: "paintId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "state" },
                value: { kind: "Variable", name: { kind: "Name", value: "state" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "stockLevel" },
                value: { kind: "Variable", name: { kind: "Name", value: "stockLevel" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "quantity" },
                value: { kind: "Variable", name: { kind: "Name", value: "quantity" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "clientMutationId" },
                value: { kind: "Variable", name: { kind: "Name", value: "clientMutationId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "paint" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "PaintStock" } }],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
                { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "PaintStock" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Paint" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
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
} as unknown as DocumentNode<SetPaintStockMutation, SetPaintStockMutationVariables>;
