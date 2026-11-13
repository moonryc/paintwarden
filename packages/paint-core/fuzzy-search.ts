// Search is intentionally bounded for untrusted imports and query strings. These are
// UTF-16 code-unit limits, applied before normalization (and again after expansion).
// Text beyond 16 KiB and query beyond 128 characters is not searchable. Fuzzy fallback
// considers at most 512 words / 16 query tokens; literal phrase matching runs first.
export const FUZZY_LIMITS = Object.freeze({ query: 128, text: 16384, words: 512, tokens: 16 });

const normalize = (value: string, maximum: number) =>
  value
    .slice(0, maximum)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximum);

// Ukkonen band: only distances <= allowance can affect the original scoring.
// Reuse two rows; abandon a row when no path can still meet the allowance.
function editDistance(left: string, right: string, allowance: number) {
  if (Math.abs(left.length - right.length) > allowance) return allowance + 1;
  let previous = new Array<number>(right.length + 1).fill(allowance + 1);
  let current = new Array<number>(right.length + 1).fill(allowance + 1);
  for (let column = 0; column <= Math.min(right.length, allowance); column++) previous[column] = column;
  for (let row = 1; row <= left.length; row++) {
    const start = Math.max(1, row - allowance),
      end = Math.min(right.length, row + allowance);
    current[0] = row <= allowance ? row : allowance + 1;
    if (start > 1) current[start - 1] = allowance + 1;
    let minimum = current[0];
    for (let column = start; column <= end; column++) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      minimum = Math.min(minimum, current[column]);
    }
    if (minimum > allowance) return allowance + 1;
    if (end < right.length) current[end + 1] = allowance + 1;
    [previous, current] = [current, previous];
  }
  return previous[right.length];
}

function subsequenceScore(needle: string, haystack: string) {
  let at = 0,
    first = -1,
    last = -1;
  for (let index = 0; index < haystack.length && at < needle.length; index += 1) {
    if (haystack[index] !== needle[at]) continue;
    if (first < 0) first = index;
    last = index;
    at += 1;
  }
  if (at !== needle.length) return null;
  return 65 - (last - first + 1 - needle.length) - first * 0.25;
}

function tokenScore(query: string, text: string, words: string[]) {
  if (text === query) return 140;
  if (text.startsWith(query)) return 125 - Math.min(20, text.length - query.length);
  const phraseIndex = text.indexOf(query);
  if (phraseIndex >= 0) return 115 - Math.min(25, phraseIndex);

  let best: number | null = null;
  for (const word of words) {
    let score: number | null = null;
    if (word === query) score = 110;
    else if (word.startsWith(query)) score = 100 - Math.min(20, word.length - query.length);
    else if (word.includes(query)) score = 90 - Math.min(20, word.indexOf(query));
    else if (query.length >= 3) {
      const allowance = Math.max(1, Math.floor(query.length * 0.3));
      const distance = editDistance(query, word, allowance);
      if (distance <= allowance) score = 82 - distance * 8 - Math.abs(word.length - query.length);
      else score = subsequenceScore(query, word);
    }
    if (score !== null && (best === null || score > best)) best = score;
  }
  return best;
}

export type FuzzyIndex<T> = {
  readonly items: T[];
  readonly entries: readonly { text: string; words: string[] }[];
};

export function createFuzzyIndex<T>(items: T[], getText: (item: T) => string): FuzzyIndex<T> {
  return {
    items,
    entries: items.map((item) => {
      const text = normalize(getText(item), FUZZY_LIMITS.text);
      return { text, words: text.split(" ", FUZZY_LIMITS.words) };
    }),
  };
}

function scoreNormalized(tokens: string[], entry: FuzzyIndex<unknown>["entries"][number]) {
  if (!entry.text) return null;
  let total = 0;
  for (const token of tokens) {
    const score = tokenScore(token, entry.text, entry.words);
    if (score === null) return null;
    total += score;
  }
  return total;
}

