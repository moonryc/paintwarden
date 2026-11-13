import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { Alert, Button, Chip, ToggleButton, ToggleButtonGroup } from "@mui/material";
import Box from "@mui/material/Box";
import { defaultSubstitution, isPaintAvailable } from "@paint-vault/core/paint-substitutions";
import type { ReactNode } from "react";
import { useState } from "react";

import { Modal } from "../Components/Modal";
import { PluginChip } from "../Components/PluginChip";
import { QuantityCounter } from "../Components/QuantityCounter";
import { Check, ExternalLink, Heart, Minus, Pencil } from "../icons";
import { useVault, useVaultStore } from "../store/hooks";
import type { Paint, PaintStatus } from "../types";
import { effectiveRequirements, owns } from "../utils/vault-data";

import { SubstitutionDialog } from "./SubstitutionDialog";

export function PaintDetailsModal({
  paint,
  onClose,
  openMini,
  onEdit,
}: {
  paint: Paint;
  onClose(): void;
  openMini(id: string): void;
  onEdit(): void;
}) {
  const data = useVault();
  const setPaintState = useVaultStore((s) => s.setPaintState);
  const [showSubstitutions, setShowSubstitutions] = useState(false);
  const rec = data.paintRecords[paint.id],
    state = owns(rec) ? "OWNED" : rec?.state === "WISHLIST" ? "WISHLIST" : null;
  const activeSubstitution = defaultSubstitution(data, paint.id);
  const available = isPaintAvailable(data, data.paintRecords, paint.id);
  const usedBy = data.miniatures.filter((m) =>
    effectiveRequirements(data, m.id).some((r) => r.paintId === paint.id),
  );
  const options: [
    PaintStatus | "UNTRACKED",
    string,
    ReactNode,
    { bgcolor: string; color: string } | undefined,
  ][] = [
    [
      "OWNED",
      "Owned",
      <Check key="o" size={18} strokeWidth={3} />,
      { bgcolor: "var(--ok-soft)", color: "var(--ok)" },
    ],
    [
      "WISHLIST",
      "Wishlist",
      <Heart key="w" size={18} />,
      { bgcolor: "var(--rust-soft)", color: "var(--rust)" },
    ],
    ["UNTRACKED", "Not owned", <Minus key="u" size={18} />, undefined],
  ];
  return (
    <Modal
      title={paint.name}
      subtitle={`${paint.brand} · ${paint.range}`}
      badge={
        paint.sourceName ? <PluginChip name={paint.sourceName} logoUrl={paint.sourceLogoUrl} /> : undefined
      }
      onClose={onClose}
    >
      <Box
        component="div"
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
      >
        <Box
          component="div"
          sx={{
            boxSizing: "border-box",
            position: "relative",
            height: "7rem",
            overflow: "hidden",
            borderRadius: "1rem",
            borderStyle: "solid",
            borderWidth: "1px",
            borderColor: "var(--line)",
          }}
          style={{
            background: paint.colorHex
              ? `linear-gradient(135deg, ${paint.colorHex}, color-mix(in oklab, ${paint.colorHex} 70%, black))`
              : "var(--sunken)",
          }}
        >
          {paint.colorHex && (
            <Box
              component="span"
              sx={{
                boxSizing: "border-box",
                position: "absolute",
                bottom: "0.5rem",
                left: "0.75rem",
                borderRadius: "10px",
                bgcolor: "color-mix(in oklab, var(--scrim) 35%, transparent)",
                px: 1,
                py: 0.25,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: "11px",
                color: "var(--on-scrim)",
                WebkitBackdropFilter: "blur(8px)",
                backdropFilter: "blur(8px)",
              }}
            >
              {paint.colorHex}
            </Box>
          )}
        </Box>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={state ?? "UNTRACKED"}
          onChange={(_, v: PaintStatus | "UNTRACKED" | null) => {
            if (!v) return;
            setPaintState(
              paint.id,
              v === "UNTRACKED" ? null : v,
              v === "OWNED" ? "FULL" : (rec?.stockLevel ?? "FULL"),
              v === "OWNED" ? Math.max(1, rec?.quantity ?? 0) : undefined,
            );
          }}
          aria-label={`State for ${paint.name}`}
        >
          {options.map(([key, label, icon, active]) => (
            <ToggleButton
              key={key}
              value={key}
              sx={[
                {
                  boxSizing: "border-box",
                  flexDirection: "column",
                  gap: "0.25rem",
                  fontSize: "0.75rem",
                  lineHeight: "calc(4 / 3)",
                },
                // The group marks the current state selected.
                active ? { "&.Mui-selected, &.Mui-selected:hover": active } : false,
              ]}
            >
              {icon}
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {activeSubstitution && (
          <Alert severity={available ? "success" : "warning"} variant="outlined">
            {available
              ? `Available through ${activeSubstitution.name}. All substitution paints are on hand.`
              : `${activeSubstitution.name} is active, but at least one substitution paint is missing.`}
          </Alert>
        )}
        {state === "OWNED" && rec && (
          <Box
            component="div"
            sx={{
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: "1rem",
              borderStyle: "solid",
              borderWidth: "1px",
              borderColor: "var(--line)",
              bgcolor: "var(--surface-raised)",
              p: 1.5,
              pl: 2,
            }}
          >
            <span>
              <Box
                component="b"
                sx={{
                  display: "block",
                  fontSize: "0.875rem",
                  lineHeight: 10 / 7,
                }}
              >
                Bottles on hand
              </Box>
              <Box
                component="small"
                sx={{
                  color: "var(--ink-faint)",
                }}
              >
                {rec.stockLevel === "LOW" ? "Running low" : "In stock"}
              </Box>
            </span>
            <QuantityCounter
              name={paint.name}
              value={rec.quantity}
              onChange={(quantity) =>
                setPaintState(paint.id, quantity === 0 ? null : "OWNED", "FULL", quantity)
              }
            />
          </Box>
        )}
        {/* All actions share one row of equal-width buttons; they stack on phones. */}
        <Box
          component="div"
          sx={{ display: "grid", gap: 1, gridAutoFlow: { sm: "column" }, gridAutoColumns: { sm: "1fr" } }}
        >
          <Button
            variant="outlined"
            startIcon={<ScienceOutlinedIcon fontSize="small" />}
            onClick={() => setShowSubstitutions(true)}
            sx={{
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            Paint substitutions (
            {data.paintSubstitutions.filter((row) => row.targetPaintId === paint.id).length})
          </Button>
          {paint.sourceUrl && (
            <Button
              variant="outlined"
              href={paint.sourceUrl}
              target="_blank"
              rel="noreferrer"
              startIcon={<ExternalLink size={15} />}
              sx={{
                boxSizing: "border-box",
                width: "100%",
              }}
            >
              Product page
            </Button>
          )}
          {paint.isCustom && (
            <Button
              variant="outlined"
              onClick={onEdit}
              startIcon={<Pencil size={15} />}
              sx={{
                boxSizing: "border-box",
                width: "100%",
              }}
            >
              Edit paint
            </Button>
          )}
        </Box>
        <Box
          component="div"
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <Box
            component="p"
            sx={{
              m: 0,
              mb: 0.7,
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Used in
          </Box>
          {usedBy.length ? (
            <Box
              component="div"
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              {usedBy.map((m) => (
                <Chip
                  key={m.id}
                  clickable
                  label={m.title}
                  onClick={() => openMini(m.id)}
                  sx={{
                    boxSizing: "border-box",
                    height: "2.25rem",
                    bgcolor: "var(--sunken) !important",
                  }}
                />
              ))}
            </Box>
          ) : (
            <Box
              component="p"
              sx={{
                m: 0,
                fontSize: "0.875rem",
                lineHeight: 10 / 7,
                color: "var(--ink-faint)",
              }}
            >
              Not part of any project recipe yet.
            </Box>
          )}
        </Box>
      </Box>
      {showSubstitutions && <SubstitutionDialog paint={paint} onClose={() => setShowSubstitutions(false)} />}
    </Modal>
  );
}
