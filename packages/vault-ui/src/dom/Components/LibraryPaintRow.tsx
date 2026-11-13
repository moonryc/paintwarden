import { useFragment } from "@apollo/client/react";
import Box from "@mui/material/Box";
import {
  defaultSubstitution,
  isPaintAvailable,
  resolvePaintChoice,
} from "@paint-vault/core/paint-substitutions";
import { memo, type KeyboardEvent } from "react";
import { shallow } from "zustand/shallow";

import { PaintStockFragmentDoc } from "../graphql/generated/graphql";
import { libraryInventoryRecord, type LibraryPaintProjection } from "../graphql/library-model";
import { useVaultGraphQL, type VaultGraphQLScope } from "../graphql/provider";
import { usePaintStock } from "../graphql/stock-actions";
import { useVault, useVaultStore } from "../store/hooks";
import type { Paint } from "../types";
import { owns } from "../utils/vault-data";

import { PaintRowActions } from "./PaintRowActions";
import { PaintRowLabel, paintRowHoverSx } from "./PaintRowLabel";
import { PaintSubstitutionChip } from "./PaintSubstitutionChip";

// A paint in the library or a scheme: owned paints show their quantity, and paints that aren't
// available can be marked owned or added to the wishlist.
type LibraryPaintRowProps = {
  paint: Paint;
  projection?: LibraryPaintProjection;
  // Replaces the usual owned toggle, as in the project drawer's scheme previews.
  toggleOwned?(paint: Paint): void;
  onOpenPaint(id: string): void;
  index?: number;
  border?: "top" | "bottom" | "none";
  onKeyDownCapture?: (event: KeyboardEvent<HTMLLIElement>) => void;
};

export const LibraryPaintRow = memo(function LibraryPaintRow(props: LibraryPaintRowProps) {
  return props.projection ? (
    <ProjectedLibraryPaintRow {...props} projection={props.projection} />
  ) : (
    <LegacyLibraryPaintRow {...props} />
  );
});

function LegacyLibraryPaintRow(props: LibraryPaintRowProps) {
  const { paint } = props;
  const { substitution, record, available, broken } = useVault(
    (data) => ({
      substitution: defaultSubstitution(data, paint.id),
      broken: resolvePaintChoice(data, "", paint.id).broken,
      record: data.paintRecords[paint.id],
      // Includes inventory and recursive substitution ingredients, not only this paint's record.
      available: isPaintAvailable(data, data.paintRecords, paint.id),
    }),
    shallow,
  );
  return (
    <LibraryPaintRowView
      {...props}
      projection={{ paint, substitution: substitution ?? null, record, available, broken }}
    />
  );
}

function ProjectedLibraryPaintRow(props: LibraryPaintRowProps & { projection: LibraryPaintProjection }) {
  const scope = useVaultGraphQL();
  return scope ? <CachedLibraryPaintRow {...props} scope={scope} /> : <LibraryPaintRowView {...props} />;
}

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
                label: wishlisted ? `Remove ${paint.name} from wishlist` : `Add ${paint.name} to wishlist`,
                title: wishlisted ? "Remove from wishlist" : "Add to wishlist",
                onClick: () => {
                  setPaintState(paint.id, wishlisted ? null : "WISHLIST");
                  notify(`${paint.name} ${wishlisted ? "removed from" : "added to"} wishlist`);
                },
              }
            : undefined
        }
        add={
          !available
            ? {
                label: substitution
                  ? `${paint.name} is unavailable through ${substitution.name}`
                  : `Mark ${paint.name} as owned`,
                title: substitution ? `Unavailable through ${substitution.name}` : "Mark as owned",
                disabled: Boolean(substitution),
                onClick: () => toggleOwned(paint),
              }
            : undefined
        }
        remove={
          directlyOwned
            ? {
                label: `Set ${paint.name} quantity to 0`,
                title: "Remove from paint library",
                onClick: () => setPaintState(paint.id, null, stockLevel, 0),
              }
            : undefined
        }
      />
    </Box>
  );
}
