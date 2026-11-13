/* eslint-disable */
import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from "graphql";
import type { PaintViewRead, SubstitutionRead } from "../library";
import type { MiniatureViewRead } from "../miniatures";
import type { MiniatureSchemeRead } from "../miniature-schemes";
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

export type FacetCount = {
  __typename?: "FacetCount";
  count: Scalars["Int"]["output"];
  key: Scalars["String"]["output"];
  label: Scalars["String"]["output"];
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
  id: Scalars["ID"]["output"];
  imageUrl?: Maybe<Scalars["String"]["output"]>;
  manufacturer: Scalars["String"]["output"];
  notes: Scalars["String"]["output"];
  paintingStatus: PaintingStatus;
  previewSwatches: Array<MiniatureSwatch>;
  previewSwatchesTruncated: Scalars["Boolean"]["output"];
  readiness: Readiness;
  scale: Scalars["String"]["output"];
  status: Ownership;
  title: Scalars["String"]["output"];
  updatedAt: Scalars["Float"]["output"];
};

export type MiniatureConnection = {
  __typename?: "MiniatureConnection";
  nodes: Array<Miniature>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type MiniatureInput = {
  faction?: InputMaybe<Scalars["String"]["input"]>;
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
  id: Scalars["ID"]["output"];
  imageUrl?: Maybe<Scalars["String"]["output"]>;
  isSystem: Scalars["Boolean"]["output"];
  name: Scalars["String"]["output"];
  paintCount: Scalars["Int"]["output"];
  previewSwatches: Array<MiniatureSwatch>;
  previewSwatchesTruncated: Scalars["Boolean"]["output"];
  sourceLogoUrl?: Maybe<Scalars["String"]["output"]>;
  sourceName?: Maybe<Scalars["String"]["output"]>;
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
  createMiniature: MiniatureMutationPayload;
  deleteMiniature: MiniatureMutationPayload;
  setMiniatureRecipe: MiniatureMutationPayload;
  setMiniatureSchemes: MiniatureMutationPayload;
  setPaintStock: PaintMutationResult;
  updateMiniature: MiniatureMutationPayload;
};

export type MutationCreateMiniatureArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  input: MiniatureInput;
};

export type MutationDeleteMiniatureArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
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

export type MutationUpdateMiniatureArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
  input: MiniatureInput;
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
  sourceId?: Maybe<Scalars["ID"]["output"]>;
  sourceLabel?: Maybe<Scalars["String"]["output"]>;
  sourceLogoUrl?: Maybe<Scalars["String"]["output"]>;
  sourceName?: Maybe<Scalars["String"]["output"]>;
  sourceUrl?: Maybe<Scalars["String"]["output"]>;
  type?: Maybe<Scalars["String"]["output"]>;
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
  similar: Array<Paint>;
  substitutions: SubstitutionConnection;
  usedBy: PaintUsageConnection;
};

export type PaintViewSimilarArgs = {
  first?: Scalars["Int"]["input"];
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

export type Query = {
  __typename?: "Query";
  home: HomeView;
  library: PaintConnection;
  miniature: MiniatureView;
  miniatureScheme: MiniatureSchemeView;
  miniatures: MiniaturesView;
  paint: PaintView;
  paintOptions: PaintOptionsView;
  schemeOptions: MiniatureSchemeOptionsView;
  substitution: SubstitutionView;
  vaultInvalidation: VaultInvalidation;
  vaultNavigation: NavigationView;
  vaultRevision: VaultRevision;
};

export type QueryHomeArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
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
  ownership?: InputMaybe<Ownership>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  stage?: InputMaybe<PaintingStatus>;
};

export type QueryPaintArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryPaintOptionsArgs = {
  excludeIds?: Array<Scalars["ID"]["input"]>;
  first?: Scalars["Int"]["input"];
  search?: Scalars["String"]["input"];
};

export type QuerySchemeOptionsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  category?: InputMaybe<Scalars["String"]["input"]>;
  excludeIds?: Array<Scalars["ID"]["input"]>;
  first?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
};

export type QuerySubstitutionArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryVaultInvalidationArgs = {
  epoch: Scalars["String"]["input"];
  since: Scalars["Sequence"]["input"];
};

