import { useTranslation } from "react-i18next";
import { Card, IconButton, InputAdornment, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import type { ReactNode } from "react";

import { Search, X } from "../icons";
import { up } from "../theme-tokens";

/**
 * Layout for a toolbar's group of select filters: stacked on phones, one row of equal columns
 * from tablet width up, so filters are either all stacked or all side by side.
 */
export const filterGridSx = {
  display: "grid",
  minWidth: 0,
  gap: 1,
  gridTemplateColumns: "minmax(0, 1fr)",
  [up.md]: { gridTemplateColumns: "none", gridAutoFlow: "column", gridAutoColumns: "minmax(0, 1fr)" },
} as const;

export function FilterToolbar({
  search,
  setSearch,
  placeholder,
  children,
  wideSearch = false,
  singleLineFilters = false,
  disabled = false,
}: {
  search: string;
  setSearch(v: string): void;
  placeholder: string;
  children: ReactNode;
  wideSearch?: boolean;
  singleLineFilters?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation(["components", "common"]);
  return (
    <Card
      data-filter-toolbar
      sx={[
        {
          boxSizing: "border-box",
          position: "sticky",
          top: "calc(3.5rem + env(safe-area-inset-top) + .5rem)",
          zIndex: 10,
          mb: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          borderRadius: "1rem",
          p: 1,
          [up.md]: {
            mb: 2.5,
            flexDirection: "row",
            alignItems: "center",
            gap: 1.5,
          },
          [up.lg]: {
            top: "4.5rem",
          },
          boxShadow: "0 1px 2px rgb(var(--shadow-color) / 6%), 0 1px 1px rgb(var(--shadow-color) / 4%)",
        },
      ]}
    >
      <TextField
        fullWidth
        disabled={disabled}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(event) => {
          // Escape clears a typed search; an empty field lets the key reach parent handlers.
          if (event.key !== "Escape" || !search) return;
          event.preventDefault();
          event.stopPropagation();
          setSearch("");
        }}
        placeholder={disabled ? t("loading") : t("common:search")}
        size="small"
        sx={
          singleLineFilters
            ? { minWidth: 0, [up.md]: { flex: "2 1 0" } }
            : wideSearch
              ? { minWidth: 0, [up.md]: { width: "auto", flex: "1 1 0" } }
              : { minWidth: 0, [up.md]: { flex: "1 1 0" } }
        }
        slotProps={{
          htmlInput: { "aria-label": placeholder, title: placeholder },
          input: {
            sx: {
              backgroundColor: "color-mix(in oklab, var(--sunken) 60%, transparent) !important",
              "& fieldset": { borderColor: "transparent !important" },
            },
            startAdornment: (
              <InputAdornment position="start">
                <Search size={17} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end" sx={{ width: 28, visibility: search ? "visible" : "hidden" }}>
                <IconButton
                  disabled={disabled}
                  size="small"
                  edge="end"
                  onClick={() => setSearch("")}
                  aria-label={t("clearSearch")}
                  tabIndex={search ? 0 : -1}
                >
                  <X size={15} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Box
        component="div"
        sx={
          singleLineFilters
            ? { minWidth: 0, width: "100%", [up.md]: { width: "auto", flex: "3 1 0" } }
            : wideSearch
              ? { minWidth: 0, width: "100%", [up.md]: { width: 224, flex: "0 0 224px" } }
              : { minWidth: 0, width: "100%", [up.md]: { width: "auto", flex: "1 1 0" } }
        }
      >
        {children}
      </Box>
    </Card>
  );
}
