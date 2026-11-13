import Box from "@mui/material/Box";

import { Heart, Plus, X } from "../icons";

import { QuantityCounter } from "./QuantityCounter";
import { RoundActionButton } from "./RoundActionButton";

export type PaintRowAction = {
  // Accessible name, such as "Add Crimson Base to wishlist".
  label: string;
  // Tooltip, such as "Add to wishlist".
  title: string;
  onClick(): void;
  disabled?: boolean;
};

// The controls at the end of a paint row. Each control appears only when it's passed.
export function PaintRowActions({
  quantity,
  wishlist,
  add,
  remove,
}: {
  quantity?: { paintName: string; value: number; onChange(quantity: number): void };
  // `active` fills the heart when the paint is already wishlisted.
  wishlist?: PaintRowAction & { active?: boolean };
  add?: PaintRowAction;
  remove?: Omit<PaintRowAction, "disabled">;
}) {
  const hasActions = Boolean(quantity || wishlist || add || remove);

  return (
    <Box
      component="span"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 0.75,
        flexShrink: 0,
        mr: hasActions ? { xs: 0.5, md: 1 } : 0,
        pr: hasActions ? 0.75 : 0,
        boxSizing: "border-box",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {quantity && (
        <QuantityCounter name={quantity.paintName} value={quantity.value} onChange={quantity.onChange} />
      )}
      {wishlist && (
        <RoundActionButton
          label={wishlist.label}
          title={wishlist.title}
          tone="wishlist"
          active={wishlist.active}
          disabled={wishlist.disabled}
          size="md"
          onClick={wishlist.onClick}
        >
          <Heart size={15} fill={wishlist.active ? "currentColor" : "none"} />
        </RoundActionButton>
      )}
      {add && (
        <RoundActionButton
          label={add.label}
          title={add.title}
          tone="ok"
          disabled={add.disabled}
          size="md"
          onClick={add.onClick}
        >
          <Plus size={15} />
        </RoundActionButton>
      )}
      {remove && (
        <RoundActionButton
          label={remove.label}
          title={remove.title}
          tone="rust"
          size="md"
          onClick={remove.onClick}
        >
          <X size={15} />
        </RoundActionButton>
      )}
    </Box>
  );
}
