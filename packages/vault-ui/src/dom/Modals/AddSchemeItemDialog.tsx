import { Box, Button, MenuItem, TextField } from "@mui/material";
import { RECIPE_STEPS, SCHEME_MILESTONES } from "@paint-vault/core/recipe-steps";
import { useState } from "react";

import { Modal } from "../Components/Modal";
import { PaintAutocomplete } from "../Components/PaintAutocomplete";
import type { DividerTone, Paint } from "../types";

export type SchemeItemKind = "STEP" | "MILESTONE" | "IMAGE" | "PAINT";

// The labels a scheme divider can take: a paint step, or a milestone.
export const dividerOptions = (tone: DividerTone): string[] =>
  tone === "SECTION" ? RECIPE_STEPS.map(([id]) => id) : [...SCHEME_MILESTONES];

const TITLES: Record<SchemeItemKind, string> = {
  STEP: "Add step",
  MILESTONE: "Add milestone",
  IMAGE: "Add image",
  PAINT: "Add paint",
};

// Adds one item to a color scheme being edited: a step or milestone divider, an example image
// by URL, or a paint placed in the step named by stepLabel.
export function AddSchemeItemDialog({
  kind,
  stepLabel,
  paints = [],
  excludedIds,
  onAddDivider,
  onAddImage,
  onAddPaint,
  onClose,
}: {
  kind: SchemeItemKind;
  // The step a new paint goes into.
  stepLabel?: string;
  // Legacy story adapter only; production paint options come from Apollo.
  paints?: Paint[];
  // Paints already in the scheme.
  excludedIds: string[];
  onAddDivider(label: string, tone: DividerTone): void;
  onAddImage(url: string): void;
  onAddPaint(paint: Paint): void;
  onClose(): void;
}) {
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
        kind === "PAINT" ? `Place a paint in ${stepLabel ?? "this step"}.` : "Add an item to this scheme."
      }
      onClose={onClose}
    >
      {divider && (
        <TextField
          select
          fullWidth
          required
          label={kind === "STEP" ? "Paint step" : "Milestone"}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        >
          {dividerOptions(tone).map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      )}
      {kind === "IMAGE" && (
        <TextField
          fullWidth
          required
          label="Image URL"
          type="url"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addImage();
            }
          }}
          placeholder="https://…"
        />
      )}
      {kind === "PAINT" && (
        <PaintAutocomplete
          paints={paints}
          excludedIds={excludedIds}
          query={search}
          onQueryChange={setSearch}
          onChoose={onAddPaint}
        />
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        {divider && (
          <Button variant="contained" disabled={!label.trim()} onClick={() => onAddDivider(label, tone)}>
            Add {kind === "STEP" ? "step" : "milestone"}
          </Button>
        )}
        {kind === "IMAGE" && (
          <Button variant="contained" disabled={!imageValid} onClick={addImage}>
            Add image
          </Button>
        )}
      </Box>
    </Modal>
  );
}
