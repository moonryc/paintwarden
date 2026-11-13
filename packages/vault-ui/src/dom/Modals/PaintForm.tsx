import { Button, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useState } from "react";

import { ColorHexField } from "../Components/ColorHexField";
import { Modal } from "../Components/Modal";
import { Save, Trash2 } from "../icons";
import { up } from "../theme-tokens";
import type { Paint } from "../types";

export type PaintFormValues = Pick<Paint, "brand" | "range" | "name" | "colorHex" | "sourceUrl">;

// Adds a custom paint, or edits one when given `paint`. Editing also offers Delete, which asks
// for a second click before it removes the paint.
export function PaintForm({
  paint,
  onClose,
  onSave,
  onDelete,
}: {
  paint?: Paint;
  onClose(): void;
  onSave(values: PaintFormValues): Promise<void>;
  // Required when editing.
  onDelete?(): Promise<void>;
}) {
  const [values, setValues] = useState({
      brand: paint?.brand ?? "",
      range: paint?.range ?? "Other",
      name: paint?.name ?? "",
      colorHex: paint?.colorHex ?? "",
      sourceUrl: paint?.sourceUrl ?? "",
    }),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const field = (key: keyof typeof values, label: string, required = false) => (
    <TextField
      required={required}
      fullWidth
      label={label}
      value={values[key]}
      onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))}
    />
  );
  const valid = !!values.brand.trim() && !!values.name.trim();
  const saveButton = (
    <Button
      type="submit"
      size={paint ? "large" : undefined}
      variant="contained"
      loading={busy}
      disabled={!valid}
      startIcon={<Save size={15} />}
      fullWidth
    >
      Save
    </Button>
  );
  return (
    <Modal
      title={paint ? "Edit custom paint" : "Add paint"}
      subtitle={
        paint
          ? "Update imported catalog details or remove this custom entry."
          : "Add a custom color to your paint library."
      }
      onClose={onClose}
    >
      <Box
        component="form"
        sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid) return;
          setBusy(true);
          try {
            await onSave({
              brand: values.brand.trim(),
              range: values.range.trim() || "Other",
              name: values.name.trim(),
              colorHex: values.colorHex.trim() || null,
              sourceUrl: values.sourceUrl.trim() || null,
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            [up.sm]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {field("brand", "Brand", true)}
          {field("range", "Range / type")}
        </Box>
        {field("name", "Paint name", true)}
        <ColorHexField
          value={values.colorHex}
          onChange={(colorHex) => setValues((current) => ({ ...current, colorHex }))}
        />
        {field("sourceUrl", "Product page URL")}
        {paint && onDelete ? (
          <Box
            sx={{
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 1.5,
              borderTop: "1px solid var(--line)",
              pt: 2.5,
            }}
          >
            <Button
              size="large"
              variant={confirmDelete ? "contained" : "outlined"}
              color="error"
              startIcon={<Trash2 size={14} />}
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              sx={confirmDelete ? undefined : { color: "var(--rust)" }}
            >
              {confirmDelete ? "Confirm delete" : "Delete"}
            </Button>
            {saveButton}
          </Box>
        ) : (
          saveButton
        )}
      </Box>
    </Modal>
  );
}
