// A stand-in for the Paint Vault server, so the whole app can render in Storybook with the
// sample vault. Reads return fixture data; writes succeed without changing anything.
import type { Decorator } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import type { AuthStatus, MiniatureTemplateCatalog } from "../types";

import { paints, vault } from "./fixtures";

const auth: AuthStatus = {
  setupRequired: false,
  setupCodeRequired: false,
  username: "painter",
  requireSignIn: false,
  authenticated: true,
};

const templates: MiniatureTemplateCatalog = {
  sourceVersion: 1,
  categories: ["Infantry"],
  templates: [
    {
      id: "example:template-knight",
      name: "Example Knight",
      imageUrl: "",
      categories: ["Infantry"],
      faction: "Order of the Lantern",
      schemeCount: 0,
      paintCount: 0,
      manufacturer: "Example Miniatures",
      kind: "source",
      sourceName: "Example paint source",
    },
  ],
};

const source = {
  id: "5e0c9a3b-7f2d-4b1e-9a6c-2d8f1b3e4a7c",
  repository: "example/paints",
  url: "https://github.com/example/paints",
  name: "Example paint source",
  version: "1.0.0",
  license: "CC-BY-4.0",
  attribution: null,
  dependencies: [],
  lastError: null,
  logoUrl: null,
  counts: { paints: Object.keys(paints).length, schemes: 2, templates: 1 },
};

function respond(url: URL, method: string): unknown {
  const route = url.pathname;
  if (method !== "GET") {
    if (route === "/api/catalog-sources") return { sources: [source] };
    return {};
  }
  switch (route) {
    case "/api/auth/status":
      return auth;
    case "/api/state":
      return { ...vault, cursor: { epoch: "story", seq: 0 } };
    case "/api/changes":
      return { epoch: "story", seq: 0, changes: [], reload: false };
    case "/api/miniature-templates":
      return templates;
    case "/api/catalog-sources":
      return url.searchParams.has("versions")
        ? { versions: [{ id: source.id, updateAvailable: false }] }
        : { sources: [source] };
    case "/api/catalog-share":
      return { paints: [], schemes: [], templates: [] };
    default:
      return {};
  }
}

// A story can replace a GET route's response; returning undefined keeps the normal one.
type MockOverrides = Record<string, () => Response | undefined>;

function MockApi({ overrides, children }: { overrides: MockOverrides; children: () => ReactNode }) {
  // Installed before the first render so the app's first requests reach the stand-in.
  const [original] = useState(() => {
    const realFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return realFetch(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const override = method === "GET" ? overrides[url.pathname]?.() : undefined;
      return Promise.resolve(override ?? Response.json(respond(url, method)));
    };
    return realFetch;
  });
  useEffect(
    () => () => {
      window.fetch = original;
    },
    [original],
  );
  return children();
}

export function mockApi(overrides: MockOverrides = {}): Decorator {
  return function WithMockApi(Story) {
    return <MockApi overrides={overrides}>{() => <Story />}</MockApi>;
  };
}
