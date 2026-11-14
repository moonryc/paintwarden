import { useTranslation } from "react-i18next";
import { IconButton } from "@mui/material";
import Box from "@mui/material/Box";

import { Check, Plus } from "../icons";
import type { Paint } from "../types";

import { RoundActionButton } from "./RoundActionButton";

export function OwnedToggle({
  paint,
  owned,
  onToggle,
  unownedAction = "owned",
  unownedIcon = "check",
  resolvedBy,
  size = "lg",
}: {
  paint: Paint;
  owned: boolean;
  onToggle(p: Paint): void;
  unownedAction?: "owned" | "bought";
  unownedIcon?: "check" | "plus";
  resolvedBy?: string;
  // md is a round action button that matches the quantity counter; lg is a larger check circle.
  size?: "md" | "lg";
}) {
  const { t } = useTranslation("components");
  const label = resolvedBy
    ? owned
      ? t("paintAvailableThrough", { name: paint.name, substitution: resolvedBy })
      : t("paintUnavailableThrough", { name: paint.name, substitution: resolvedBy })
    : owned
      ? t("unmarkPaintOwned", { name: paint.name })
      : unownedAction === "bought"
        ? t("markPaintBought", { name: paint.name })
        : t("markPaintOwned", { name: paint.name });
  const title = resolvedBy
    ? owned
      ? t("availableThrough", { substitution: resolvedBy })
      : t("unavailableThrough", { substitution: resolvedBy })
    : owned
      ? t("unmarkAsOwned")
      : unownedAction === "bought"
        ? t("markAsBought")
        : t("markAsOwned");

  if (size === "md") {
    return (
      <RoundActionButton
        label={label}
        title={title}
        tone="ok"
        active={owned}
        disabled={Boolean(resolvedBy)}
        onClick={() => onToggle(paint)}
        size="md"
      >
        {unownedIcon === "plus" && !owned ? <Plus size={15} /> : <Check size={15} />}
      </RoundActionButton>
    );
  }

  return (
    <IconButton
      onClick={(e) => {
        e.stopPropagation();
        onToggle(paint);
      }}
      disabled={Boolean(resolvedBy)}
      aria-label={label}
      title={title}
      aria-pressed={owned}
      sx={[
        {
          boxSizing: "border-box",
          height: "2.75rem",
          width: "2.75rem",
          flexShrink: "0",
        },
        {
          "&.Mui-disabled": { opacity: 1 },
          "&:hover, &.Mui-focusVisible": { bgcolor: owned ? "var(--sunken)" : "var(--ok-soft)" },
          ...(!owned && {
            "&:hover > .MuiBox-root, &.Mui-focusVisible > .MuiBox-root": {
              borderColor: "var(--ok)",
              color: "var(--ok)",
            },
          }),
        },
      ]}
    >
      <Box
        component="span"
        sx={[
          {
            boxSizing: "border-box",
            display: "grid",
            height: "1.75rem",
            width: "1.75rem",
            placeItems: "center",
            borderRadius: "calc(infinity * 1px)",
            borderStyle: "solid",
            borderWidth: "2px",
            transition:
              "border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
          },
          owned
            ? {
                borderColor: "var(--ok)",
                bgcolor: "var(--ok)",
                color: "var(--ok-soft)",
              }
            : unownedIcon === "plus"
              ? {
                  borderColor: "var(--line-strong)",
                  color: "var(--ink-faint)",
                }
              : {
                  borderColor: "var(--line-strong)",
                  color: "transparent",
                },
        ]}
      >
        {unownedIcon === "plus" && !owned ? <Plus size={14} /> : <Check size={14} strokeWidth={3} />}
      </Box>
    </IconButton>
  );
}
