import { dividerLabel } from "../Components/component-labels";
import { i18n } from "../i18n";
import { useTranslation } from "react-i18next";
import { imageUrl } from "../utils/image-cache";
import { Button, Chip, IconButton, MenuItem, TextField } from "@mui/material";
import Box from "@mui/material/Box";

import { PaintBottle } from "../Components/PaintBottle";
import { SortableRow } from "../Components/SortableRow";
import { X } from "../icons";
import type { ColorSchemeDivider, Paint, SchemeOrderEntry } from "../types";
import { isRequiredMilestone } from "../utils/scheme-order";
import { truncateSx } from "../utils/truncate";

import { dividerOptions } from "./AddSchemeItemDialog";

const labelSx = {
  minWidth: 0,
  flex: "1",
  fontSize: "0.875rem",
  lineHeight: 10 / 7,
} as const;

// A milestone every scheme has, which can't be renamed or removed.
export function RequiredMilestone({ label }: { label: string }) {
  const { t } = useTranslation("components");
  return (
    <>
      <Box component="span" sx={{ ...labelSx, fontWeight: 700, letterSpacing: "0.025em" }}>
        {dividerLabel(label)}
      </Box>
      <Chip
        size="small"
        label={t("required")}
        sx={{
          boxSizing: "border-box",
          bgcolor: "color-mix(in oklab, var(--scrim) 15%, transparent)",
          color: "currentcolor",
        }}
      />
    </>
  );
}

const entryName = (entry: SchemeOrderEntry, paint: Paint | null | undefined) =>
  entry.type === "PAINT"
    ? (paint?.name ?? i18n.t("components:paint"))
    : entry.type === "DIVIDER"
      ? dividerLabel(entry.label)
      : i18n.t("components:schemeImage");

// One draggable item in a scheme being edited: a paint, a step or milestone divider whose label
// can be changed, or an example image. Each can be removed except a required milestone, and a
// step only once it holds no paints.
export function SchemeEntryRow({
  entry,
  paint,
  stepHasPaints,
  onChangeLabel,
  onAddPaint,
  onRemove,
}: {
  entry: SchemeOrderEntry;
  // The catalog paint for a paint entry; missing when the catalog no longer has it.
  paint?: Paint | null;
  stepHasPaints: boolean;
  onChangeLabel(patch: Partial<Pick<ColorSchemeDivider, "label" | "tone">>): void;
  onAddPaint(): void;
  onRemove(): void;
}) {
  const { t } = useTranslation("components");
  const name = entryName(entry, paint);
  return (
    <SortableRow
      id={entry.id}
      label={name}
      handleSx={entry.type === "PAINT" ? { color: "var(--ink-faint)" } : { opacity: 0.55 }}
      sx={
        entry.type === "DIVIDER"
          ? entry.tone === "MILESTONE"
            ? { bgcolor: "var(--brand)", color: "var(--brand-fg)" }
            : { bgcolor: "var(--sunken)", color: "#fff" }
          : undefined
      }
      nested={entry.type === "PAINT"}
    >
      {entry.type === "PAINT" && paint ? (
        <>
          <PaintBottle paint={paint} size="sm" />
          <Box component="span" sx={{ minWidth: 0, flex: "1" }}>
            <Box
              component="b"
              sx={{ display: "block", ...truncateSx, fontSize: "0.875rem", lineHeight: 10 / 7 }}
            >
              {paint.name}
            </Box>
            <Box component="small" sx={{ display: "block", ...truncateSx, color: "var(--ink-faint)" }}>
              {paint.brand} · {paint.range}
            </Box>
          </Box>
        </>
      ) : entry.type === "DIVIDER" ? (
        isRequiredMilestone(entry) ? (
          <RequiredMilestone label={entry.label} />
        ) : (
          <>
            <TextField
              select
              size="small"
              label={entry.tone === "SECTION" ? t("paintStep") : t("milestone")}
              value={entry.label}
              onChange={(e) => onChangeLabel({ label: e.target.value })}
              sx={{
                minWidth: 130,
                flex: "1 1 130px",
                // The row's own text color (white on a step, brand-fg on a milestone) keeps the
                // label, value and outline readable on its colored background.
                "& .MuiInputLabel-root, & .MuiInputLabel-root.Mui-focused, & .MuiSelect-select, & .MuiSelect-icon":
                  {
                    color: "inherit",
                  },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "color-mix(in oklab, currentColor 45%, transparent)",
                },
              }}
            >
              {!dividerOptions(entry.tone).includes(entry.label) && (
                <MenuItem value={entry.label}>
                  {t("existingDividerLabel", { label: dividerLabel(entry.label) })}
                </MenuItem>
              )}
              {dividerOptions(entry.tone).map((label) => (
                <MenuItem key={label} value={label}>
                  {dividerLabel(label)}
                </MenuItem>
              ))}
            </TextField>
            {entry.tone === "SECTION" && (
              <Button size="small" variant="outlined" onClick={onAddPaint}>
                {t("addPaint")}
              </Button>
            )}
          </>
        )
      ) : entry.type === "IMAGE" ? (
        <>
          <Box
            component="img"
            src={imageUrl(entry.thumbnailUrl || entry.imageUrl)}
            alt={t("schemeExample")}
            sx={{
              height: "6rem",
              width: "7rem",
              flexShrink: 0,
              borderRadius: "0.75rem",
              bgcolor: "#fff",
              objectFit: "contain",
            }}
          />
          <Box component="span" sx={{ minWidth: 0, flex: "1" }}>
            <Box component="b" sx={{ display: "block", fontSize: "0.875rem", lineHeight: 10 / 7 }}>
              {entry.imageType
                ? t("schemeImageTypeReadyImage", { type: entry.imageType })
                : t("schemeImage2")}
            </Box>
            <Box component="small" sx={{ display: "block", ...truncateSx, color: "var(--ink-faint)" }}>
              {entry.method ? `${entry.method} · ` : ""}
              {entry.imageUrl}
            </Box>
          </Box>
        </>
      ) : (
        <Box component="span" sx={{ ...labelSx, color: "var(--rust)" }}>
          {t("paintUnavailable")}
        </Box>
      )}
      {!isRequiredMilestone(entry) && (
        <IconButton
          size="small"
          disabled={entry.type === "DIVIDER" && entry.tone === "SECTION" && stepHasPaints}
          onClick={onRemove}
          aria-label={
            entry.type === "DIVIDER"
              ? entry.tone === "SECTION"
                ? t("removeNamedStep", { label: dividerLabel(entry.label) })
                : t("removeNamedMilestone", { label: dividerLabel(entry.label) })
              : t("removeNamedItem", { name })
          }
          sx={[{ boxSizing: "border-box" }, entry.type === "DIVIDER" && { color: "currentcolor !important" }]}
        >
          <X size={15} />
        </IconButton>
      )}
    </SortableRow>
  );
}
