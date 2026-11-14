// A stand-in for the Paintwarden server, so the whole app can render in Storybook with the
// sample vault. Reads return fixture data; writes succeed without changing anything.
import { createFuzzyIndex, searchFuzzyIndex } from "@paintwarden/core/fuzzy-search";
import {
  defaultSubstitution,
  isPaintAvailable,
  resolvePaintChoice,
  resolveSubstitution,
} from "@paintwarden/core/paint-substitutions";
import type { Decorator } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { ALL_LIBRARY_SOURCES, NO_LIBRARY_SOURCE, type LibraryFilters } from "../graphql/library-hooks";
import type { AuthStatus, MiniatureTemplateCatalog, Paint, State, StockLevel } from "../types";
import { usedByMiniatures } from "../utils/semantic-contract";
import { owns } from "../utils/vault-data";

import { paints, vault } from "./fixtures";
import { fixtureLibraryView } from "./library-fixtures";
import { fixtureMiniatureResponse } from "./miniature-api-fixtures";
import { fixturePaintToolsResponse } from "./paint-tools-api-fixtures";
import { fixtureTemplateResponse } from "./template-api-fixtures";

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

type GraphQLRequest = { operationName?: string; variables?: Record<string, unknown> };

type MockGraphQLOptions = { data?: () => State; revision?: () => number };

