/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type BrokenReason = "CYCLE" | "EMPTY";

export type CustomPaintImportInput = {
  brand?: string | null | undefined;
  colorHex?: string | null | undefined;
  name?: string | null | undefined;
  range?: string | null | undefined;
  sourceUrl?: string | null | undefined;
  type?: string | null | undefined;
};

export type CustomPaintInput = {
  brand: string;
  colorHex?: string | null | undefined;
  name: string;
  range?: string | null | undefined;
  sourceUrl?: string | null | undefined;
};

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

export type SchemeEntryInput = {
  id?: string | number | null | undefined;
  imageType?: string | null | undefined;
  imageUrl?: string | null | undefined;
  label?: string | null | undefined;
  method?: string | null | undefined;
  paintId?: string | number | null | undefined;
  role?: string | null | undefined;
  thumbnailUrl?: string | null | undefined;
  tone?: string | null | undefined;
  type: MiniatureSchemeEntryKind;
};

export type SchemeInput = {
  category: string;
  entries: Array<SchemeEntryInput>;
  name: string;
};

export type SchemeReadiness = "MISSING" | "READY";

export type StockLevel = "EMPTY" | "FULL" | "LOW";

export type SubstitutionIngredientInput = {
  paintId: string | number;
  parts?: number | null | undefined;
};

export type SubstitutionInput = {
  ingredients: Array<SubstitutionIngredientInput>;
  name: string;
  targetPaintId: string | number;
};

export type TemplateInput = {
  faction?: string | null | undefined;
  imageUrl?: string | null | undefined;
  manufacturer?: string | null | undefined;
  name?: string | null | undefined;
  paints?: Array<TemplatePaintInput> | null | undefined;
  schemeIds?: Array<string | number> | null | undefined;
  sourceMiniatureId?: string | number | null | undefined;
};

export type TemplatePaintInput = {
  notes?: string;
  paintId: string | number;
  sortOrder?: number;
  step: string;
};

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
  thumbnailUrl: string | null;
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
  thumbnailUrl: string | null;
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

export type ImportCustomPaintsMutationVariables = Exact<{
  paints: Array<CustomPaintImportInput> | CustomPaintImportInput;
  clientMutationId?: string | null | undefined;
}>;

export type ImportCustomPaintsMutation = {
  importCustomPaints: {
    imported: number;
    skipped: number;
    clientMutationId: string | null;
    invalidatedFamilies: Array<VaultFamily>;
    revision: { epoch: string; seq: string };
  };
};

export type UpdateCustomPaintMutationVariables = Exact<{
  id: string | number;
  input: CustomPaintInput;
  clientMutationId?: string | null | undefined;
}>;

export type UpdateCustomPaintMutation = {
  updateCustomPaint: {
    paintId: string;
    clientMutationId: string | null;
    invalidatedFamilies: Array<VaultFamily>;
    revision: { epoch: string; seq: string };
  };
};

export type DeleteCustomPaintMutationVariables = Exact<{
  id: string | number;
  clientMutationId?: string | null | undefined;
}>;

export type DeleteCustomPaintMutation = {
  deleteCustomPaint: {
    paintId: string;
    clientMutationId: string | null;
    invalidatedFamilies: Array<VaultFamily>;
    revision: { epoch: string; seq: string };
  };
};

export type CreateSubstitutionMutationVariables = Exact<{
  input: SubstitutionInput;
  clientMutationId?: string | null | undefined;
}>;

export type CreateSubstitutionMutation = {
  createSubstitution: {
    substitutionId: string | null;
    clientMutationId: string | null;
    invalidatedFamilies: Array<VaultFamily>;
    revision: { epoch: string; seq: string };
  };
};

export type SetSubstitutionDefaultMutationVariables = Exact<{
  id: string | number;
  enabled: boolean;
  clientMutationId?: string | null | undefined;
}>;

export type SetSubstitutionDefaultMutation = {
  setSubstitutionDefault: {
    substitutionId: string | null;
    clientMutationId: string | null;
    invalidatedFamilies: Array<VaultFamily>;
    revision: { epoch: string; seq: string };
  };
};

export type DeleteSubstitutionMutationVariables = Exact<{
  id: string | number;
  clientMutationId?: string | null | undefined;
}>;

export type DeleteSubstitutionMutation = {
  deleteSubstitution: {
    substitutionId: string | null;
    clientMutationId: string | null;
    invalidatedFamilies: Array<VaultFamily>;
    revision: { epoch: string; seq: string };
  };
};

export type SelectPaintSubstitutionMutationVariables = Exact<{
  miniatureId: string | number;
  targetPaintId: string | number;
  substitutionId?: string | number | null | undefined;
  useOriginal?: boolean;
  clientMutationId?: string | null | undefined;
}>;

