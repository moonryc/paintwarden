import CoffeeOutlinedIcon from "@mui/icons-material/CoffeeOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  ButtonBase,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
} from "@mui/material";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";

import { formatNumber } from "../i18n";
import { Settings, X } from "../icons";
import type { Tab } from "../types";
import { linkResetSx } from "../utils/element-resets";
import { buzz } from "../utils/misc";
import { truncateSx } from "../utils/truncate";

import { AddMenuButton } from "./AddMenuButton";
import { BrandMark } from "./BrandMark";
import { NAV_SECTIONS } from "./nav-items";
import { UserAvatar } from "./UserAvatar";

export function NavPanel({
  tab,
  go,
  counts,
  displayName,
  onAddMiniature,
  onAddPaint,
  onAddScheme,
  onAccount,
  onClose,
}: {
  tab: Tab;
  go(t: Tab): void;
  counts: Partial<Record<Tab, number>>;
  displayName: string;
  onAddMiniature(): void;
  onAddPaint(): void;
  onAddScheme(): void;
  onAccount(): void;
  onClose?(): void;
}) {
  const { t } = useTranslation("pages");
  const then = (fn: () => void) => () => {
    onClose?.();
    fn();
  };
  const chooseAddAction = (fn: () => void) => {
    onClose?.();
    fn();
  };
  return (
    <Box
      component="div"
      sx={{
        boxSizing: "border-box",
        display: "flex",
        minHeight: "100%",
        width: "100%",
        flexDirection: "column",
        px: 2,
        paddingTop: "calc(1.25rem + env(safe-area-inset-top))",
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
      }}
    >
      <Box
        component="div"
        sx={{
          mb: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <ButtonBase
          sx={{
            boxSizing: "border-box",
            justifyContent: "flex-start",
            gap: "0.75rem",
            borderRadius: "16px",
            padding: "0.25rem",
            textAlign: "left",
          }}
          onClick={then(() => go("dashboard"))}
        >
          <BrandMark />
          <span>
            <Box
              component="span"
              sx={{
                display: "block",
                fontFamily: "var(--font-serif)",
                letterSpacing: "-0.02em",
                fontOpticalSizing: "auto",
                fontSize: "1.125rem",
                lineHeight: 1,
                fontWeight: 600,
              }}
            >
              {t("layoutBrand")}
            </Box>
            <Box
              component="span"
              sx={{
                mt: 0.5,
                display: "block",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: ".18em",
                color: "var(--ink-faint)",
                textTransform: "uppercase",
              }}
            >
              {t("layoutStudio")}
            </Box>
          </span>
        </ButtonBase>
        {onClose && (
          <IconButton
            onClick={onClose}
            aria-label={t("layoutCloseNavigation")}
            sx={{
              boxSizing: "border-box",
              borderRadius: "calc(infinity * 1px)",
              borderStyle: "solid",
              borderWidth: "1px",
              borderColor: "var(--line) !important",
              bgcolor: "var(--surface-raised) !important",
            }}
          >
            <X size={18} />
          </IconButton>
        )}
      </Box>
      {tab !== "dashboard" && tab !== "miniatures" && tab !== "templates" && (
        <AddMenuButton
          onAddMiniature={then(onAddMiniature)}
          onAddPaint={() => chooseAddAction(onAddPaint)}
          onAddScheme={() => chooseAddAction(onAddScheme)}
        />
      )}
      <Box
        component="nav"
        aria-label={t("layoutPrimary")}
        sx={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        {NAV_SECTIONS.map((section, index) => (
          <List
            key={section.label ?? index}
            disablePadding
            aria-label={section.label ? t(section.label) : undefined}
            subheader={
              section.label ? (
                <ListSubheader
                  disableSticky
                  sx={{
                    boxSizing: "border-box",
                    bgcolor: "transparent",
                    paddingInline: "1rem",
                    paddingTop: "0.75rem",
                    paddingBottom: "0.25rem",
                    fontSize: 11,
                    fontWeight: "600",
                    lineHeight: 1,
                    letterSpacing: ".14em",
                    color: "var(--ink-faint)",
                    textTransform: "uppercase",
                  }}
                >
                  {t(section.label)}
                </ListSubheader>
              ) : undefined
            }
            sx={{ display: "flex", flexDirection: "column", gap: "4px" }}
          >
            {section.items.map(([key, Icon, label]) => {
              const count = counts[key];
              return (
                <ListItem key={key} disablePadding>
                  <ListItemButton
                    selected={tab === key}
                    onClick={then(() => {
                      buzz();
                      go(key);
                    })}
                    aria-current={tab === key ? "page" : undefined}
                    sx={[
                      {
                        boxSizing: "border-box",
                        borderRadius: "calc(infinity * 1px)",
                        paddingLeft: "1rem",
                      },
                      onClose
                        ? {
                            paddingBlock: "0.75rem",
                          }
                        : {
                            paddingBlock: "0.5rem",
                          },
                    ]}
                  >
                    <ListItemIcon>
                      <Icon size={onClose ? 20 : 18} />
                    </ListItemIcon>
                    <ListItemText
                      primary={t(label)}
                      slotProps={{
                        primary: {
                          sx: [
                            {
                              boxSizing: "border-box",
                            },
                            onClose
                              ? {
                                  fontSize: "1rem",
                                  lineHeight: "1.5",
                                  fontWeight: "600",
                                }
                              : {
                                  fontSize: "0.875rem",
                                  lineHeight: "calc(10 / 7)",
                                  fontWeight: "600",
                                },
                          ],
                        },
                      }}
                    />
                    {count ? (
                      <Box
                        component="span"
                        sx={[
                          {
                            boxSizing: "border-box",
                            minWidth: "1.5rem",
                            borderRadius: "calc(infinity * 1px)",
                            px: 1,
                            py: 0.25,
                            textAlign: "center",
                            fontSize: "11px",
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                          },
                          key === "wishlist"
                            ? false
                            : tab === key
                              ? {
                                  bgcolor: "color-mix(in oklab, var(--surface) 70%, transparent)",
                                }
                              : {
                                  bgcolor: "var(--sunken)",
                                  color: "var(--ink-faint)",
                                },
                          key === "wishlist"
                            ? {
                                bgcolor: "var(--wishlist-soft)",
                                color: "var(--wishlist)",
                              }
                            : {},
                        ]}
                      >
                        {formatNumber(count)}
                      </Box>
                    ) : null}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        ))}
      </Box>
      <Box
        component="div"
        sx={{
          boxSizing: "border-box",
          marginTop: "auto",
          "& > :where(:not(:last-child))": { mb: 1.5 },
          pt: 3,
        }}
      >
        <Box
          component="a"
          href="https://ko-fi.com/moonryc"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            ...linkResetSx,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            borderRadius: "1rem",
            borderStyle: "solid",
            borderWidth: "1px",
            borderColor: "var(--line)",
            bgcolor: "color-mix(in oklab, var(--sunken) 60%, transparent)",
            p: 2,
            textAlign: "left",
            "&:hover": {
              "@media (hover: hover)": {
                bgcolor: "var(--sunken)",
              },
            },
            "&:focus-visible": {
              outline: "2px solid var(--gold)",
              outlineOffset: "2px",
              borderRadius: "6px",
              outlineStyle: "solid",
              outlineWidth: "2px",
              outlineColor: "var(--brand)",
            },
          }}
        >
          <CoffeeOutlinedIcon
            sx={{
              boxSizing: "border-box",
              flexShrink: 0,
              color: "var(--brand)",
            }}
            fontSize="small"
          />
          <Box
            component="span"
            sx={{
              minWidth: 0,
              flex: "1",
            }}
          >
            <Box
              component="span"
              sx={{
                display: "block",
                fontSize: "0.875rem",
                lineHeight: 10 / 7,
                fontWeight: 600,
                whiteSpace: "normal",
                color: "var(--ink)",
              }}
            >
              {t("layoutSupport")}
            </Box>
            <Box
              component="span"
              sx={{
                display: "block",
                fontSize: "0.75rem",
                lineHeight: 4 / 3,
                whiteSpace: "normal",
                color: "var(--ink-soft)",
              }}
            >
              {t("layoutCoffee")}
            </Box>
          </Box>
          <OpenInNewIcon
            sx={[
              {
                boxSizing: "border-box",
                flexShrink: 0,
                color: "var(--ink-faint)",
              },
              { fontSize: 16 },
            ]}
          />
        </Box>
        <ButtonBase
          onClick={then(onAccount)}
          sx={{
            boxSizing: "border-box",
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: "0.75rem",
            borderRadius: "1rem",
            borderStyle: "solid",
            borderWidth: "1px",
            borderColor: "var(--line) !important",
            padding: "0.625rem",
            textAlign: "left",
            "&:hover": {
              "@media (hover: hover)": {
                bgcolor: "var(--sunken) !important",
              },
            },
          }}
        >
          <UserAvatar name={displayName} />
          <Box
            component="span"
            sx={{
              minWidth: 0,
              flex: "1",
            }}
          >
            <Box
              component="span"
              sx={{
                display: "block",
                ...truncateSx,
                fontSize: "0.875rem",
                lineHeight: 10 / 7,
                fontWeight: 600,
              }}
            >
              {displayName}
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: "0.75rem",
                lineHeight: 4 / 3,
                color: "var(--ink-faint)",
              }}
            >
              {t("layoutSettings")}
            </Box>
          </Box>
          <Settings size={16} style={{ color: "var(--ink-faint)" }} />
        </ButtonBase>
      </Box>
    </Box>
  );
}
