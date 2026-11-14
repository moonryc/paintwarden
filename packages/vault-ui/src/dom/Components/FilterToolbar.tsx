import { useTranslation } from "react-i18next";
import { Card, IconButton, InputAdornment, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import type { ReactNode } from "react";

import { Search, X } from "../icons";
import { breakpoints, up } from "../theme-tokens";

export function FilterToolbar({
  search,
  setSearch,
  placeholder,
  children,
  wideSearch = false,
  singleLineFilters = false,
}: {
  search: string;
  setSearch(v: string): void;
  placeholder: string;
  children: ReactNode;
  wideSearch?: boolean;
  singleLineFilters?: boolean;
}) {
  const { t } = useTranslation(["components", "common"]);
  return (
    <Card
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
          },
          [up.lg]: {
            top: "4.5rem",
            flexDirection: "row",
            alignItems: "center",
            gap: 1.5,
          },
          boxShadow: "0 1px 2px rgb(var(--shadow-color) / 6%), 0 1px 1px rgb(var(--shadow-color) / 4%)",
        },
        singleLineFilters
          ? {
              [`${up.lg} and (max-width: ${breakpoints.xl - 0.05}px)`]: {
                flexDirection: "column",
                alignItems: "stretch",
              },
            }
          : {},
      ]}
    >
      <TextField
        fullWidth
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(event) => {
          // Escape clears a typed search; an empty field lets the key reach parent handlers.
          if (event.key !== "Escape" || !search) return;
          event.preventDefault();
          event.stopPropagation();
          setSearch("");
        }}
        placeholder={t("common:search")}
        size="small"
        sx={
          singleLineFilters
            ? {
                minWidth: 0,
                maxWidth: "none",
                [up.xl]: { width: "26%", flex: "0 0 26%" },
              }
            : wideSearch
              ? { minWidth: 0, [up.lg]: { width: "auto", flex: "1 1 0" } }
              : {
                  boxSizing: "border-box",
                  [up.lg]: {
                    maxWidth: "24rem !important",
                  },
                }
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
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  edge="end"
                  onClick={() => setSearch("")}
                  aria-label={t("clearSearch")}
                >
                  <X size={15} />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
      />
      <Box
        component="div"
        sx={
          singleLineFilters
            ? { minWidth: 0, width: "100%", [up.xl]: { width: "auto", flex: "1 1 0" } }
            : wideSearch
              ? {
                  minWidth: 0,
                  width: "100%",
                  [up.lg]: { width: 224, flex: "0 0 224px" },
                }
              : {
                  minWidth: 0,
                  flex: "1",
                }
        }
      >
        {children}
      </Box>
    </Card>
  );
}