export type SelectPaintSubstitutionMutation = {
  selectPaintSubstitution: {
    miniatureId: string | null;
    paintId: string | null;
    substitutionId: string | null;
    clientMutationId: string | null;
    invalidatedFamilies: Array<VaultFamily>;
    revision: { epoch: string; seq: string };
  };
};

export type PaintToolRankingQueryVariables = Exact<{
  id: string | number;
  ownedOnly?: boolean;
  after?: string | null | undefined;
}>;

export type PaintToolRankingQuery = {
  paintRanking: {
    owned: boolean;
    suggestedId: string | null;
    totalCount: number;
    revision: { epoch: string; seq: string };
    paint: { " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } } | null;
    nodes: Array<{
      sameType: boolean;
      paint: { " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } };
      match: {
        score: number;
        distance: number;
        lightnessDelta: number;
        hueDelta: number | null;
        intensityDelta: number;
      };
    }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export type OwnedPaintPickerOptionsQueryVariables = Exact<{
  search: string;
}>;

export type OwnedPaintPickerOptionsQuery = {
  ownedPaintOptions: {
    revision: { epoch: string; seq: string };
    items: Array<{ " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } }>;
  };
};

export type PaintToolChoiceQueryVariables = Exact<{
  id: string | number;
}>;

export type PaintToolChoiceQuery = {
  paint: {
    revision: { epoch: string; seq: string };
    paint: { " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } } | null;
  };
};

export type SchemesPageQueryVariables = Exact<{
  after?: string | null | undefined;
  search?: string | null | undefined;
  category?: string | null | undefined;
  sourceId?: string | number | null | undefined;
  noSource: boolean;
  readiness?: SchemeReadiness | null | undefined;
  usesPaintIds: Array<string | number> | string | number;
}>;

export type SchemesPageQuery = {
  schemes: {
    totalCount: number;
    revision: { epoch: string; seq: string };
    nodes: Array<
      {
        sourceId: string | null;
        paintNames: string;
        usageCount: number;
        gradient: string;
        previewMoreCount: number;
      } & { " $fragmentRefs"?: { MiniatureSchemeSummaryFragment: MiniatureSchemeSummaryFragment } }
    >;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    facets: {
      categories: Array<{ key: string; label: string; count: number }>;
      sources: Array<{ key: string; label: string; count: number }>;
      readiness: Array<{ key: string; label: string; count: number }>;
    };
  };
};

export type SchemeUsedPaintOptionsQueryVariables = Exact<{
  search: string;
  excludeIds: Array<string | number> | string | number;
}>;

export type SchemeUsedPaintOptionsQuery = {
  schemePaintOptions: {
    revision: { epoch: string; seq: string };
    items: Array<{ " $fragmentRefs"?: { DetailPaintFragment: DetailPaintFragment } }>;
  };
};

export type SchemeEditResultFragment = {
  schemeId: string;
  invalidatedFamilies: Array<VaultFamily>;
  clientMutationId: string | null;
  revision: { epoch: string; seq: string };
} & { " $fragmentName"?: "SchemeEditResultFragment" };

export type CreateColorSchemeMutationVariables = Exact<{
  input: SchemeInput;
  clientMutationId?: string | null | undefined;
}>;

export type CreateColorSchemeMutation = {
  createScheme: { " $fragmentRefs"?: { SchemeEditResultFragment: SchemeEditResultFragment } };
};

export type UpdateColorSchemeMutationVariables = Exact<{
  id: string | number;
  input: SchemeInput;
  clientMutationId?: string | null | undefined;
}>;

export type UpdateColorSchemeMutation = {
  updateScheme: { " $fragmentRefs"?: { SchemeEditResultFragment: SchemeEditResultFragment } };
};

export type DeleteColorSchemeMutationVariables = Exact<{
  id: string | number;
  clientMutationId?: string | null | undefined;
}>;

export type DeleteColorSchemeMutation = {
  deleteScheme: { " $fragmentRefs"?: { SchemeEditResultFragment: SchemeEditResultFragment } };
};

export type InstalledSourcesQueryVariables = Exact<{ [key: string]: never }>;

export type InstalledSourcesQuery = {
  sources: {
    revision: { epoch: string; seq: string };
    sources: Array<{
      id: string;
      repository: string;
      url: string;
      name: string;
      version: string;
      license: string | null;
      attribution: string | null;
      lastError: string | null;
      logoUrl: string | null;
      lastErrorInfo: { code: string; parameters: Array<{ name: string; value: string }> } | null;
      dependencies: Array<{ repository: string; minimumVersion: string | null }>;
      counts: { paints: number; schemes: number; templates: number };
    }>;
  };
};

export type PluginVersionsQueryVariables = Exact<{ [key: string]: never }>;

export type PluginVersionsQuery = {
  sourceVersions: {
    revision: { epoch: string; seq: string };
    versions: Array<{
      id: string;
      availableVersion: string | null;
      updateAvailable: boolean | null;
      error: string | null;
    }>;
  };
};

export type PluginRemovalQueryVariables = Exact<{
  id: string | number;
}>;

export type PluginRemovalQuery = {
  sourceRemoval: {
    canRemove: boolean;
    revision: { epoch: string; seq: string };
    source: { id: string; name: string; version: string };
    removes: { paints: number; schemes: number; templates: number };
    blockers: Array<{ label: string; count: number }>;
  };
};

export type PluginShareableQueryVariables = Exact<{ [key: string]: never }>;

export type PluginShareableQuery = {
  sourceShareable: {
    revision: { epoch: string; seq: string };
    paints: Array<{ id: string; name: string }>;
    schemes: Array<{ id: string; name: string }>;
    templates: Array<{ id: string; name: string }>;
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

export type TemplateSummaryFieldsFragment = {
  id: string;
  name: string;
  manufacturer: string;
  faction: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  categories: Array<string>;
  kind: string;
  sourceId: string | null;
  sourceName: string | null;
  sourceLogoUrl: string | null;
  schemeCount: number;
  paintCount: number;
} & { " $fragmentName"?: "TemplateSummaryFieldsFragment" };

export type TemplateSummariesQueryVariables = Exact<{
  id?: string | number | null | undefined;
  first?: number;
  after?: string | null | undefined;
  search?: string | null | undefined;
  category?: string | null | undefined;
  sourceId?: string | number | null | undefined;
  noSource?: boolean | null | undefined;
}>;

export type TemplateSummariesQuery = {
  templates: {
    revision: { epoch: string; seq: string };
    categoryCounts: Array<{ key: string; label: string; count: number }>;
    sourceCounts: Array<{ key: string; label: string; count: number }>;
    templates: {
      totalCount: number;
      nodes: Array<{ " $fragmentRefs"?: { TemplateSummaryFieldsFragment: TemplateSummaryFieldsFragment } }>;
      pageInfo: { endCursor: string | null; hasNextPage: boolean };
    };
  };
};

export type SelectedTemplateRecipeQueryVariables = Exact<{
  id: string | number;
  paintAfter?: string | null | undefined;
  schemeAfter?: string | null | undefined;
}>;

export type SelectedTemplateRecipeQuery = {
  templateRecipe: {
    templateId: string;
    revision: { epoch: string; seq: string };
    paints: {
      nodes: Array<{
        paintId: string;
        paintName: string;
        paintBrand: string;
        step: string;
        notes: string;
        sortOrder: number;
      }>;
      pageInfo: { endCursor: string | null; hasNextPage: boolean };
    };
    schemes: {
      nodes: Array<{ schemeId: string; name: string }>;
      pageInfo: { endCursor: string | null; hasNextPage: boolean };
    };
  };
};

export type TemplateCommandResultFragment = {
  templateId: string;
  clientMutationId: string | null;
  invalidatedFamilies: Array<VaultFamily>;
  revision: { epoch: string; seq: string };
} & { " $fragmentName"?: "TemplateCommandResultFragment" };

export type CreateReusableTemplateMutationVariables = Exact<{
  input: TemplateInput;
  clientMutationId?: string | null | undefined;
}>;

export type CreateReusableTemplateMutation = {
  createTemplate: { " $fragmentRefs"?: { TemplateCommandResultFragment: TemplateCommandResultFragment } };
};

export type UpdateReusableTemplateMutationVariables = Exact<{
  id: string | number;
  input: TemplateInput;
  clientMutationId?: string | null | undefined;
}>;

export type UpdateReusableTemplateMutation = {
  updateTemplate: { " $fragmentRefs"?: { TemplateCommandResultFragment: TemplateCommandResultFragment } };
};

export type DeleteReusableTemplateMutationVariables = Exact<{
  id: string | number;
  clientMutationId?: string | null | undefined;
}>;

export type DeleteReusableTemplateMutation = {
  deleteTemplate: { " $fragmentRefs"?: { TemplateCommandResultFragment: TemplateCommandResultFragment } };
};

export type TemplateSourceMiniatureQueryVariables = Exact<{
  id: string | number;
  paintAfter?: string | null | undefined;
  schemeAfter?: string | null | undefined;
}>;

export type TemplateSourceMiniatureQuery = {
  miniature: {
    revision: { epoch: string; seq: string };
    miniature: {
      id: string;
      title: string;
      manufacturer: string;
      faction: string;
      imageUrl: string | null;
    } | null;
    recipe: {
      nodes: Array<{
        step: string;
        notes: string;
        sortOrder: number;
        paint: { id: string; name: string; brand: string };
      }>;
      pageInfo: { endCursor: string | null; hasNextPage: boolean };
    };
    schemes: {
      nodes: Array<{ scheme: { id: string; name: string } }>;
      pageInfo: { endCursor: string | null; hasNextPage: boolean };
    };
  };
};

export type WishlistRowFragment = {
  id: string;
  brandGroup: string;
  restock: boolean;
  missingStock: boolean;
  brokenSubstitution: boolean;
  projectCount: number;
  relatedProjectsTruncated: boolean;
  paint: { " $fragmentRefs"?: { LibraryPaintFragment: LibraryPaintFragment } };
  relatedProjectsPreview: Array<{ id: string; title: string }>;
} & { " $fragmentName"?: "WishlistRowFragment" };

export type WishlistPageQueryVariables = Exact<{
  first?: number;
  after?: string | null | undefined;
  missingFirst?: number;
  missingAfter?: string | null | undefined;
  miniatureId?: string | number | null | undefined;
}>;

export type WishlistPageQuery = {
  wishlist: {
    revision: { epoch: string; seq: string };
    counts: {
      shoppingPaints: number;
      restockPaints: number;
      missingPaints: number;
      missingStock: number;
      brokenSubstitution: number;
      listedMissingStock: number;
      projectCount: number;
    };
    shopping: {
      totalCount: number;
      nodes: Array<{ " $fragmentRefs"?: { WishlistRowFragment: WishlistRowFragment } }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
    missing: {
      totalCount: number;
      nodes: Array<{ " $fragmentRefs"?: { WishlistRowFragment: WishlistRowFragment } }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
};

export type WishlistModelOptionsQueryVariables = Exact<{
  first?: number;
  after?: string | null | undefined;
  search?: string | null | undefined;
}>;

export type WishlistModelOptionsQuery = {
  wishlistModelOptions: {
    totalCount: number;
    revision: { epoch: string; seq: string };
    nodes: Array<{ id: string; title: string; projectCount: number }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export type WishlistRelatedProjectsQueryVariables = Exact<{
  paintId: string | number;
  first?: number;
  after?: string | null | undefined;
}>;

export type WishlistRelatedProjectsQuery = {
  wishlistRelatedProjects: {
    totalCount: number;
    revision: { epoch: string; seq: string };
    nodes: Array<{ id: string; title: string }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export type WishlistExportQueryVariables = Exact<{
  miniatureId?: string | number | null | undefined;
}>;

export type WishlistExportQuery = {
  wishlistExport: { text: string; totalCount: number; revision: { epoch: string; seq: string } };
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
          { kind: "Field", name: { kind: "Name", value: "thumbnailUrl" } },
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
          { kind: "Field", name: { kind: "Name", value: "thumbnailUrl" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MiniatureSchemeSummaryFragment, unknown>;
export const SchemeEditResultFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "SchemeEditResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "SchemeMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "schemeId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SchemeEditResultFragment, unknown>;
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
export const TemplateSummaryFieldsFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "TemplateSummaryFields" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "TemplateSummary" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
          { kind: "Field", name: { kind: "Name", value: "faction" } },
          { kind: "Field", name: { kind: "Name", value: "imageUrl" } },
          { kind: "Field", name: { kind: "Name", value: "thumbnailUrl" } },
          { kind: "Field", name: { kind: "Name", value: "categories" } },
          { kind: "Field", name: { kind: "Name", value: "kind" } },
          { kind: "Field", name: { kind: "Name", value: "sourceId" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
          { kind: "Field", name: { kind: "Name", value: "schemeCount" } },
          { kind: "Field", name: { kind: "Name", value: "paintCount" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<TemplateSummaryFieldsFragment, unknown>;
export const TemplateCommandResultFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "TemplateCommandResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "TemplateMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "templateId" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<TemplateCommandResultFragment, unknown>;
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
export const WishlistRowFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "WishlistRow" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "WishlistRow" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "paint" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "LibraryPaint" } }],
            },
          },
          { kind: "Field", name: { kind: "Name", value: "brandGroup" } },
          { kind: "Field", name: { kind: "Name", value: "restock" } },
          { kind: "Field", name: { kind: "Name", value: "missingStock" } },
          { kind: "Field", name: { kind: "Name", value: "brokenSubstitution" } },
          { kind: "Field", name: { kind: "Name", value: "projectCount" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "relatedProjectsPreview" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
              ],
            },
          },
          { kind: "Field", name: { kind: "Name", value: "relatedProjectsTruncated" } },
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
} as unknown as DocumentNode<WishlistRowFragment, unknown>;
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
          { kind: "Field", name: { kind: "Name", value: "thumbnailUrl" } },
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
          { kind: "Field", name: { kind: "Name", value: "thumbnailUrl" } },
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
          { kind: "Field", name: { kind: "Name", value: "thumbnailUrl" } },
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
export const ImportCustomPaintsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "ImportCustomPaints" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "paints" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "ListType",
              type: {
                kind: "NonNullType",
                type: { kind: "NamedType", name: { kind: "Name", value: "CustomPaintImportInput" } },
              },
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
            name: { kind: "Name", value: "importCustomPaints" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "paints" },
                value: { kind: "Variable", name: { kind: "Name", value: "paints" } },
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
                { kind: "Field", name: { kind: "Name", value: "imported" } },
                { kind: "Field", name: { kind: "Name", value: "skipped" } },
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
                { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
                { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ImportCustomPaintsMutation, ImportCustomPaintsMutationVariables>;
export const UpdateCustomPaintDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "UpdateCustomPaint" },
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
            type: { kind: "NamedType", name: { kind: "Name", value: "CustomPaintInput" } },
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
            name: { kind: "Name", value: "updateCustomPaint" },
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
              selections: [
                { kind: "Field", name: { kind: "Name", value: "paintId" } },
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
                { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
                { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateCustomPaintMutation, UpdateCustomPaintMutationVariables>;
export const DeleteCustomPaintDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "DeleteCustomPaint" },
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
            name: { kind: "Name", value: "deleteCustomPaint" },
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
              selections: [
                { kind: "Field", name: { kind: "Name", value: "paintId" } },
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
                { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
                { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeleteCustomPaintMutation, DeleteCustomPaintMutationVariables>;
export const CreateSubstitutionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CreateSubstitution" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "input" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "SubstitutionInput" } },
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
            name: { kind: "Name", value: "createSubstitution" },
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
              selections: [
                { kind: "Field", name: { kind: "Name", value: "substitutionId" } },
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
                { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
                { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CreateSubstitutionMutation, CreateSubstitutionMutationVariables>;
export const SetSubstitutionDefaultDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "SetSubstitutionDefault" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "enabled" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
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
            name: { kind: "Name", value: "setSubstitutionDefault" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "enabled" },
                value: { kind: "Variable", name: { kind: "Name", value: "enabled" } },
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
                { kind: "Field", name: { kind: "Name", value: "substitutionId" } },
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
                { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
                { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SetSubstitutionDefaultMutation, SetSubstitutionDefaultMutationVariables>;
export const DeleteSubstitutionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "DeleteSubstitution" },
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
            name: { kind: "Name", value: "deleteSubstitution" },
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
              selections: [
                { kind: "Field", name: { kind: "Name", value: "substitutionId" } },
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
                { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
                { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeleteSubstitutionMutation, DeleteSubstitutionMutationVariables>;
export const SelectPaintSubstitutionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "SelectPaintSubstitution" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "miniatureId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "targetPaintId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "substitutionId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "useOriginal" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          },
          defaultValue: { kind: "BooleanValue", value: false },
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
            name: { kind: "Name", value: "selectPaintSubstitution" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "miniatureId" },
                value: { kind: "Variable", name: { kind: "Name", value: "miniatureId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "targetPaintId" },
                value: { kind: "Variable", name: { kind: "Name", value: "targetPaintId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "substitutionId" },
                value: { kind: "Variable", name: { kind: "Name", value: "substitutionId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "useOriginal" },
                value: { kind: "Variable", name: { kind: "Name", value: "useOriginal" } },
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
                { kind: "Field", name: { kind: "Name", value: "miniatureId" } },
                { kind: "Field", name: { kind: "Name", value: "paintId" } },
                { kind: "Field", name: { kind: "Name", value: "substitutionId" } },
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
                { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
                { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SelectPaintSubstitutionMutation, SelectPaintSubstitutionMutationVariables>;
export const PaintToolRankingDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PaintToolRanking" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "ownedOnly" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          },
          defaultValue: { kind: "BooleanValue", value: false },
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
            name: { kind: "Name", value: "paintRanking" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "ownedOnly" },
                value: { kind: "Variable", name: { kind: "Name", value: "ownedOnly" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "30" },
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
                { kind: "Field", name: { kind: "Name", value: "owned" } },
                { kind: "Field", name: { kind: "Name", value: "suggestedId" } },
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
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "match" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "score" } },
                            { kind: "Field", name: { kind: "Name", value: "distance" } },
                            { kind: "Field", name: { kind: "Name", value: "lightnessDelta" } },
                            { kind: "Field", name: { kind: "Name", value: "hueDelta" } },
                            { kind: "Field", name: { kind: "Name", value: "intensityDelta" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "sameType" } },
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
} as unknown as DocumentNode<PaintToolRankingQuery, PaintToolRankingQueryVariables>;
export const OwnedPaintPickerOptionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "OwnedPaintPickerOptions" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "ownedPaintOptions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "30" },
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
} as unknown as DocumentNode<OwnedPaintPickerOptionsQuery, OwnedPaintPickerOptionsQueryVariables>;
export const PaintToolChoiceDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PaintToolChoice" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
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
} as unknown as DocumentNode<PaintToolChoiceQuery, PaintToolChoiceQueryVariables>;
export const SchemesPageDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SchemesPage" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "after" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "category" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "sourceId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "noSource" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "readiness" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "SchemeReadiness" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "usesPaintIds" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "ListType",
              type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "schemes" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "48" },
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
                name: { kind: "Name", value: "sourceId" },
                value: { kind: "Variable", name: { kind: "Name", value: "sourceId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "noSource" },
                value: { kind: "Variable", name: { kind: "Name", value: "noSource" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "readiness" },
                value: { kind: "Variable", name: { kind: "Name", value: "readiness" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "usesPaintIds" },
                value: { kind: "Variable", name: { kind: "Name", value: "usesPaintIds" } },
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
                      { kind: "Field", name: { kind: "Name", value: "sourceId" } },
                      { kind: "Field", name: { kind: "Name", value: "paintNames" } },
                      { kind: "Field", name: { kind: "Name", value: "usageCount" } },
                      { kind: "Field", name: { kind: "Name", value: "gradient" } },
                      { kind: "Field", name: { kind: "Name", value: "previewMoreCount" } },
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "facets" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "categories" },
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
                        name: { kind: "Name", value: "readiness" },
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
          { kind: "Field", name: { kind: "Name", value: "thumbnailUrl" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SchemesPageQuery, SchemesPageQueryVariables>;
export const SchemeUsedPaintOptionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SchemeUsedPaintOptions" },
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
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "schemePaintOptions" },
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
                value: { kind: "IntValue", value: "30" },
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
} as unknown as DocumentNode<SchemeUsedPaintOptionsQuery, SchemeUsedPaintOptionsQueryVariables>;
export const CreateColorSchemeDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CreateColorScheme" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "input" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "SchemeInput" } },
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
            name: { kind: "Name", value: "createScheme" },
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
              selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "SchemeEditResult" } }],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "SchemeEditResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "SchemeMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "schemeId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CreateColorSchemeMutation, CreateColorSchemeMutationVariables>;
export const UpdateColorSchemeDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "UpdateColorScheme" },
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
            type: { kind: "NamedType", name: { kind: "Name", value: "SchemeInput" } },
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
            name: { kind: "Name", value: "updateScheme" },
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
              selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "SchemeEditResult" } }],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "SchemeEditResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "SchemeMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "schemeId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateColorSchemeMutation, UpdateColorSchemeMutationVariables>;
export const DeleteColorSchemeDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "DeleteColorScheme" },
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
            name: { kind: "Name", value: "deleteScheme" },
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
              selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "SchemeEditResult" } }],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "SchemeEditResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "SchemeMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "schemeId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeleteColorSchemeMutation, DeleteColorSchemeMutationVariables>;
export const InstalledSourcesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "InstalledSources" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "sources" },
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
                  name: { kind: "Name", value: "sources" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "repository" } },
                      { kind: "Field", name: { kind: "Name", value: "url" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "version" } },
                      { kind: "Field", name: { kind: "Name", value: "license" } },
                      { kind: "Field", name: { kind: "Name", value: "attribution" } },
                      { kind: "Field", name: { kind: "Name", value: "lastError" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "lastErrorInfo" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "code" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "parameters" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "name" } },
                                  { kind: "Field", name: { kind: "Name", value: "value" } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "logoUrl" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "dependencies" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "repository" } },
                            { kind: "Field", name: { kind: "Name", value: "minimumVersion" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "counts" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "paints" } },
                            { kind: "Field", name: { kind: "Name", value: "schemes" } },
                            { kind: "Field", name: { kind: "Name", value: "templates" } },
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
} as unknown as DocumentNode<InstalledSourcesQuery, InstalledSourcesQueryVariables>;
export const PluginVersionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PluginVersions" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "sourceVersions" },
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
                  name: { kind: "Name", value: "versions" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "availableVersion" } },
                      { kind: "Field", name: { kind: "Name", value: "updateAvailable" } },
                      { kind: "Field", name: { kind: "Name", value: "error" } },
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
} as unknown as DocumentNode<PluginVersionsQuery, PluginVersionsQueryVariables>;
export const PluginRemovalDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PluginRemoval" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "sourceRemoval" },
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
                  name: { kind: "Name", value: "source" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "version" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "removes" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "paints" } },
                      { kind: "Field", name: { kind: "Name", value: "schemes" } },
                      { kind: "Field", name: { kind: "Name", value: "templates" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "blockers" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "label" } },
                      { kind: "Field", name: { kind: "Name", value: "count" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "canRemove" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PluginRemovalQuery, PluginRemovalQueryVariables>;
export const PluginShareableDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PluginShareable" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "sourceShareable" },
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
                  name: { kind: "Name", value: "paints" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "schemes" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "templates" },
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
      },
    },
  ],
} as unknown as DocumentNode<PluginShareableQuery, PluginShareableQueryVariables>;
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
export const TemplateSummariesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "TemplateSummaries" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
        },
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
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "category" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "sourceId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "noSource" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: false },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "templates" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
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
                name: { kind: "Name", value: "sourceId" },
                value: { kind: "Variable", name: { kind: "Name", value: "sourceId" } },
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "sourceCounts" },
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
                  name: { kind: "Name", value: "templates" },
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
                              kind: "FragmentSpread",
                              name: { kind: "Name", value: "TemplateSummaryFields" },
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
                            { kind: "Field", name: { kind: "Name", value: "endCursor" } },
                            { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
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
      name: { kind: "Name", value: "TemplateSummaryFields" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "TemplateSummary" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
          { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
          { kind: "Field", name: { kind: "Name", value: "faction" } },
          { kind: "Field", name: { kind: "Name", value: "imageUrl" } },
          { kind: "Field", name: { kind: "Name", value: "thumbnailUrl" } },
          { kind: "Field", name: { kind: "Name", value: "categories" } },
          { kind: "Field", name: { kind: "Name", value: "kind" } },
          { kind: "Field", name: { kind: "Name", value: "sourceId" } },
          { kind: "Field", name: { kind: "Name", value: "sourceName" } },
          { kind: "Field", name: { kind: "Name", value: "sourceLogoUrl" } },
          { kind: "Field", name: { kind: "Name", value: "schemeCount" } },
          { kind: "Field", name: { kind: "Name", value: "paintCount" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<TemplateSummariesQuery, TemplateSummariesQueryVariables>;
export const SelectedTemplateRecipeDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SelectedTemplateRecipe" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "paintAfter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "schemeAfter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "templateRecipe" },
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
                { kind: "Field", name: { kind: "Name", value: "templateId" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "paints" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "100" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: { kind: "Variable", name: { kind: "Name", value: "paintAfter" } },
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
                            { kind: "Field", name: { kind: "Name", value: "paintId" } },
                            { kind: "Field", name: { kind: "Name", value: "paintName" } },
                            { kind: "Field", name: { kind: "Name", value: "paintBrand" } },
                            { kind: "Field", name: { kind: "Name", value: "step" } },
                            { kind: "Field", name: { kind: "Name", value: "notes" } },
                            { kind: "Field", name: { kind: "Name", value: "sortOrder" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "pageInfo" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "endCursor" } },
                            { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
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
                      value: { kind: "IntValue", value: "100" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: { kind: "Variable", name: { kind: "Name", value: "schemeAfter" } },
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
                            { kind: "Field", name: { kind: "Name", value: "schemeId" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "pageInfo" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "endCursor" } },
                            { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
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
} as unknown as DocumentNode<SelectedTemplateRecipeQuery, SelectedTemplateRecipeQueryVariables>;
export const CreateReusableTemplateDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CreateReusableTemplate" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "input" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "TemplateInput" } },
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
            name: { kind: "Name", value: "createTemplate" },
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
              selections: [
                { kind: "FragmentSpread", name: { kind: "Name", value: "TemplateCommandResult" } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "TemplateCommandResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "TemplateMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "templateId" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CreateReusableTemplateMutation, CreateReusableTemplateMutationVariables>;
export const UpdateReusableTemplateDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "UpdateReusableTemplate" },
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
            type: { kind: "NamedType", name: { kind: "Name", value: "TemplateInput" } },
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
            name: { kind: "Name", value: "updateTemplate" },
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
              selections: [
                { kind: "FragmentSpread", name: { kind: "Name", value: "TemplateCommandResult" } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "TemplateCommandResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "TemplateMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "templateId" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateReusableTemplateMutation, UpdateReusableTemplateMutationVariables>;
export const DeleteReusableTemplateDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "DeleteReusableTemplate" },
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
            name: { kind: "Name", value: "deleteTemplate" },
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
              selections: [
                { kind: "FragmentSpread", name: { kind: "Name", value: "TemplateCommandResult" } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "TemplateCommandResult" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "TemplateMutationPayload" } },
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
          { kind: "Field", name: { kind: "Name", value: "templateId" } },
          { kind: "Field", name: { kind: "Name", value: "clientMutationId" } },
          { kind: "Field", name: { kind: "Name", value: "invalidatedFamilies" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeleteReusableTemplateMutation, DeleteReusableTemplateMutationVariables>;
export const TemplateSourceMiniatureDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "TemplateSourceMiniature" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "paintAfter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "schemeAfter" } },
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
                      { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                      { kind: "Field", name: { kind: "Name", value: "faction" } },
                      { kind: "Field", name: { kind: "Name", value: "imageUrl" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "recipe" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "100" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: { kind: "Variable", name: { kind: "Name", value: "paintAfter" } },
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
                                  { kind: "Field", name: { kind: "Name", value: "id" } },
                                  { kind: "Field", name: { kind: "Name", value: "name" } },
                                  { kind: "Field", name: { kind: "Name", value: "brand" } },
                                ],
                              },
                            },
                            { kind: "Field", name: { kind: "Name", value: "step" } },
                            { kind: "Field", name: { kind: "Name", value: "notes" } },
                            { kind: "Field", name: { kind: "Name", value: "sortOrder" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "pageInfo" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "endCursor" } },
                            { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
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
                      value: { kind: "IntValue", value: "100" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: { kind: "Variable", name: { kind: "Name", value: "schemeAfter" } },
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
                              name: { kind: "Name", value: "scheme" },
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
                        kind: "Field",
                        name: { kind: "Name", value: "pageInfo" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "endCursor" } },
                            { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
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
} as unknown as DocumentNode<TemplateSourceMiniatureQuery, TemplateSourceMiniatureQueryVariables>;
export const WishlistPageDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "WishlistPage" },
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
          variable: { kind: "Variable", name: { kind: "Name", value: "missingFirst" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "Int" } } },
          defaultValue: { kind: "IntValue", value: "48" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "missingAfter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "miniatureId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "wishlist" },
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
                name: { kind: "Name", value: "missingFirst" },
                value: { kind: "Variable", name: { kind: "Name", value: "missingFirst" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "missingAfter" },
                value: { kind: "Variable", name: { kind: "Name", value: "missingAfter" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "miniatureId" },
                value: { kind: "Variable", name: { kind: "Name", value: "miniatureId" } },
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
                      { kind: "Field", name: { kind: "Name", value: "shoppingPaints" } },
                      { kind: "Field", name: { kind: "Name", value: "restockPaints" } },
                      { kind: "Field", name: { kind: "Name", value: "missingPaints" } },
                      { kind: "Field", name: { kind: "Name", value: "missingStock" } },
                      { kind: "Field", name: { kind: "Name", value: "brokenSubstitution" } },
                      { kind: "Field", name: { kind: "Name", value: "listedMissingStock" } },
                      { kind: "Field", name: { kind: "Name", value: "projectCount" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "shopping" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "nodes" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "FragmentSpread", name: { kind: "Name", value: "WishlistRow" } },
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
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "nodes" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "FragmentSpread", name: { kind: "Name", value: "WishlistRow" } },
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
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "WishlistRow" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "WishlistRow" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "paint" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [{ kind: "FragmentSpread", name: { kind: "Name", value: "LibraryPaint" } }],
            },
          },
          { kind: "Field", name: { kind: "Name", value: "brandGroup" } },
          { kind: "Field", name: { kind: "Name", value: "restock" } },
          { kind: "Field", name: { kind: "Name", value: "missingStock" } },
          { kind: "Field", name: { kind: "Name", value: "brokenSubstitution" } },
          { kind: "Field", name: { kind: "Name", value: "projectCount" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "relatedProjectsPreview" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
              ],
            },
          },
          { kind: "Field", name: { kind: "Name", value: "relatedProjectsTruncated" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<WishlistPageQuery, WishlistPageQueryVariables>;
export const WishlistModelOptionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "WishlistModelOptions" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "first" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "Int" } } },
          defaultValue: { kind: "IntValue", value: "40" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "after" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
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
            name: { kind: "Name", value: "wishlistModelOptions" },
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
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
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
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "projectCount" } },
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
} as unknown as DocumentNode<WishlistModelOptionsQuery, WishlistModelOptionsQueryVariables>;
export const WishlistRelatedProjectsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "WishlistRelatedProjects" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "paintId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ID" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "first" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "Int" } } },
          defaultValue: { kind: "IntValue", value: "30" },
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
            name: { kind: "Name", value: "wishlistRelatedProjects" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "paintId" },
                value: { kind: "Variable", name: { kind: "Name", value: "paintId" } },
              },
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
} as unknown as DocumentNode<WishlistRelatedProjectsQuery, WishlistRelatedProjectsQueryVariables>;
export const WishlistExportDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "WishlistExport" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "miniatureId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "wishlistExport" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "miniatureId" },
                value: { kind: "Variable", name: { kind: "Name", value: "miniatureId" } },
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
                { kind: "Field", name: { kind: "Name", value: "text" } },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<WishlistExportQuery, WishlistExportQueryVariables>;