export function fuzzyScore(query: string, value: string) {
  const normalizedQuery = normalize(query, FUZZY_LIMITS.query);
  if (!normalizedQuery) return 0;
  return scoreNormalized(
    normalizedQuery.split(" ", FUZZY_LIMITS.tokens),
    createFuzzyIndex([value], (v) => v).entries[0],
  );
}

type Match = { index: number; rank: number };
const compare = (a: Match, b: Match) => a.rank - b.rank || a.index - b.index;

// A worst-first heap retains only k results (O(n log k), O(k) memory).
function collectMatches(limit: number | undefined) {
  const matches: Match[] = [];
  return {
    add(match: Match) {
      if (limit === 0) return;
      if (limit === undefined) {
        matches.push(match);
        return;
      }
      if (matches.length === limit) {
        if (compare(match, matches[0]) >= 0) return;
        matches[0] = match;
        let at = 0;
        while (at * 2 + 1 < matches.length) {
          const left = at * 2 + 1,
            right = left + 1;
          let worst = at;
          if (left < matches.length && compare(matches[left], matches[worst]) > 0) worst = left;
          if (right < matches.length && compare(matches[right], matches[worst]) > 0) worst = right;
          if (worst === at) break;
          [matches[at], matches[worst]] = [matches[worst], matches[at]];
          at = worst;
        }
      } else {
        matches.push(match);
        let at = matches.length - 1;
        while (at > 0) {
          const parent = (at - 1) >> 1;
          if (compare(matches[parent], matches[at]) >= 0) break;
          [matches[parent], matches[at]] = [matches[at], matches[parent]];
          at = parent;
        }
      }
    },
    result: () => matches.sort(compare).map(({ index }) => index),
  };
}

export function searchFuzzyIndex<T>(index: FuzzyIndex<T>, query: string, limit?: number): T[] {
  // Keep Array.slice semantics, including negative and fractional limits.
  if (limit !== undefined && limit < 0) return searchFuzzyIndex(index, query).slice(0, limit);
  const count =
    limit === undefined
      ? undefined
      : Math.max(
          0,
          Math.min(
            index.items.length,
            Number.isNaN(limit) ? 0 : limit < 0 ? index.items.length + Math.ceil(limit) : Math.floor(limit),
          ),
        );
  const normalizedQuery = normalize(query, FUZZY_LIMITS.query);
  if (!normalizedQuery) return limit === undefined ? index.items : index.items.slice(0, limit);
  if (count === 0) return [];
  const literals = collectMatches(count);
  let hasLiteral = false;
  for (let i = 0; i < index.entries.length; i++) {
    const at = index.entries[i].text.indexOf(normalizedQuery);
    if (at >= 0) {
      hasLiteral = true;
      literals.add({ index: i, rank: at });
    }
  }
  // A literal anywhere suppresses *all* fuzzy suggestions, even with a limit.
  if (hasLiteral) return literals.result().map((i) => index.items[i]);
  const tokens = normalizedQuery.split(" ", FUZZY_LIMITS.tokens);
  const matches = collectMatches(count);
  for (let i = 0; i < index.entries.length; i++) {
    const score = scoreNormalized(tokens, index.entries[i]);
    if (score !== null) matches.add({ index: i, rank: -score });
  }
  return matches.result().map((i) => index.items[i]);
}

// Immutable table identity + stable text selector owns the cache; old tables can GC.
const cachedIndexes = new WeakMap<object, WeakMap<object, FuzzyIndex<unknown>>>();
export function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string, limit?: number) {
  if (!normalize(query, FUZZY_LIMITS.query)) return limit === undefined ? items : items.slice(0, limit);
  let selectors = cachedIndexes.get(items);
  if (!selectors) {
    selectors = new WeakMap();
    cachedIndexes.set(items, selectors);
  }
  let index = selectors.get(getText) as FuzzyIndex<T> | undefined;
  if (!index) {
    index = createFuzzyIndex(items, getText);
    selectors.set(getText, index);
  }
  return searchFuzzyIndex(index, query, limit);
}
