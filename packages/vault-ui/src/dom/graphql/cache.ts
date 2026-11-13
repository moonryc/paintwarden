import { InMemoryCache, type FieldPolicy, type Reference } from "@apollo/client";

type PaintConnection = {
  __typename?: string;
  nodes: readonly Reference[];
  pageInfo: { __typename?: string; endCursor: string | null; hasNextPage: boolean };
  revision: { __typename?: string; epoch: string; seq: number };
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

export function createVaultCache(): InMemoryCache {
  return new InMemoryCache({
    typePolicies: {
      Query: { fields: { library: libraryPolicy } },
      Paint: { keyFields: ["id"], fields: { inventory: { merge: false } } },
      Inventory: { keyFields: false },
      PaintConnection: { keyFields: false },
      PageInfo: { keyFields: false },
      VaultRevision: { keyFields: false },
      Revision: { keyFields: false },
    },
  });
}
