import type { ApolloClient } from "@apollo/client";

import { readColorIndex, type ColorIndexRead } from "./color-tools-loader";
import { useSchemeWindow } from "./miniature-scheme-hooks";

const write = (_client: ApolloClient, _data: ColorIndexRead) => {};
const noMore = () => false;
export function useColorIndex() {
  const { data, ...result } = useSchemeWindow("color-index", readColorIndex, write, noMore);
  return { ...result, paints: data?.nodes ?? [] };
}
