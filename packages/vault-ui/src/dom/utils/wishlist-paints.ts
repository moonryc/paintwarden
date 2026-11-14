import { isPaintOwned } from "@paintwarden/core/paint-state";

type PaintRecord = {
  state: "OWNED" | "WISHLIST";
  stockLevel: "FULL" | "LOW" | "EMPTY";
  quantity: number;
};

export function wishlistPaintIds(records: Record<string, PaintRecord>) {
  return new Set(
    Object.entries(records)
      .filter(
        ([, record]) =>
          record.state === "WISHLIST" ||
          (record.state === "OWNED" && !isPaintOwned(record.state, record.stockLevel, record.quantity)),
      )
      .map(([paintId]) => paintId),
  );
}
