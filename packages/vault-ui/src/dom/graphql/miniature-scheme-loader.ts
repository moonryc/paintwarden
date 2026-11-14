import { i18n } from "@paintwarden/i18n/runtime";
import type { ApolloClient } from "@apollo/client";

import { getFragmentData } from "./generated/fragment-masking";
import {
  DetailPaintFragmentDoc,
  MiniatureSchemeDetailsDocument,
  MiniatureSchemeSummaryFragmentDoc,
  SchemePickerOptionsDocument,
  type MiniatureSchemeDetailsQuery,
  type SchemePickerOptionsQuery,
  type SchemePickerOptionsQueryVariables,
} from "./generated/graphql";
import type { Revision } from "./invalidation";
import { isStaleLibraryCursor } from "./library-loader";

const sameRevision = (a: Revision, b: Revision) => a.epoch === b.epoch && a.seq === b.seq;

function unpackScheme(raw: MiniatureSchemeDetailsQuery["miniatureScheme"]) {
  return {
    ...raw,
    scheme: getFragmentData(MiniatureSchemeSummaryFragmentDoc, raw.scheme),
    entries: {
      ...raw.entries,
      nodes: raw.entries.nodes.map((entry) => ({
        ...entry,
        paint: getFragmentData(DetailPaintFragmentDoc, entry.paint),
      })),
    },
  };
}
export type MiniatureSchemeRead = ReturnType<typeof unpackScheme>;
export type SchemeOptionsVariables = Omit<SchemePickerOptionsQueryVariables, "after">;

function unpackOptions(raw: SchemePickerOptionsQuery["schemeOptions"]) {
  return { ...raw, nodes: getFragmentData(MiniatureSchemeSummaryFragmentDoc, raw.nodes) };
}
export type SchemeOptionsRead = ReturnType<typeof unpackOptions>;

type Connection = { pageInfo: { hasNextPage: boolean; endCursor?: string | null } };
function nextCursor(connection: Connection, previous: string | null) {
  if (!connection.pageInfo.hasNextPage) return null;
  const next = connection.pageInfo.endCursor;
  if (!next || next === previous) throw new Error(i18n.t("shell:schemesReturnedAnInvalidPageCursor"));
  return next;
}

async function readStableWindow<T>(read: () => Promise<T | undefined>, description: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await read();
      if (result) return result;
    } catch (error) {
      if (!isStaleLibraryCursor(error)) throw error;
    }
  }
  throw new Error(i18n.t("shell:changedWhileRefreshingTryAgain", { value1: description }));
}

// The editor requires every entry, not just the first page. No page may normalize
// paints until the entire scheme has one revision accepted by its caller.
export function readMiniatureScheme(client: ApolloClient, id: string): Promise<MiniatureSchemeRead> {
  return readStableWindow(async () => {
    let combined: MiniatureSchemeRead | undefined;
    let after: string | null = null;
    do {
      const { data } = await client.query({
        query: MiniatureSchemeDetailsDocument,
        variables: { id, after },
        fetchPolicy: "no-cache",
      });
      if (!data) throw new Error(i18n.t("shell:schemeDetailsResponseWasEmpty"));
      const next = unpackScheme(data.miniatureScheme);
      if (combined && !sameRevision(combined.revision, next.revision)) return undefined;
      combined = combined
        ? { ...next, entries: { ...next.entries, nodes: [...combined.entries.nodes, ...next.entries.nodes] } }
        : next;
      after = nextCursor(next.entries, after);
    } while (after);
    return combined;
  }, "Scheme");
}

// Rebuild only the explicitly loaded picker window. Search/filter changes start
// at page one; refetches replace every loaded page at a single revision.
export function readSchemeOptions(
  client: ApolloClient,
  variables: SchemeOptionsVariables,
  pages = 1,
): Promise<SchemeOptionsRead> {
  return readStableWindow(async () => {
    let combined: SchemeOptionsRead | undefined;
    let after: string | null = null;
    for (let page = 0; page < Math.max(1, pages); page += 1) {
      const { data } = await client.query({
        query: SchemePickerOptionsDocument,
        variables: { ...variables, after },
        fetchPolicy: "no-cache",
      });
      if (!data) throw new Error(i18n.t("shell:schemeOptionsResponseWasEmpty"));
      const next = unpackOptions(data.schemeOptions);
      if (combined && !sameRevision(combined.revision, next.revision)) return undefined;
      combined = combined ? { ...next, nodes: [...combined.nodes, ...next.nodes] } : next;
      after = nextCursor(next, after);
      if (!after) break;
    }
    return combined;
  }, i18n.t("shell:schemeOptions"));
}
