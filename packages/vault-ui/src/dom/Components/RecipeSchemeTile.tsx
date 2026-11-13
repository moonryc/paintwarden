import { ButtonBase, Card } from "@mui/material";
import Box from "@mui/material/Box";

import { X } from "../icons";
import { useVault } from "../store/hooks";
import { schemeOrderEntries } from "../utils/scheme-order";
import { truncateSx } from "../utils/truncate";
import { visuallyHiddenSx } from "../utils/visually-hidden";

import { SchemeSwatch } from "./SchemeSwatch";

// Edit mode keeps the tile's size and swatch so the layout doesn't jump. The sizing and
// typography are explicit because the edit tile is a div, not a button, and would otherwise use
// content-box sizing and the page's taller line height.
const tileSx = {
  boxSizing: "border-box",
  fontFamily: "inherit",
  fontSize: 12,
  lineHeight: 1.3,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 0.75,
  width: "100%",
  minHeight: 116,
  px: 1,
  py: 1.5,
  textAlign: "center",
} as const;

// A color scheme attached to a project's recipe: its swatch, name and paint count. It opens the
// scheme, or in edit mode carries a badge that removes it from the miniature.
export function RecipeSchemeTile({
  scheme,
  editMode,
  onOpen,
  onRemove,
}: {
  scheme: { id: string; name: string };
  editMode: boolean;
  onOpen(): void;
  onRemove(): void;
}) {
  const data = useVault();
  const paintCount = schemeOrderEntries(data, scheme.id).filter((entry) => entry.type === "PAINT").length;
  const content = (
    <>
      <SchemeSwatch schemeId={scheme.id} size="lg" />
      <Box component="span" sx={{ width: "100%", minWidth: 0 }}>
        <Box
          component="span"
          sx={{ display: "block", ...truncateSx, fontSize: 12, fontWeight: 700 }}
          title={scheme.name}
        >
          {scheme.name}
        </Box>
        <Box component="span" sx={{ display: "block", fontSize: 12, color: "var(--ink-faint)" }}>
          {paintCount} paint{paintCount === 1 ? "" : "s"}
        </Box>
      </Box>
    </>
  );
  return (
    <Card
      sx={{
        position: "relative",
        overflow: editMode ? "visible" : "hidden",
        borderColor: editMode ? "var(--line-strong)" : undefined,
        transition: "border-color .15s",
        "&:has(.scheme-remove:hover), &:has(.scheme-remove:focus-visible)": {
          borderColor: "var(--rust)",
        },
      }}
    >
      {editMode ? (
        <>
          <Box component="div" sx={tileSx}>
            {content}
          </Box>
          {/* A corner badge marks the tile as removable without hiding the scheme's swatch. */}
          <ButtonBase
            className="scheme-remove"
            onClick={onRemove}
            aria-label={`Remove ${scheme.name} from miniature`}
            title="Remove from miniature"
            sx={{
              position: "absolute",
              top: -8,
              right: -8,
              zIndex: 1,
              display: "grid",
              placeItems: "center",
              width: 26,
              height: 26,
              borderRadius: "50%",
              color: "var(--rust)",
              bgcolor: "var(--surface-raised)",
              border: "1px solid color-mix(in oklab, var(--rust) 45%, var(--line))",
              boxShadow: "0 1px 4px rgb(var(--shadow-color) / .25)",
              transition: "background-color .15s, color .15s, transform .15s",
              // Extend the touch target without enlarging the badge.
              "&::before": { content: '""', position: "absolute", inset: -8 },
              "&:hover": { bgcolor: "var(--rust)", color: "var(--surface-raised)", transform: "scale(1.08)" },
              "&:focus-visible": { outline: "2px solid var(--rust)", outlineOffset: 2 },
            }}
          >
            <X size={14} />
          </ButtonBase>
        </>
      ) : (
        <ButtonBase onClick={onOpen} sx={{ ...tileSx, "&:hover": { backgroundColor: "var(--sunken)" } }}>
          {content}
          <Box component="span" sx={visuallyHiddenSx}>
            , open scheme
          </Box>
        </ButtonBase>
      )}
    </Card>
  );
}
