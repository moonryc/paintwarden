import assert from "node:assert/strict";
import test from "node:test";

import { fuzzyFilter, fuzzyScore, FUZZY_LIMITS } from "./fuzzy-search.ts";

test("matches typos, partial words, and non-contiguous characters", () => {
  assert.notEqual(fuzzyScore("intercesor", "Ultramarines Intercessors"), null);
  assert.notEqual(fuzzyScore("wraith", "Citadel Wraithbone Spray"), null);
  assert.notEqual(fuzzyScore("wrthbn", "Wraithbone"), null);
});

test("requires every query token and ranks stronger matches first", () => {
  const values = ["Blood Angels Red", "Mephiston Red", "Blood for the Blood God"];
  assert.deepEqual(
    fuzzyFilter(values, "blood red", (value) => value),
    ["Blood Angels Red"],
  );
  assert.equal(fuzzyFilter(values, "ultramarine blue", (value) => value).length, 0);
});

test("does not include unrelated suggestions beside a literal model match", () => {
  const models = [
    "'Jotunn' H-Grade Servitor Ogryn",
    "Abyssal Knight",
    "Bill the Pony",
    "Hill Troll",
    "Kill Team Laboratory Wall Section",
    "Tomb King",
  ];
  assert.deepEqual(
    fuzzyFilter(models, "kill", (value) => value),
    ["Kill Team Laboratory Wall Section"],
  );
});

test("a model search only considers the displayed model name", () => {
  const models = [
    { name: "Gantry", category: "Kill Team" },
    { name: "Killzone Volkus Crates", category: "Kill Team" },
  ];
  assert.deepEqual(
    fuzzyFilter(models, "kill", (model) => model.name),
    [models[1]],
  );
});

// Intentionally simple unbounded reference for equivalence on ordinary input.
const referenceNormalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
function referenceScore(query: string, value: string): number | null {
  const q = referenceNormalize(query),
    text = referenceNormalize(value);
  if (!q) return 0;
  if (!text) return null;
  let total = 0;
  for (const token of q.split(" ")) {
    let best: number | null = null;
    if (text === token) best = 140;
    else if (text.startsWith(token)) best = 125 - Math.min(20, text.length - token.length);
    else if (text.includes(token)) best = 115 - Math.min(25, text.indexOf(token));
    else
      for (const word of text.split(" ")) {
        let score: number | null = null;
        if (word === token) score = 110;
        else if (word.startsWith(token)) score = 100 - Math.min(20, word.length - token.length);
        else if (word.includes(token)) score = 90 - Math.min(20, word.indexOf(token));
        else if (token.length >= 3) {
          let row = Array.from({ length: word.length + 1 }, (_, i) => i);
          for (let a = 1; a <= token.length; a++) {
            const next = [a];
            for (let b = 1; b <= word.length; b++)
              next[b] = Math.min(
                next[b - 1] + 1,
                row[b] + 1,
                row[b - 1] + (token[a - 1] === word[b - 1] ? 0 : 1),
              );
            row = next;
          }
          const distance = row[word.length];
          if (distance <= Math.max(1, Math.floor(token.length * 0.3)))
            score = 82 - distance * 8 - Math.abs(word.length - token.length);
          else {
            let at = 0,
              first = -1,
              last = -1;
            for (let i = 0; i < word.length && at < token.length; i++)
              if (word[i] === token[at]) {
                if (first < 0) first = i;
                last = i;
                at++;
              }
            if (at === token.length) score = 65 - (last - first + 1 - token.length) - first * 0.25;
          }
        }
        if (score !== null && (best === null || score > best)) best = score;
      }
    if (best === null) return null;
    total += best;
  }
  return total;
}
function referenceFilter(items: string[], query: string, limit?: number) {
  const q = referenceNormalize(query);
  if (!q) return limit === undefined ? items : items.slice(0, limit);
  const literal = items
    .map((item, index) => ({ item, index, at: referenceNormalize(item).indexOf(q) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map((m) => m.item);
  const matches = literal.length
    ? literal
    : items
        .map((item, index) => ({ item, index, score: referenceScore(query, item) }))
        .filter((m): m is typeof m & { score: number } => m.score !== null)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map((m) => m.item);
  return limit === undefined ? matches : matches.slice(0, limit);
}

test("indexed banded scoring and top-k agree with original ranking, including ties", () => {
  let seed = 821;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const word = () =>
    Array.from({ length: 1 + Math.floor(random() * 18) }, () => "abcde"[Math.floor(random() * 5)]).join("");
  const identity = (v: string) => v;
  for (let sample = 0; sample < 180; sample++) {
    const values = Array.from({ length: 24 }, () => `${word()} ${word()}`);
    values.push(values[0], "Café Röjo", "Blood Angels Red", "Red Red");
    const queries = [word(), `${word()} ${word()}`, "cafe", "red", "", " ", values[0].slice(2, 8)];
    for (const query of queries) {
      for (const value of values) assert.equal(fuzzyScore(query, value), referenceScore(query, value));
      for (const limit of [undefined, 0, 1, 5, 100, -1, 2.5, NaN, Infinity]) {
        assert.deepEqual(fuzzyFilter(values, query, identity, limit), referenceFilter(values, query, limit));
      }
    }
  }
});

test("indexes normalize once for an immutable table and stable selector", () => {
  let calls = 0;
  const text = (value: string) => {
    calls++;
    return value;
  };
  const values = ["Red", "Blue", "Café"];
  fuzzyFilter(values, "red", text);
  fuzzyFilter(values, "blu", text, 1);
  assert.equal(calls, 3);
  fuzzyFilter([...values, "Green"], "gren", text);
  assert.equal(calls, 7);
});

test("hostile query and text sizes have documented deterministic limits", () => {
  const query = "a".repeat(FUZZY_LIMITS.query);
  assert.equal(fuzzyScore(query + "z".repeat(100000), query), fuzzyScore(query, query));
  const text = "z".repeat(FUZZY_LIMITS.text);
  assert.equal(fuzzyScore("needle", text + " needle"), null);
  assert.equal(
    fuzzyScore("abc", "abc" + "z".repeat(100000)),
    fuzzyScore("abc", "abc" + "z".repeat(FUZZY_LIMITS.text - 3)),
  );
  const values = Array.from({ length: 300 }, (_, i) => `red ${i}`);
  assert.deepEqual(fuzzyFilter(values, "red", String, 4), values.slice(0, 4));
});
