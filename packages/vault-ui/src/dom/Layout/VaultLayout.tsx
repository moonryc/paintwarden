import { Drawer, IconButton, useScrollTrigger } from "@mui/material";
import Box from "@mui/material/Box";
import { i18n } from "@paintwarden/i18n/runtime";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { PageLoadingStatus } from "../Components/PageLoadingStatus";
import { ErrorSurface } from "../Components/QueryErrorNotice";
import { MenuIcon } from "../icons";
import { up } from "../theme-tokens";
import { truncateSx } from "../utils/truncate";

import { AppContent } from "./AppContent";

// The shell and every global notice share the same content column.
export function VaultLayout({
  navigation,
  title,
  status,
  children,
}: {
  navigation: (onClose?: () => void) => ReactNode;
  title: string;
  status?: ReactNode;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    // Include wrapped install notices and safe-area padding, not just the title row.
    // These variables affect sticky/scroll clearance only, never normal-flow geometry.
    const measure = () => {
      if (header.current)
        shell.current?.style.setProperty(
          "--app-header-height",
          `${header.current.getBoundingClientRect().height}px`,
        );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (header.current) observer.observe(header.current);
    return () => observer.disconnect();
  }, []);
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 48 });
  return (
    <Box
      component="div"
      ref={shell}
      sx={{
        "--app-header-row-height": "3.5rem",
        "--app-header-offset":
          "calc(var(--desktop-titlebar-height, 0px) + var(--app-header-height, calc(var(--app-header-row-height) + env(safe-area-inset-top) + 1px)))",
        [up.lg]: { "--app-header-row-height": "4rem" },
        display: "flex",
        minHeight: "calc(100vh - var(--desktop-titlebar-height, 0px))",
      }}
    >
      <Box
        component="aside"
        // The panel scrolls when the window is shorter than it, so its bottom section stays reachable.
        sx={[
          {
            boxSizing: "border-box",
            position: "fixed",
            top: "var(--desktop-titlebar-height, 0px)",
            bottom: 0,
            left: 0,
            zIndex: 40,
            display: "none",
            width: "264px",
            borderRightStyle: "solid",
            borderRightWidth: "1px",
            borderColor: "var(--line)",
            bgcolor: "var(--surface)",
            [up.lg]: {
              display: "flex",
            },
          },
          { overflowY: "auto", overscrollBehavior: "contain" },
        ]}
      >
        {navigation()}
      </Box>
      {/* Phones and tablets: the same panel in a full-width drawer behind the hamburger. */}
      <Drawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        anchor="left"
        sx={{
          boxSizing: "border-box",
          [up.lg]: {
            display: "none",
          },
        }}
        slotProps={{
          paper: {
            sx: {
              boxSizing: "border-box",
              width: "100%",
              bgcolor: "var(--surface)",
            },
            "aria-label": i18n.t("shell:navigation"),
          },
        }}
      >
        {navigation(() => setNavOpen(false))}
      </Drawer>
      <Box
        component="main"
        sx={{
          minWidth: 0,
          flex: "1",
          [up.lg]: {
            ml: 33,
          },
        }}
      >
        {/* Same bar at every size: the page title docks here once the large title scrolls away. */}
        <Box
          component="header"
          ref={header}
          sx={[
            {
              boxSizing: "border-box",
              position: "sticky",
              top: "var(--desktop-titlebar-height, 0px)",
              zIndex: 20,
              borderBottomStyle: "solid",
              borderBottomWidth: "1px",
              bgcolor: "color-mix(in oklab, var(--canvas) 85%, transparent)",
              paddingTop: "env(safe-area-inset-top)",
              WebkitBackdropFilter: "blur(24px)",
              backdropFilter: "blur(24px)",
              transition: "border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
            },
            scrolled
              ? {
                  borderColor: "var(--line)",
                }
              : {
                  borderColor: "transparent",
                },
          ]}
        >
          <Box
            component="div"
            sx={{
              boxSizing: "border-box",
              marginInline: "auto",
              display: "flex",
              height: "var(--app-header-row-height)",
              maxWidth: "1280px",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
              px: 2,
              [up.md]: {
                px: 4,
              },
              [up.lg]: {
                px: 5,
              },
            }}
          >
            <Box
              component="div"
              sx={{
                display: "flex",
                minWidth: 0,
                alignItems: "center",
                gap: 1.25,
              }}
            >
              <IconButton
                onClick={() => setNavOpen(true)}
                aria-label={i18n.t("shell:openNavigation")}
                aria-expanded={navOpen}
                sx={{
                  boxSizing: "border-box",
                  marginLeft: "-0.5rem",
                  color: "var(--ink) !important",
                  [up.lg]: {
                    display: "none !important",
                  },
                }}
              >
                <MenuIcon size={22} />
              </IconButton>
              <Box
                component="h1"
                sx={[
                  {
                    m: 0,
                    ...truncateSx,
                    fontFamily: "var(--font-serif)",
                    letterSpacing: "-0.02em",
                    fontOpticalSizing: "auto",
                    fontSize: "1.125rem",
                    lineHeight: 14 / 9,
                    fontWeight: 600,
                    transitionProperty: "all",
                    transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
                    transitionDuration: "200ms",
                  },
                  scrolled
                    ? {
                        translate: "0 0",
                        opacity: 1,
                      }
                    : {
                        translate: "0 0.25rem",
                        opacity: 0,
                      },
                ]}
              >
                {title}
              </Box>
            </Box>
          </Box>
          {status}
        </Box>
        <AppContent>
          <ErrorSurface>
            <PageLoadingStatus>{children}</PageLoadingStatus>
          </ErrorSurface>
        </AppContent>
      </Box>
    </Box>
  );
}
