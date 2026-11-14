import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DesktopWindowsOutlined from "@mui/icons-material/DesktopWindowsOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import StorageOutlined from "@mui/icons-material/StorageOutlined";
import SwapHoriz from "@mui/icons-material/SwapHoriz";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Container,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";

import { IconTile, PageIntro, Surface, serif } from "../components/primitives";
import { siteT as t } from "../i18n";

type Group = "data" | "desktop" | "tools";

const groups = (): { id: Group; title: string; icon: ReactNode }[] => [
  { id: "data", title: t("faq.yourDataAccount"), icon: <StorageOutlined /> },
  { id: "desktop", title: t("faq.desktopApp"), icon: <DesktopWindowsOutlined /> },
  { id: "tools", title: t("faq.paintsPaintTools"), icon: <SwapHoriz /> },
];

const questions = (): { question: string; answer: string; group: Group }[] => [
  {
    question: t("faq.whereIsMyVaultDataStored"),
    group: "data",
    answer: t("faq.theSelfHostedServerStoresAppRecordsInSQLiteAnd"),
  },
  {
    question: t("faq.doINeedAnAccount"),
    group: "data",
    answer: t("faq.eachVaultHasOneOwnerAccountCreatedOnFirstUse"),
  },
  {
    question: t("faq.canTheDesktopAppConnectToMyServer"),
    group: "desktop",
    answer: t("faq.yesAtFirstLaunchChooseTheBundledLocalServerOr"),
  },
  {
    question: t("faq.doesTheAppWorkOffline"),
    group: "desktop",
    answer: t("faq.aDesktopVaultRunningOnYourComputerCanBeUsed"),
  },
  {
    question: t("faq.doesABackupIncludeMyPhotos"),
    group: "data",
    answer: t("faq.yesExportInDataSettingsSavesOneZipWithYour"),
  },
  {
    question: t("faq.whereDoThePaintsComeFrom"),
    group: "tools",
    answer: t("faq.fromPluginsPaintwardenDoesnTBundleACatalogSo"),
  },
  {
    question: t("faq.canIShareMyOwnSchemesAndPaints"),
    group: "tools",
    answer: t("faq.yesCreatePluginInThePluginsDialogPackagesYourOwn"),
  },
  {
    question: t("faq.howAccurateIsPaintCompare"),
    group: "tools",
    answer: t("faq.itComparesTheCatalogSScreenColorsAHighScore"),
  },
  {
    question: t("faq.doesTheRecipeConverterReplaceMyOriginalScheme"),
    group: "tools",
    answer: t("faq.noItSavesANewReusableSchemeWithYourReviewed"),
  },
  {
    question: t("faq.canIAddPaintsThatNoPluginIncludes"),
    group: "tools",
    answer: t("faq.yesUseAddPaintInThePaintsLibraryToCreate"),
  },
];

export function FaqPage() {
  return (
    <Container maxWidth="lg">
      <PageIntro
        eyebrow={t("faq.frequentlyAskedQuestions")}
        title={t("faq.theLittleDetailsMatter")}
        description={t("faq.answersAboutSetupStorageDesktopUseAndThePaintPlanning")}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 300px" },
          gap: { xs: 6, md: 6 },
          alignItems: "start",
        }}
      >
        <Box sx={{ display: "grid", gap: { xs: 5, md: 6 } }}>
          {groups().map((group) => (
            <Box key={group.id} component="section" aria-labelledby={`faq-${group.id}`}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                <IconTile>{group.icon}</IconTile>
                <Typography
                  id={`faq-${group.id}`}
                  component="h2"
                  sx={{ fontFamily: serif, fontWeight: 600, fontSize: { xs: 22, md: 25 }, color: "#ececec" }}
                >
                  {group.title}
                </Typography>
              </Box>
              <Box sx={{ display: "grid", gap: 1.25 }}>
                {questions()
                  .filter((item) => item.group === group.id)
                  .map((item) => (
                    <Accordion
                      key={item.question}
                      disableGutters
                      slotProps={{ heading: { component: "h3" } }}
                      sx={{
                        bgcolor: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: "16px !important",
                        boxShadow: "none",
                        overflow: "hidden",
                        transition: "border-color 150ms",
                        "&::before": { display: "none" },
                        "&:hover, &.Mui-expanded": { borderColor: "var(--line-strong)" },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon sx={{ color: "var(--ink-faint)" }} />}
                        sx={{
                          px: { xs: 2, md: 2.5 },
                          minHeight: 60,
                          "& .MuiAccordionSummary-content": { my: 1.5 },
                          "&.Mui-focusVisible": { bgcolor: "var(--sunken)" },
                        }}
                      >
                        <Typography
                          sx={{ fontSize: { xs: 15.5, md: 16.5 }, fontWeight: 600, color: "var(--ink)" }}
                        >
                          {item.question}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: { xs: 2, md: 2.5 }, pt: 0, pb: 2.5 }}>
                        <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.75, fontSize: 15 }}>
                          {item.answer}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))}
              </Box>
            </Box>
          ))}
        </Box>
        <Surface sx={{ p: 3, position: { md: "sticky" }, top: { md: 100 } }}>
          <IconTile tone="gold">
            <MenuBookOutlined />
          </IconTile>
          <Typography
            component="h2"
            sx={{ fontFamily: serif, fontWeight: 600, fontSize: 22, mt: 2.5, mb: 1, color: "#ececec" }}
          >
            {t("faq.stillFiguringItOut")}
          </Typography>
          <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.65, fontSize: 14.5, mb: 2.5 }}>
            {t("faq.theGettingStartedGuideWalksThroughTheCoreWorkflowFrom")}
          </Typography>
          <Button href="/docs/" variant="outlined" fullWidth endIcon={<ArrowForwardIcon />}>
            {t("faq.readTheGuide")}
          </Button>
        </Surface>
      </Box>
    </Container>
  );
}
