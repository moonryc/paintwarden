import { InMemoryCache, type FieldPolicy, type Reference } from "@apollo/client";

type PaintConnection = {
  __typename?: string;
  nodes: readonly Reference[];
  pageInfo: { __typename?: string; endCursor: string | null; hasNextPage: boolean };
  revision: { __typename?: string; epoch: string; seq: string };
};

const libraryPolicy: FieldPolicy<PaintConnection | undefined, PaintConnection> = {
  // Pagination controls share one list; any future filters still separate lists.
  keyArgs(args) {
    return Object.keys(args ?? {})
      .filter((key) => key !== "first" && key !== "after")
      .sort();
  },
  merge(existing, incoming, { args, readField }) {
    if (args?.after == null) return incoming;

    // Only extend the current snapshot's tail. Retried/late pages must not move
    // pageInfo backwards or resurrect pages removed by a first-page refresh.
    if (
      !existing ||
      args.after !== existing.pageInfo.endCursor ||
      incoming.revision.epoch !== existing.revision.epoch ||
      incoming.revision.seq !== existing.revision.seq
    ) {
      return existing ?? undefined;
    }

    const nodes = [...existing.nodes];
    const ids = new Set(nodes.map((node) => readField<string>("id", node)));
    for (const node of incoming.nodes) {
      const id = readField<string>("id", node);
      if (!ids.has(id)) {
        ids.add(id);
        nodes.push(node);
      }
    }
    return { ...incoming, nodes };
  },
};

const paginationKeys: NonNullable<FieldPolicy["keyArgs"]> = (args) =>
  Object.keys(args ?? {})
    .filter((key) => key !== "first" && key !== "after")
    .sort();

export function createVaultCache(): InMemoryCache {
  return new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          library: libraryPolicy,
          // Miniature hooks fetch with no-cache and publish one accepted complete
          // window. Pagination arguments must share a slot; only that atomic
          // publication may replace it (never normalize in-flight page results).
          home: { keyArgs: paginationKeys, merge: false },
          miniatures: { keyArgs: paginationKeys, merge: false },
          vaultNavigation: { merge: false },
          miniature: { merge: false },
          schemeOptions: { keyArgs: paginationKeys, merge: false },
          miniatureScheme: { merge: false },
        },
      },
      Miniature: { keyFields: ["id"], fields: { readiness: { merge: false } } },
      MiniatureConnection: { keyFields: false },
      HomeView: { keyFields: false },
      MiniaturesView: { keyFields: false },
      MiniatureView: { keyFields: false },
      Paint: { keyFields: ["id"], fields: { inventory: { merge: false } } },
      Inventory: { keyFields: false },
      PaintConnection: { keyFields: false },
      PageInfo: { keyFields: false },
      VaultRevision: { keyFields: false },
      Revision: { keyFields: false },
    },
  });
}
