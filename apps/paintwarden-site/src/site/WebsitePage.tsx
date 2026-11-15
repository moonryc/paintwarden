import CloseIcon from "@mui/icons-material/Close";
import CoffeeOutlined from "@mui/icons-material/CoffeeOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import GitHub from "@mui/icons-material/GitHub";
import MenuIcon from "@mui/icons-material/Menu";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Box,
  Button,
  Container,
  CssBaseline,
  IconButton,
  MenuItem,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { Wordmark } from "./components/primitives";
import { siteT as t, useSiteLanguage, languages } from "./i18n";
import { betaTesterGuide, koFi, releases, releasesAvailable, repository, securityReport } from "./links";
import { DocsPage } from "./pages/DocsPage";
import { DownloadPage } from "./pages/DownloadPage";
import { FaqPage } from "./pages/FaqPage";
import { HomePage } from "./pages/HomePage";
import { LicensesPage } from "./pages/LicensesPage";
import { PhonePage } from "./pages/PhonePage";
import { theme } from "./theme";

export type Page = "home" | "docs" | "faq" | "download" | "licenses" | "phone";

const nav = (): { label: string; href: string; page: Page }[] => [
  { label: t("website.overview"), href: "/", page: "home" },
  { label: t("website.howToUse"), href: "/docs/", page: "docs" },
  { label: t("website.phonePrivacy"), href: "/phone/", page: "phone" },
  { label: t("website.faq"), href: "/faq/", page: "faq" },
  { label: t("website.download"), href: "/download/", page: "download" },
];

const focusRing = {
  "&:focus-visible": { outline: "2px solid var(--brand-text)", outlineOffset: 2 },
};

function Header({
  page,
  language,
  setLanguage,
}: {
  page: Page;
  language: string;
  setLanguage: (language: string) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        borderBottom: "1px solid var(--line)",
        bgcolor: "rgb(32 32 32 / 82%)",
        backdropFilter: "saturate(140%) blur(18px)",
      }}
    >
      <Container maxWidth="lg" sx={{ display: "flex", alignItems: "center", minHeight: 68, gap: 2, py: 1.5 }}>
        <Box
          component="a"
          href="/"
          aria-label={t("website.paintwardenHome")}
          sx={{ textDecoration: "none", borderRadius: "12px", mr: "auto", ...focusRing }}
        >
          <Wordmark />
        </Box>
        <Box
          component="nav"
          aria-label={t("website.mainNavigation")}
          sx={{ display: { xs: "none", lg: "flex" }, alignItems: "center", gap: 0.5 }}
        >
          {nav().map((item) => {
            const current = page === item.page;
            return (
              <Box
                key={item.href}
                component="a"
                href={item.href}
                aria-current={current ? "page" : undefined}
                sx={{
                  px: 1.75,
                  py: 0.9,
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  bgcolor: current ? "var(--brand-soft)" : "transparent",
                  color: current ? "var(--brand-text)" : "var(--ink-soft)",
                  transition: "background-color 150ms, color 150ms",
                  "&:hover": {
                    color: current ? "var(--brand-text)" : "var(--ink)",
                    bgcolor: current ? "var(--brand-soft)" : "var(--sunken)",
                  },
                  ...focusRing,
                }}
              >
                {item.label}
              </Box>
            );
          })}
        </Box>
        <Button
          href="/download/"
          variant="contained"
          startIcon={<DownloadIcon />}
          sx={{ display: { xs: "none", lg: "inline-flex" }, ml: 1.5 }}
        >
          {t("website.getTheApp")}
        </Button>
        <TextField
          select
          size="small"
          label={t("website.language")}
          value={language}
          onChange={(event) => {
            void setLanguage(event.target.value);
          }}
          sx={{
            minWidth: 124,
            maxWidth: { xs: 140, md: 180 },
            "& .MuiSelect-select": { whiteSpace: "normal", overflowWrap: "anywhere" },
          }}
        >
          {languages.map(({ code, name }) => (
            <MenuItem key={code} value={code}>
              {name}
            </MenuItem>
          ))}
        </TextField>
        <IconButton
          aria-label={menuOpen ? t("website.closeMenu") : t("website.openMenu")}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
          sx={{
            display: { xs: "inline-flex", lg: "none" },
            border: "1px solid var(--line)",
            bgcolor: "var(--surface-raised)",
            borderRadius: 999,
            color: "var(--ink)",
          }}
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </IconButton>
      </Container>
      {menuOpen && (
        <Box
          component="nav"
          id="mobile-navigation"
          aria-label={t("website.mobileNavigation")}
          sx={{ display: { lg: "none" }, px: 2, pb: 2, pt: 1, borderTop: "1px solid var(--line)" }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {nav().map((item) => {
              const current = page === item.page;
              return (
                <Box
                  key={item.href}
                  component="a"
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  sx={{
                    display: "block",
                    px: 2,
                    py: 1.5,
                    borderRadius: 999,
                    fontWeight: 600,
                    textDecoration: "none",
                    bgcolor: current ? "var(--brand-soft)" : "transparent",
                    color: current ? "var(--brand-text)" : "var(--ink)",
                    ...focusRing,
                  }}
                >
                  {item.label}
                </Box>
              );
            })}
          </Box>
          <Button
            href="/download/"
            variant="contained"
            fullWidth
            startIcon={<DownloadIcon />}
            sx={{ mt: 1.5 }}
          >
            {t("website.getTheApp")}
          </Button>
        </Box>
      )}
    </Box>
  );
}

