import { Button, ButtonGroup, Menu, MenuItem } from "@mui/material";
import { useState } from "react";

import { ChevronDown, PaintDrop, Palette, Plus } from "../icons";

// The "+ Miniature" split button: the main part adds a miniature, and the arrow opens a menu to
// add a paint or a color scheme.
export function AddMenuButton({
  onAddMiniature,
  onAddPaint,
  onAddScheme,
}: {
  onAddMiniature(): void;
  onAddPaint(): void;
  onAddScheme(): void;
}) {
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const choose = (fn: () => void) => {
    setAddMenuAnchor(null);
    fn();
  };
  return (
    <>
      <ButtonGroup
        variant="contained"
        size="large"
        sx={{
          boxSizing: "border-box",
          marginBottom: "1.25rem",
          display: "flex",
          width: "100%",
          borderRadius: "1rem",
          boxShadow: "none !important",
        }}
        aria-label="Add to vault"
      >
        <Button
          onClick={onAddMiniature}
          startIcon={<Plus size={18} />}

          sx={[
            {
              boxSizing: "border-box",
              justifyContent: "flex-start",
              borderTopLeftRadius: "1rem",
              borderBottomLeftRadius: "1rem",
              paddingInline: "1rem",
            },
            { flex: "1 1 auto" },
          ]}
        >
          Miniature
        </Button>
        <Button
          onClick={(event) => setAddMenuAnchor(event.currentTarget)}
          aria-label="More add options"
          aria-haspopup="menu"
          aria-expanded={!!addMenuAnchor}

          sx={[
            {
              boxSizing: "border-box",
              borderTopRightRadius: "1rem",
              borderBottomRightRadius: "1rem",
              paddingInline: 0,
            },
            {
              flex: "0 0 48px",
              width: 48,
              minWidth: 48,
              maxWidth: 48,
            },
          ]}
        >
          <ChevronDown size={18} />
        </Button>
      </ButtonGroup>
      <Menu
        anchorEl={addMenuAnchor}
        open={!!addMenuAnchor}
        onClose={() => setAddMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              boxSizing: "border-box",
              marginTop: "0.25rem",
              minWidth: "12rem",
              borderRadius: "1rem",
              borderStyle: "solid",
              borderWidth: "1px",
              borderColor: "var(--line)",
            },
          },
        }}
      >
        <MenuItem
          onClick={() => choose(onAddPaint)}
          sx={{
            boxSizing: "border-box",
            gap: "0.5rem",
          }}
        >
          <PaintDrop size={17} /> Add paint
        </MenuItem>
        <MenuItem
          onClick={() => choose(onAddScheme)}
          sx={{
            boxSizing: "border-box",
            gap: "0.5rem",
          }}
        >
          <Palette size={17} /> Add scheme
        </MenuItem>
      </Menu>
    </>
  );
}
