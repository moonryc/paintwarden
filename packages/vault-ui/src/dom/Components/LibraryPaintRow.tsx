import { useTranslation } from "react-i18next";
import { useFragment } from "@apollo/client/react";
import Box from "@mui/material/Box";
import { memo, type KeyboardEvent } from "react";

import { PaintStockFragmentDoc } from "../graphql/generated/graphql";
import { libraryInventoryRecord, type LibraryPaintProjection } from "../graphql/library-model";
import { useVaultGraphQL, type VaultGraphQLScope } from "../graphql/provider";
import { usePaintStock } from "../graphql/stock-actions";
import { useVaultStore } from "../store/hooks";
import type { Paint } from "../types";
import { owns } from "../utils/vault-data";

import { PaintRowActions } from "./PaintRowActions";
import { PaintRowLabel, paintRowHoverSx } from "./PaintRowLabel";
import { PaintSubstitutionChip } from "./PaintSubstitutionChip";

// A paint in the library or a scheme: owned paints show their quantity, and paints that aren't
// available can be marked owned or added to the wishlist.
type LibraryPaintRowProps = {
  paint: Paint;
  projection: LibraryPaintProjection;
  // Replaces the usual owned toggle, as in the project drawer's scheme previews.
  toggleOwned?(paint: Paint): void;
  onOpenPaint(id: string): void;
  index?: number;
  border?: "top" | "bottom" | "none";
  onKeyDownCapture?: (event: KeyboardEvent<HTMLLIElement>) => void;
};

export const LibraryPaintRow = memo(function LibraryPaintRow(props: LibraryPaintRowProps) {
  const scope = useVaultGraphQL();
  return scope ? <CachedLibraryPaintRow {...props} scope={scope} /> : <LibraryPaintRowView {...props} />;
});

function CachedLibraryPaintRow({
  scope,
  ...props
}: LibraryPaintRowProps & { projection: LibraryPaintProjection; scope: VaultGraphQLScope }) {
  const { data, complete } = useFragment({
    fragment: PaintStockFragmentDoc,
    from: { __typename: "Paint", id: props.paint.id },
    client: scope.client,
    optimistic: true,
  });
  const record = complete ? libraryInventoryRecord(data.inventory) : props.projection.record;
  return <LibraryPaintRowView {...props} projection={{ ...props.projection, record }} />;
}

function LibraryPaintRowView({
  paint,
  projection: { substitution, record, available, broken },
  toggleOwned: toggleOwnedOverride,
  onOpenPaint,
  index,
  border = "top",
  onKeyDownCapture,
}: LibraryPaintRowProps & { projection: LibraryPaintProjection }) {
  const { t } = useTranslation("components");
  const notify = useVaultStore((s) => s.notify);
  const { setPaintState, toggleOwned: stockToggleOwned } = usePaintStock();
  const toggleOwned = toggleOwnedOverride ?? ((item: Paint) => stockToggleOwned(item, record));
  const directlyOwned = owns(record);
  const wishlisted = record?.state === "WISHLIST";
  const stockLevel = record?.stockLevel === "EMPTY" ? "FULL" : record?.stockLevel;

  return (
    <Box
      component="li"
      data-paint-index={index}
      onKeyDownCapture={onKeyDownCapture}
      sx={[
        {
          boxSizing: "border-box",
          display: "flex",
          height: "66px",
          minWidth: 0,
          alignItems: "center",
        },
        border === "top" && index !== 0
          ? {
              borderTopStyle: "solid",
              borderTopWidth: "1px",
              borderColor: "var(--line)",
            }
          : border === "bottom" && {
              borderBottomStyle: "solid",
              borderBottomWidth: "1px",
              borderColor: "var(--line)",
              "&:last-child": {
                borderBottomStyle: "solid",
                borderBottomWidth: "0px",
              },
            },
        paintRowHoverSx,
      ]}
    >
      <PaintRowLabel
        paint={paint}
        onClick={() => onOpenPaint(paint.id)}
        accessory={substitution && <PaintSubstitutionChip name={substitution.name} broken={broken} />}
      />
      <PaintRowActions
        quantity={
          directlyOwned && record?.quantity !== undefined
            ? {
                paintName: paint.name,
                value: record.quantity,
                onChange: (quantity) =>
                  setPaintState(paint.id, quantity === 0 ? null : "OWNED", stockLevel, quantity),
              }
            : undefined
        }
        wishlist={
          !available || wishlisted
            ? {
                active: wishlisted,
                label: wishlisted
                  ? t("removePaintFromWishlist", { name: paint.name })
                  : t("addPaintToWishlist", { name: paint.name }),
                title: wishlisted ? t("removeFromWishlist") : t("addToWishlist"),
                onClick: () => {
                  setPaintState(paint.id, wishlisted ? null : "WISHLIST");
                  notify(
                    wishlisted
                      ? t("paintRemovedFromWishlist", { name: paint.name })
                      : t("paintAddedToWishlist", { name: paint.name }),
                  );
                },
              }
            : undefined
        }
        add={
          !available
            ? {
                label: substitution
                  ? t("paintUnavailableThrough", { name: paint.name, substitution: substitution.name })
                  : t("markPaintOwned", { name: paint.name }),
                title: substitution
                  ? t("unavailableThrough", { substitution: substitution.name })
                  : t("markAsOwned"),
                disabled: Boolean(substitution),
                onClick: () => toggleOwned(paint),
              }
            : undefined
        }
        remove={
          directlyOwned
            ? {
                label: t("clearPaintQuantity", { name: paint.name }),
                title: t("removeFromPaintLibrary"),
                onClick: () => setPaintState(paint.id, null, stockLevel, 0),
              }
            : undefined
        }
      />
    </Box>
  );
}
