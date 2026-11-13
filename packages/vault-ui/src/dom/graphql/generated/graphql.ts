/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type BrokenReason = "CYCLE" | "EMPTY";

export type LibraryFilter = "ALL" | "OWNED" | "UNTRACKED" | "WISHLIST";

export type MiniatureInput = {
  faction?: string | null | undefined;
  includeTemplateImage?: boolean | null | undefined;
  manufacturer?: string | null | undefined;
  notes?: string | null | undefined;
  paintingStatus?: PaintingStatus | null | undefined;
  scale?: string | null | undefined;
  status?: Ownership | null | undefined;
  templateId?: string | number | null | undefined;
  title?: string | null | undefined;
};

export type MiniatureRecipeEntryInput = {
  id?: string | number | null | undefined;
  notes?: string | null | undefined;
  paintId: string | number;
  sortOrder?: number | null | undefined;
  step?: string | null | undefined;
};

export type MiniatureSchemeEntryKind = "DIVIDER" | "IMAGE" | "PAINT";

export type Ownership = "OWNED" | "WISHLIST";

export type PaintingStatus = "ASSEMBLED" | "COMPLETE" | "IN_PROGRESS" | "NOT_STARTED" | "PRIMED";

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

export type ProjectMiniatureDetailsQueryVariables = Exact<{
  id: string | number;
  recipeAfter?: string | null | undefined;
  schemesAfter?: string | null | undefined;
  missingAfter?: string | null | undefined;
  requiredAfter?: string | null | undefined;
}>;

