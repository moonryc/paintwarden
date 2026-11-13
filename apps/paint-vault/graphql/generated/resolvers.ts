/* eslint-disable */
import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from "graphql";
import type { PaintViewRead, SubstitutionRead } from "../library";
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

export type Mutation = {
  __typename?: "Mutation";
  setPaintStock: PaintMutationResult;
};

export type MutationSetPaintStockArgs = {
  clientMutationId?: InputMaybe<Scalars["String"]["input"]>;
  paintId: Scalars["ID"]["input"];
  quantity?: InputMaybe<Scalars["Int"]["input"]>;
  state?: InputMaybe<Ownership>;
  stockLevel?: InputMaybe<StockLevel>;
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

export type Query = {
  __typename?: "Query";
  library: PaintConnection;
  paint: PaintView;
  paintOptions: PaintOptionsView;
  substitution: SubstitutionView;
  vaultInvalidation: VaultInvalidation;
  vaultRevision: VaultRevision;
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

export type QueryPaintArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryPaintOptionsArgs = {
  excludeIds?: Array<Scalars["ID"]["input"]>;
  first?: Scalars["Int"]["input"];
  search?: Scalars["String"]["input"];
};

export type QuerySubstitutionArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryVaultInvalidationArgs = {
  epoch: Scalars["String"]["input"];
  since: Scalars["Sequence"]["input"];
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
  ID: ResolverTypeWrapper<Scalars["ID"]["output"]>;
  IngredientConnection: ResolverTypeWrapper<IngredientConnection>;
  Int: ResolverTypeWrapper<Scalars["Int"]["output"]>;
  Inventory: ResolverTypeWrapper<Inventory>;
  LibraryFacets: ResolverTypeWrapper<LibraryFacets>;
  LibraryFilter: LibraryFilter;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Ownership: Ownership;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Paint: ResolverTypeWrapper<Paint>;
  PaintConnection: ResolverTypeWrapper<PaintConnection>;
  PaintMutationResult: ResolverTypeWrapper<PaintMutationResult>;
  PaintOptionsView: ResolverTypeWrapper<PaintOptionsView>;
  PaintUsage: ResolverTypeWrapper<PaintUsage>;
  PaintUsageConnection: ResolverTypeWrapper<PaintUsageConnection>;
  PaintView: ResolverTypeWrapper<PaintViewRead>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
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
  ID: Scalars["ID"]["output"];
  IngredientConnection: IngredientConnection;
  Int: Scalars["Int"]["output"];
  Inventory: Inventory;
  LibraryFacets: LibraryFacets;
  Mutation: Record<PropertyKey, never>;
  PageInfo: PageInfo;
  Paint: Paint;
  PaintConnection: PaintConnection;
  PaintMutationResult: PaintMutationResult;
  PaintOptionsView: PaintOptionsView;
  PaintUsage: PaintUsage;
  PaintUsageConnection: PaintUsageConnection;
  PaintView: PaintViewRead;
  Query: Record<PropertyKey, never>;
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

export type MutationResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Mutation"] = ResolversParentTypes["Mutation"],
> = {
  setPaintStock?: Resolver<
    ResolversTypes["PaintMutationResult"],
    ParentType,
    ContextType,
    RequireFields<MutationSetPaintStockArgs, "paintId">
  >;
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
  library?: Resolver<
    ResolversTypes["PaintConnection"],
    ParentType,
    ContextType,
    RequireFields<QueryLibraryArgs, "filter" | "first" | "noSource">
  >;
  paint?: Resolver<ResolversTypes["PaintView"], ParentType, ContextType, RequireFields<QueryPaintArgs, "id">>;
  paintOptions?: Resolver<
    ResolversTypes["PaintOptionsView"],
    ParentType,
    ContextType,
    RequireFields<QueryPaintOptionsArgs, "excludeIds" | "first" | "search">
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
  vaultRevision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
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
  IngredientConnection?: IngredientConnectionResolvers<ContextType>;
  Inventory?: InventoryResolvers<ContextType>;
  LibraryFacets?: LibraryFacetsResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Paint?: PaintResolvers<ContextType>;
  PaintConnection?: PaintConnectionResolvers<ContextType>;
  PaintMutationResult?: PaintMutationResultResolvers<ContextType>;
  PaintOptionsView?: PaintOptionsViewResolvers<ContextType>;
  PaintUsage?: PaintUsageResolvers<ContextType>;
  PaintUsageConnection?: PaintUsageConnectionResolvers<ContextType>;
  PaintView?: PaintViewResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Sequence?: GraphQLScalarType;
  Subscription?: SubscriptionResolvers<ContextType>;
  Substitution?: SubstitutionResolvers<ContextType>;
  SubstitutionConnection?: SubstitutionConnectionResolvers<ContextType>;
  SubstitutionIngredient?: SubstitutionIngredientResolvers<ContextType>;
  SubstitutionView?: SubstitutionViewResolvers<ContextType>;
  VaultInvalidation?: VaultInvalidationResolvers<ContextType>;
  VaultRevision?: VaultRevisionResolvers<ContextType>;
};