export type Readiness = {
  __typename?: "Readiness";
  brokenSubstitution: Scalars["Int"]["output"];
  missing: Scalars["Int"]["output"];
  missingStock: Scalars["Int"]["output"];
  ready: Scalars["Boolean"]["output"];
  total: Scalars["Int"]["output"];
};

export type StockLevel = "EMPTY" | "FULL" | "LOW";

export type Subscription = {
  __typename?: "Subscription";
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

export type SubstitutionView = {
  __typename?: "SubstitutionView";
  revision: VaultRevision;
  substitution?: Maybe<Substitution>;
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

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  ActiveSubstitution: ResolverTypeWrapper<ActiveSubstitution>;
  Boolean: ResolverTypeWrapper<Scalars["Boolean"]["output"]>;
  BrokenReason: BrokenReason;
  FacetCount: ResolverTypeWrapper<FacetCount>;
  Float: ResolverTypeWrapper<Scalars["Float"]["output"]>;
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
  PaintConnection: ResolverTypeWrapper<PaintConnection>;
  PaintMutationResult: ResolverTypeWrapper<PaintMutationResult>;
  PaintOptionsView: ResolverTypeWrapper<PaintOptionsView>;
  PaintUsage: ResolverTypeWrapper<PaintUsage>;
  PaintUsageConnection: ResolverTypeWrapper<PaintUsageConnection>;
  PaintView: ResolverTypeWrapper<PaintViewRead>;
  PaintingStatus: PaintingStatus;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Readiness: ResolverTypeWrapper<Readiness>;
  Sequence: ResolverTypeWrapper<Scalars["Sequence"]["output"]>;
  StockLevel: StockLevel;
  String: ResolverTypeWrapper<Scalars["String"]["output"]>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Substitution: ResolverTypeWrapper<SubstitutionRead>;
  SubstitutionConnection: ResolverTypeWrapper<
    Omit<SubstitutionConnection, "nodes"> & { nodes: Array<ResolversTypes["Substitution"]> }
  >;
  SubstitutionIngredient: ResolverTypeWrapper<SubstitutionIngredient>;
  SubstitutionView: ResolverTypeWrapper<
    Omit<SubstitutionView, "substitution"> & { substitution?: Maybe<ResolversTypes["Substitution"]> }
  >;
  VaultFamily: VaultFamily;
  VaultInvalidation: ResolverTypeWrapper<VaultInvalidation>;
  VaultRevision: ResolverTypeWrapper<VaultRevision>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  ActiveSubstitution: ActiveSubstitution;
  Boolean: Scalars["Boolean"]["output"];
  FacetCount: FacetCount;
  Float: Scalars["Float"]["output"];
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
  PaintConnection: PaintConnection;
  PaintMutationResult: PaintMutationResult;
  PaintOptionsView: PaintOptionsView;
  PaintUsage: PaintUsage;
  PaintUsageConnection: PaintUsageConnection;
  PaintView: PaintViewRead;
  Query: Record<PropertyKey, never>;
  Readiness: Readiness;
  Sequence: Scalars["Sequence"]["output"];
  String: Scalars["String"]["output"];
  Subscription: Record<PropertyKey, never>;
  Substitution: SubstitutionRead;
  SubstitutionConnection: Omit<SubstitutionConnection, "nodes"> & {
    nodes: Array<ResolversParentTypes["Substitution"]>;
  };
  SubstitutionIngredient: SubstitutionIngredient;
  SubstitutionView: Omit<SubstitutionView, "substitution"> & {
    substitution?: Maybe<ResolversParentTypes["Substitution"]>;
  };
  VaultInvalidation: VaultInvalidation;
  VaultRevision: VaultRevision;
};

export type ActiveSubstitutionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["ActiveSubstitution"] = ResolversParentTypes["ActiveSubstitution"],
> = {
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type FacetCountResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["FacetCount"] = ResolversParentTypes["FacetCount"],
> = {
  count?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  key?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  label?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
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
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  imageUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  manufacturer?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  notes?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  paintingStatus?: Resolver<ResolversTypes["PaintingStatus"], ParentType, ContextType>;
  previewSwatches?: Resolver<Array<ResolversTypes["MiniatureSwatch"]>, ParentType, ContextType>;
  previewSwatchesTruncated?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  readiness?: Resolver<ResolversTypes["Readiness"], ParentType, ContextType>;
  scale?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  status?: Resolver<ResolversTypes["Ownership"], ParentType, ContextType>;
  title?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes["Float"], ParentType, ContextType>;
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
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  imageUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  isSystem?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  paintCount?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  previewSwatches?: Resolver<Array<ResolversTypes["MiniatureSwatch"]>, ParentType, ContextType>;
  previewSwatchesTruncated?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  sourceLogoUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  sourceName?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
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
  createMiniature?: Resolver<
    ResolversTypes["MiniatureMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationCreateMiniatureArgs, "input">
  >;
  deleteMiniature?: Resolver<
    ResolversTypes["MiniatureMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteMiniatureArgs, "id">
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
  updateMiniature?: Resolver<
    ResolversTypes["MiniatureMutationPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateMiniatureArgs, "id" | "input">
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
  sourceId?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  sourceLabel?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  sourceLogoUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  sourceName?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  sourceUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
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
  similar?: Resolver<
    Array<ResolversTypes["Paint"]>,
    ParentType,
    ContextType,
    RequireFields<PaintViewSimilarArgs, "first">
  >;
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

export type QueryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Query"] = ResolversParentTypes["Query"],
> = {
  home?: Resolver<ResolversTypes["HomeView"], ParentType, ContextType, RequireFields<QueryHomeArgs, "first">>;
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
    RequireFields<QueryMiniaturesArgs, "first">
  >;
  paint?: Resolver<ResolversTypes["PaintView"], ParentType, ContextType, RequireFields<QueryPaintArgs, "id">>;
  paintOptions?: Resolver<
    ResolversTypes["PaintOptionsView"],
    ParentType,
    ContextType,
    RequireFields<QueryPaintOptionsArgs, "excludeIds" | "first" | "search">
  >;
  schemeOptions?: Resolver<
    ResolversTypes["MiniatureSchemeOptionsView"],
    ParentType,
    ContextType,
    RequireFields<QuerySchemeOptionsArgs, "excludeIds" | "first">
  >;
  substitution?: Resolver<
    ResolversTypes["SubstitutionView"],
    ParentType,
    ContextType,
    RequireFields<QuerySubstitutionArgs, "id">
  >;
  vaultInvalidation?: Resolver<
    ResolversTypes["VaultInvalidation"],
    ParentType,
    ContextType,
    RequireFields<QueryVaultInvalidationArgs, "epoch" | "since">
  >;
  vaultNavigation?: Resolver<ResolversTypes["NavigationView"], ParentType, ContextType>;
  vaultRevision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
};

export type ReadinessResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Readiness"] = ResolversParentTypes["Readiness"],
> = {
  brokenSubstitution?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  missing?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  missingStock?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  ready?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  total?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export interface SequenceScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes["Sequence"], any> {
  name: "Sequence";
}

export type SubscriptionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Subscription"] = ResolversParentTypes["Subscription"],
> = {
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

export type SubstitutionViewResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["SubstitutionView"] = ResolversParentTypes["SubstitutionView"],
> = {
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
  substitution?: Resolver<Maybe<ResolversTypes["Substitution"]>, ParentType, ContextType>;
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

export type Resolvers<ContextType = GraphQLContext> = {
  ActiveSubstitution?: ActiveSubstitutionResolvers<ContextType>;
  FacetCount?: FacetCountResolvers<ContextType>;
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
  PaintConnection?: PaintConnectionResolvers<ContextType>;
  PaintMutationResult?: PaintMutationResultResolvers<ContextType>;
  PaintOptionsView?: PaintOptionsViewResolvers<ContextType>;
  PaintUsage?: PaintUsageResolvers<ContextType>;
  PaintUsageConnection?: PaintUsageConnectionResolvers<ContextType>;
  PaintView?: PaintViewResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Readiness?: ReadinessResolvers<ContextType>;
  Sequence?: GraphQLScalarType;
  Subscription?: SubscriptionResolvers<ContextType>;
  Substitution?: SubstitutionResolvers<ContextType>;
  SubstitutionConnection?: SubstitutionConnectionResolvers<ContextType>;
  SubstitutionIngredient?: SubstitutionIngredientResolvers<ContextType>;
  SubstitutionView?: SubstitutionViewResolvers<ContextType>;
  VaultInvalidation?: VaultInvalidationResolvers<ContextType>;
  VaultRevision?: VaultRevisionResolvers<ContextType>;
};
