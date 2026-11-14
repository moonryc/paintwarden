import { createElement, lazy, type ComponentType } from "react";

// Idle, intent and render all share one import (including a rejected import).
// Rendering a fulfilled preload directly also avoids React.lazy's first-render
// suspension on an already-resolved promise.
export function createPreloadable<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
) {
  let promise: Promise<{ default: ComponentType<Props> }> | undefined;
  let loaded: ComponentType<Props> | undefined;
  const preload = () => {
    promise ??= load().then((module) => {
      loaded = module.default;
      return module;
    });
    return promise;
  };
  const Lazy = lazy(preload);
  function Component(props: Props) {
    return loaded ? createElement(loaded, props) : createElement(Lazy, props);
  }
  return { Component, preload };
}

export function preloadOnIntent(preload: () => Promise<unknown>) {
  const intent = () => {
    void preload().catch(() => undefined);
  };
  return { onPointerEnter: intent, onFocus: intent, onPointerDown: intent };
}