function createGraphQLResponder(options: MockGraphQLOptions) {
  let data = structuredClone(vault);
  let sequence = 0;
  const revision = () => ({ epoch: "story", seq: String(options.revision?.() ?? sequence) });
  const projectPaint = (paint: Paint) => {
    const resolved = resolvePaintChoice(data, "", paint.id);
    const active = defaultSubstitution(data, paint.id);
    return {
      __typename: "Paint",
      ...paint,
      sourceName: paint.sourceName ?? null,
      sourceLogoUrl: paint.sourceLogoUrl ?? null,
      sourceId: null,
      sourceLabel: paint.sourceName ?? null,
      type: null,
      discontinued: false,
      inventory: data.paintRecords[paint.id]
        ? { __typename: "Inventory", ...data.paintRecords[paint.id] }
        : null,
      available: isPaintAvailable(data, data.paintRecords, paint.id),
      hasActiveSubstitution: !!active,
      activeSubstitution: active ? { id: active.id, name: active.name } : null,
      brokenReason: resolved.broken ? (resolved.brokenReason === "empty" ? "EMPTY" : "CYCLE") : null,
      brokenSubstitution: resolved.broken || resolved.unavailablePaintIds.length > 0,
      missingStock: resolved.paintIds.some((id) => !owns(data.paintRecords[id])),
    };
  };
  const paginate = <T,>(rows: T[], first: number, after: unknown) => {
    const start = Number(after ?? 0);
    const end = Math.min(start + first, rows.length);
    return {
      nodes: rows.slice(start, end),
      totalCount: rows.length,
      pageInfo: { hasNextPage: end < rows.length, endCursor: String(end) },
    };
  };
  const substitution = (mix: State["paintSubstitutions"][number], after?: unknown) => {
    const resolved = resolveSubstitution(data, mix.id);
    return {
      ...mix,
      available: resolved?.paintIds.every((id) => isPaintAvailable(data, data.paintRecords, id)) ?? false,
      brokenReason: resolved?.broken ? (resolved.brokenReason === "empty" ? "EMPTY" : "CYCLE") : null,
      ingredients: paginate(
        data.paintSubstitutionIngredients
          .filter((row) => row.substitutionId === mix.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .flatMap((row) => {
            const paint = data.catalog.find((candidate) => candidate.id === row.paintId);
            return paint ? [{ paint: projectPaint(paint), parts: row.parts, sortOrder: row.sortOrder }] : [];
          }),
        after ? 100 : 20,
        after,
      ),
    };
  };
  return ({ operationName, variables: vars = {} }: GraphQLRequest): Record<string, unknown> => {
    data = options.data?.() ?? data;
    if (operationName === "VaultInvalidation")
      return {
        vaultInvalidation: {
          ...revision(),
          reset: false,
          families:
            Number(revision().seq) > Number(vars.since ?? 0)
              ? ["HOME", "MINIATURES", "LIBRARY", "PAINT", "OPTIONS"]
              : [],
        },
      };
    if (operationName === "InstalledSources") return { sources: { revision: revision(), sources: [source] } };
    if (operationName === "PluginVersions")
      return {
        sourceVersions: { revision: revision(), versions: [{ id: source.id, updateAvailable: false }] },
      };
    if (operationName === "PluginRemoval")
      return {
        sourceRemoval: {
          revision: revision(),
          source: { id: source.id, name: source.name, version: source.version },
          removes: source.counts,
          blockers: [],
          canRemove: true,
        },
      };
    if (operationName === "PluginShareable")
      return {
        sourceShareable: {
          revision: revision(),
          paints: data.catalog
            .filter((paint) => paint.isCustom)
            .map((paint) => ({ id: paint.id, name: `${paint.brand} · ${paint.name}` })),
          schemes: data.colorSchemes
            .filter((scheme) => scheme.id.startsWith("user:"))
            .map(({ id, name }) => ({ id, name })),
          templates: [],
        },
      };
    if (operationName === "ColorToolIndex") {
      const start = Number(vars.after ?? 0);
      const rows = data.catalog.slice(start, start + 100);
      const end = start + rows.length;
      return {
        colorIndex: {
          revision: revision(),
          nodes: rows.map((paint) => ({
            id: paint.id,
            name: paint.name,
            brand: paint.brand,
            hex: paint.colorHex ?? null,
            owned: owns(data.paintRecords[paint.id]),
            available: isPaintAvailable(data, data.paintRecords, paint.id),
          })),
          pageInfo: { hasNextPage: end < data.catalog.length, endCursor: rows.length ? String(end) : null },
        },
      };
    }
    if (operationName === "BrowseFolders")
      return {
        folderBrowser: {
          revision: revision(),
          folders: [],
          totalCount: 0,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    if (operationName === "SearchFolderContents") {
      type Results = { nodes: Record<string, unknown>[]; totalCount: number; pageInfo: unknown };
      if (vars.kind === "TEMPLATE") {
        const response = fixtureTemplateResponse(data, "TemplateSummaries", vars, revision()) as {
          templates: { templates: Results };
        };
        const results = response.templates.templates;
        return {
          folderSearch: {
            revision: revision(),
            results: {
              ...results,
              nodes: results.nodes.map((row) => ({ ...row, templateImageUrl: row.imageUrl })),
            },
          },
        };
      }
      const response = fixtureMiniatureResponse(data, "MiniatureList", vars, revision(), projectPaint) as {
        miniatures: { miniatures: Results };
      };
      return { folderSearch: { revision: revision(), results: response.miniatures.miniatures } };
    }
    const paintTools = fixturePaintToolsResponse(data, operationName, vars, revision(), projectPaint);
    if (paintTools) return paintTools;
    const template = fixtureTemplateResponse(data, operationName, vars, revision());
    if (template) return template;
    const miniature = fixtureMiniatureResponse(data, operationName, vars, revision(), projectPaint);
    if (miniature) return miniature;
    if (operationName === "SetPaintStock") {
      const id = String(vars.paintId);
      const paint = data.catalog.find((row) => row.id === id);
      if (vars.state === "OWNED" || vars.state === "WISHLIST")
        data.paintRecords[id] = {
          state: vars.state,
          stockLevel: (vars.stockLevel as StockLevel) ?? "FULL",
          quantity: Number(vars.quantity ?? 0),
        };
      else delete data.paintRecords[id];
      sequence += 1;
      return {
        setPaintStock: {
          revision: revision(),
          paint: paint ? projectPaint(paint) : null,
          clientMutationId: vars.clientMutationId ?? null,
          invalidatedFamilies: ["PAINT", "LIBRARY", "OPTIONS"],
        },
      };
    }
    if (operationName === "PaintPickerOptions") {
      const excluded = new Set((vars.excludeIds ?? []) as string[]);
      const candidates = data.catalog.filter((paint) => !excluded.has(paint.id));
      const matches = searchFuzzyIndex(
        createFuzzyIndex(candidates, (paint) => `${paint.brand} ${paint.range} ${paint.name}`),
        typeof vars.search === "string" ? vars.search : "",
        Number(vars.first ?? 30),
      );
      return { paintOptions: { revision: revision(), items: matches.map(projectPaint) } };
    }
    if (operationName === "PaintSubstitutionIngredients") {
      const mix = data.paintSubstitutions.find((row) => row.id === vars.id);
      return {
        substitution: { revision: revision(), substitution: mix ? substitution(mix, vars.after) : null },
      };
    }
    if (operationName === "PaintDetails") {
      const paint = data.catalog.find((row) => row.id === vars.id);
      return {
        paint: {
          revision: revision(),
          paint: paint ? projectPaint(paint) : null,
          substitutions: paginate(
            data.paintSubstitutions
              .filter((row) => row.targetPaintId === vars.id)
              .map((row) => substitution(row)),
            10,
            vars.substitutionsAfter,
          ),
          usedBy: paginate(
            usedByMiniatures(data, String(vars.id)).map(({ id, title }) => ({ id, title })),
            30,
            vars.usedByAfter,
          ),
        },
      };
    }
    const view = fixtureLibraryView(data, {
      search: typeof vars.search === "string" ? vars.search : "",
      brand: typeof vars.brand === "string" ? vars.brand : "ALL",
      plugin: vars.noSource
        ? NO_LIBRARY_SOURCE
        : typeof vars.sourceName === "string"
          ? vars.sourceName
          : ALL_LIBRARY_SOURCES,
      inventory: (vars.filter ?? "ALL") as LibraryFilters["inventory"],
    });
    return {
      library: {
        ...paginate(
          view.rows.map(({ paint }) => projectPaint(paint)),
          Number(vars.first ?? 48),
          vars.after,
        ),
        revision: revision(),
        catalogCount: view.catalogCount,
        availableCount: view.availableCount,
        explicitWishlistCount: view.wishlistCount,
        facets: { brands: view.brands, sources: view.sources, inventory: view.inventory },
      },
    };
  };
}

// A story can replace a GET route's response; returning undefined keeps the normal one.
type MockOverrides = Record<string, () => Response | undefined | Promise<Response | undefined>>;

function MockApi({
  overrides,
  options,
  children,
}: {
  overrides: MockOverrides;
  options: MockGraphQLOptions;
  children: () => ReactNode;
}) {
  // Installed before the first render so the app's first requests reach the stand-in.
  const [original] = useState(() => {
    const realFetch = window.fetch;
    const graphql = createGraphQLResponder(options);
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return realFetch(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (url.pathname === "/api/graphql/stream")
        return new Response(
          'event: next\ndata: {"data":{"vaultChanges":{"epoch":"story","seq":"0","reset":false,"families":[]}}}\n\nevent: complete\ndata: null\n\n',
          { headers: { "content-type": "text/event-stream" } },
        );
      if (url.pathname === "/api/graphql") {
        const body =
          typeof init?.body === "string"
            ? init.body
            : input instanceof Request
              ? await input.clone().text()
              : "{}";
        return Response.json({ data: graphql(JSON.parse(body) as GraphQLRequest) });
      }
      const override = method === "GET" ? await overrides[url.pathname]?.() : undefined;
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

export function mockApi(overrides: MockOverrides = {}, options: MockGraphQLOptions = {}): Decorator {
  return function WithMockApi(Story) {
    return (
      <MockApi overrides={overrides} options={options}>
        {() => <Story />}
      </MockApi>
    );
  };
}
