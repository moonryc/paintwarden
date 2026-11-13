export type PaintState = "OWNED" | "WISHLIST" | null;
export type StockLevel = "FULL" | "LOW" | "EMPTY" | null;

export function isPaintOwned(state: PaintState, stockLevel: StockLevel = "FULL", quantity = 1): boolean {
  return state === "OWNED" && stockLevel !== "EMPTY" && quantity > 0;
}

export function isPaintOutstanding(
  state: PaintState,
  stockLevel: StockLevel = "FULL",
  quantity = 1,
): boolean {
  return !isPaintOwned(state, stockLevel, quantity);
}

export function summarizeRequired<T extends { state: PaintState }>(paints: T[]) {
  const owned = paints.filter((paint) => isPaintOwned(paint.state));
  const missing = paints.filter((paint) => isPaintOutstanding(paint.state));
  return { total: paints.length, owned, missing };
}
