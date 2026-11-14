import { i18n } from "@paint-vault/i18n/runtime";
import type { TypedDocumentNode } from "@apollo/client";

import {
  InstalledSourcesDocument,
  PluginRemovalDocument,
  PluginShareableDocument,
  PluginVersionsDocument,
} from "./generated/graphql";
import type { Revision } from "./invalidation";
import type { VaultGraphQLScope } from "./provider";

const FAMILIES = ["SOURCES"] as const;

// Source reads never normalize an in-flight response. A late plugin/license response
// must not resurrect a removed source or populate a different account's cache.
export async function acceptedSourceRead<
  T,
  V extends Record<string, unknown>,
  E extends { revision: Revision },
>(
  scope: VaultGraphQLScope,
  query: TypedDocumentNode<T, V>,
  variables: V,
  envelope: (data: T) => E,
): Promise<E> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const ticket = scope.controller.capture();
    const result = await scope.client.query({ query, variables, fetchPolicy: "no-cache" });
    if (!scope.controller.isCurrent(ticket))
      throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
    if (!result.data) throw new Error(i18n.t("shell:couldNotLoadPlugins"));
    const view = envelope(result.data);
    if (!scope.controller.accepts(ticket, view.revision, FAMILIES)) continue;
    scope.client.writeQuery({ query, variables, data: result.data });
    return view;
  }
  throw new Error(i18n.t("shell:pluginsChangedWhileLoadingPleaseTryAgain"));
}

export const readInstalledSources = (scope: VaultGraphQLScope) =>
  acceptedSourceRead(scope, InstalledSourcesDocument, {}, (data) => data.sources);
export const readPluginVersions = (scope: VaultGraphQLScope) =>
  acceptedSourceRead(scope, PluginVersionsDocument, {}, (data) => data.sourceVersions);
export const readPluginRemoval = (scope: VaultGraphQLScope, id: string) =>
  acceptedSourceRead(scope, PluginRemovalDocument, { id }, (data) => data.sourceRemoval);
export const readPluginShareable = (scope: VaultGraphQLScope) =>
  acceptedSourceRead(scope, PluginShareableDocument, {}, (data) => data.sourceShareable);