const footerLink = {
  color: "var(--ink-soft)",
  textDecoration: "none",
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
  gap: 0.75,
  borderRadius: "6px",
  "&:hover": { color: "var(--ink)" },
  ...focusRing,
};

function Footer() {
  return (
    <Box
      component="footer"
      sx={{ mt: { xs: 10, md: 14 }, borderTop: "1px solid var(--line)", bgcolor: "var(--surface)" }}
    >
      <Container
        maxWidth="lg"
        sx={{
          py: { xs: 5, md: 6 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "2fr 1fr 1fr" },
          gap: 4,
        }}
      >
        <Box sx={{ gridColumn: { sm: "1 / -1", md: "auto" } }}>
          <Wordmark />
          <Typography sx={{ color: "var(--ink-faint)", fontSize: 14, mt: 2, maxWidth: 320, lineHeight: 1.6 }}>
            {t("website.yourPaintsProjectsAndRecipesInOneQuietPlaceOn")}
          </Typography>
          <Typography sx={{ color: "var(--ink-faint)", fontSize: 14, mt: 2, maxWidth: 320, lineHeight: 1.6 }}>
            {t("website.licenseSummary")}
          </Typography>
        </Box>
        <Box>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              mb: 1.5,
            }}
          >
            {t("website.product")}
          </Typography>
          <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1.25 }}>
            {nav().map((item) => (
              <li key={item.href}>
                <Box component="a" href={item.href} sx={footerLink}>
                  {item.label}
                </Box>
              </li>
            ))}
          </Box>
        </Box>
        <Box>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              mb: 1.5,
            }}
          >
            {t("website.project")}
          </Typography>
          <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1.25 }}>
            <li>
              <Box
                component="a"
                href={releasesAvailable ? `${repository}/blob/main/LICENSE` : "/LICENSE"}
                sx={footerLink}
              >
                {t("website.license")}
              </Box>
            </li>
            <li>
              <Box component="a" href="/licenses/" sx={footerLink}>
                {t("website.openSourceLicenses")}
              </Box>
            </li>
            <li>
              <Box component="a" href="/privacy.md" sx={footerLink}>
                {t("website.privacyNetworkLink")}
              </Box>
            </li>
            {releasesAvailable &&
              [
                [betaTesterGuide, t("website.betaTesterGuide")],
                [securityReport, t("website.securityReportLink")],
              ].map(([href, label]) => (
                <li key={href}>
                  <Box component="a" href={href} target="_blank" rel="noopener noreferrer" sx={footerLink}>
                    {label}
                  </Box>
                </li>
              ))}
            {releasesAvailable && (
              <>
                <li>
                  <Box component="a" href={repository} target="_blank" rel="noreferrer" sx={footerLink}>
                    <GitHub sx={{ fontSize: 17 }} /> {t("website.sourceCode")}
                  </Box>
                </li>
                <li>
                  <Box component="a" href={releases} target="_blank" rel="noreferrer" sx={footerLink}>
                    <OpenInNewIcon sx={{ fontSize: 17 }} /> {t("website.releases")}
                  </Box>
                </li>
              </>
            )}
            <li>
              <Box component="a" href={koFi} target="_blank" rel="noopener noreferrer" sx={footerLink}>
                <CoffeeOutlined sx={{ fontSize: 17 }} /> {t("website.supportOnKoFi")}
              </Box>
            </li>
          </Box>
        </Box>
      </Container>
      <Box sx={{ borderTop: "1px solid var(--line)" }}>
        <Container maxWidth="lg" sx={{ py: 2.5, color: "var(--ink-faint)", fontSize: 12 }}>
          <Box
            component="a"
            href="/phone/#website-privacy"
            sx={{ color: "var(--ink-soft)", display: "block", mb: 1.5, ...focusRing }}
          >
            {t("website.sitePrivacy")}
          </Box>
          {t("website.paintwardenIsAnIndependentProjectAndIsNotAffiliated")}
        </Container>
      </Box>
    </Box>
  );
}

export default function WebsitePage({ page, notices = "" }: { page: Page; notices?: string }) {
  const { language, setLanguage } = useSiteLanguage();
  useEffect(() => {
    document.title = t(`meta.${page}Title`);
    const description = t(`meta.${page}Description`);
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  }, [page, language]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "var(--canvas)", color: "var(--ink)", overflowX: "clip" }}>
        <Box
          component="a"
          href="#main"
          sx={{
            position: "absolute",
            left: 16,
            top: -48,
            zIndex: 30,
            px: 2,
            py: 1,
            borderRadius: "12px",
            bgcolor: "var(--brand)",
            color: "var(--brand-fg)",
            fontWeight: 600,
            textDecoration: "none",
            "&:focus": { top: 12 },
          }}
        >
          {t("website.skipToContent")}
        </Box>
        <Header page={page} language={language} setLanguage={setLanguage} />
        <Box component="main" id="main">
          {page === "home" && <HomePage />}
          {page === "docs" && <DocsPage />}
          {page === "phone" && <PhonePage />}
          {page === "faq" && <FaqPage />}
          {page === "download" && <DownloadPage />}
          {page === "licenses" && <LicensesPage notices={notices} />}
        </Box>
        <Footer />
      </Box>
    </ThemeProvider>
  );
}
