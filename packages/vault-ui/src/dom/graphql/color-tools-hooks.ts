import type { ApolloClient } from "@apollo/client";

import {
  readColorIndex,
  readSchemeColorIndex,
  type ColorIndexRead,
  type SchemeColorIndexRead,
} from "./color-tools-loader";
import { useSchemeWindow } from "./miniature-scheme-hooks";

const write = (_client: ApolloClient, _data: ColorIndexRead) => {};
const noMore = () => false;
export function useColorIndex() {
  const { data, ...result } = useSchemeWindow("color-index", readColorIndex, write, noMore);
  return { ...result, paints: data?.nodes ?? [] };
}

const writeSchemes = (_client: ApolloClient, _data: SchemeColorIndexRead) => {};
export function useSchemeColorIndex() {
  const {
    data,
    loadMore: _loadMore,
    ...result
  } = useSchemeWindow("scheme-color-index", readSchemeColorIndex, writeSchemes, noMore);
  return { ...result, schemes: data?.schemes ?? [] };
}
