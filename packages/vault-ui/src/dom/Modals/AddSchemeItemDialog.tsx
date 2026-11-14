import { dividerLabel } from "../Components/component-labels";
import { useTranslation } from "react-i18next";
import { Box, Button, MenuItem, TextField } from "@mui/material";
import { RECIPE_STEPS, SCHEME_MILESTONES } from "@paintwarden/core/recipe-steps";
import { useState } from "react";

import { Modal } from "../Components/Modal";
import { PaintAutocomplete } from "../Components/PaintAutocomplete";
import type { DividerTone, Paint } from "../types";

export type SchemeItemKind = "STEP" | "MILESTONE" | "IMAGE" | "PAINT";

// The labels a scheme divider can take: a paint step, or a milestone.
export const dividerOptions = (tone: DividerTone): string[] =>
  tone === "SECTION" ? RECIPE_STEPS.map(([id]) => id) : [...SCHEME_MILESTONES];

// Adds one item to a color scheme being edited: a step or milestone divider, an example image
// by URL, or a paint placed in the step named by stepLabel.
export function AddSchemeItemDialog({
  kind,
  stepLabel,
  excludedIds,
  onAddDivider,
  onAddImage,
  onAddPaint,
  onClose,
}: {
  kind: SchemeItemKind;
  // The step a new paint goes into.
  stepLabel?: string;
  // Paints already in the scheme.
  excludedIds: string[];
  onAddDivider(label: string, tone: DividerTone): void;
  onAddImage(url: string): void;
  onAddPaint(paint: Paint): void;
  onClose(): void;
}) {
  const { t } = useTranslation("components");
  const TITLES: Record<SchemeItemKind, string> = {
    STEP: t("addStep"),
    MILESTONE: t("addMilestone"),
    IMAGE: t("addImage"),
    PAINT: t("addPaint"),
  };
  const divider = kind === "STEP" || kind === "MILESTONE";
  const tone: DividerTone = kind === "MILESTONE" ? "MILESTONE" : "SECTION";
  const [label, setLabel] = useState(dividerOptions(tone)[0]);
  const [imageUrl, setImageUrl] = useState("");
  const [search, setSearch] = useState("");
  const imageValid = imageUrl.trim().startsWith("https://");
  const addImage = () => {
    if (imageValid) onAddImage(imageUrl.trim());
  };
  return (
    <Modal
      title={TITLES[kind]}
      subtitle={
        kind === "PAINT"
          ? stepLabel
            ? t("placePaintInStep", { label: dividerLabel(stepLabel) })
            : t("placePaintInThisStep")
          : t("addAnItemToThisScheme")
      }
      onClose={onClose}
    >
      {divider && (
        <TextField
          select
          fullWidth
          required
          label={kind === "STEP" ? t("paintStep") : t("milestone")}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        >
          {dividerOptions(tone).map((option) => (
            <MenuItem key={option} value={option}>
              {dividerLabel(option)}
            </MenuItem>
          ))}
        </TextField>
      )}
      {kind === "IMAGE" && (
        <TextField
          fullWidth
          required
          label={t("imageUrl")}
          type="url"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addImage();
            }
          }}
          placeholder={t("https")}
        />
      )}
      {kind === "PAINT" && (
        <PaintAutocomplete
          excludedIds={excludedIds}
          query={search}
          onQueryChange={setSearch}
          onChoose={onAddPaint}
        />
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
        <Button onClick={onClose}>{t("cancel")}</Button>
        {divider && (
          <Button variant="contained" disabled={!label.trim()} onClick={() => onAddDivider(label, tone)}>
            {kind === "STEP" ? t("addStep") : t("addMilestone")}
          </Button>
        )}
        {kind === "IMAGE" && (
          <Button variant="contained" disabled={!imageValid} onClick={addImage}>
            {t("addImage")}
          </Button>
        )}
      </Box>
    </Modal>
  );
}