export type ProjectMiniatureDetailsQuery = {
  miniature: {
    recipeSteps: Array<string>;
    revision: { epoch: string; seq: string };
    miniature: {
      id: string;
      title: string;
      status: Ownership;
      paintingStatus: PaintingStatus;
      imageUrl: string | null;
      createdAt: number;
      notes: string;
      manufacturer: string;
      faction: string;
      scale: string;
    } | null;
    recipe: {
      totalCount: number;
      nodes: Array<{
        id: string;
        step: string;
        notes: string;
        sortOrder: number;
        paint: { " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } };
      }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
    schemes: {
      totalCount: number;
      nodes: Array<{
        id: string;
        sortOrder: number;
        scheme: {
          id: string;
          name: string;
          category: string | null;
          isSystem: boolean;
          sourceName: string | null;
          sourceLogoUrl: string | null;
        };
      }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
    missing: {
      totalCount: number;
      nodes: Array<{
        id: string;
        missingStock: boolean;
        brokenSubstitution: boolean;
        paint: { " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } };
      }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
    required: {
      totalCount: number;
      nodes: Array<{ " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
};

export type MiniatureEditResultFragment = {
  miniatureId: string;
  clientMutationId: string | null;
  invalidatedFamilies: Array<VaultFamily>;
  revision: { epoch: string; seq: string };
} & { " $fragmentName"?: "MiniatureEditResultFragment" };

export type CreateProjectMiniatureMutationVariables = Exact<{
  input: MiniatureInput;
  clientMutationId?: string | null | undefined;
}>;

export type CreateProjectMiniatureMutation = {
  createMiniature: { " $fragmentRefs"?: { MiniatureEditResultFragment: MiniatureEditResultFragment } };
};

export type UpdateProjectMiniatureMutationVariables = Exact<{
  id: string | number;
  input: MiniatureInput;
  clientMutationId?: string | null | undefined;
}>;

export type UpdateProjectMiniatureMutation = {
  updateMiniature: { " $fragmentRefs"?: { MiniatureEditResultFragment: MiniatureEditResultFragment } };
};

export type DeleteProjectMiniatureMutationVariables = Exact<{
  id: string | number;
  clientMutationId?: string | null | undefined;
}>;

export type DeleteProjectMiniatureMutation = {
  deleteMiniature: { " $fragmentRefs"?: { MiniatureEditResultFragment: MiniatureEditResultFragment } };
};

export type SetProjectRecipeMutationVariables = Exact<{
  id: string | number;
  entries: Array<MiniatureRecipeEntryInput> | MiniatureRecipeEntryInput;
  steps?: Array<string> | string | null | undefined;
  clientMutationId?: string | null | undefined;
}>;

export type SetProjectRecipeMutation = {
  setMiniatureRecipe: { " $fragmentRefs"?: { MiniatureEditResultFragment: MiniatureEditResultFragment } };
};

export type SetProjectSchemesMutationVariables = Exact<{
  id: string | number;
  schemeIds: Array<string | number> | string | number;
  clientMutationId?: string | null | undefined;
}>;

export type SetProjectSchemesMutation = {
  setMiniatureSchemes: { " $fragmentRefs"?: { MiniatureEditResultFragment: MiniatureEditResultFragment } };
};

export type MiniatureTileFragment = {
  id: string;
  title: string;
  status: Ownership;
  imageUrl: string | null;
  readiness: { total: number; missing: number };
  previewSwatches: Array<{ colorHex: string }>;
} & { " $fragmentName"?: "MiniatureTileFragment" };

export type MiniatureListQueryVariables = Exact<{
  workbench: boolean;
  first: number;
  after?: string | null | undefined;
  ownership?: Ownership | null | undefined;
  stage?: PaintingStatus | null | undefined;
  search?: string | null | undefined;
}>;

export type MiniatureListQuery = {
  home?: {
    revision: { epoch: string; seq: string };
    counts: {
      catalogCount: number;
      owned: number;
      ready: number;
      distinctMissingPaints: number;
      wishlistedMissingPaints: number;
      stages: Array<{ key: string; label: string; count: number }>;
    };
    miniatures: {
      totalCount: number;
      nodes: Array<{ " $fragmentRefs"?: { MiniatureTileFragment: MiniatureTileFragment } }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
  miniatures?: {
    revision: { epoch: string; seq: string };
    ownershipCounts: Array<{ key: string; label: string; count: number }>;
    stageCounts: Array<{ key: string; label: string; count: number }>;
    miniatures: {
      totalCount: number;
      nodes: Array<{ " $fragmentRefs"?: { MiniatureTileFragment: MiniatureTileFragment } }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
};

export type MiniatureSchemeSummaryFragment = {
  id: string;
  name: string;
  category: string | null;
  isSystem: boolean;
  sourceName: string | null;
  sourceLogoUrl: string | null;
  paintCount: number;
  availableCount: number;
  previewSwatchesTruncated: boolean;
  imageUrl: string | null;
  previewSwatches: Array<{ paintId: string; colorHex: string }>;
} & { " $fragmentName"?: "MiniatureSchemeSummaryFragment" };

export type MiniatureSchemeDetailsQueryVariables = Exact<{
  id: string | number;
  after?: string | null | undefined;
}>;

export type MiniatureSchemeDetailsQuery = {
  miniatureScheme: {
    revision: { epoch: string; seq: string };
    scheme: { " $fragmentRefs"?: { MiniatureSchemeSummaryFragment: MiniatureSchemeSummaryFragment } } | null;
    entries: {
      totalCount: number;
      nodes: Array<{
        id: string;
        kind: MiniatureSchemeEntryKind;
        sortOrder: number;
        label: string | null;
        tone: string | null;
        role: string | null;
        imageUrl: string | null;
        thumbnailUrl: string | null;
        imageType: string | null;
        method: string | null;
        paint: { " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } } | null;
      }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
};

export type SchemePickerOptionsQueryVariables = Exact<{
  search: string;
  category?: string | null | undefined;
  excludeIds: Array<string | number> | string | number;
  after?: string | null | undefined;
}>;

export type SchemePickerOptionsQuery = {
  schemeOptions: {
    totalCount: number;
    revision: { epoch: string; seq: string };
    nodes: Array<{ " $fragmentRefs"?: { MiniatureSchemeSummaryFragment: MiniatureSchemeSummaryFragment } }>;
    categoryCounts: Array<{ key: string; label: string; count: number }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export type VaultNavigationQueryVariables = Exact<{ [key: string]: never }>;

export type VaultNavigationQuery = {
  vaultNavigation: {
    availablePaints: number;
    shoppingPaints: number;
    revision: { epoch: string; seq: string };
  };
};

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
export const MiniatureEditResultFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "MiniatureEditResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "MiniatureMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "miniatureId" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MiniatureEditResultFragment, unknown>;
export const MiniatureTileFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "MiniatureTile" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Miniature" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "title" } },
          { kind: "Field", name: { kind: "Name", value: "status" } },
          { kind: "Field", name: { kind: "Name", value: "imageUrl" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "readiness" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "total" } },
                { kind: "Field", name: { kind: "Name", value: "missing" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "previewSwatches" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [{ kind: "Field", name: { kind: "Name", value: "colorHex" } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MiniatureTileFragment, unknown>;
export const MiniatureSchemeSummaryFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "MiniatureSchemeSummary" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "MiniatureScheme" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "category" } },
          { kind: "Field", name: { kind: "Name", value: "isSystem" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
          { kind: "Field", name: { kind: "Name", value: "paintCount" } },
          { kind: "Field", name: { kind: "Name", value: "availableCount" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "previewSwatches" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "paintId" } },
                { kind: "Field", name: { kind: "Name", value: "colorHex" } },
              ],
            },
          },
          { kind: "Field", name: { kind: "Name", value: "previewSwatchesTruncated" } },
          { kind: "Field", name: { kind: "Name", value: "imageUrl" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MiniatureSchemeSummaryFragment, unknown>;
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
export const ProjectMiniatureDetailsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ProjectMiniatureDetails" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "recipeAfter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "schemesAfter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "missingAfter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "requiredAfter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "miniature" },
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
                  name: { kind: "Name", value: "miniature" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "paintingStatus" } },
                      { kind: "Field", name: { kind: "Name", value: "imageUrl" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "notes" } },
                      { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                      { kind: "Field", name: { kind: "Name", value: "faction" } },
                      { kind: "Field", name: { kind: "Name", value: "scale" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "recipeSteps" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "recipe" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "40" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: { kind: "Variable", name: { kind: "Name", value: "recipeAfter" } },
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
                            { kind: "Field", name: { kind: "Name", value: "step" } },
                            { kind: "Field", name: { kind: "Name", value: "notes" } },
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "schemes" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "40" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: { kind: "Variable", name: { kind: "Name", value: "schemesAfter" } },
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
                            { kind: "Field", name: { kind: "Name", value: "sortOrder" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "scheme" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "id" } },
                                  { kind: "Field", name: { kind: "Name", value: "name" } },
                                  { kind: "Field", name: { kind: "Name", value: "category" } },
                                  { kind: "Field", name: { kind: "Name", value: "isSystem" } },
                                  { kind: "Field", name: { kind: "Name", value: "sourceName" } },
                                  { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
                                ],
                              },
                            },
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
                  name: { kind: "Name", value: "missing" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "40" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: { kind: "Variable", name: { kind: "Name", value: "missingAfter" } },
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
                            { kind: "Field", name: { kind: "Name", value: "missingStock" } },
                            { kind: "Field", name: { kind: "Name", value: "brokenSubstitution" } },
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
                  name: { kind: "Name", value: "required" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "40" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: { kind: "Variable", name: { kind: "Name", value: "requiredAfter" } },
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
                            { kind: "FragmentSpread", name: { kind: "Name", value: "DetailPaint" } },
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
  ],
} as unknown as DocumentNode<ProjectMiniatureDetailsQuery, ProjectMiniatureDetailsQueryVariables>;
export const CreateProjectMiniatureDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CreateProjectMiniature" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "input" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "MiniatureInput" } },
          },
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
            name: { kind: "Name", value: "createMiniature" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: { kind: "Variable", name: { kind: "Name", value: "input" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "clientMutationId" },
                value: { kind: "Variable", name: { kind: "Name", value: "clientMutationId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "MiniatureEditResult" } }],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "MiniatureEditResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "MiniatureMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "miniatureId" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CreateProjectMiniatureMutation, CreateProjectMiniatureMutationVariables>;
export const UpdateProjectMiniatureDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "UpdateProjectMiniature" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "input" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "MiniatureInput" } },
          },
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
            name: { kind: "Name", value: "updateMiniature" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: { kind: "Variable", name: { kind: "Name", value: "input" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "clientMutationId" },
                value: { kind: "Variable", name: { kind: "Name", value: "clientMutationId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "MiniatureEditResult" } }],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "MiniatureEditResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "MiniatureMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "miniatureId" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateProjectMiniatureMutation, UpdateProjectMiniatureMutationVariables>;
export const DeleteProjectMiniatureDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "DeleteProjectMiniature" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
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
            name: { kind: "Name", value: "deleteMiniature" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "clientMutationId" },
                value: { kind: "Variable", name: { kind: "Name", value: "clientMutationId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "MiniatureEditResult" } }],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "MiniatureEditResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "MiniatureMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "miniatureId" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeleteProjectMiniatureMutation, DeleteProjectMiniatureMutationVariables>;
export const SetProjectRecipeDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "SetProjectRecipe" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "entries" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "ListType",
              type: {
                kind: "NonNullType",
                type: { kind: "NamedType", name: { kind: "Name", value: "MiniatureRecipeEntryInput" } },
              },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "steps" } },
          type: {
            kind: "ListType",
            type: {
              kind: "NonNullType",
              type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
            },
          },
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
            name: { kind: "Name", value: "setMiniatureRecipe" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "entries" },
                value: { kind: "Variable", name: { kind: "Name", value: "entries" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "steps" },
                value: { kind: "Variable", name: { kind: "Name", value: "steps" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "clientMutationId" },
                value: { kind: "Variable", name: { kind: "Name", value: "clientMutationId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "MiniatureEditResult" } }],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "MiniatureEditResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "MiniatureMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "miniatureId" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SetProjectRecipeMutation, SetProjectRecipeMutationVariables>;
export const SetProjectSchemesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "SetProjectSchemes" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "schemeIds" } },
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
          variable: { kind: "Variable", name: { kind: "Name", value: "clientMutationId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "setMiniatureSchemes" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "schemeIds" },
                value: { kind: "Variable", name: { kind: "Name", value: "schemeIds" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "clientMutationId" },
                value: { kind: "Variable", name: { kind: "Name", value: "clientMutationId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "MiniatureEditResult" } }],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "MiniatureEditResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "MiniatureMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "miniatureId" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SetProjectSchemesMutation, SetProjectSchemesMutationVariables>;
export const MiniatureListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "MiniatureList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "workbench" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "first" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "Int" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "after" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "ownership" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Ownership" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "stage" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "PaintingStatus" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "home" },
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
                name: { kind: "Name", value: "stage" },
                value: { kind: "Variable", name: { kind: "Name", value: "stage" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
            ],
            directives: [
              {
                kind: "Directive",
                name: { kind: "Name", value: "include" },
                arguments: [
                  {
                    kind: "Argument",
                    name: { kind: "Name", value: "if" },
                    value: { kind: "Variable", name: { kind: "Name", value: "workbench" } },
                  },
                ],
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
                  name: { kind: "Name", value: "counts" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "catalogCount" } },
                      { kind: "Field", name: { kind: "Name", value: "owned" } },
                      { kind: "Field", name: { kind: "Name", value: "ready" } },
                      { kind: "Field", name: { kind: "Name", value: "distinctMissingPaints" } },
                      { kind: "Field", name: { kind: "Name", value: "wishlistedMissingPaints" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "stages" },
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
                  name: { kind: "Name", value: "miniatures" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "nodes" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "FragmentSpread", name: { kind: "Name", value: "MiniatureTile" } },
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
            kind: "Field",
            name: { kind: "Name", value: "miniatures" },
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
                name: { kind: "Name", value: "ownership" },
                value: { kind: "Variable", name: { kind: "Name", value: "ownership" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "stage" },
                value: { kind: "Variable", name: { kind: "Name", value: "stage" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
            ],
            directives: [
              {
                kind: "Directive",
                name: { kind: "Name", value: "skip" },
                arguments: [
                  {
                    kind: "Argument",
                    name: { kind: "Name", value: "if" },
                    value: { kind: "Variable", name: { kind: "Name", value: "workbench" } },
                  },
                ],
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
                  name: { kind: "Name", value: "ownershipCounts" },
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
                  name: { kind: "Name", value: "stageCounts" },
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
                  name: { kind: "Name", value: "miniatures" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "nodes" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "FragmentSpread", name: { kind: "Name", value: "MiniatureTile" } },
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
      name: { kind: "Name", value: "MiniatureTile" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Miniature" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "title" } },
          { kind: "Field", name: { kind: "Name", value: "status" } },
          { kind: "Field", name: { kind: "Name", value: "imageUrl" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "readiness" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "total" } },
                { kind: "Field", name: { kind: "Name", value: "missing" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "previewSwatches" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [{ kind: "Field", name: { kind: "Name", value: "colorHex" } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MiniatureListQuery, MiniatureListQueryVariables>;
export const MiniatureSchemeDetailsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "MiniatureSchemeDetails" },
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
            name: { kind: "Name", value: "miniatureScheme" },
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
                  name: { kind: "Name", value: "scheme" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "FragmentSpread", name: { kind: "Name", value: "MiniatureSchemeSummary" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "entries" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "40" },
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
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "kind" } },
                            { kind: "Field", name: { kind: "Name", value: "sortOrder" } },
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
                            { kind: "Field", name: { kind: "Name", value: "label" } },
                            { kind: "Field", name: { kind: "Name", value: "tone" } },
                            { kind: "Field", name: { kind: "Name", value: "role" } },
                            { kind: "Field", name: { kind: "Name", value: "imageUrl" } },
                            { kind: "Field", name: { kind: "Name", value: "thumbnailUrl" } },
                            { kind: "Field", name: { kind: "Name", value: "imageType" } },
                            { kind: "Field", name: { kind: "Name", value: "method" } },
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
      name: { kind: "Name", value: "MiniatureSchemeSummary" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "MiniatureScheme" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "category" } },
          { kind: "Field", name: { kind: "Name", value: "isSystem" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
          { kind: "Field", name: { kind: "Name", value: "paintCount" } },
          { kind: "Field", name: { kind: "Name", value: "availableCount" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "previewSwatches" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "paintId" } },
                { kind: "Field", name: { kind: "Name", value: "colorHex" } },
              ],
            },
          },
          { kind: "Field", name: { kind: "Name", value: "previewSwatchesTruncated" } },
          { kind: "Field", name: { kind: "Name", value: "imageUrl" } },
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
} as unknown as DocumentNode<MiniatureSchemeDetailsQuery, MiniatureSchemeDetailsQueryVariables>;
export const SchemePickerOptionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SchemePickerOptions" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "category" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
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
          variable: { kind: "Variable", name: { kind: "Name", value: "after" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "schemeOptions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "40" },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "after" },
                value: { kind: "Variable", name: { kind: "Name", value: "after" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "category" },
                value: { kind: "Variable", name: { kind: "Name", value: "category" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "excludeIds" },
                value: { kind: "Variable", name: { kind: "Name", value: "excludeIds" } },
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
                  name: { kind: "Name", value: "nodes" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "FragmentSpread", name: { kind: "Name", value: "MiniatureSchemeSummary" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "categoryCounts" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "key" } },
                      { kind: "Field", name: { kind: "Name", value: "label" } },
                      { kind: "Field", name: { kind: "Name", value: "count" } },
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
      name: { kind: "Name", value: "MiniatureSchemeSummary" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "MiniatureScheme" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "category" } },
          { kind: "Field", name: { kind: "Name", value: "isSystem" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
          { kind: "Field", name: { kind: "Name", value: "paintCount" } },
          { kind: "Field", name: { kind: "Name", value: "availableCount" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "previewSwatches" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "paintId" } },
                { kind: "Field", name: { kind: "Name", value: "colorHex" } },
              ],
            },
          },
          { kind: "Field", name: { kind: "Name", value: "previewSwatchesTruncated" } },
          { kind: "Field", name: { kind: "Name", value: "imageUrl" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SchemePickerOptionsQuery, SchemePickerOptionsQueryVariables>;
export const VaultNavigationDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "VaultNavigation" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "vaultNavigation" },
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
                { kind: "Field", name: { kind: "Name", value: "availablePaints" } },
                { kind: "Field", name: { kind: "Name", value: "shoppingPaints" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<VaultNavigationQuery, VaultNavigationQueryVariables>;
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
