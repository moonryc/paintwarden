// Storybook-only complete sample data. Never imported by production components.
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

import type { State } from "../types";

export function createStoryFixture(initialState: State) {
  let state = initialState;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setState: (next: State) => {
      if (Object.is(state, next)) return;
      state = next;
      for (const listener of listeners) listener();
    },
  };
}

export type StoryFixture = ReturnType<typeof createStoryFixture>;
const StoryFixtureContext = createContext<StoryFixture | null>(null);

export function StoryFixtureProvider({ fixture, children }: { fixture: StoryFixture; children: ReactNode }) {
  return <StoryFixtureContext.Provider value={fixture}>{children}</StoryFixtureContext.Provider>;
}

export function useStoryFixture() {
  const fixture = useContext(StoryFixtureContext);
  if (!fixture) throw new Error("Story fixture controls require StoryFixtureProvider");
  return fixture;
}

export function useStoryFixtureState() {
  const fixture = useStoryFixture();
  return useSyncExternalStore(fixture.subscribe, fixture.getSnapshot, fixture.getSnapshot);
}
