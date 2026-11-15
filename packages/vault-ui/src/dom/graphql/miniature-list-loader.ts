import { i18n } from "@paintwarden/i18n/runtime";
import type { ApolloClient } from "@apollo/client";

import {
  MiniatureListDocument,
  type MiniatureListQuery,
  type MiniatureListQueryVariables,
} from "./generated/graphql";
import { isStaleLibraryCursor } from "./library-loader";

export const MINIATURE_PAGE_SIZE = 48;
export type MiniatureListVariables = Omit<MiniatureListQueryVariables, "first" | "after">;

export function miniatureListEnvelope(data: MiniatureListQuery) {
  const envelope = data.home ?? data.miniatures;
  if (!envelope) throw new Error(i18n.t("shell:miniatureListResponseWasEmpty"));
  return envelope;
}

export function sameMiniatureRevision(a: MiniatureListQuery, b: MiniatureListQuery) {
  const left = miniatureListEnvelope(a).revision;
  const right = miniatureListEnvelope(b).revision;
  return left.epoch === right.epoch && left.seq === right.seq;
}

export function appendMiniaturePage(
  previous: MiniatureListQuery,
  next: MiniatureListQuery,
): MiniatureListQuery {
  const nodes = [
    ...miniatureListEnvelope(previous).miniatures.nodes,
    ...miniatureListEnvelope(next).miniatures.nodes,
  ];
  if (next.home) return { ...next, home: { ...next.home, miniatures: { ...next.home.miniatures, nodes } } };
  if (next.miniatures)
    return {
      ...next,
      miniatures: { ...next.miniatures, miniatures: { ...next.miniatures.miniatures, nodes } },
    };
  throw new Error(i18n.t("shell:miniatureListResponseWasEmpty"));
}

// Read complete windows without touching normalized entities until the revision guard accepts.
export async function readMiniaturePage(
  client: ApolloClient,
  variables: MiniatureListVariables,
  after: string | null = null,
  signal?: AbortSignal,
) {
  const { data } = await client.query({
    query: MiniatureListDocument,
    variables: { ...variables, first: MINIATURE_PAGE_SIZE, after },
    fetchPolicy: "no-cache",
    context: { fetchOptions: { signal }, queryDeduplication: false },
  });
  if (!data) throw new Error(i18n.t("shell:miniatureListResponseWasEmpty"));
  miniatureListEnvelope(data);
  return data;
}

export async function readMiniatureWindow(
  client: ApolloClient,
  pages: number,
  variables: MiniatureListVariables,
  signal?: AbortSignal,
): Promise<MiniatureListQuery> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let combined: MiniatureListQuery | undefined;
    let after: string | null = null;
    for (let page = 0; page < Math.max(1, pages); page += 1) {
      let data: MiniatureListQuery;
      try {
        data = await readMiniaturePage(client, variables, after, signal);
      } catch (error) {
        if (!isStaleLibraryCursor(error)) throw error;
        combined = undefined;
        break;
      }
      if (combined && !sameMiniatureRevision(combined, data)) {
        combined = undefined;
        break;
      }
      combined = combined ? appendMiniaturePage(combined, data) : data;
      const connection = miniatureListEnvelope(data).miniatures;
      if (!connection.pageInfo.hasNextPage) break;
      after = connection.pageInfo.endCursor ?? null;
      if (!after) throw new Error(i18n.t("shell:miniaturesReturnedAnInvalidPageCursor"));
    }
    if (combined) return combined;
  }
  throw new Error(i18n.t("shell:miniaturesChangedRepeatedlyWhileRefreshingTryAgain"));
}
