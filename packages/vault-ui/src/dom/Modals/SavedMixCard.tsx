import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { Button, Card, IconButton } from "@mui/material";
import Box from "@mui/material/Box";

import { Trash2 } from "../icons";
import { useVault } from "../store/hooks";
import type { Paint, State } from "../types";
import { paintGradient } from "../utils/paint-gradient";
import { truncateSx } from "../utils/truncate";

type Mix = State["paintSubstitutions"][number];

// A saved substitution mix for a paint: its blended swatch, name and parts, a button to make it
// (or stop it being) the paint's default, and Delete.
export function SavedMixCard({
  mix,
  onToggleDefault,
  onDelete,
}: {
  mix: Mix;
  onToggleDefault(): void;
  onDelete(): void;
}) {
  const data = useVault();
  const rows = data.paintSubstitutionIngredients
    .filter((row) => row.substitutionId === mix.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const ingredientPaints = rows
    .map((row) => data.catalog.find((item) => item.id === row.paintId))
    .filter(Boolean) as Paint[];
  return (
    <Card
      sx={{
        boxSizing: "border-box",
        p: 1.5,
      }}
    >
      <Box
        component="div"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <SubstitutionSwatch paints={ingredientPaints} />
        <Box
          component="div"
          sx={{
            minWidth: 0,
            flex: "1",
          }}
        >
          <Box
            component="b"
            sx={{
              display: "block",
              ...truncateSx,
              fontSize: "0.875rem",
              lineHeight: 10 / 7,
            }}
          >
            {mix.name}
          </Box>
          <Box
            component="p"
            sx={{
              m: 0,
              mt: 0.5,
              fontSize: "0.75rem",
              lineHeight: 4 / 3,
              color: "var(--ink-faint)",
            }}
          >
            {rows
              .map(
                (row) =>
                  `${row.parts}× ${data.catalog.find((item) => item.id === row.paintId)?.name ?? "Unknown"}`,
              )
              .join(" + ")}
          </Box>
        </Box>
        <Button size="small" variant={mix.isDefault ? "contained" : "outlined"} onClick={onToggleDefault}>
          {mix.isDefault ? "Default" : "Make default"}
        </Button>
        <IconButton size="small" color="error" onClick={onDelete} aria-label={`Delete ${mix.name}`}>
          <Trash2 size={15} />
        </IconButton>
      </Box>
    </Card>
  );
}

// The swatch for a mix: its paints blended in a gradient, under a flask icon.
function SubstitutionSwatch({ paints }: { paints: Paint[] }) {
  const colors = paints.map((paint) => paint.colorHex || "#777");
  const background = paintGradient(colors) ?? "var(--sunken)";
  return (
    <Box
      component="span"
      sx={{
        boxSizing: "border-box",
        position: "relative",
        display: "grid",
        height: "2.25rem",
        width: "2.25rem",
        flexShrink: 0,
        placeItems: "center",
        overflow: "hidden",
        borderRadius: "0.75rem",
        borderStyle: "solid",
        borderWidth: "1px",
        borderColor: "var(--line-strong)",
        color: "var(--on-scrim)",
        boxShadow: "inset 0 2px 4px 0 rgb(var(--shadow-color) / 0.05)",
      }}
      style={{ background }}
      aria-hidden="true"
    >
      <Box
        component="span"
        sx={{
          position: "absolute",
          inset: 0,
          bgcolor: "color-mix(in oklab, var(--scrim) 20%, transparent)",
        }}
      />
      <ScienceOutlinedIcon
        fontSize="small"
        sx={{
          boxSizing: "border-box",
          position: "relative",
          filter:
            "drop-shadow(0 1px 2px rgb(var(--shadow-color) / 0.1)) drop-shadow( 0 1px 1px rgb(var(--shadow-color) / 0.06))",
        }}
      />
    </Box>
  );
}
