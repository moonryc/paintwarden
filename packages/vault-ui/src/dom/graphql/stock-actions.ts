import { i18n } from "@paintwarden/i18n/runtime";
import { createContext, useContext, useMemo } from "react";

import { useVaultStore } from "../store/hooks";
import type { Notify, Paint, PaintStateSetter, State } from "../types";
import { buzz } from "../utils/misc";
import { owns } from "../utils/vault-data";

import { getFragmentData } from "./generated/fragment-masking";
import { PaintStockFragmentDoc, SetPaintStockDocument } from "./generated/graphql";
import { useVaultGraphQL, type VaultGraphQLScope } from "./provider";

type Record = State["paintRecords"][string];
type Actions = { setPaintState: PaintStateSetter; toggleOwned(paint: Paint, record?: Record): void };
export const PaintStockFixtureContext = createContext<Actions | null>(null);
const actionsByScope = new WeakMap<VaultGraphQLScope, Actions>();

// Each resource has a write queue. Optimistic layers are per edit, so an older failure
// cannot roll back a newer edit; a new quantity is based on the visible optimistic value.
export function createPaintStockActions(scope: VaultGraphQLScope, notify: Notify): Actions {
  const queues = new Map<string, Promise<void>>();
  let version = 0;
  const current = (id: string): Record | undefined => {
    const row = scope.client.cache.readFragment({
      fragment: PaintStockFragmentDoc,
      id: scope.client.cache.identify({ __typename: "Paint", id }),
      optimistic: true,
    });
    const inventory = row?.inventory;
    return inventory ? (inventory as Record) : undefined;
  };
  const setPaintState: PaintStateSetter = (paintId, state, stockLevel = "FULL", quantity) => {
    const previous = current(paintId);
    const qty =
      state === "OWNED"
        ? Math.max(
            0,
            Math.min(999, Math.floor(quantity ?? (previous?.state === "OWNED" ? previous.quantity : 1))),
          )
        : 0;
    const nextState = state === "OWNED" && qty === 0 ? null : state;
    const stock = nextState === "OWNED" && stockLevel === "EMPTY" ? "FULL" : stockLevel;
    const inventory = nextState
      ? { __typename: "Inventory" as const, state: nextState, stockLevel: stock, quantity: qty }
      : null;
    const id = scope.client.cache.identify({ __typename: "Paint", id: paintId });
    const layer = `stock:${++version}:${paintId}`;
    const ticket = scope.controller.captureCommand();
    const readTicket = scope.controller.capture();
    buzz();
    const optimisticPaint = { __typename: "Paint" as const, id: paintId, inventory };
    scope.client.cache.recordOptimisticTransaction(
      (cache) =>
        cache.writeFragment({
          id,
          fragment: PaintStockFragmentDoc,
          data: optimisticPaint,
        }),
      layer,
    );
    const task = async () => {
      try {
        if (!scope.controller.isCommandCurrent(ticket)) return;
        const result = await scope.client.mutate({
          mutation: SetPaintStockDocument,
          variables: { paintId, state: nextState, stockLevel: stock, quantity: qty, clientMutationId: layer },
          fetchPolicy: "no-cache",
        });
        const payload = result.data?.setPaintStock;
        if (!payload) throw new Error(i18n.t("shell:stockSaveReturnedNoResult"));
        if (!scope.controller.isCommandCurrent(ticket)) return;
        if (!scope.controller.commitCommand(ticket, payload.revision, payload.invalidatedFamilies)) return;
        // Write only while this envelope is fresh. Global counts/availability are never
        // guessed from a partial catalog; committed() refetches the loaded window.
        if (payload.paint && scope.controller.accepts(readTicket, payload.revision, ["PAINT", "LIBRARY"])) {
          scope.client.cache.writeFragment({
            id,
            fragment: PaintStockFragmentDoc,
            data: getFragmentData(PaintStockFragmentDoc, payload.paint),
          });
        }
      } catch (error) {
        if (scope.controller.isCommandCurrent(ticket)) {
          notify(error instanceof Error ? error.message : i18n.t("shell:couldNotSaveStock"), "error");
          const cursor = scope.controller.getCursor();
          if (cursor) scope.controller.committed(cursor, ["LIBRARY", "PAINT", "OPTIONS"]);
        }
      } finally {
        scope.client.cache.removeOptimistic(layer);
      }
    };
    const queued = (queues.get(paintId) ?? Promise.resolve()).then(task, task);
    queues.set(paintId, queued);
    void queued.finally(() => {
      if (queues.get(paintId) === queued) queues.delete(paintId);
    });
  };
  return {
    setPaintState,
    toggleOwned(paint, record) {
      const previous = current(paint.id) ?? record;
      const owned = owns(previous);
      setPaintState(
        paint.id,
        owned ? null : "OWNED",
        "FULL",
        owned ? undefined : Math.max(1, previous?.quantity ?? 0),
      );
      notify(
        owned
          ? i18n.t("shell:unmarked", { value1: paint.name })
          : i18n.t("shell:markedAsOwned", { value1: paint.name }),
        "ok",
        {
          label: i18n.t("shell:undo"),
          onClick: () =>
            previous
              ? setPaintState(paint.id, previous.state, previous.stockLevel, previous.quantity)
              : setPaintState(paint.id, null),
        },
      );
    },
  };
}

export function usePaintStock(): Actions {
  const scope = useVaultGraphQL();
  const notify = useVaultStore((store) => store.notify);
  const fixture = useContext(PaintStockFixtureContext);
  return useMemo(() => {
    if (!scope) {
      if (fixture) return fixture;
      throw new Error(i18n.t("shell:paintStockActionsRequireAGraphqlScope"));
    }
    let actions = actionsByScope.get(scope);
    if (!actions) {
      actions = createPaintStockActions(scope, notify);
      actionsByScope.set(scope, actions);
    }
    return actions;
  }, [scope, notify, fixture]);
}
