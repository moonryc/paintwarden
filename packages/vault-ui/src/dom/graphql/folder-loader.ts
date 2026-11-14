import type { ApolloClient } from "@apollo/client";
import { i18n } from "@paintwarden/i18n/runtime";

import { BrowseFoldersDocument, type BrowseFoldersQuery, type FolderKind } from "./generated/graphql";
import { isStaleLibraryCursor } from "./library-loader";

// A picker must see the complete hierarchy, not silently truncate after the first page.
// Never combine pages from different database revisions or publish a partial tree.
export async function readFolderTree(client: ApolloClient, kind: FolderKind): Promise<BrowseFoldersQuery> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let combined: BrowseFoldersQuery | undefined;
    let after: string | null = null;
    const seen = new Set<string>();
    do {
      let data: BrowseFoldersQuery | undefined;
      try {
        const result = await client.query({
          query: BrowseFoldersDocument,
          variables: { kind, first: 100, after },
          fetchPolicy: "no-cache",
        });
        data = result.data;
      } catch (error) {
        if (!isStaleLibraryCursor(error)) throw error;
        combined = undefined;
        break;
      }
      if (!data) throw new Error(i18n.t("pages:folders.error"));
      const next: BrowseFoldersQuery["folderBrowser"] = data.folderBrowser;
      if (
        combined &&
        (combined.folderBrowser.revision.epoch !== next.revision.epoch ||
          combined.folderBrowser.revision.seq !== next.revision.seq)
      ) {
        combined = undefined;
        break;
      }
      combined = combined
        ? { folderBrowser: { ...next, folders: [...combined.folderBrowser.folders, ...next.folders] } }
        : data;
      after = next.pageInfo.hasNextPage ? next.pageInfo.endCursor : null;
      if (next.pageInfo.hasNextPage && (!after || seen.has(after)))
        throw new Error(i18n.t("pages:folders.error"));
      if (after) seen.add(after);
    } while (after);
    if (combined) return combined;
  }
  throw new Error(i18n.t("pages:folders.error"));
}
