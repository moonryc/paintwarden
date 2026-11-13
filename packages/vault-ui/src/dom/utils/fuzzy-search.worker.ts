import { createFuzzyIndex, searchFuzzyIndex, type FuzzyIndex } from "@paint-vault/core/fuzzy-search";

let index: FuzzyIndex<number> = createFuzzyIndex([], String);
// Only text crosses the boundary on table changes; keystrokes send a tiny message.
self.onmessage = ({
  data,
}: MessageEvent<{
  texts?: string[];
  request?: number;
  query?: string;
  limit?: number;
}>) => {
  if (data.texts)
    index = createFuzzyIndex(
      data.texts.map((_, i) => i),
      (i) => data.texts![i],
    );
  if (data.request !== undefined)
    self.postMessage({
      request: data.request,
      indices: searchFuzzyIndex(index, data.query ?? "", data.limit),
    });
};
