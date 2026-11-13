import type { ApolloClient } from "@apollo/client";

import { getFragmentData, makeFragmentData } from "./generated/fragment-masking";
import {
  DetailPaintFragmentDoc,
  PaintToolChoiceDocument,
  PaintToolRankingDocument,
  VaultRevisionDocument,
  type PaintToolRankingQuery,
} from "./generated/graphql";
import type { Revision } from "./invalidation";
import { isStaleLibraryCursor } from "./library-loader";

const sameRevision = (a: Revision, b: Revision) => a.epoch === b.epoch && a.seq === b.seq;
function unpack(raw: PaintToolRankingQuery["paintRanking"]) {
  return {
    ...raw,
    paint: getFragmentData(DetailPaintFragmentDoc, raw.paint),
    nodes: raw.nodes.map((row) => ({
      ...row,
      paint: getFragmentData(DetailPaintFragmentDoc, row.paint),
    })),
  };
}
export type PaintRankingRead = ReturnType<typeof unpack>;
async function stableRead<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await read();
      if (result) return result;
    } catch (error) {
      if (!isStaleLibraryCursor(error)) throw error;
    }
  }
  throw new Error("Paints changed while refreshing. Try again.");
}

// Only the explicitly loaded ranking window is read. A refresh rebuilds that
// window at one revision before any normalized paint is published.
export function readPaintRankingWindow(client: ApolloClient, id: string, ownedOnly: boolean, pages = 1) {
  return stableRead(async () => {
    let result: PaintRankingRead | undefined;
    let after: string | null = null;
    for (let page = 0; page < Math.max(1, pages); page += 1) {
      const { data } = await client.query({
        query: PaintToolRankingDocument,
        variables: { id, ownedOnly, after },
        fetchPolicy: "no-cache",
      });
      if (!data) throw new Error("Paint ranking response was empty");
      const next = unpack(data.paintRanking);
      if (result && !sameRevision(result.revision, next.revision)) return undefined;
      result = result ? { ...next, nodes: [...result.nodes, ...next.nodes] } : next;
      if (!next.pageInfo.hasNextPage) break;
      const cursor = next.pageInfo.endCursor;
      if (!cursor || cursor === after) throw new Error("Paint ranking returned an invalid cursor");
      after = cursor;
    }
    return result;
  });
}
export function writePaintRanking(
  client: ApolloClient,
  id: string,
  ownedOnly: boolean,
  data: PaintRankingRead,
) {
  client.writeQuery({
    query: PaintToolRankingDocument,
    variables: { id, ownedOnly, after: null },
    data: {
      paintRanking: {
        ...data,
        paint: data.paint ? makeFragmentData(data.paint, DetailPaintFragmentDoc) : null,
        nodes: data.nodes.map((row) => ({
          ...row,
          paint: makeFragmentData(row.paint, DetailPaintFragmentDoc),
        })),
      },
    },
  });
}

async function readChoice(client: ApolloClient, id: string) {
  const { data } = await client.query({
    query: PaintToolChoiceDocument,
    variables: { id },
    fetchPolicy: "no-cache",
  });
  if (!data) throw new Error("Selected paint response was empty");
  return { ...data.paint, id, paint: getFragmentData(DetailPaintFragmentDoc, data.paint.paint) };
}
export type PaintConversionRead = {
  revision: Revision;
  rows: PaintRankingRead[];
  choices: Awaited<ReturnType<typeof readChoice>>[];
};

// All original paints belong to an authored scheme, never an all-catalog
// lookup. Each gets a bounded suggestion preview. Manual choices outside that
// preview are looked up by ID and revalidated at the same revision.
export function readPaintConversion(client: ApolloClient, ids: string[], choiceIds: string[]) {
  return stableRead<PaintConversionRead>(async () => {
    const rows: PaintRankingRead[] = [];
    const choices: PaintConversionRead["choices"] = [];
    let revision: Revision | undefined;
    for (const id of [...new Set(ids)]) {
      const row = await readPaintRankingWindow(client, id, true);
      if (revision && !sameRevision(revision, row.revision)) return undefined;
      revision = row.revision;
      rows.push(row);
    }
    for (const id of [...new Set(choiceIds)].filter((id) => !ids.includes(id))) {
      const choice = await readChoice(client, id);
      if (revision && !sameRevision(revision, choice.revision)) return undefined;
      revision = choice.revision;
      choices.push(choice);
    }
    if (!revision) {
      const { data } = await client.query({ query: VaultRevisionDocument, fetchPolicy: "no-cache" });
      if (!data) throw new Error("Paint revision response was empty");
      revision = data.vaultRevision;
    }
    return { revision, rows, choices };
  });
}
export function writePaintConversion(client: ApolloClient, data: PaintConversionRead) {
  for (const row of data.rows) {
    if (row.paint) writePaintRanking(client, row.paint.id, true, row);
  }
  for (const choice of data.choices) {
    client.writeQuery({
      query: PaintToolChoiceDocument,
      variables: { id: choice.id },
      data: {
        paint: {
          revision: choice.revision,
          paint: choice.paint ? makeFragmentData(choice.paint, DetailPaintFragmentDoc) : null,
        },
      },
    });
  }
}
