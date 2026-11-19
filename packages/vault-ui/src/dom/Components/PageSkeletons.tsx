import { i18n } from "../i18n";
import { useTranslation } from "react-i18next";
import { Box, Card, Skeleton, useMediaQuery } from "@mui/material";
import type { SkeletonProps, SxProps, Theme } from "@mui/material";
import { createContext, useContext } from "react";

import { visuallyHiddenSx } from "../utils/visually-hidden";

import { PageHeader } from "./PageHeader";

export type SkeletonPage =
  | "home"
  | "miniatures"
  | "paints"
  | "wishlist"
  | "schemes"
  | "templates"
  | "settings"
  | "plugins"
  | "paint-tools"
  | "miniature-detail"
  | "paint-detail";

function pageTitles(): Record<SkeletonPage, string> {
  return {
    home: i18n.t("components:workbench"),
    miniatures: i18n.t("components:miniatures"),
    paints: i18n.t("components:paints"),
    wishlist: i18n.t("components:wishlist"),
    schemes: i18n.t("components:schemes"),
    templates: i18n.t("components:miniatureTemplates"),
    settings: i18n.t("components:dataSettings"),
    plugins: i18n.t("components:plugins"),
    "paint-tools": i18n.t("components:paintTools"),
    "miniature-detail": i18n.t("components:miniatureDetails"),
    "paint-detail": i18n.t("components:paintDetails"),
  };
}

const ReducedMotionContext = createContext(false);
const items = (count: number) => Array.from({ length: count }, (_, index) => index);

function Shape({
  sx,
  ...props
}: Omit<SkeletonProps, "sx"> & { sx?: Exclude<SxProps<Theme>, readonly unknown[]> }) {
  const reducedMotion = useContext(ReducedMotionContext);
  return (
    <Skeleton
      variant="rounded"
      {...props}
      aria-hidden="true"
      animation={reducedMotion ? false : "pulse"}
      sx={[
        {
          transform: "none",
          maxWidth: "100%",
          bgcolor: "var(--sunken)",
          borderRadius: props.variant === "circular" ? "50%" : 1,
        },
        sx ?? {},
      ]}
    />
  );
}

function Lines({ wide = false }: { wide?: boolean }) {
  return (
    <Box sx={{ minWidth: 0, flex: 1, display: "grid", gap: 0.75 }}>
      <Shape width={wide ? "72%" : "56%"} height={16} />
      <Shape width={wide ? "90%" : "38%"} height={12} />
    </Box>
  );
}

// Hidden text measures the real typography/wrapping; only its skeleton is drawn.
function pageBodies(): Partial<Record<SkeletonPage, string>> {
  return {
    home: i18n.t("components:seeWhichProjectsAreReadyToPaintAndWhat"),
    miniatures: i18n.t("components:browseYourOwnedAndWishlistedMiniatures"),
    paints: i18n.t("components:paintsAvailablePaintsOnYourWishlistColorsInThe"),
    wishlist: i18n.t("components:paintsToBuyForYourProjectsTickOneOff"),
    schemes: i18n.t("components:orderedGroupsOfPaintsYouCanAddToAny"),
    templates: i18n.t("components:browseTemplatesFromYourCatalogSourcesOrSaveA"),
    settings: i18n.t("components:manageYourVaultAccountAndBackups"),
    "paint-tools": i18n.t("components:comparePaintsAndConvertRecipesWithYourCollection"),
  };
}
function Header({ page, action = false }: { page: SkeletonPage; action?: boolean }) {
  if (page === "paint-tools")
    return (
      <PageHeader
        beta
        eyebrow={i18n.t("pages:toolsEyebrow")}
        title={i18n.t("pages:toolsTitle")}
        body={i18n.t("pages:toolsDescription")}
      />
    );
  const actionWidth = page === "templates" ? 147 : page === "schemes" ? 139 : 124;
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        columnGap: 2,
        rowGap: 1.5,
        mb: { xs: 2.5, lg: 3 },
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ height: 15.6, mb: 0.7, display: "flex", alignItems: "center" }}>
          <Shape width={104} height={10} />
        </Box>
        <Box
          sx={{
            position: "relative",
            fontFamily: "var(--font-serif)",
            fontSize: { xs: "2rem", lg: "2.5rem" },
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
          }}
        >
          <Box sx={{ visibility: "hidden" }}>{pageTitles()[page]}</Box>
          <Shape sx={{ position: "absolute", inset: 0, height: "100%", width: "100%", maxWidth: 300 }} />
        </Box>
        <Box
          sx={{ mt: 1, position: "relative", maxWidth: "42rem", fontSize: "0.875rem", lineHeight: 10 / 7 }}
        >
          <Box sx={{ visibility: "hidden" }}>{pageBodies()[page]}</Box>
          <Shape sx={{ position: "absolute", inset: 0, height: "100%", width: "100%", maxWidth: 480 }} />
        </Box>
      </Box>
      {action && <Shape width={actionWidth} height={44} sx={{ flexShrink: 0 }} />}
    </Box>
  );
}

