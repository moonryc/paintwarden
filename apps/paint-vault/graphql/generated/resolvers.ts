/* eslint-disable */
import type { GraphQLResolveInfo } from "graphql";
import type { GraphQLContext } from "../context";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
};

export type Inventory = {
  __typename?: "Inventory";
  quantity: Scalars["Int"]["output"];
  state: Scalars["String"]["output"];
  stockLevel: Scalars["String"]["output"];
};

export type PageInfo = {
  __typename?: "PageInfo";
  endCursor?: Maybe<Scalars["String"]["output"]>;
  hasNextPage: Scalars["Boolean"]["output"];
};

export type Paint = {
  __typename?: "Paint";
  brand: Scalars["String"]["output"];
  colorHex?: Maybe<Scalars["String"]["output"]>;
  discontinued: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  inventory?: Maybe<Inventory>;
  name: Scalars["String"]["output"];
  range: Scalars["String"]["output"];
  type?: Maybe<Scalars["String"]["output"]>;
};

export type PaintConnection = {
  __typename?: "PaintConnection";
  nodes: Array<Paint>;
  pageInfo: PageInfo;
  revision: VaultRevision;
};

/** Phase 1 raw Library projection, not a full vault or availability model. */
export type Query = {
  __typename?: "Query";
  library: PaintConnection;
};

/** Phase 1 raw Library projection, not a full vault or availability model. */
export type QueryLibraryArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: Scalars["Int"]["input"];
};

export type Subscription = {
  __typename?: "Subscription";
  /** Conservative all-family invalidation. Resume using the last received epoch/seq. */
  vaultChanges: VaultInvalidation;
};

export type SubscriptionVaultChangesArgs = {
  epoch: Scalars["String"]["input"];
  since: Scalars["Int"]["input"];
};

export type VaultInvalidation = {
  __typename?: "VaultInvalidation";
  epoch: Scalars["String"]["output"];
  /** Epoch/pruning/overflow/source reset: discard the previous revision baseline. */
  reset: Scalars["Boolean"]["output"];
  seq: Scalars["Int"]["output"];
};

export type VaultRevision = {
  __typename?: "VaultRevision";
  epoch: Scalars["String"]["output"];
  seq: Scalars["Int"]["output"];
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
  Boolean: ResolverTypeWrapper<Scalars["Boolean"]["output"]>;
  ID: ResolverTypeWrapper<Scalars["ID"]["output"]>;
  Int: ResolverTypeWrapper<Scalars["Int"]["output"]>;
  Inventory: ResolverTypeWrapper<Inventory>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Paint: ResolverTypeWrapper<Paint>;
  PaintConnection: ResolverTypeWrapper<PaintConnection>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  String: ResolverTypeWrapper<Scalars["String"]["output"]>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  VaultInvalidation: ResolverTypeWrapper<VaultInvalidation>;
  VaultRevision: ResolverTypeWrapper<VaultRevision>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars["Boolean"]["output"];
  ID: Scalars["ID"]["output"];
  Int: Scalars["Int"]["output"];
  Inventory: Inventory;
  PageInfo: PageInfo;
  Paint: Paint;
  PaintConnection: PaintConnection;
  Query: Record<PropertyKey, never>;
  String: Scalars["String"]["output"];
  Subscription: Record<PropertyKey, never>;
  VaultInvalidation: VaultInvalidation;
  VaultRevision: VaultRevision;
};

export type InventoryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Inventory"] = ResolversParentTypes["Inventory"],
> = {
  quantity?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  state?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  stockLevel?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
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
  brand?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  colorHex?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  discontinued?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  inventory?: Resolver<Maybe<ResolversTypes["Inventory"]>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  range?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
};

export type PaintConnectionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["PaintConnection"] = ResolversParentTypes["PaintConnection"],
> = {
  nodes?: Resolver<Array<ResolversTypes["Paint"]>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes["PageInfo"], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes["VaultRevision"], ParentType, ContextType>;
};

export type QueryResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["Query"] = ResolversParentTypes["Query"],
> = {
  library?: Resolver<
    ResolversTypes["PaintConnection"],
    ParentType,
    ContextType,
    RequireFields<QueryLibraryArgs, "first">
  >;
};

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

export type VaultInvalidationResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["VaultInvalidation"] = ResolversParentTypes["VaultInvalidation"],
> = {
  epoch?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  reset?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  seq?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type VaultRevisionResolvers<
  ContextType = GraphQLContext,
  ParentType extends ResolversParentTypes["VaultRevision"] = ResolversParentTypes["VaultRevision"],
> = {
  epoch?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  seq?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
};

export type Resolvers<ContextType = GraphQLContext> = {
  Inventory?: InventoryResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Paint?: PaintResolvers<ContextType>;
  PaintConnection?: PaintConnectionResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  VaultInvalidation?: VaultInvalidationResolvers<ContextType>;
  VaultRevision?: VaultRevisionResolvers<ContextType>;
};
