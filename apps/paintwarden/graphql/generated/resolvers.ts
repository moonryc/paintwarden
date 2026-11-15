/* eslint-disable */
import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from "graphql";
import type { FolderRead } from "../folders";
import type { PaintViewRead, SubstitutionRead } from "../library";
import type { MiniatureViewRead } from "../miniatures";
import type { MiniatureSchemeRead } from "../miniature-schemes";
import type { TemplateRecipeRead } from "../templates";
import type { GraphQLContext } from "../context";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  /** Nonnegative safe-integer revision, represented as a canonical decimal string. */
  Sequence: { input: number; output: number };
};

export type ActiveSubstitution = {
  __typename?: "ActiveSubstitution";
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
};

export type BrokenReason = "CYCLE" | "EMPTY";

export type CatalogSource = {
  __typename?: "CatalogSource";
  attribution?: Maybe<Scalars["String"]["output"]>;
  counts: SourceItemCounts;
  dependencies: Array<SourceDependency>;
  id: Scalars["ID"]["output"];
  lastError?: Maybe<Scalars["String"]["output"]>;
  lastErrorInfo?: Maybe<PublicError>;
  license?: Maybe<Scalars["String"]["output"]>;
  logoUrl?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  repository: Scalars["String"]["output"];
  url: Scalars["String"]["output"];
  version: Scalars["String"]["output"];
};

export type ColorIndexPaint = {
  __typename?: "ColorIndexPaint";
  available: Scalars["Boolean"]["output"];
  brand: Scalars["String"]["output"];
  hex?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  owned: Scalars["Boolean"]["output"];
};

export type ColorIndexView = {
  __typename?: "ColorIndexView";
  nodes: Array<ColorIndexPaint>;
  pageInfo: PageInfo;
  revision: VaultRevision;
};

export type CustomPaintImportInput = {
  brand?: InputMaybe<Scalars["String"]["input"]>;
  colorHex?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  range?: InputMaybe<Scalars["String"]["input"]>;
  sourceUrl?: InputMaybe<Scalars["String"]["input"]>;
  type?: InputMaybe<Scalars["String"]["input"]>;
};

export type CustomPaintInput = {
  brand: Scalars["String"]["input"];
  colorHex?: InputMaybe<Scalars["String"]["input"]>;
  name: Scalars["String"]["input"];
  range?: InputMaybe<Scalars["String"]["input"]>;
  sourceUrl?: InputMaybe<Scalars["String"]["input"]>;
};

export type ErrorParameter = {
  __typename?: "ErrorParameter";
  name: Scalars["String"]["output"];
  value: Scalars["String"]["output"];
};

export type FacetCount = {
  __typename?: "FacetCount";
  count: Scalars["Int"]["output"];
  key: Scalars["String"]["output"];
  label: Scalars["String"]["output"];
};

export type Folder = {
  __typename?: "Folder";
  coverThumbnailUrl?: Maybe<Scalars["String"]["output"]>;
  directCount: Scalars["Int"]["output"];
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  parentId?: Maybe<Scalars["ID"]["output"]>;
  recursiveCount: Scalars["Int"]["output"];
};

export type FolderBrowserPayload = {
  __typename?: "FolderBrowserPayload";
  folders: Array<Folder>;
  pageInfo: PageInfo;
  revision: VaultRevision;
  totalCount: Scalars["Int"]["output"];
};

export type FolderDeleteMode = "DELETE_CONTENTS" | "MOVE_UP";

export type FolderKind = "MINIATURE" | "TEMPLATE";

export type FolderMutationPayload = {
  __typename?: "FolderMutationPayload";
  invalidatedFamilies: Array<VaultFamily>;
  revision: VaultRevision;
};

export type FolderSearchConnection = {
  __typename?: "FolderSearchConnection";
  nodes: Array<FolderSearchResult>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type FolderSearchResult = Folder | Miniature | TemplateSummary;

export type FolderSearchView = {
  __typename?: "FolderSearchView";
  results: FolderSearchConnection;
  revision: VaultRevision;
};

export type HomeCounts = {
  __typename?: "HomeCounts";
  catalogCount: Scalars["Int"]["output"];
  distinctMissingPaints: Scalars["Int"]["output"];
  owned: Scalars["Int"]["output"];
  ready: Scalars["Int"]["output"];
  stages: Array<FacetCount>;
  wishlistedMissingPaints: Scalars["Int"]["output"];
};

export type HomeView = {
  __typename?: "HomeView";
  counts: HomeCounts;
  miniatures: MiniatureConnection;
  revision: VaultRevision;
};

export type IngredientConnection = {
  __typename?: "IngredientConnection";
  nodes: Array<SubstitutionIngredient>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type Inventory = {
  __typename?: "Inventory";
  quantity: Scalars["Int"]["output"];
  state: Scalars["String"]["output"];
  stockLevel: Scalars["String"]["output"];
};

export type LibraryFacets = {
  __typename?: "LibraryFacets";
  brands: Array<FacetCount>;
  inventory: Array<FacetCount>;
  sources: Array<FacetCount>;
};

export type LibraryFilter = "ALL" | "OWNED" | "UNTRACKED" | "WISHLIST";

export type Miniature = {
  __typename?: "Miniature";
  createdAt: Scalars["Float"]["output"];
  faction: Scalars["String"]["output"];
  folderId?: Maybe<Scalars["ID"]["output"]>;
  id: Scalars["ID"]["output"];
  imageUrl?: Maybe<Scalars["String"]["output"]>;
  manufacturer: Scalars["String"]["output"];
  notes: Scalars["String"]["output"];
  paintingStatus: PaintingStatus;
  previewSwatches: Array<MiniatureSwatch>;
  readiness: Readiness;
  scale: Scalars["String"]["output"];
  status: Ownership;
  thumbnailUrl?: Maybe<Scalars["String"]["output"]>;
  title: Scalars["String"]["output"];
};

export type MiniatureConnection = {
  __typename?: "MiniatureConnection";
  nodes: Array<Miniature>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type MiniatureInput = {
  faction?: InputMaybe<Scalars["String"]["input"]>;
  folderId?: InputMaybe<Scalars["ID"]["input"]>;
  includeTemplateImage?: InputMaybe<Scalars["Boolean"]["input"]>;
  manufacturer?: InputMaybe<Scalars["String"]["input"]>;
  notes?: InputMaybe<Scalars["String"]["input"]>;
  paintingStatus?: InputMaybe<PaintingStatus>;
  scale?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<Ownership>;
  templateId?: InputMaybe<Scalars["ID"]["input"]>;
  title?: InputMaybe<Scalars["String"]["input"]>;
};

export type MiniatureMissingConnection = {
  __typename?: "MiniatureMissingConnection";
  nodes: Array<MiniatureMissingPaint>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type MiniatureMissingPaint = {
  __typename?: "MiniatureMissingPaint";
  brokenSubstitution: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  missingStock: Scalars["Boolean"]["output"];
  paint: Paint;
};

export type MiniatureMutationPayload = {
  __typename?: "MiniatureMutationPayload";
  clientMutationId?: Maybe<Scalars["String"]["output"]>;
  invalidatedFamilies: Array<VaultFamily>;
  miniatureId: Scalars["ID"]["output"];
  revision: VaultRevision;
};

export type MiniatureRecipeConnection = {
  __typename?: "MiniatureRecipeConnection";
  nodes: Array<MiniatureRecipeEntry>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type MiniatureRecipeEntry = {
  __typename?: "MiniatureRecipeEntry";
  id: Scalars["ID"]["output"];
  notes: Scalars["String"]["output"];
  paint: Paint;
  sortOrder: Scalars["Int"]["output"];
  step: Scalars["String"]["output"];
};

export type MiniatureRecipeEntryInput = {
  id?: InputMaybe<Scalars["ID"]["input"]>;
  notes?: InputMaybe<Scalars["String"]["input"]>;
  paintId: Scalars["ID"]["input"];
  sortOrder?: InputMaybe<Scalars["Int"]["input"]>;
  step?: InputMaybe<Scalars["String"]["input"]>;
};

export type MiniatureRequiredConnection = {
  __typename?: "MiniatureRequiredConnection";
  nodes: Array<Paint>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type MiniatureScheme = {
  __typename?: "MiniatureScheme";
  availableCount: Scalars["Int"]["output"];
  category?: Maybe<Scalars["String"]["output"]>;
  gradient: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  imageUrl?: Maybe<Scalars["String"]["output"]>;
  isSystem: Scalars["Boolean"]["output"];
  name: Scalars["String"]["output"];
  paintCount: Scalars["Int"]["output"];
  paintNames: Scalars["String"]["output"];
  previewMoreCount: Scalars["Int"]["output"];
  previewSwatches: Array<MiniatureSwatch>;
  previewSwatchesTruncated: Scalars["Boolean"]["output"];
  sourceId?: Maybe<Scalars["ID"]["output"]>;
  sourceLogoUrl?: Maybe<Scalars["String"]["output"]>;
  sourceName?: Maybe<Scalars["String"]["output"]>;
  thumbnailUrl?: Maybe<Scalars["String"]["output"]>;
  usageCount: Scalars["Int"]["output"];
};

export type MiniatureSchemeConnection = {
  __typename?: "MiniatureSchemeConnection";
  nodes: Array<MiniatureSchemeLink>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type MiniatureSchemeEntry = {
  __typename?: "MiniatureSchemeEntry";
  id: Scalars["ID"]["output"];
  imageType?: Maybe<Scalars["String"]["output"]>;
  imageUrl?: Maybe<Scalars["String"]["output"]>;
  kind: MiniatureSchemeEntryKind;
  label?: Maybe<Scalars["String"]["output"]>;
  method?: Maybe<Scalars["String"]["output"]>;
  paint?: Maybe<Paint>;
  role?: Maybe<Scalars["String"]["output"]>;
  sortOrder: Scalars["Int"]["output"];
  thumbnailUrl?: Maybe<Scalars["String"]["output"]>;
  tone?: Maybe<Scalars["String"]["output"]>;
};

export type MiniatureSchemeEntryConnection = {
  __typename?: "MiniatureSchemeEntryConnection";
  nodes: Array<MiniatureSchemeEntry>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type MiniatureSchemeEntryKind = "DIVIDER" | "IMAGE" | "PAINT";

export type MiniatureSchemeLink = {
  __typename?: "MiniatureSchemeLink";
  id: Scalars["ID"]["output"];
  scheme: MiniatureScheme;
  sortOrder: Scalars["Int"]["output"];
};

export type MiniatureSchemeOptionsView = {
  __typename?: "MiniatureSchemeOptionsView";
  categoryCounts: Array<FacetCount>;
  nodes: Array<MiniatureScheme>;
  pageInfo: PageInfo;
  revision: VaultRevision;
  totalCount: Scalars["Int"]["output"];
};

export type MiniatureSchemeView = {
  __typename?: "MiniatureSchemeView";
  entries: MiniatureSchemeEntryConnection;
  revision: VaultRevision;
  scheme?: Maybe<MiniatureScheme>;
};

export type MiniatureSchemeViewEntriesArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type MiniatureSwatch = {
  __typename?: "MiniatureSwatch";
  colorHex: Scalars["String"]["output"];
  paintId: Scalars["ID"]["output"];
};

export type MiniatureView = {
  __typename?: "MiniatureView";
  miniature?: Maybe<Miniature>;
  missing: MiniatureMissingConnection;
  recipe: MiniatureRecipeConnection;
  recipeSteps: Array<Scalars["String"]["output"]>;
  required: MiniatureRequiredConnection;
  revision: VaultRevision;
  schemes: MiniatureSchemeConnection;
};

export type MiniatureViewMissingArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type MiniatureViewRecipeArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type MiniatureViewRequiredArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type MiniatureViewSchemesArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type MiniaturesView = {
  __typename?: "MiniaturesView";
  miniatures: MiniatureConnection;
  ownershipCounts: Array<FacetCount>;
  revision: VaultRevision;
  stageCounts: Array<FacetCount>;
};

export type Mutation = {
  __typename?: "Mutation";
  createFolder: FolderMutationPayload;
  createMiniature: MiniatureMutationPayload;
  createScheme: SchemeMutationPayload;
  createSubstitution: SubstitutionMutationPayload;
  createTemplate: TemplateMutationPayload;
  deleteCustomPaint: PaintCommandPayload;
  deleteFolder: FolderMutationPayload;
  deleteMiniature: MiniatureMutationPayload;
  deleteScheme: SchemeMutationPayload;
  deleteSubstitution: SubstitutionMutationPayload;
  deleteTemplate: TemplateMutationPayload;
  importCustomPaints: PaintImportPayload;
  moveFolder: FolderMutationPayload;
  moveFolderItems: FolderMutationPayload;
  renameFolder: FolderMutationPayload;
  selectPaintSubstitution: SubstitutionMutationPayload;
  setMiniatureRecipe: MiniatureMutationPayload;
  setMiniatureSchemes: MiniatureMutationPayload;
  setPaintStock: PaintMutationResult;
  setSubstitutionDefault: SubstitutionMutationPayload;
  updateCustomPaint: PaintCommandPayload;
  updateMiniature: MiniatureMutationPayload;
  updateScheme: SchemeMutationPayload;
  updateTemplate: TemplateMutationPayload;
};

export type MutationCreateFolderArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  kind: FolderKind;
  name: Scalars["String"]["input"];
  parentId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type MutationCreateMiniatureArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  input: MiniatureInput;
};

export type MutationCreateSchemeArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  input: SchemeInput;
};

export type MutationCreateSubstitutionArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  input: SubstitutionInput;
};

export type MutationCreateTemplateArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  input: TemplateInput;
};

export type MutationDeleteCustomPaintArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
};

export type MutationDeleteFolderArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
  mode: FolderDeleteMode;
};

export type MutationDeleteMiniatureArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
};

export type MutationDeleteSchemeArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
};

export type MutationDeleteSubstitutionArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
};

export type MutationDeleteTemplateArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
};

export type MutationImportCustomPaintsArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  paints: Array<CustomPaintImportInput>;
};

export type MutationMoveFolderArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
  parentId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type MutationMoveFolderItemsArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  folderId?: InputMaybe<Scalars["ID"]["input"]>;
  ids: Array<Scalars["ID"]["input"]>;
  kind: FolderKind;
};

export type MutationRenameFolderArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
  name: Scalars["String"]["input"];
};

export type MutationSelectPaintSubstitutionArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  miniatureId: Scalars["ID"]["input"];
  substitutionId?: InputMaybe<Scalars["ID"]["input"]>;
  targetPaintId: Scalars["ID"]["input"];
  useOriginal?: Scalars["Boolean"]["input"];
};

export type MutationSetMiniatureRecipeArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  entries: Array<MiniatureRecipeEntryInput>;
  id: Scalars["ID"]["input"];
  schemeIds?: InputMaybe<Array<Scalars["ID"]["input"]>>;
  steps?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

export type MutationSetMiniatureSchemesArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
  schemeIds: Array<Scalars["ID"]["input"]>;
};

export type MutationSetPaintStockArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  paintId: Scalars["ID"]["input"];
  quantity?: InputMaybe<Scalars["Int"]["input"]>;
  state?: InputMaybe<Ownership>;
  stockLevel?: InputMaybe<StockLevel>;
};

export type MutationSetSubstitutionDefaultArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  enabled: Scalars["Boolean"]["input"];
  id: Scalars["ID"]["input"];
};

export type MutationUpdateCustomPaintArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
  input: CustomPaintInput;
};

export type MutationUpdateMiniatureArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
  input: MiniatureInput;
};

export type MutationUpdateSchemeArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
  input: SchemeInput;
};

export type MutationUpdateTemplateArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
  input: TemplateInput;
};

export type NavigationView = {
  __typename?: "NavigationView";
  availablePaints: Scalars["Int"]["output"];
  revision: VaultRevision;
  shoppingPaints: Scalars["Int"]["output"];
};

export type Ownership = "OWNED" | "WISHLIST";

export type PageInfo = {
  __typename?: "PageInfo";
  endCursor?: Maybe<Scalars["String"]["output"]>;
  hasNextPage: Scalars["Boolean"]["output"];
};

export type Paint = {
  __typename?: "Paint";
  activeSubstitution?: Maybe<ActiveSubstitution>;
  available: Scalars["Boolean"]["output"];
  brand: Scalars["String"]["output"];
  brokenReason?: Maybe<BrokenReason>;
  brokenSubstitution: Scalars["Boolean"]["output"];
  colorHex?: Maybe<Scalars["String"]["output"]>;
  discontinued: Scalars["Boolean"]["output"];
  hasActiveSubstitution: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  inventory?: Maybe<Inventory>;
  isCustom: Scalars["Boolean"]["output"];
  missingStock: Scalars["Boolean"]["output"];
  name: Scalars["String"]["output"];
  range: Scalars["String"]["output"];
  sourceLogoUrl?: Maybe<Scalars["String"]["output"]>;
  sourceName?: Maybe<Scalars["String"]["output"]>;
  sourceUrl?: Maybe<Scalars["String"]["output"]>;
  type?: Maybe<Scalars["String"]["output"]>;
};

export type PaintColorMatch = {
  __typename?: "PaintColorMatch";
  distance: Scalars["Float"]["output"];
  hueDelta?: Maybe<Scalars["Float"]["output"]>;
  intensityDelta: Scalars["Float"]["output"];
  lightnessDelta: Scalars["Float"]["output"];
  score: Scalars["Int"]["output"];
};

export type PaintCommandPayload = {
  __typename?: "PaintCommandPayload";
  clientMutationId?: Maybe<Scalars["String"]["output"]>;
  invalidatedFamilies: Array<VaultFamily>;
  paintId: Scalars["ID"]["output"];
  revision: VaultRevision;
};

export type PaintConnection = {
  __typename?: "PaintConnection";
  availableCount: Scalars["Int"]["output"];
  catalogCount: Scalars["Int"]["output"];
  explicitWishlistCount: Scalars["Int"]["output"];
  facets: LibraryFacets;
  nodes: Array<Paint>;
  pageInfo: PageInfo;
  revision: VaultRevision;
  totalCount: Scalars["Int"]["output"];
};

export type PaintImportPayload = {
  __typename?: "PaintImportPayload";
  clientMutationId?: Maybe<Scalars["String"]["output"]>;
  imported: Scalars["Int"]["output"];
  invalidatedFamilies: Array<VaultFamily>;
  revision: VaultRevision;
  skipped: Scalars["Int"]["output"];
};

export type PaintMutationResult = {
  __typename?: "PaintMutationResult";
  clientMutationId?: Maybe<Scalars["String"]["output"]>;
  invalidatedFamilies: Array<VaultFamily>;
  paint?: Maybe<Paint>;
  revision: VaultRevision;
};

export type PaintOptionsView = {
  __typename?: "PaintOptionsView";
  items: Array<Paint>;
  revision: VaultRevision;
};

export type PaintRankingView = {
  __typename?: "PaintRankingView";
  nodes: Array<RankedPaint>;
  owned: Scalars["Boolean"]["output"];
  pageInfo: PageInfo;
  paint?: Maybe<Paint>;
  revision: VaultRevision;
  suggestedId?: Maybe<Scalars["ID"]["output"]>;
  totalCount: Scalars["Int"]["output"];
};

export type PaintUsage = {
  __typename?: "PaintUsage";
  id: Scalars["ID"]["output"];
  title: Scalars["String"]["output"];
};

export type PaintUsageConnection = {
  __typename?: "PaintUsageConnection";
  nodes: Array<PaintUsage>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type PaintView = {
  __typename?: "PaintView";
  paint?: Maybe<Paint>;
  revision: VaultRevision;
  substitutions: SubstitutionConnection;
  usedBy: PaintUsageConnection;
};

export type PaintViewSubstitutionsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type PaintViewUsedByArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type PaintingStatus = "ASSEMBLED" | "COMPLETE" | "IN_PROGRESS" | "NOT_STARTED" | "PRIMED";

export type PluginInstallErrorParameter = {
  __typename?: "PluginInstallErrorParameter";
  name: Scalars["String"]["output"];
  value: Scalars["String"]["output"];
};

/** Latest in-memory install; survives client reloads, not server restarts. */
export type PluginInstallJob = {
  __typename?: "PluginInstallJob";
  cancellable: Scalars["Boolean"]["output"];
  done: Scalars["Int"]["output"];
  error?: Maybe<Scalars["String"]["output"]>;
  errorCode?: Maybe<Scalars["String"]["output"]>;
  errorParameters: Array<PluginInstallErrorParameter>;
  id: Scalars["String"]["output"];
  percent: Scalars["Float"]["output"];
  stage: PluginInstallStage;
  total: Scalars["Int"]["output"];
};

export type PluginInstallStage =
  "CANCELLED" | "CHECKING" | "COMMITTING" | "FAILED" | "IMAGES" | "PREPARING" | "READING" | "SUCCEEDED";

export type PublicError = {
  __typename?: "PublicError";
  code: Scalars["String"]["output"];
  parameters: Array<ErrorParameter>;
};

export type Query = {
  __typename?: "Query";
  colorIndex: ColorIndexView;
  folderBrowser: FolderBrowserPayload;
  folderSearch: FolderSearchView;
  home: HomeView;
  library: PaintConnection;
  miniature: MiniatureView;
  miniatureScheme: MiniatureSchemeView;
  miniatures: MiniaturesView;
  ownedPaintOptions: PaintOptionsView;
  paint: PaintView;
  paintOptions: PaintOptionsView;
  paintRanking: PaintRankingView;
  pluginInstallJob?: Maybe<PluginInstallJob>;
  schemeColorIndex: SchemeColorIndexView;
  schemeOptions: MiniatureSchemeOptionsView;
  schemePaintOptions: PaintOptionsView;
  schemes: SchemesView;
  sourceRemoval: SourceRemovalView;
  sourceShareable: SourceShareableView;
  sourceVersions: SourceVersionsView;
  sources: SourcesView;
  substitution: SubstitutionView;
  templateRecipe: TemplateRecipeView;
  templates: TemplatesView;
  vaultInvalidation: VaultInvalidation;
  vaultNavigation: NavigationView;
  vaultRevision: VaultRevision;
  wishlist: WishlistView;
  /** Complete filtered shopping text, independent of loaded pages. */
  wishlistExport: WishlistExport;
  wishlistModelOptions: WishlistModelOptionsView;
  wishlistRelatedProjects: WishlistProjectConnection;
};

export type QueryColorIndexArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type QueryFolderBrowserArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
  flat?: Scalars["Boolean"]["input"];
  kind: FolderKind;
  parentId?: InputMaybe<Scalars["ID"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryFolderSearchArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  category?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
  folderId?: InputMaybe<Scalars["ID"]["input"]>;
  kind: FolderKind;
  noSource?: Scalars["Boolean"]["input"];
  ownership?: InputMaybe<Ownership>;
  search: Scalars["String"]["input"];
  sourceId?: InputMaybe<Scalars["ID"]["input"]>;
  stage?: InputMaybe<PaintingStatus>;
};

export type QueryHomeArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
  flat?: Scalars["Boolean"]["input"];
  folderId?: InputMaybe<Scalars["ID"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  stage?: InputMaybe<PaintingStatus>;
};

export type QueryLibraryArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  brand?: InputMaybe<Scalars["String"]["input"]>;
  filter?: LibraryFilter;
  first?: Scalars["Int"]["input"];
  noSource?: Scalars["Boolean"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
  sourceId?: InputMaybe<Scalars["ID"]["input"]>;
  sourceName?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryMiniatureArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryMiniatureSchemeArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryMiniaturesArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
  flat?: Scalars["Boolean"]["input"];
  folderId?: InputMaybe<Scalars["ID"]["input"]>;
  ownership?: InputMaybe<Ownership>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  stage?: InputMaybe<PaintingStatus>;
};

export type QueryOwnedPaintOptionsArgs = {
  first?: Scalars["Int"]["input"];
  search?: Scalars["String"]["input"];
};

export type QueryPaintArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryPaintOptionsArgs = {
  excludeIds?: Array<Scalars["ID"]["input"]>;
  first?: Scalars["Int"]["input"];
  search?: Scalars["String"]["input"];
};

export type QueryPaintRankingArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
  id: Scalars["ID"]["input"];
  ownedOnly?: Scalars["Boolean"]["input"];
};

export type QuerySchemeColorIndexArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type QuerySchemeOptionsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  category?: InputMaybe<Scalars["String"]["input"]>;
  excludeIds?: Array<Scalars["ID"]["input"]>;
  first?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
};

export type QuerySchemePaintOptionsArgs = {
  excludeIds?: Array<Scalars["ID"]["input"]>;
  first?: Scalars["Int"]["input"];
  search?: Scalars["String"]["input"];
};

export type QuerySchemesArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  category?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
  noSource?: Scalars["Boolean"]["input"];
  readiness?: InputMaybe<SchemeReadiness>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  sourceId?: InputMaybe<Scalars["ID"]["input"]>;
  usesPaintIds?: Array<Scalars["ID"]["input"]>;
};

export type QuerySourceRemovalArgs = {
  id: Scalars["ID"]["input"];
};

export type QuerySubstitutionArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryTemplateRecipeArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryTemplatesArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  category?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
  flat?: Scalars["Boolean"]["input"];
  folderId?: InputMaybe<Scalars["ID"]["input"]>;
  id?: InputMaybe<Scalars["ID"]["input"]>;
  noSource?: InputMaybe<Scalars["Boolean"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  sourceId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type QueryVaultInvalidationArgs = {
  epoch: Scalars["String"]["input"];
  since: Scalars["Sequence"]["input"];
};

export type QueryWishlistArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
  miniatureId?: InputMaybe<Scalars["ID"]["input"]>;
  missingAfter?: InputMaybe<Scalars["String"]["input"]>;
  missingFirst?: Scalars["Int"]["input"];
};

export type QueryWishlistExportArgs = {
  miniatureId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type QueryWishlistModelOptionsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryWishlistRelatedProjectsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
  paintId: Scalars["ID"]["input"];
};

export type RankedPaint = {
  __typename?: "RankedPaint";
  match: PaintColorMatch;
  paint: Paint;
  sameType: Scalars["Boolean"]["output"];
};