// Mirrors FilterToolbar: stacked search/filters below lg, inline above it.
function Toolbar({ facets = 1, wide = false }: { facets?: number; wide?: boolean }) {
  return (
    <Card
      sx={{
        p: 1,
        mb: { xs: 2, md: 2.5 },
        borderRadius: "1rem",
        display: "flex",
        flexDirection: facets === 4 ? { xs: "column", xl: "row" } : { xs: "column", lg: "row" },
        gap: { xs: 1, lg: 1.5 },
      }}
    >
      <Shape
        height={40}
        sx={{
          width: facets === 4 ? { xs: "100%", xl: "26%" } : { xs: "100%", lg: wide ? "auto" : "26%" },
          flex: wide ? { xs: "0 0 auto", lg: 1 } : undefined,
        }}
      />
      <Box
        sx={{
          minWidth: 0,
          flex: wide ? { xs: "auto", lg: "0 0 224px" } : 1,
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: `repeat(${Math.min(facets, 3)}, minmax(0, 1fr))`,
            xl: `repeat(${facets}, minmax(0, 1fr))`,
          },
          gap: 1,
        }}
      >
        {items(facets).map((index) => (
          <Shape key={index} height={40} />
        ))}
      </Box>
    </Card>
  );
}

// Home, miniature and template shelves use measured container width (not viewport width).
function TileShelf({ miniature = false }: { miniature?: boolean }) {
  return (
    <Box sx={{ containerType: "inline-size" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 1.5,
          "@container (min-width: 600px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2 },
          "@container (min-width: 840px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
          "@container (min-width: 1100px)": { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" },
        }}
      >
        {items(10).map((index) => (
          <Card
            key={index}
            sx={{
              position: "relative",
              ...(miniature ? { height: 0, paddingTop: "calc(125% + 2px)" } : { aspectRatio: "4 / 5" }),
              overflow: "hidden",
            }}
          >
            <Shape
              sx={{
                position: "absolute",
                inset: 0,
                height: "100%",
                borderRadius: 0,
                bgcolor: "var(--surface-raised)",
              }}
            />
            <Box sx={{ position: "absolute", insetInline: 12, bottom: 16 }}>
              <Lines wide />
            </Box>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

function WorkbenchSummary() {
  return (
    <Card sx={{ mb: { xs: 4, lg: 5 }, display: { lg: "flex" }, overflow: "hidden" }}>
      <Box
        sx={{ flex: 1, display: "flex", alignItems: "center", gap: { xs: 2, lg: 3 }, p: { xs: 2, lg: 3 } }}
      >
        <Shape
          variant="circular"
          sx={{ width: { xs: 72, lg: 96 }, height: { xs: 72, lg: 96 }, flexShrink: 0 }}
        />
        <Lines wide />
      </Box>
      <Box
        sx={{
          width: { lg: 256 },
          boxSizing: "border-box",
          height: { xs: 62, lg: "auto" },
          p: { xs: 1, lg: 3 },
          borderTop: { xs: "1px solid var(--line)", lg: 0 },
          borderLeft: { lg: "1px solid var(--line)" },
          display: "grid",
          justifyItems: "center",
          alignContent: "center",
          gap: 1,
        }}
      >
        <Shape width={80} height={30} />
        <Shape width={150} height={10} />
      </Box>
    </Card>
  );
}

function Miniatures({ dashboard = false }: { dashboard?: boolean }) {
  return (
    <>
      <Header page={dashboard ? "home" : "miniatures"} />
      {dashboard && (
        <>
          <WorkbenchSummary />
          <Shape width={220} sx={{ height: { xs: 24, lg: 26.4 }, mb: { xs: 1.5, lg: 2 } }} />
        </>
      )}
      <Toolbar wide />
      <TileShelf miniature />
    </>
  );
}

function PaintRows({ count = 8, shopping = false }: { count?: number; shopping?: boolean }) {
  return (
    <Card sx={{ overflow: "hidden", "& > * + *": { borderTop: "1px solid var(--line)" } }}>
      {items(count).map((index) => (
        <Box
          key={index}
          sx={{
            height: 66,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: { xs: 1.5, md: 2 },
          }}
        >
          {shopping && <Shape variant="circular" width={24} height={24} sx={{ flexShrink: 0 }} />}
          <Shape width={24} height={36} sx={{ flexShrink: 0 }} />
          <Lines />
          <Shape width={shopping ? 64 : 112} height={30} sx={{ flexShrink: 0 }} />
        </Box>
      ))}
    </Card>
  );
}

function Wishlist() {
  return (
    <>
      <Header page="wishlist" />
      <Card sx={{ p: 2, mb: 2.5 }}>
        <Shape width={230} height={22} sx={{ mb: 1.5 }} />
        <Lines wide />
        <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
          {items(3).map((index) => (
            <Shape key={index} width={140} height={32} />
          ))}
        </Box>
      </Card>
      <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
        <Shape height={40} sx={{ flex: 1, maxWidth: 340 }} />
        <Shape width={112} height={36} sx={{ ml: "auto" }} />
      </Box>
      {items(2).map((index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Shape width={140} height={16} sx={{ my: 1.5 }} />
          <PaintRows count={3} shopping />
        </Box>
      ))}
    </>
  );
}

function Schemes() {
  return (
    <>
      <Header page="schemes" action />
      <Toolbar facets={4} />
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(3, minmax(0, 1fr))",
          },
        }}
      >
        {items(6).map((index) => (
          <Card key={index} sx={{ height: "18rem", boxSizing: "border-box", overflow: "hidden" }}>
            <Shape height="50%" sx={{ borderRadius: 0 }} />
            <Box sx={{ p: 2.5 }}>
              <Lines wide />
              <Shape width={90} height={22} sx={{ my: 1.5 }} />
              <Shape width="85%" height={12} />
            </Box>
          </Card>
        ))}
      </Box>
    </>
  );
}

function Templates() {
  return (
    <>
      <Header page="templates" action />
      <Toolbar facets={2} />
      <Shape width={100} height={20} sx={{ mb: 1.5 }} />
      <TileShelf />
    </>
  );
}

// Actual SettingsSection order: Connection, Catalog, Account and security, Data.
function Settings() {
  return (
    <>
      <Header page="settings" />
      <Box sx={{ display: "grid", gap: { xs: 3, md: 3.5 } }}>
        {[1, 1, 4, 2].map((count, section) => (
          <Box key={section}>
            <Shape width={section === 2 ? 190 : 110} height={28} sx={{ mb: 1 }} />
            {section === 3 && <Shape width="85%" height={18} sx={{ mb: 1 }} />}
            <Card sx={{ "& > * + *": { borderTop: "1px solid var(--line)" } }}>
              {items(count).map((index) => (
                <Box
                  key={index}
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    display: "flex",
                    flexWrap: { xs: "wrap", sm: "nowrap" },
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <Shape width={40} height={40} sx={{ flexShrink: 0 }} />
                  <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
                    <Lines wide />
                  </Box>
                  <Shape width={120} height={32} sx={{ ml: { xs: "56px", sm: 0 } }} />
                </Box>
              ))}
            </Card>
          </Box>
        ))}
      </Box>
    </>
  );
}

// Plugins and detail variants are content only: callers own their modal/drawer shell.
function Plugins() {
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Box>
        <Shape width={150} height={22} sx={{ mb: 1 }} />
        <Shape width="90%" height={32} sx={{ mb: 2 }} />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Shape height={40} sx={{ flex: 1 }} />
          <Shape width={90} height={40} />
        </Box>
      </Box>
      <Box>
        <Shape width={180} height={22} sx={{ mb: 1.5 }} />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {items(3).map((index) => (
            <Card key={index} sx={{ p: 2, display: "flex", gap: 1.5, alignItems: "center" }}>
              <Shape width={40} height={40} sx={{ flexShrink: 0 }} />
              <Lines wide />
              <Shape width={32} height={32} />
            </Card>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function PaintTools() {
  return (
    <>
      <Header page="paint-tools" />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 0.5, mb: 2.5 }}>
        {items(3).map((key) => (
          <Shape key={key} height={64} />
        ))}
      </Box>
      <Card sx={{ p: { xs: 2, sm: 4 } }}>
        <Shape height={56} />
        <Box
          sx={{ display: "flex", gap: 1.5, mt: 2.5, p: 2, borderRadius: 2, border: "1px solid var(--line)" }}
        >
          <Shape width={18} height={18} sx={{ flexShrink: 0 }} />
          <Lines wide />
        </Box>
      </Card>
    </>
  );
}

function MiniatureDetail({ hasImage = true }: { hasImage?: boolean }) {
  return (
    <>
      <Shape
        sx={{
          height: hasImage ? { xs: "15rem", md: "18rem" } : { xs: "10rem", md: "11rem" },
          borderRadius: 0,
        }}
      />
      <Box sx={{ p: { xs: 2, md: 3.5 }, display: "grid", gap: { xs: 3, md: 3.5 } }}>
        <Lines wide />
        <Box>
          <Shape width={120} height={10} sx={{ mb: 1 }} />
          <Shape height={40} />
        </Box>
        <Card sx={{ p: 2, display: "flex", gap: 2, alignItems: "center" }}>
          <Shape variant="circular" width={56} height={56} />
          <Lines wide />
        </Card>
        <Box>
          <Shape width={160} height={24} sx={{ mb: 1.5 }} />
          <PaintRows count={3} />
        </Box>
      </Box>
    </>
  );
}

function PaintDetail() {
  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Shape height={112} sx={{ borderRadius: "1rem" }} />
      <Box sx={{ display: "flex", gap: 1 }}>
        {items(3).map((index) => (
          <Shape key={index} height={48} sx={{ flex: 1 }} />
        ))}
      </Box>
      <Lines wide />
      <Card sx={{ p: 2 }}>
        <Lines wide />
        <Shape width={160} height={32} sx={{ mt: 2 }} />
      </Card>
      <Box>
        <Shape width={180} height={24} sx={{ mb: 1.5 }} />
        <PaintRows count={2} />
      </Box>
    </Box>
  );
}

function Content({ page, miniatureImage }: { page: SkeletonPage; miniatureImage?: boolean }) {
  switch (page) {
    case "home":
      return <Miniatures dashboard />;
    case "miniatures":
      return <Miniatures />;
    case "paints":
      return (
        <>
          <Header page="paints" action />
          <Toolbar facets={3} />
          <PaintRows />
        </>
      );
    case "wishlist":
      return <Wishlist />;
    case "schemes":
      return <Schemes />;
    case "templates":
      return <Templates />;
    case "settings":
      return <Settings />;
    case "plugins":
      return <Plugins />;
    case "paint-tools":
      return <PaintTools />;
    case "miniature-detail":
      return <MiniatureDetail hasImage={miniatureImage} />;
    case "paint-detail":
      return <PaintDetail />;
  }
}

/** Initial reads only; keep already-loaded content mounted during background refreshes. */
export function PageSkeleton({ page, miniatureImage }: { page: SkeletonPage; miniatureImage?: boolean }) {
  const { t } = useTranslation("components");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", { noSsr: true });
  return (
    <ReducedMotionContext.Provider value={reducedMotion}>
      <Box data-skeleton={page} aria-busy="true" sx={{ width: "100%", minWidth: 0 }}>
        <Box role="status" aria-live="polite" sx={visuallyHiddenSx}>
          {t("loadingPage", { title: pageTitles()[page] })}
        </Box>
        <Box aria-hidden="true">
          <Content page={page} miniatureImage={miniatureImage} />
        </Box>
      </Box>
    </ReducedMotionContext.Provider>
  );
}