export type Readiness = {
  __typename?: "Readiness";
  missing: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

/** Flat memberships keep responses bounded even for a scheme with many paints. */
export type SchemeColorIndexEntry = {
  __typename?: "SchemeColorIndexEntry";
  paint: ColorIndexPaint;
  schemeId: Scalars["ID"]["output"];
  schemeName: Scalars["String"]["output"];
};

export type SchemeColorIndexView = {
  __typename?: "SchemeColorIndexView";
  nodes: Array<SchemeColorIndexEntry>;
  pageInfo: PageInfo;
  revision: VaultRevision;
};

export type SchemeEntryInput = {
  id?: InputMaybe<Scalars["ID"]["input"]>;
  imageType?: InputMaybe<Scalars["String"]["input"]>;
  imageUrl?: InputMaybe<Scalars["String"]["input"]>;
  label?: InputMaybe<Scalars["String"]["input"]>;
  method?: InputMaybe<Scalars["String"]["input"]>;
  paintId?: InputMaybe<Scalars["ID"]["input"]>;
  role?: InputMaybe<Scalars["String"]["input"]>;
  thumbnailUrl?: InputMaybe<Scalars["String"]["input"]>;
  tone?: InputMaybe<Scalars["String"]["input"]>;
  type: MiniatureSchemeEntryKind;
};

export type SchemeFacets = {
  __typename?: "SchemeFacets";
  categories: Array<FacetCount>;
  readiness: Array<FacetCount>;
  sources: Array<FacetCount>;
};

export type SchemeInput = {
  category: Scalars["String"]["input"];
  entries: Array<SchemeEntryInput>;
  name: Scalars["String"]["input"];
};

export type SchemeMutationPayload = {
  __typename?: "SchemeMutationPayload";
  clientMutationId?: Maybe<Scalars["String"]["output"]>;
  invalidatedFamilies: Array<VaultFamily>;
  revision: VaultRevision;
  schemeId: Scalars["ID"]["output"];
};

export type SchemeReadiness = "MISSING" | "READY";

export type SchemesView = {
  __typename?: "SchemesView";
  facets: SchemeFacets;
  nodes: Array<MiniatureScheme>;
  pageInfo: PageInfo;
  revision: VaultRevision;
  totalCount: Scalars["Int"]["output"];
};

export type SourceDependency = {
  __typename?: "SourceDependency";
  minimumVersion?: Maybe<Scalars["String"]["output"]>;
  repository: Scalars["String"]["output"];
};

export type SourceItemCounts = {
  __typename?: "SourceItemCounts";
  paints: Scalars["Int"]["output"];
  schemes: Scalars["Int"]["output"];
  templates: Scalars["Int"]["output"];
};

export type SourceRemovalBlocker = {
  __typename?: "SourceRemovalBlocker";
  count: Scalars["Int"]["output"];
  label: Scalars["String"]["output"];
};

export type SourceRemovalIdentity = {
  __typename?: "SourceRemovalIdentity";
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  version: Scalars["String"]["output"];
};

export type SourceRemovalView = {
  __typename?: "SourceRemovalView";
  blockers: Array<SourceRemovalBlocker>;
  canRemove: Scalars["Boolean"]["output"];
  removes: SourceItemCounts;
  revision: VaultRevision;
  source: SourceRemovalIdentity;
};

export type SourceShareItem = {
  __typename?: "SourceShareItem";
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
};

export type SourceShareableView = {
  __typename?: "SourceShareableView";
  paints: Array<SourceShareItem>;
  revision: VaultRevision;
  schemes: Array<SourceShareItem>;
  templates: Array<SourceShareItem>;
};

export type SourceVersion = {
  __typename?: "SourceVersion";
  availableVersion?: Maybe<Scalars["String"]["output"]>;
  error?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  updateAvailable?: Maybe<Scalars["Boolean"]["output"]>;
};

export type SourceVersionsView = {
  __typename?: "SourceVersionsView";
  revision: VaultRevision;
  versions: Array<SourceVersion>;
};

export type SourcesView = {
  __typename?: "SourcesView";
  revision: VaultRevision;
  sources: Array<CatalogSource>;
};

export type StockLevel = "EMPTY" | "FULL" | "LOW";

export type Subscription = {
  __typename?: "Subscription";
  pluginInstallProgress?: Maybe<PluginInstallJob>;
  /** Resume family invalidations using the last received epoch/seq. */
  vaultChanges: VaultInvalidation;
};

export type SubscriptionVaultChangesArgs = {
  epoch: Scalars["String"]["input"];
  since: Scalars["Sequence"]["input"];
};

export type Substitution = {
  __typename?: "Substitution";
  available: Scalars["Boolean"]["output"];
  brokenReason?: Maybe<BrokenReason>;
  id: Scalars["ID"]["output"];
  ingredients: IngredientConnection;
  isDefault: Scalars["Boolean"]["output"];
  name: Scalars["String"]["output"];
  targetPaintId: Scalars["ID"]["output"];
};

export type SubstitutionIngredientsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type SubstitutionConnection = {
  __typename?: "SubstitutionConnection";
  nodes: Array<Substitution>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type SubstitutionIngredient = {
  __typename?: "SubstitutionIngredient";
  paint: Paint;
  parts: Scalars["Int"]["output"];
  sortOrder: Scalars["Int"]["output"];
};

export type SubstitutionIngredientInput = {
  paintId: Scalars["ID"]["input"];
  parts?: InputMaybe<Scalars["Int"]["input"]>;
};

export type SubstitutionInput = {
  ingredients: Array<SubstitutionIngredientInput>;
  name: Scalars["String"]["input"];
  targetPaintId: Scalars["ID"]["input"];
};

export type SubstitutionMutationPayload = {
  __typename?: "SubstitutionMutationPayload";
  clientMutationId?: Maybe<Scalars["String"]["output"]>;
  invalidatedFamilies: Array<VaultFamily>;
  miniatureId?: Maybe<Scalars["ID"]["output"]>;
  paintId?: Maybe<Scalars["ID"]["output"]>;
  revision: VaultRevision;
  substitutionId?: Maybe<Scalars["ID"]["output"]>;
};

export type SubstitutionView = {
  __typename?: "SubstitutionView";
  revision: VaultRevision;
  substitution?: Maybe<Substitution>;
};

export type TemplateConnection = {
  __typename?: "TemplateConnection";
  nodes: Array<TemplateSummary>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type TemplateInput = {
  faction?: InputMaybe<Scalars["String"]["input"]>;
  folderId?: InputMaybe<Scalars["ID"]["input"]>;
  imageUrl?: InputMaybe<Scalars["String"]["input"]>;
  manufacturer?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  paints?: InputMaybe<Array<TemplatePaintInput>>;
  schemeIds?: InputMaybe<Array<Scalars["ID"]["input"]>>;
  sourceMiniatureId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type TemplateMutationPayload = {
  __typename?: "TemplateMutationPayload";
  clientMutationId?: Maybe<Scalars["String"]["output"]>;
  invalidatedFamilies: Array<VaultFamily>;
  revision: VaultRevision;
  templateId: Scalars["ID"]["output"];
};

export type TemplatePaint = {
  __typename?: "TemplatePaint";
  notes: Scalars["String"]["output"];
  paintBrand: Scalars["String"]["output"];
  paintId: Scalars["ID"]["output"];
  paintName: Scalars["String"]["output"];
  sortOrder: Scalars["Int"]["output"];
  step: Scalars["String"]["output"];
};

export type TemplatePaintConnection = {
  __typename?: "TemplatePaintConnection";
  nodes: Array<TemplatePaint>;
  pageInfo: PageInfo;
};

export type TemplatePaintInput = {
  notes?: Scalars["String"]["input"];
  paintId: Scalars["ID"]["input"];
  sortOrder?: Scalars["Int"]["input"];
  step: Scalars["String"]["input"];
};

export type TemplateRecipeView = {
  __typename?: "TemplateRecipeView";
  paints: TemplatePaintConnection;
  revision: VaultRevision;
  schemes: TemplateSchemeConnection;
  templateId: Scalars["ID"]["output"];
};

export type TemplateRecipeViewPaintsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type TemplateRecipeViewSchemesArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type TemplateScheme = {
  __typename?: "TemplateScheme";
  name: Scalars["String"]["output"];
  schemeId: Scalars["ID"]["output"];
};

export type TemplateSchemeConnection = {
  __typename?: "TemplateSchemeConnection";
  nodes: Array<TemplateScheme>;
  pageInfo: PageInfo;
};

export type TemplateSummary = {
  __typename?: "TemplateSummary";
  categories: Array<Scalars["String"]["output"]>;
  faction: Scalars["String"]["output"];
  folderId?: Maybe<Scalars["ID"]["output"]>;
  id: Scalars["ID"]["output"];
  imageUrl: Scalars["String"]["output"];
  kind: Scalars["String"]["output"];
  manufacturer: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
  paintCount: Scalars["Int"]["output"];
  schemeCount: Scalars["Int"]["output"];
  sourceId?: Maybe<Scalars["ID"]["output"]>;
  sourceLogoUrl?: Maybe<Scalars["String"]["output"]>;
  sourceName?: Maybe<Scalars["String"]["output"]>;
  thumbnailUrl?: Maybe<Scalars["String"]["output"]>;
};

export type TemplatesView = {
  __typename?: "TemplatesView";
  categoryCounts: Array<FacetCount>;
  revision: VaultRevision;
  sourceCounts: Array<FacetCount>;
  templates: TemplateConnection;
};

export type VaultFamily =
  "HOME" | "LIBRARY" | "MINIATURES" | "OPTIONS" | "PAINT" | "SCHEMES" | "SOURCES" | "TEMPLATES" | "WISHLIST";

export type VaultInvalidation = {
  __typename?: "VaultInvalidation";
  epoch: Scalars["String"]["output"];
  families: Array<VaultFamily>;
  /** Epoch/pruning/overflow/source reset: discard the previous revision baseline. */
  reset: Scalars["Boolean"]["output"];
  seq: Scalars["Sequence"]["output"];
};

export type VaultRevision = {
  __typename?: "VaultRevision";
  epoch: Scalars["String"]["output"];
  seq: Scalars["Sequence"]["output"];
};

export type WishlistConnection = {
  __typename?: "WishlistConnection";
  nodes: Array<WishlistRow>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type WishlistCounts = {
  __typename?: "WishlistCounts";
  brokenSubstitution: Scalars["Int"]["output"];
  listedMissingStock: Scalars["Int"]["output"];
  /** Distinct unlisted project paint issues, globally, independent of model filter. */
  missingPaints: Scalars["Int"]["output"];
  /** Unlisted paint issues with missing physical stock (may also be broken). */
  missingStock: Scalars["Int"]["output"];
  projectCount: Scalars["Int"]["output"];
  restockPaints: Scalars["Int"]["output"];
  shoppingPaints: Scalars["Int"]["output"];
};

export type WishlistExport = {
  __typename?: "WishlistExport";
  revision: VaultRevision;
  text: Scalars["String"]["output"];
  totalCount: Scalars["Int"]["output"];
};

export type WishlistModelOption = {
  __typename?: "WishlistModelOption";
  id: Scalars["ID"]["output"];
  /** Distinct shopping paints associated with this miniature. */
  projectCount: Scalars["Int"]["output"];
  title: Scalars["String"]["output"];
};

export type WishlistModelOptionsView = {
  __typename?: "WishlistModelOptionsView";
  nodes: Array<WishlistModelOption>;
  pageInfo: PageInfo;
  revision: VaultRevision;
  totalCount: Scalars["Int"]["output"];
};

export type WishlistProject = {
  __typename?: "WishlistProject";
  id: Scalars["ID"]["output"];
  title: Scalars["String"]["output"];
};

export type WishlistProjectConnection = {
  __typename?: "WishlistProjectConnection";
  nodes: Array<WishlistProject>;
  pageInfo: PageInfo;
  revision: VaultRevision;
  totalCount: Scalars["Int"]["output"];
};

export type WishlistRow = {
  __typename?: "WishlistRow";
  brandGroup: Scalars["String"]["output"];
  brokenSubstitution: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  missingStock: Scalars["Boolean"]["output"];
  paint: Paint;
  projectCount: Scalars["Int"]["output"];
  relatedProjectsPreview: Array<WishlistProject>;
  relatedProjectsTruncated: Scalars["Boolean"]["output"];
  restock: Scalars["Boolean"]["output"];
};

export type WishlistView = {
  __typename?: "WishlistView";
  counts: WishlistCounts;
  missing: WishlistConnection;
  revision: VaultRevision;
  shopping: WishlistConnection;
};

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<
  TResult,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<
  TResult,
  TKey extends string,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<
  TTypes,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
> = (parent: TParent, context: TContext, info: GraphQLResolveInfo) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  obj: T,
  context: TContext,
  info: GraphQLResolveInfo,
) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<
  TResult = Record<PropertyKey, never>,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/** Mapping of union types */
export type ResolversUnionTypes<_RefType extends Record<string, unknown>> = {
  FolderSearchResult: FolderRead | Miniature | TemplateSummary;
};

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  ActiveSubstitution: ResolverTypeWrapper<ActiveSubstitution>;
  Boolean: ResolverTypeWrapper<Scalars["Boolean"]["output"]>;
  BrokenReason: BrokenReason;
  CatalogSource: ResolverTypeWrapper<CatalogSource>;
  ColorIndexPaint: ResolverTypeWrapper<ColorIndexPaint>;
  ColorIndexView: ResolverTypeWrapper<ColorIndexView>;
  CustomPaintImportInput: CustomPaintImportInput;
  CustomPaintInput: CustomPaintInput;
  ErrorParameter: ResolverTypeWrapper<ErrorParameter>;
  FacetCount: ResolverTypeWrapper<FacetCount>;
  Float: ResolverTypeWrapper<Scalars["Float"]["output"]>;
  Folder: ResolverTypeWrapper<FolderRead>;
  FolderBrowserPayload: ResolverTypeWrapper<
    Omit<FolderBrowserPayload, "folders"> & { folders: Array<ResolversTypes["Folder"]> }
  >;
  FolderDeleteMode: FolderDeleteMode;
  FolderKind: FolderKind;
  FolderMutationPayload: ResolverTypeWrapper<FolderMutationPayload>;
  FolderSearchConnection: ResolverTypeWrapper<
    Omit<FolderSearchConnection, "nodes"> & { nodes: Array<ResolversTypes["FolderSearchResult"]> }
  >;
  FolderSearchResult: ResolverTypeWrapper<ResolversUnionTypes<ResolversTypes>["FolderSearchResult"]>;
  FolderSearchView: ResolverTypeWrapper<
    Omit<FolderSearchView, "results"> & { results: ResolversTypes["FolderSearchConnection"] }
  >;
  HomeCounts: ResolverTypeWrapper<HomeCounts>;
  HomeView: ResolverTypeWrapper<HomeView>;
  ID: ResolverTypeWrapper<Scalars["ID"]["output"]>;
  IngredientConnection: ResolverTypeWrapper<IngredientConnection>;
  Int: ResolverTypeWrapper<Scalars["Int"]["output"]>;
  Inventory: ResolverTypeWrapper<Inventory>;
  LibraryFacets: ResolverTypeWrapper<LibraryFacets>;
  LibraryFilter: LibraryFilter;
  Miniature: ResolverTypeWrapper<Miniature>;
  MiniatureConnection: ResolverTypeWrapper<MiniatureConnection>;
  MiniatureInput: MiniatureInput;
  MiniatureMissingConnection: ResolverTypeWrapper<MiniatureMissingConnection>;
  MiniatureMissingPaint: ResolverTypeWrapper<MiniatureMissingPaint>;
  MiniatureMutationPayload: ResolverTypeWrapper<MiniatureMutationPayload>;
  MiniatureRecipeConnection: ResolverTypeWrapper<MiniatureRecipeConnection>;
  MiniatureRecipeEntry: ResolverTypeWrapper<MiniatureRecipeEntry>;
  MiniatureRecipeEntryInput: MiniatureRecipeEntryInput;
  MiniatureRequiredConnection: ResolverTypeWrapper<MiniatureRequiredConnection>;
  MiniatureScheme: ResolverTypeWrapper<MiniatureScheme>;
  MiniatureSchemeConnection: ResolverTypeWrapper<MiniatureSchemeConnection>;
  MiniatureSchemeEntry: ResolverTypeWrapper<MiniatureSchemeEntry>;
  MiniatureSchemeEntryConnection: ResolverTypeWrapper<MiniatureSchemeEntryConnection>;
  MiniatureSchemeEntryKind: MiniatureSchemeEntryKind;
  MiniatureSchemeLink: ResolverTypeWrapper<MiniatureSchemeLink>;
  MiniatureSchemeOptionsView: ResolverTypeWrapper<MiniatureSchemeOptionsView>;
  MiniatureSchemeView: ResolverTypeWrapper<MiniatureSchemeRead>;
  MiniatureSwatch: ResolverTypeWrapper<MiniatureSwatch>;
  MiniatureView: ResolverTypeWrapper<MiniatureViewRead>;
  MiniaturesView: ResolverTypeWrapper<MiniaturesView>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  NavigationView: ResolverTypeWrapper<NavigationView>;
  Ownership: Ownership;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Paint: ResolverTypeWrapper<Paint>;
  PaintColorMatch: ResolverTypeWrapper<PaintColorMatch>;
  PaintCommandPayload: ResolverTypeWrapper<PaintCommandPayload>;
  PaintConnection: ResolverTypeWrapper<PaintConnection>;
  PaintImportPayload: ResolverTypeWrapper<PaintImportPayload>;
  PaintMutationResult: ResolverTypeWrapper<PaintMutationResult>;
  PaintOptionsView: ResolverTypeWrapper<PaintOptionsView>;
  PaintRankingView: ResolverTypeWrapper<PaintRankingView>;
  PaintUsage: ResolverTypeWrapper<PaintUsage>;
  PaintUsageConnection: ResolverTypeWrapper<PaintUsageConnection>;
  PaintView: ResolverTypeWrapper<PaintViewRead>;
  PaintingStatus: PaintingStatus;
  PluginInstallErrorParameter: ResolverTypeWrapper<PluginInstallErrorParameter>;
  PluginInstallJob: ResolverTypeWrapper<PluginInstallJob>;
  PluginInstallStage: PluginInstallStage;
  PublicError: ResolverTypeWrapper<PublicError>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  RankedPaint: ResolverTypeWrapper<RankedPaint>;
  Readiness: ResolverTypeWrapper<Readiness>;
  SchemeColorIndexEntry: ResolverTypeWrapper<SchemeColorIndexEntry>;
  SchemeColorIndexView: ResolverTypeWrapper<SchemeColorIndexView>;
  SchemeEntryInput: SchemeEntryInput;
  SchemeFacets: ResolverTypeWrapper<SchemeFacets>;
  SchemeInput: SchemeInput;
  SchemeMutationPayload: ResolverTypeWrapper<SchemeMutationPayload>;
  SchemeReadiness: SchemeReadiness;
  SchemesView: ResolverTypeWrapper<SchemesView>;
  Sequence: ResolverTypeWrapper<Scalars["Sequence"]["output"]>;
  SourceDependency: ResolverTypeWrapper<SourceDependency>;
  SourceItemCounts: ResolverTypeWrapper<SourceItemCounts>;
  SourceRemovalBlocker: ResolverTypeWrapper<SourceRemovalBlocker>;
  SourceRemovalIdentity: ResolverTypeWrapper<SourceRemovalIdentity>;
  SourceRemovalView: ResolverTypeWrapper<SourceRemovalView>;
  SourceShareItem: ResolverTypeWrapper<SourceShareItem>;
  SourceShareableView: ResolverTypeWrapper<SourceShareableView>;
  SourceVersion: ResolverTypeWrapper<SourceVersion>;
  SourceVersionsView: ResolverTypeWrapper<SourceVersionsView>;
  SourcesView: ResolverTypeWrapper<SourcesView>;
  StockLevel: StockLevel;
  String: ResolverTypeWrapper<Scalars["String"]["output"]>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Substitution: ResolverTypeWrapper<SubstitutionRead>;
  SubstitutionConnection: ResolverTypeWrapper<
    Omit<SubstitutionConnection, "nodes"> & { nodes: Array<ResolversTypes["Substitution"]> }
  >;
  SubstitutionIngredient: ResolverTypeWrapper<SubstitutionIngredient>;
  SubstitutionIngredientInput: SubstitutionIngredientInput;
  SubstitutionInput: SubstitutionInput;
  SubstitutionMutationPayload: ResolverTypeWrapper<SubstitutionMutationPayload>;
  SubstitutionView: ResolverTypeWrapper<
    Omit<SubstitutionView, "substitution"> & { substitution?: Maybe<ResolversTypes["Substitution"]> }
  >;
  TemplateConnection: ResolverTypeWrapper<TemplateConnection>;
  TemplateInput: TemplateInput;
  TemplateMutationPayload: ResolverTypeWrapper<TemplateMutationPayload>;
  TemplatePaint: ResolverTypeWrapper<TemplatePaint>;
  TemplatePaintConnection: ResolverTypeWrapper<TemplatePaintConnection>;
  TemplatePaintInput: TemplatePaintInput;
  TemplateRecipeView: ResolverTypeWrapper<TemplateRecipeRead>;
  TemplateScheme: ResolverTypeWrapper<TemplateScheme>;
  TemplateSchemeConnection: ResolverTypeWrapper<TemplateSchemeConnection>;
  TemplateSummary: ResolverTypeWrapper<TemplateSummary>;
  TemplatesView: ResolverTypeWrapper<TemplatesView>;
  VaultFamily: VaultFamily;
  VaultInvalidation: ResolverTypeWrapper<VaultInvalidation>;
  VaultRevision: ResolverTypeWrapper<VaultRevision>;
  WishlistConnection: ResolverTypeWrapper<WishlistConnection>;
  WishlistCounts: ResolverTypeWrapper<WishlistCounts>;
  WishlistExport: ResolverTypeWrapper<WishlistExport>;
  WishlistModelOption: ResolverTypeWrapper<WishlistModelOption>;
  WishlistModelOptionsView: ResolverTypeWrapper<WishlistModelOptionsView>;
  WishlistProject: ResolverTypeWrapper<WishlistProject>;
  WishlistProjectConnection: ResolverTypeWrapper<WishlistProjectConnection>;
  WishlistRow: ResolverTypeWrapper<WishlistRow>;
  WishlistView: ResolverTypeWrapper<WishlistView>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  ActiveSubstitution: ActiveSubstitution;
  Boolean: Scalars["Boolean"]["output"];
  CatalogSource: CatalogSource;
  ColorIndexPaint: ColorIndexPaint;
  ColorIndexView: ColorIndexView;
  CustomPaintImportInput: CustomPaintImportInput;
  CustomPaintInput: CustomPaintInput;
  ErrorParameter: ErrorParameter;
  FacetCount: FacetCount;
  Float: Scalars["Float"]["output"];
  Folder: FolderRead;
  FolderBrowserPayload: Omit<FolderBrowserPayload, "folders"> & {
    folders: Array<ResolversParentTypes["Folder"]>;
  };
  FolderMutationPayload: FolderMutationPayload;
  FolderSearchConnection: Omit<FolderSearchConnection, "nodes"> & {
    nodes: Array<ResolversParentTypes["FolderSearchResult"]>;
  };
  FolderSearchResult: ResolversUnionTypes<ResolversParentTypes>["FolderSearchResult"];
  FolderSearchView: Omit<FolderSearchView, "results"> & {
    results: ResolversParentTypes["FolderSearchConnection"];
  };
  HomeCounts: HomeCounts;
  HomeView: HomeView;
  ID: Scalars["ID"]["output"];
  IngredientConnection: IngredientConnection;
  Int: Scalars["Int"]["output"];
  Inventory: Inventory;
  LibraryFacets: LibraryFacets;
  Miniature: Miniature;
  MiniatureConnection: MiniatureConnection;
  MiniatureInput: MiniatureInput;
  MiniatureMissingConnection: MiniatureMissingConnection;
  MiniatureMissingPaint: MiniatureMissingPaint;
  MiniatureMutationPayload: MiniatureMutationPayload;
  MiniatureRecipeConnection: MiniatureRecipeConnection;
  MiniatureRecipeEntry: MiniatureRecipeEntry;
  MiniatureRecipeEntryInput: MiniatureRecipeEntryInput;
  MiniatureRequiredConnection: MiniatureRequiredConnection;
  MiniatureScheme: MiniatureScheme;
  MiniatureSchemeConnection: MiniatureSchemeConnection;
  MiniatureSchemeEntry: MiniatureSchemeEntry;
  MiniatureSchemeEntryConnection: MiniatureSchemeEntryConnection;
  MiniatureSchemeLink: MiniatureSchemeLink;
  MiniatureSchemeOptionsView: MiniatureSchemeOptionsView;
  MiniatureSchemeView: MiniatureSchemeRead;
  MiniatureSwatch: MiniatureSwatch;
  MiniatureView: MiniatureViewRead;
  MiniaturesView: MiniaturesView;
  Mutation: Record<PropertyKey, never>;
  NavigationView: NavigationView;
  PageInfo: PageInfo;
  Paint: Paint;
  PaintColorMatch: PaintColorMatch;
  PaintCommandPayload: PaintCommandPayload;
  PaintConnection: PaintConnection;
  PaintImportPayload: PaintImportPayload;
  PaintMutationResult: PaintMutationResult;
  PaintOptionsView: PaintOptionsView;
  PaintRankingView: PaintRankingView;
  PaintUsage: PaintUsage;
  PaintUsageConnection: PaintUsageConnection;
  PaintView: PaintViewRead;
  PluginInstallErrorParameter: PluginInstallErrorParameter;
  PluginInstallJob: PluginInstallJob;
  PublicError: PublicError;
  Query: Record<PropertyKey, never>;
  RankedPaint: RankedPaint;
  Readiness: Readiness;
  SchemeColorIndexEntry: SchemeColorIndexEntry;
  SchemeColorIndexView: SchemeColorIndexView;
  SchemeEntryInput: SchemeEntryInput;
  SchemeFacets: SchemeFacets;
  SchemeInput: SchemeInput;
  SchemeMutationPayload: SchemeMutationPayload;
  SchemesView: SchemesView;
  Sequence: Scalars["Sequence"]["output"];
  SourceDependency: SourceDependency;
  SourceItemCounts: SourceItemCounts;
  SourceRemovalBlocker: SourceRemovalBlocker;
  SourceRemovalIdentity: SourceRemovalIdentity;
  SourceRemovalView: SourceRemovalView;
  SourceShareItem: SourceShareItem;
  SourceShareableView: SourceShareableView;
  SourceVersion: SourceVersion;
  SourceVersionsView: SourceVersionsView;
  SourcesView: SourcesView;
  String: Scalars["String"]["output"];
  Subscription: Record<PropertyKey, never>;
  Substitution: SubstitutionRead;
  SubstitutionConnection: Omit<SubstitutionConnection, "nodes"> & {
    nodes: Array<ResolversParentTypes["Substitution"]>;
  };
  SubstitutionIngredient: SubstitutionIngredient;
  SubstitutionIngredientInput: SubstitutionIngredientInput;
  SubstitutionInput: SubstitutionInput;
  SubstitutionMutationPayload: SubstitutionMutationPayload;
  SubstitutionView: Omit<SubstitutionView, "substitution"> & {
    substitution?: Maybe<ResolversParentTypes["Substitution"]>;
  };
  TemplateConnection: TemplateConnection;
  TemplateInput: TemplateInput;
  TemplateMutationPayload: TemplateMutationPayload;
  TemplatePaint: TemplatePaint;
  TemplatePaintConnection: TemplatePaintConnection;
  TemplatePaintInput: TemplatePaintInput;
  TemplateRecipeView: TemplateRecipeRead;
  TemplateScheme: TemplateScheme;
  TemplateSchemeConnection: TemplateSchemeConnection;
  TemplateSummary: TemplateSummary;
  TemplatesView: TemplatesView;
  VaultInvalidation: VaultInvalidation;
  VaultRevision: VaultRevision;
  WishlistConnection: WishlistConnection;
  WishlistCounts: WishlistCounts;
  WishlistExport: WishlistExport;
  WishlistModelOption: WishlistModelOption;
  WishlistModelOptionsView: WishlistModelOptionsView;
  WishlistProject: WishlistProject;
  WishlistProjectConnection: WishlistProjectConnection;
  WishlistRow: WishlistRow;
  WishlistView: WishlistView;
};

export type ActiveSubstitutionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["ActiveSubstitution"] = ResolversParentTypes["ActiveSubstitution"],
> = {
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type CatalogSourceResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["CatalogSource"] = ResolversParentTypes["CatalogSource"],
> = {
  attribution?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  counts?: Resolver<ResolversTypes["SourceItemCounts"], ParentType, ContextType>;
  dependencies?: Resolver<Array<ResolversTypes["SourceDependency"]>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  lastError?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  lastErrorInfo?: Resolver<Maybe<ResolversTypes["PublicError"]>, ParentType, ContextType>;
  license?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  logoUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  repository?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  url?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  version?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type ColorIndexPaintResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["ColorIndexPaint"] = ResolversParentTypes["ColorIndexPaint"],
> = {
  available?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  brand?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  hex?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  owned?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
};

export type ColorIndexViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["ColorIndexView"] = ResolversParentTypes["ColorIndexView"],
> = {
  nodes?: Resolver<Array<ResolversTypes["ColorIndexPaint"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
};

export type ErrorParameterResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["ErrorParameter"] = ResolversParentTypes["ErrorParameter"],
> = {
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  value?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type FacetCountResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["FacetCount"] = ResolversParentTypes["FacetCount"],
> = {
  count?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  key?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  label?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type FolderResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Folder"] = ResolversParentTypes["Folder"],
> = {
  coverThumbnailUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  directCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  parentId?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  recursiveCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FolderBrowserPayloadResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["FolderBrowserPayload"] =
    ResolversParentTypes["FolderBrowserPayload"],
> = {
  folders?: Resolver<Array<ResolversTypes["Folder"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type FolderMutationPayloadResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["FolderMutationPayload"] =
    ResolversParentTypes["FolderMutationPayload"],
> = {
  invalidatedFamilies?: Resolver<Array<ResolversTypes["VaultFamily"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
};

export type FolderSearchConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["FolderSearchConnection"] =
    ResolversParentTypes["FolderSearchConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["FolderSearchResult"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type FolderSearchResultResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["FolderSearchResult"] = ResolversParentTypes["FolderSearchResult"],
> = {
  __resolveType: TypeResolveFn<"Folder" | "Miniature" | "TemplateSummary", ParentType, ContextType>;
};

export type FolderSearchViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["FolderSearchView"] = ResolversParentTypes["FolderSearchView"],
> = {
  results?: Resolver<ResolversTypes["FolderSearchConnection"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
};

export type HomeCountsResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["HomeCounts"] = ResolversParentTypes["HomeCounts"],
> = {
  catalogCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  distinctMissingPaints?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  owned?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  ready?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  stages?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
  wishlistedMissingPaints?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type HomeViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["HomeView"] = ResolversParentTypes["HomeView"],
> = {
  counts?: Resolver<ResolversTypes["HomeCounts"], ParentType, ContextType>;
  miniatures?: Resolver<ResolversTypes["MiniatureConnection"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
};

export type IngredientConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["IngredientConnection"] =
    ResolversParentTypes["IngredientConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["SubstitutionIngredient"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type InventoryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Inventory"] = ResolversParentTypes["Inventory"],
> = {
  quantity?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  state?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  stockLevel?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type LibraryFacetsResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["LibraryFacets"] = ResolversParentTypes["LibraryFacets"],
> = {
  brands?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
  inventory?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
  sources?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
};

export type MiniatureResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Miniature"] = ResolversParentTypes["Miniature"],
> = {
  createdAt?: Resolver<ResolversTypes["Float"], ParentType, ContextType>;
  faction?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  folderId?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  imageUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  manufacturer?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  notes?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  paintingStatus?: Resolver<ResolversTypes["PaintingStatus"], ParentType, ContextType>;
  previewSwatches?: Resolver<Array<ResolversTypes["MiniatureSwatch"]>, ParentType, ContextType>;
  readiness?: Resolver<ResolversTypes["Readiness"], ParentType, ContextType>;
  scale?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  status?: Resolver<ResolversTypes["Ownership"], ParentType, ContextType>;
  thumbnailUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  title?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MiniatureConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureConnection"] =
    ResolversParentTypes["MiniatureConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["Miniature"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type MiniatureMissingConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureMissingConnection"] =
    ResolversParentTypes["MiniatureMissingConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["MiniatureMissingPaint"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type MiniatureMissingPaintResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureMissingPaint"] =
    ResolversParentTypes["MiniatureMissingPaint"],
> = {
  brokenSubstitution?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  missingStock?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  paint?: Resolver<ResolversTypes["Paint"], ParentType, ContextType>;
};

export type MiniatureMutationPayloadResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureMutationPayload"] =
    ResolversParentTypes["MiniatureMutationPayload"],
> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  invalidatedFamilies?: Resolver<Array<ResolversTypes["VaultFamily"]>, ParentType, ContextType>;
  miniatureId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
};

export type MiniatureRecipeConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureRecipeConnection"] =
    ResolversParentTypes["MiniatureRecipeConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["MiniatureRecipeEntry"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type MiniatureRecipeEntryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureRecipeEntry"] =
    ResolversParentTypes["MiniatureRecipeEntry"],
> = {
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  notes?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  paint?: Resolver<ResolversTypes["Paint"], ParentType, ContextType>;
  sortOrder?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  step?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type MiniatureRequiredConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureRequiredConnection"] =
    ResolversParentTypes["MiniatureRequiredConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["Paint"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type MiniatureSchemeResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureScheme"] = ResolversParentTypes["MiniatureScheme"],
> = {
  availableCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  category?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  gradient?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  imageUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  isSystem?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  paintCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  paintNames?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  previewMoreCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  previewSwatches?: Resolver<Array<ResolversTypes["MiniatureSwatch"]>, ParentType, ContextType>;
  previewSwatchesTruncated?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  sourceId?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  sourceLogoUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  sourceName?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  thumbnailUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  usageCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type MiniatureSchemeConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureSchemeConnection"] =
    ResolversParentTypes["MiniatureSchemeConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["MiniatureSchemeLink"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type MiniatureSchemeEntryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureSchemeEntry"] =
    ResolversParentTypes["MiniatureSchemeEntry"],
> = {
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  imageType?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  imageUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  kind?: Resolver<ResolversTypes["MiniatureSchemeEntryKind"], ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  method?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  paint?: Resolver<Maybe<ResolversTypes["Paint"]>, ParentType, ContextType>;
  role?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  sortOrder?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  thumbnailUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  tone?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
};

export type MiniatureSchemeEntryConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureSchemeEntryConnection"] =
    ResolversParentTypes["MiniatureSchemeEntryConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["MiniatureSchemeEntry"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type MiniatureSchemeLinkResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureSchemeLink"] =
    ResolversParentTypes["MiniatureSchemeLink"],
> = {
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  scheme?: Resolver<ResolversTypes["MiniatureScheme"], ParentType, ContextType>;
  sortOrder?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type MiniatureSchemeOptionsViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureSchemeOptionsView"] =
    ResolversParentTypes["MiniatureSchemeOptionsView"],
> = {
  categoryCounts?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
  nodes?: Resolver<Array<ResolversTypes["MiniatureScheme"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type MiniatureSchemeViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureSchemeView"] =
    ResolversParentTypes["MiniatureSchemeView"],
> = {
  entries?: Resolver<
    ResolversTypes["MiniatureSchemeEntryConnection"],
    ParentType,
    ContextType,
    RequireFields<MiniatureSchemeViewEntriesArgs, "first">
  >;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  scheme?: Resolver<Maybe<ResolversTypes["MiniatureScheme"]>, ParentType, ContextType>;
};

export type MiniatureSwatchResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureSwatch"] = ResolversParentTypes["MiniatureSwatch"],
> = {
  colorHex?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  paintId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
};

export type MiniatureViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniatureView"] = ResolversParentTypes["MiniatureView"],
> = {
  miniature?: Resolver<Maybe<ResolversTypes["Miniature"]>, ParentType, ContextType>;
  missing?: Resolver<
    ResolversTypes["MiniatureMissingConnection"],
    ParentType,
    ContextType,
    RequireFields<MiniatureViewMissingArgs, "first">
  >;
  recipe?: Resolver<
    ResolversTypes["MiniatureRecipeConnection"],
    ParentType,
    ContextType,
    RequireFields<MiniatureViewRecipeArgs, "first">
  >;
  recipeSteps?: Resolver<Array<ResolversTypes["String"]>, ParentType, ContextType>;
  required?: Resolver<
    ResolversTypes["MiniatureRequiredConnection"],
    ParentType,
    ContextType,
    RequireFields<MiniatureViewRequiredArgs, "first">
  >;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  schemes?: Resolver<
    ResolversTypes["MiniatureSchemeConnection"],
    ParentType,
    ContextType,
    RequireFields<MiniatureViewSchemesArgs, "first">
  >;
};

export type MiniaturesViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["MiniaturesView"] = ResolversParentTypes["MiniaturesView"],
> = {
  miniatures?: Resolver<ResolversTypes["MiniatureConnection"], ParentType, ContextType>;
  ownershipCounts?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  stageCounts?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
};

export type MutationResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Mutation"] = ResolversParentTypes["Mutation"],
> = {
  createFolder?: Resolver<
    ResolversTypes["FolderMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationCreateFolderArgs, "kind" | "name">
  >;
  createMiniature?: Resolver<
    ResolversTypes["MiniatureMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationCreateMiniatureArgs, "input">
  >;
  createScheme?: Resolver<
    ResolversTypes["SchemeMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationCreateSchemeArgs, "input">
  >;
  createSubstitution?: Resolver<
    ResolversTypes["SubstitutionMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationCreateSubstitutionArgs, "input">
  >;
  createTemplate?: Resolver<
    ResolversTypes["TemplateMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationCreateTemplateArgs, "input">
  >;
  deleteCustomPaint?: Resolver<
    ResolversTypes["PaintCommandPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteCustomPaintArgs, "id">
  >;
  deleteFolder?: Resolver<
    ResolversTypes["FolderMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteFolderArgs, "id" | "mode">
  >;
  deleteMiniature?: Resolver<
    ResolversTypes["MiniatureMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteMiniatureArgs, "id">
  >;
  deleteScheme?: Resolver<
    ResolversTypes["SchemeMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteSchemeArgs, "id">
  >;
  deleteSubstitution?: Resolver<
    ResolversTypes["SubstitutionMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteSubstitutionArgs, "id">
  >;
  deleteTemplate?: Resolver<
    ResolversTypes["TemplateMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteTemplateArgs, "id">
  >;
  importCustomPaints?: Resolver<
    ResolversTypes["PaintImportPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationImportCustomPaintsArgs, "paints">
  >;
  moveFolder?: Resolver<
    ResolversTypes["FolderMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationMoveFolderArgs, "id">
  >;
  moveFolderItems?: Resolver<
    ResolversTypes["FolderMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationMoveFolderItemsArgs, "ids" | "kind">
  >;
  renameFolder?: Resolver<
    ResolversTypes["FolderMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationRenameFolderArgs, "id" | "name">
  >;
  selectPaintSubstitution?: Resolver<
    ResolversTypes["SubstitutionMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationSelectPaintSubstitutionArgs, "miniatureId" | "targetPaintId" | "useOriginal">
  >;
  setMiniatureRecipe?: Resolver<
    ResolversTypes["MiniatureMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationSetMiniatureRecipeArgs, "entries" | "id">
  >;
  setMiniatureSchemes?: Resolver<
    ResolversTypes["MiniatureMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationSetMiniatureSchemesArgs, "id" | "schemeIds">
  >;
  setPaintStock?: Resolver<
    ResolversTypes["PaintMutationResult"],
    ParentType,
    ContextType,
    RequireFields<MutationSetPaintStockArgs, "paintId">
  >;
  setSubstitutionDefault?: Resolver<
    ResolversTypes["SubstitutionMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationSetSubstitutionDefaultArgs, "enabled" | "id">
  >;
  updateCustomPaint?: Resolver<
    ResolversTypes["PaintCommandPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateCustomPaintArgs, "id" | "input">
  >;
  updateMiniature?: Resolver<
    ResolversTypes["MiniatureMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateMiniatureArgs, "id" | "input">
  >;
  updateScheme?: Resolver<
    ResolversTypes["SchemeMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateSchemeArgs, "id" | "input">
  >;
  updateTemplate?: Resolver<
    ResolversTypes["TemplateMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateTemplateArgs, "id" | "input">
  >;
};

export type NavigationViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["NavigationView"] = ResolversParentTypes["NavigationView"],
> = {
  availablePaints?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  shoppingPaints?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type PageInfoResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PageInfo"] = ResolversParentTypes["PageInfo"],
> = {
  endCursor?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
};

export type PaintResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Paint"] = ResolversParentTypes["Paint"],
> = {
  activeSubstitution?: Resolver<Maybe<ResolversTypes["ActiveSubstitution"]>, ParentType, ContextType>;
  available?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  brand?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  brokenReason?: Resolver<Maybe<ResolversTypes["BrokenReason"]>, ParentType, ContextType>;
  brokenSubstitution?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  colorHex?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  discontinued?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  hasActiveSubstitution?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  inventory?: Resolver<Maybe<ResolversTypes["Inventory"]>, ParentType, ContextType>;
  isCustom?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  missingStock?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  range?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  sourceLogoUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  sourceName?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  sourceUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
};

export type PaintColorMatchResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PaintColorMatch"] = ResolversParentTypes["PaintColorMatch"],
> = {
  distance?: Resolver<ResolversTypes["Float"], ParentType, ContextType>;
  hueDelta?: Resolver<Maybe<ResolversTypes["Float"]>, ParentType, ContextType>;
  intensityDelta?: Resolver<ResolversTypes["Float"], ParentType, ContextType>;
  lightnessDelta?: Resolver<ResolversTypes["Float"], ParentType, ContextType>;
  score?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type PaintCommandPayloadResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PaintCommandPayload"] =
    ResolversParentTypes["PaintCommandPayload"],
> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  invalidatedFamilies?: Resolver<Array<ResolversTypes["VaultFamily"]>, ParentType, ContextType>;
  paintId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
};

export type PaintConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PaintConnection"] = ResolversParentTypes["PaintConnection"],
> = {
  availableCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  catalogCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  explicitWishlistCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  facets?: Resolver<ResolversTypes["LibraryFacets"], ParentType, ContextType>;
  nodes?: Resolver<Array<ResolversTypes["Paint"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type PaintImportPayloadResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PaintImportPayload"] = ResolversParentTypes["PaintImportPayload"],
> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  imported?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  invalidatedFamilies?: Resolver<Array<ResolversTypes["VaultFamily"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  skipped?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type PaintMutationResultResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PaintMutationResult"] =
    ResolversParentTypes["PaintMutationResult"],
> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  invalidatedFamilies?: Resolver<Array<ResolversTypes["VaultFamily"]>, ParentType, ContextType>;
  paint?: Resolver<Maybe<ResolversTypes["Paint"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
};

export type PaintOptionsViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PaintOptionsView"] = ResolversParentTypes["PaintOptionsView"],
> = {
  items?: Resolver<Array<ResolversTypes["Paint"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
};

export type PaintRankingViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PaintRankingView"] = ResolversParentTypes["PaintRankingView"],
> = {
  nodes?: Resolver<Array<ResolversTypes["RankedPaint"]>, ParentType, ContextType>;
  owned?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  paint?: Resolver<Maybe<ResolversTypes["Paint"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  suggestedId?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type PaintUsageResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PaintUsage"] = ResolversParentTypes["PaintUsage"],
> = {
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  title?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type PaintUsageConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PaintUsageConnection"] =
    ResolversParentTypes["PaintUsageConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["PaintUsage"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type PaintViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PaintView"] = ResolversParentTypes["PaintView"],
> = {
  paint?: Resolver<Maybe<ResolversTypes["Paint"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  substitutions?: Resolver<
    ResolversTypes["SubstitutionConnection"],
    ParentType,
    ContextType,
    RequireFields<PaintViewSubstitutionsArgs, "first">
  >;
  usedBy?: Resolver<
    ResolversTypes["PaintUsageConnection"],
    ParentType,
    ContextType,
    RequireFields<PaintViewUsedByArgs, "first">
  >;
};

export type PluginInstallErrorParameterResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PluginInstallErrorParameter"] =
    ResolversParentTypes["PluginInstallErrorParameter"],
> = {
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  value?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type PluginInstallJobResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PluginInstallJob"] = ResolversParentTypes["PluginInstallJob"],
> = {
  cancellable?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  done?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  error?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  errorCode?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  errorParameters?: Resolver<Array<ResolversTypes["PluginInstallErrorParameter"]>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  percent?: Resolver<ResolversTypes["Float"], ParentType, ContextType>;
  stage?: Resolver<ResolversTypes["PluginInstallStage"], ParentType, ContextType>;
  total?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type PublicErrorResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PublicError"] = ResolversParentTypes["PublicError"],
> = {
  code?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  parameters?: Resolver<Array<ResolversTypes["ErrorParameter"]>, ParentType, ContextType>;
};

export type QueryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Query"] = ResolversParentTypes["Query"],
> = {
  colorIndex?: Resolver<
    ResolversTypes["ColorIndexView"],
    ParentType,
    ContextType,
    RequireFields<QueryColorIndexArgs, "first">
  >;
  folderBrowser?: Resolver<
    ResolversTypes["FolderBrowserPayload"],
    ParentType,
    ContextType,
    RequireFields<QueryFolderBrowserArgs, "first" | "flat" | "kind">
  >;
  folderSearch?: Resolver<
    ResolversTypes["FolderSearchView"],
    ParentType,
    ContextType,
    RequireFields<QueryFolderSearchArgs, "first" | "kind" | "noSource" | "search">
  >;
  home?: Resolver<
    ResolversTypes["HomeView"],
    ParentType,
    ContextType,
    RequireFields<QueryHomeArgs, "first" | "flat">
  >;
  library?: Resolver<
    ResolversTypes["PaintConnection"],
    ParentType,
    ContextType,
    RequireFields<QueryLibraryArgs, "filter" | "first" | "noSource">
  >;
  miniature?: Resolver<
    ResolversTypes["MiniatureView"],
    ParentType,
    ContextType,
    RequireFields<QueryMiniatureArgs, "id">
  >;
  miniatureScheme?: Resolver<
    ResolversTypes["MiniatureSchemeView"],
    ParentType,
    ContextType,
    RequireFields<QueryMiniatureSchemeArgs, "id">
  >;
  miniatures?: Resolver<
    ResolversTypes["MiniaturesView"],
    ParentType,
    ContextType,
    RequireFields<QueryMiniaturesArgs, "first" | "flat">
  >;
  ownedPaintOptions?: Resolver<
    ResolversTypes["PaintOptionsView"],
    ParentType,
    ContextType,
    RequireFields<QueryOwnedPaintOptionsArgs, "first" | "search">
  >;
  paint?: Resolver<ResolversTypes["PaintView"], ParentType, ContextType, RequireFields<QueryPaintArgs, "id">>;
  paintOptions?: Resolver<
    ResolversTypes["PaintOptionsView"],
    ParentType,
    ContextType,
    RequireFields<QueryPaintOptionsArgs, "excludeIds" | "first" | "search">
  >;
  paintRanking?: Resolver<
    ResolversTypes["PaintRankingView"],
    ParentType,
    ContextType,
    RequireFields<QueryPaintRankingArgs, "first" | "id" | "ownedOnly">
  >;
  pluginInstallJob?: Resolver<Maybe<ResolversTypes["PluginInstallJob"]>, ParentType, ContextType>;
  schemeColorIndex?: Resolver<
    ResolversTypes["SchemeColorIndexView"],
    ParentType,
    ContextType,
    RequireFields<QuerySchemeColorIndexArgs, "first">
  >;
  schemeOptions?: Resolver<
    ResolversTypes["MiniatureSchemeOptionsView"],
    ParentType,
    ContextType,
    RequireFields<QuerySchemeOptionsArgs, "excludeIds" | "first">
  >;
  schemePaintOptions?: Resolver<
    ResolversTypes["PaintOptionsView"],
    ParentType,
    ContextType,
    RequireFields<QuerySchemePaintOptionsArgs, "excludeIds" | "first" | "search">
  >;
  schemes?: Resolver<
    ResolversTypes["SchemesView"],
    ParentType,
    ContextType,
    RequireFields<QuerySchemesArgs, "first" | "noSource" | "usesPaintIds">
  >;
  sourceRemoval?: Resolver<
    ResolversTypes["SourceRemovalView"],
    ParentType,
    ContextType,
    RequireFields<QuerySourceRemovalArgs, "id">
  >;
  sourceShareable?: Resolver<ResolversTypes["SourceShareableView"], ParentType, ContextType>;
  sourceVersions?: Resolver<ResolversTypes["SourceVersionsView"], ParentType, ContextType>;
  sources?: Resolver<ResolversTypes["SourcesView"], ParentType, ContextType>;
  substitution?: Resolver<
    ResolversTypes["SubstitutionView"],
    ParentType,
    ContextType,
    RequireFields<QuerySubstitutionArgs, "id">
  >;
  templateRecipe?: Resolver<
    ResolversTypes["TemplateRecipeView"],
    ParentType,
    ContextType,
    RequireFields<QueryTemplateRecipeArgs, "id">
  >;
  templates?: Resolver<
    ResolversTypes["TemplatesView"],
    ParentType,
    ContextType,
    RequireFields<QueryTemplatesArgs, "first" | "flat" | "noSource">
  >;
  vaultInvalidation?: Resolver<
    ResolversTypes["VaultInvalidation"],
    ParentType,
    ContextType,
    RequireFields<QueryVaultInvalidationArgs, "epoch" | "since">
  >;
  vaultNavigation?: Resolver<ResolversTypes["NavigationView"], ParentType, ContextType>;
  vaultRevision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  wishlist?: Resolver<
    ResolversTypes["WishlistView"],
    ParentType,
    ContextType,
    RequireFields<QueryWishlistArgs, "first" | "missingFirst">
  >;
  wishlistExport?: Resolver<
    ResolversTypes["WishlistExport"],
    ParentType,
    ContextType,
    Partial<QueryWishlistExportArgs>
  >;
  wishlistModelOptions?: Resolver<
    ResolversTypes["WishlistModelOptionsView"],
    ParentType,
    ContextType,
    RequireFields<QueryWishlistModelOptionsArgs, "first">
  >;
  wishlistRelatedProjects?: Resolver<
    ResolversTypes["WishlistProjectConnection"],
    ParentType,
    ContextType,
    RequireFields<QueryWishlistRelatedProjectsArgs, "first" | "paintId">
  >;
};

export type RankedPaintResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["RankedPaint"] = ResolversParentTypes["RankedPaint"],
> = {
  match?: Resolver<ResolversTypes["PaintColorMatch"], ParentType, ContextType>;
  paint?: Resolver<ResolversTypes["Paint"], ParentType, ContextType>;
  sameType?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
};

export type ReadinessResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Readiness"] = ResolversParentTypes["Readiness"],
> = {
  missing?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  total?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type SchemeColorIndexEntryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SchemeColorIndexEntry"] =
    ResolversParentTypes["SchemeColorIndexEntry"],
> = {
  paint?: Resolver<ResolversTypes["ColorIndexPaint"], ParentType, ContextType>;
  schemeId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  schemeName?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type SchemeColorIndexViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SchemeColorIndexView"] =
    ResolversParentTypes["SchemeColorIndexView"],
> = {
  nodes?: Resolver<Array<ResolversTypes["SchemeColorIndexEntry"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
};

export type SchemeFacetsResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SchemeFacets"] = ResolversParentTypes["SchemeFacets"],
> = {
  categories?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
  readiness?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
  sources?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
};

export type SchemeMutationPayloadResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SchemeMutationPayload"] =
    ResolversParentTypes["SchemeMutationPayload"],
> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  invalidatedFamilies?: Resolver<Array<ResolversTypes["VaultFamily"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  schemeId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
};

export type SchemesViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SchemesView"] = ResolversParentTypes["SchemesView"],
> = {
  facets?: Resolver<ResolversTypes["SchemeFacets"], ParentType, ContextType>;
  nodes?: Resolver<Array<ResolversTypes["MiniatureScheme"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export interface SequenceScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes["Sequence"], any> {
  name: "Sequence";
}

export type SourceDependencyResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SourceDependency"] = ResolversParentTypes["SourceDependency"],
> = {
  minimumVersion?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  repository?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type SourceItemCountsResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SourceItemCounts"] = ResolversParentTypes["SourceItemCounts"],
> = {
  paints?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  schemes?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  templates?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type SourceRemovalBlockerResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SourceRemovalBlocker"] =
    ResolversParentTypes["SourceRemovalBlocker"],
> = {
  count?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  label?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type SourceRemovalIdentityResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SourceRemovalIdentity"] =
    ResolversParentTypes["SourceRemovalIdentity"],
> = {
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  version?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type SourceRemovalViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SourceRemovalView"] = ResolversParentTypes["SourceRemovalView"],
> = {
  blockers?: Resolver<Array<ResolversTypes["SourceRemovalBlocker"]>, ParentType, ContextType>;
  canRemove?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  removes?: Resolver<ResolversTypes["SourceItemCounts"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  source?: Resolver<ResolversTypes["SourceRemovalIdentity"], ParentType, ContextType>;
};

export type SourceShareItemResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SourceShareItem"] = ResolversParentTypes["SourceShareItem"],
> = {
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type SourceShareableViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SourceShareableView"] =
    ResolversParentTypes["SourceShareableView"],
> = {
  paints?: Resolver<Array<ResolversTypes["SourceShareItem"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  schemes?: Resolver<Array<ResolversTypes["SourceShareItem"]>, ParentType, ContextType>;
  templates?: Resolver<Array<ResolversTypes["SourceShareItem"]>, ParentType, ContextType>;
};

export type SourceVersionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SourceVersion"] = ResolversParentTypes["SourceVersion"],
> = {
  availableVersion?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  error?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  updateAvailable?: Resolver<Maybe<ResolversTypes["Boolean"]>, ParentType, ContextType>;
};

export type SourceVersionsViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SourceVersionsView"] = ResolversParentTypes["SourceVersionsView"],
> = {
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  versions?: Resolver<Array<ResolversTypes["SourceVersion"]>, ParentType, ContextType>;
};

export type SourcesViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SourcesView"] = ResolversParentTypes["SourcesView"],
> = {
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  sources?: Resolver<Array<ResolversTypes["CatalogSource"]>, ParentType, ContextType>;
};

export type SubscriptionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Subscription"] = ResolversParentTypes["Subscription"],
> = {
  pluginInstallProgress?: SubscriptionResolver<
    Maybe<ResolversTypes["PluginInstallJob"]>,
    "pluginInstallProgress",
    ParentType,
    ContextType
  >;
  vaultChanges?: SubscriptionResolver<
    ResolversTypes["VaultInvalidation"],
    "vaultChanges",
    ParentType,
    ContextType,
    RequireFields<SubscriptionVaultChangesArgs, "epoch" | "since">
  >;
};

export type SubstitutionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Substitution"] = ResolversParentTypes["Substitution"],
> = {
  available?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  brokenReason?: Resolver<Maybe<ResolversTypes["BrokenReason"]>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  ingredients?: Resolver<
    ResolversTypes["IngredientConnection"],
    ParentType,
    ContextType,
    RequireFields<SubstitutionIngredientsArgs, "first">
  >;
  isDefault?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  targetPaintId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
};

export type SubstitutionConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SubstitutionConnection"] =
    ResolversParentTypes["SubstitutionConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["Substitution"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type SubstitutionIngredientResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SubstitutionIngredient"] =
    ResolversParentTypes["SubstitutionIngredient"],
> = {
  paint?: Resolver<ResolversTypes["Paint"], ParentType, ContextType>;
  parts?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  sortOrder?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type SubstitutionMutationPayloadResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SubstitutionMutationPayload"] =
    ResolversParentTypes["SubstitutionMutationPayload"],
> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  invalidatedFamilies?: Resolver<Array<ResolversTypes["VaultFamily"]>, ParentType, ContextType>;
  miniatureId?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  paintId?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  substitutionId?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
};

export type SubstitutionViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SubstitutionView"] = ResolversParentTypes["SubstitutionView"],
> = {
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  substitution?: Resolver<Maybe<ResolversTypes["Substitution"]>, ParentType, ContextType>;
};

export type TemplateConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["TemplateConnection"] = ResolversParentTypes["TemplateConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["TemplateSummary"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type TemplateMutationPayloadResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["TemplateMutationPayload"] =
    ResolversParentTypes["TemplateMutationPayload"],
> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  invalidatedFamilies?: Resolver<Array<ResolversTypes["VaultFamily"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  templateId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
};

export type TemplatePaintResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["TemplatePaint"] = ResolversParentTypes["TemplatePaint"],
> = {
  notes?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  paintBrand?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  paintId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  paintName?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  sortOrder?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  step?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type TemplatePaintConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["TemplatePaintConnection"] =
    ResolversParentTypes["TemplatePaintConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["TemplatePaint"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
};

export type TemplateRecipeViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["TemplateRecipeView"] = ResolversParentTypes["TemplateRecipeView"],
> = {
  paints?: Resolver<
    ResolversTypes["TemplatePaintConnection"],
    ParentType,
    ContextType,
    RequireFields<TemplateRecipeViewPaintsArgs, "first">
  >;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  schemes?: Resolver<
    ResolversTypes["TemplateSchemeConnection"],
    ParentType,
    ContextType,
    RequireFields<TemplateRecipeViewSchemesArgs, "first">
  >;
  templateId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
};

export type TemplateSchemeResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["TemplateScheme"] = ResolversParentTypes["TemplateScheme"],
> = {
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  schemeId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
};

export type TemplateSchemeConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["TemplateSchemeConnection"] =
    ResolversParentTypes["TemplateSchemeConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["TemplateScheme"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
};

export type TemplateSummaryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["TemplateSummary"] = ResolversParentTypes["TemplateSummary"],
> = {
  categories?: Resolver<Array<ResolversTypes["String"]>, ParentType, ContextType>;
  faction?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  folderId?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  imageUrl?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  kind?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  manufacturer?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  paintCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  schemeCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  sourceId?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  sourceLogoUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  sourceName?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  thumbnailUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TemplatesViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["TemplatesView"] = ResolversParentTypes["TemplatesView"],
> = {
  categoryCounts?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  sourceCounts?: Resolver<Array<ResolversTypes["FacetCount"]>, ParentType, ContextType>;
  templates?: Resolver<ResolversTypes["TemplateConnection"], ParentType, ContextType>;
};

export type VaultInvalidationResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["VaultInvalidation"] = ResolversParentTypes["VaultInvalidation"],
> = {
  epoch?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  families?: Resolver<Array<ResolversTypes["VaultFamily"]>, ParentType, ContextType>;
  reset?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  seq?: Resolver<ResolversTypes["Sequence"], ParentType, ContextType>;
};

export type VaultRevisionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["VaultRevision"] = ResolversParentTypes["VaultRevision"],
> = {
  epoch?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  seq?: Resolver<ResolversTypes["Sequence"], ParentType, ContextType>;
};

export type WishlistConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["WishlistConnection"] = ResolversParentTypes["WishlistConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["WishlistRow"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type WishlistCountsResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["WishlistCounts"] = ResolversParentTypes["WishlistCounts"],
> = {
  brokenSubstitution?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  listedMissingStock?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  missingPaints?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  missingStock?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  projectCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  restockPaints?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  shoppingPaints?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type WishlistExportResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["WishlistExport"] = ResolversParentTypes["WishlistExport"],
> = {
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  text?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type WishlistModelOptionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["WishlistModelOption"] =
    ResolversParentTypes["WishlistModelOption"],
> = {
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  projectCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  title?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type WishlistModelOptionsViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["WishlistModelOptionsView"] =
    ResolversParentTypes["WishlistModelOptionsView"],
> = {
  nodes?: Resolver<Array<ResolversTypes["WishlistModelOption"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type WishlistProjectResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["WishlistProject"] = ResolversParentTypes["WishlistProject"],
> = {
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  title?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type WishlistProjectConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["WishlistProjectConnection"] =
    ResolversParentTypes["WishlistProjectConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["WishlistProject"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type WishlistRowResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["WishlistRow"] = ResolversParentTypes["WishlistRow"],
> = {
  brandGroup?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  brokenSubstitution?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  missingStock?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  paint?: Resolver<ResolversTypes["Paint"], ParentType, ContextType>;
  projectCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  relatedProjectsPreview?: Resolver<Array<ResolversTypes["WishlistProject"]>, ParentType, ContextType>;
  relatedProjectsTruncated?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  restock?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
};

export type WishlistViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["WishlistView"] = ResolversParentTypes["WishlistView"],
> = {
  counts?: Resolver<ResolversTypes["WishlistCounts"], ParentType, ContextType>;
  missing?: Resolver<ResolversTypes["WishlistConnection"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  shopping?: Resolver<ResolversTypes["WishlistConnection"], ParentType, ContextType>;
};

export type Resolvers<ContextType = GraphQLContext> = {
  ActiveSubstitution?: ActiveSubstitutionResolvers<ContextType>;
  CatalogSource?: CatalogSourceResolvers<ContextType>;
  ColorIndexPaint?: ColorIndexPaintResolvers<ContextType>;
  ColorIndexView?: ColorIndexViewResolvers<ContextType>;
  ErrorParameter?: ErrorParameterResolvers<ContextType>;
  FacetCount?: FacetCountResolvers<ContextType>;
  Folder?: FolderResolvers<ContextType>;
  FolderBrowserPayload?: FolderBrowserPayloadResolvers<ContextType>;
  FolderMutationPayload?: FolderMutationPayloadResolvers<ContextType>;
  FolderSearchConnection?: FolderSearchConnectionResolvers<ContextType>;
  FolderSearchResult?: FolderSearchResultResolvers<ContextType>;
  FolderSearchView?: FolderSearchViewResolvers<ContextType>;
  HomeCounts?: HomeCountsResolvers<ContextType>;
  HomeView?: HomeViewResolvers<ContextType>;
  IngredientConnection?: IngredientConnectionResolvers<ContextType>;
  Inventory?: InventoryResolvers<ContextType>;
  LibraryFacets?: LibraryFacetsResolvers<ContextType>;
  Miniature?: MiniatureResolvers<ContextType>;
  MiniatureConnection?: MiniatureConnectionResolvers<ContextType>;
  MiniatureMissingConnection?: MiniatureMissingConnectionResolvers<ContextType>;
  MiniatureMissingPaint?: MiniatureMissingPaintResolvers<ContextType>;
  MiniatureMutationPayload?: MiniatureMutationPayloadResolvers<ContextType>;
  MiniatureRecipeConnection?: MiniatureRecipeConnectionResolvers<ContextType>;
  MiniatureRecipeEntry?: MiniatureRecipeEntryResolvers<ContextType>;
  MiniatureRequiredConnection?: MiniatureRequiredConnectionResolvers<ContextType>;
  MiniatureScheme?: MiniatureSchemeResolvers<ContextType>;
  MiniatureSchemeConnection?: MiniatureSchemeConnectionResolvers<ContextType>;
  MiniatureSchemeEntry?: MiniatureSchemeEntryResolvers<ContextType>;
  MiniatureSchemeEntryConnection?: MiniatureSchemeEntryConnectionResolvers<ContextType>;
  MiniatureSchemeLink?: MiniatureSchemeLinkResolvers<ContextType>;
  MiniatureSchemeOptionsView?: MiniatureSchemeOptionsViewResolvers<ContextType>;
  MiniatureSchemeView?: MiniatureSchemeViewResolvers<ContextType>;
  MiniatureSwatch?: MiniatureSwatchResolvers<ContextType>;
  MiniatureView?: MiniatureViewResolvers<ContextType>;
  MiniaturesView?: MiniaturesViewResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  NavigationView?: NavigationViewResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Paint?: PaintResolvers<ContextType>;
  PaintColorMatch?: PaintColorMatchResolvers<ContextType>;
  PaintCommandPayload?: PaintCommandPayloadResolvers<ContextType>;
  PaintConnection?: PaintConnectionResolvers<ContextType>;
  PaintImportPayload?: PaintImportPayloadResolvers<ContextType>;
  PaintMutationResult?: PaintMutationResultResolvers<ContextType>;
  PaintOptionsView?: PaintOptionsViewResolvers<ContextType>;
  PaintRankingView?: PaintRankingViewResolvers<ContextType>;
  PaintUsage?: PaintUsageResolvers<ContextType>;
  PaintUsageConnection?: PaintUsageConnectionResolvers<ContextType>;
  PaintView?: PaintViewResolvers<ContextType>;
  PluginInstallErrorParameter?: PluginInstallErrorParameterResolvers<ContextType>;
  PluginInstallJob?: PluginInstallJobResolvers<ContextType>;
  PublicError?: PublicErrorResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RankedPaint?: RankedPaintResolvers<ContextType>;
  Readiness?: ReadinessResolvers<ContextType>;
  SchemeColorIndexEntry?: SchemeColorIndexEntryResolvers<ContextType>;
  SchemeColorIndexView?: SchemeColorIndexViewResolvers<ContextType>;
  SchemeFacets?: SchemeFacetsResolvers<ContextType>;
  SchemeMutationPayload?: SchemeMutationPayloadResolvers<ContextType>;
  SchemesView?: SchemesViewResolvers<ContextType>;
  Sequence?: GraphQLScalarType;
  SourceDependency?: SourceDependencyResolvers<ContextType>;
  SourceItemCounts?: SourceItemCountsResolvers<ContextType>;
  SourceRemovalBlocker?: SourceRemovalBlockerResolvers<ContextType>;
  SourceRemovalIdentity?: SourceRemovalIdentityResolvers<ContextType>;
  SourceRemovalView?: SourceRemovalViewResolvers<ContextType>;
  SourceShareItem?: SourceShareItemResolvers<ContextType>;
  SourceShareableView?: SourceShareableViewResolvers<ContextType>;
  SourceVersion?: SourceVersionResolvers<ContextType>;
  SourceVersionsView?: SourceVersionsViewResolvers<ContextType>;
  SourcesView?: SourcesViewResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  Substitution?: SubstitutionResolvers<ContextType>;
  SubstitutionConnection?: SubstitutionConnectionResolvers<ContextType>;
  SubstitutionIngredient?: SubstitutionIngredientResolvers<ContextType>;
  SubstitutionMutationPayload?: SubstitutionMutationPayloadResolvers<ContextType>;
  SubstitutionView?: SubstitutionViewResolvers<ContextType>;
  TemplateConnection?: TemplateConnectionResolvers<ContextType>;
  TemplateMutationPayload?: TemplateMutationPayloadResolvers<ContextType>;
  TemplatePaint?: TemplatePaintResolvers<ContextType>;
  TemplatePaintConnection?: TemplatePaintConnectionResolvers<ContextType>;
  TemplateRecipeView?: TemplateRecipeViewResolvers<ContextType>;
  TemplateScheme?: TemplateSchemeResolvers<ContextType>;
  TemplateSchemeConnection?: TemplateSchemeConnectionResolvers<ContextType>;
  TemplateSummary?: TemplateSummaryResolvers<ContextType>;
  TemplatesView?: TemplatesViewResolvers<ContextType>;
  VaultInvalidation?: VaultInvalidationResolvers<ContextType>;
  VaultRevision?: VaultRevisionResolvers<ContextType>;
  WishlistConnection?: WishlistConnectionResolvers<ContextType>;
  WishlistCounts?: WishlistCountsResolvers<ContextType>;
  WishlistExport?: WishlistExportResolvers<ContextType>;
  WishlistModelOption?: WishlistModelOptionResolvers<ContextType>;
  WishlistModelOptionsView?: WishlistModelOptionsViewResolvers<ContextType>;
  WishlistProject?: WishlistProjectResolvers<ContextType>;
  WishlistProjectConnection?: WishlistProjectConnectionResolvers<ContextType>;
  WishlistRow?: WishlistRowResolvers<ContextType>;
  WishlistView?: WishlistViewResolvers<ContextType>;
};
