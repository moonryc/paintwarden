import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BookmarksOutlined from "@mui/icons-material/BookmarksOutlined";
import ChecklistIcon from "@mui/icons-material/Checklist";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import ExtensionOutlined from "@mui/icons-material/ExtensionOutlined";
import LayersOutlined from "@mui/icons-material/LayersOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import ScienceOutlined from "@mui/icons-material/ScienceOutlined";
import SwapHoriz from "@mui/icons-material/SwapHoriz";
import { Box, Container, Typography } from "@mui/material";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import type { ComponentType, ReactNode } from "react";

import { CtaBand, IconTile, PageIntro, Screenshot, Surface, serif } from "../components/primitives";
import { siteT as t } from "../i18n";
import { examplePlugin, repository } from "../links";

const steps = () => [
  {
    title: t("docs.chooseWhereYourVaultRuns"),
    body: t("docs.installTheDesktopAppForALocalVaultConnectIt"),
  },
  {
    title: t("docs.createTheOwnerAccount"),
    body: t("docs.onFirstUseSetAnOwnerUsernameAndAPassword"),
  },
  {
    title: t("docs.installACatalogPlugin"),
    body: t("docs.aNewVaultStartsEmptyOpenDataSettingsPluginsAnd"),
  },
  {
    title: t("docs.addPaintsAndAMiniature"),
    body: t("docs.markBottlesAsOwnedSetQuantitiesThenAddAMiniature"),
  },
];

type Section = {
  id: string;
  label: string;
  title: string;
  icon: ComponentType<SvgIconProps>;
  body: ReactNode;
  image?: { src: string; width: number; height: number; alt: string; caption: string; maxWidth?: number };
};

const strong = (text: string) => <strong>{text}</strong>;

const sections = (): Section[] => [
  {
    id: "plugins",
    label: t("docs.plugins"),
    title: t("docs.installCatalogsAsPlugins"),
    icon: ExtensionOutlined,
    image: {
      src: "/images/app/plugins.webp",
      width: 1000,
      height: 1048,
      alt: t("docs.thePluginsDialogWithAGitHubRepositoryFieldAnUpload"),
      caption: t("docs.dataSettingsPlugins"),
      maxWidth: 460,
    },
    body: (
      <>
        <p>
          {t("docs.paintVaultDoesnTBundleAPaintCatalogPaintsColor")} {strong(t("docs.plugins2"))}
          {t("docs.publicGitHubRepositoriesOrZipFilesInThePaintVault")}{" "}
          {strong(t("docs.dataSettingsPlugins"))}
          {t("docs.thenPasteARepositoryIn")} {/* i18n-allow: literal GitHub repository syntax */}
          <code>owner/repository</code> {t("docs.formOrChoose")} {strong(t("docs.uploadZip"))}
          {t("docs.pluginsACatalogDependsOnAreInstalledWithIt")}
        </p>
        <p>
          {t("docs.toTryItInstallTheExamplePlugin")}{" "}
          <a href={`https://github.com/${examplePlugin}`} target="_blank" rel="noreferrer">
            <code>{examplePlugin}</code>
          </a>
          {t("docs.aSmallCatalogOfSamplePaintsSchemesAndTemplatesIt")}
        </p>
        <p>{t("docs.installedCatalogsStayAvailableOfflinePluginsFromGitHubCanBe")}</p>
        <p>
          {strong(t("docs.createPlugin"))} {t("docs.packagesYourOwnPaintsSchemesAndTemplatesAsAReady")}{" "}
          <a href={`${repository}/blob/main/docs/source-format.md`} target="_blank" rel="noreferrer">
            {t("docs.sourceFormatGuide")}
          </a>{" "}
          {t("docs.describesEveryFile")}
        </p>
      </>
    ),
  },
  {
    id: "paints",
    label: t("docs.paints"),
    title: t("docs.keepYourPaintLibraryCurrent"),
    icon: ScienceOutlined,
    body: (
      <>
        <p>
          {t("docs.open")} {strong(t("docs.paints"))} {t("docs.toSearchThePaintsFromYourPluginsMarkAPaint")}
        </p>
      </>
    ),
  },
  {
    id: "miniatures",
    label: t("docs.workbench"),
    title: t("docs.planAMiniature"),
    icon: DashboardOutlined,
    image: {
      src: "/images/app/miniature.webp",
      width: 960,
      height: 1350,
      alt: t("docs.aMiniatureSDetailViewWithItsPaintingStageThe"),
      caption: t("docs.aMiniatureSDetailView"),
      maxWidth: 420,
    },
    body: (
      <>
        <p>
          {t("docs.use")} {strong(t("docs.miniature"))} {t("docs.inTheSidebarToAddAModelToYourCollection")}
        </p>
        <p>
          {t("docs.the")} {strong(t("docs.workbench"))}{" "}
          {t("docs.summarizesWhichProjectsAreReadyToPaintAndWhichPaints")}
        </p>
      </>
    ),
  },
  {
    id: "schemes",
    label: t("docs.schemes"),
    title: t("docs.buildReusableSchemes"),
    icon: LayersOutlined,
    image: {
      src: "/images/app/schemes.webp",
      width: 2400,
      height: 1500,
      alt: t("docs.theSchemesScreenWithColorRecipeCardsEachShowingWhether"),
      caption: t("docs.schemesFilteredByPluginColorAndAvailability"),
    },
    body: (
      <p>
        {t("docs.open")} {strong(t("docs.schemes"))} {t("docs.toBrowseColorRecipesOrCreateYourOwnAScheme")}
      </p>
    ),
  },
  {
    id: "templates",
    label: t("docs.templates"),
    title: t("docs.startFromATemplate"),
    icon: BookmarksOutlined,
    body: (
      <p>
        {t("docs.a")} {strong(t("docs.template"))} {t("docs.isAMiniatureSStartingSetupItsMakerFactionColor")}{" "}
        {strong(t("docs.templates"))}
        {t("docs.pickOneWhenYouAddAMiniatureOrUse")} {strong(t("docs.saveAsTemplate"))}{" "}
        {t("docs.onAMiniatureYouVeAlreadyPlanned")}
      </p>
    ),
  },
  {
    id: "paint-tools",
    label: t("docs.paintTools"),
    title: t("docs.compareColorsAndConvertRecipes"),
    icon: SwapHoriz,
    image: {
      src: "/images/app/converter.webp",
      width: 1600,
      height: 1189,
      alt: t("docs.theRecipeConverterKeepingThreeOwnedPaintsFromAScheme"),
      caption: t("docs.recipeConverter"),
    },
    body: (
      <>
        <p>
          {strong(t("docs.paintCompare"))} {t("docs.ranksCatalogPaintsByScreenColorSimilarityWithNotesOn")}
        </p>
        <p>
          {t("docs.the")} {strong(t("docs.recipeConverter"))}{" "}
          {t("docs.adaptsASchemeToYourCollectionReviewTheSuggestionsAnd")}
        </p>
      </>
    ),
  },
  {
    id: "wishlist",
    label: t("docs.wishlist"),
    title: t("docs.gatherWhatIsMissing"),
    icon: ChecklistIcon,
    body: (
      <p>
        {t("docs.the")} {strong(t("docs.wishlist"))}{" "}
        {t("docs.collectsPaintsAndMiniaturesYouWantAddPaintsFromA")}
      </p>
    ),
  },
  {
    id: "backup",
    label: t("docs.backups"),
    title: t("docs.backUpYourVault"),
    icon: SaveOutlined,
    body: (
      <>
        <p>
          {t("docs.in")} {strong(t("docs.dataSettings"))}
          {t("docs.text")} {strong(t("docs.export"))}{" "}
          {t("docs.savesOneZipFileWithEverythingInTheVaultMiniatures")}
        </p>
        <p>
          {strong(t("docs.restoreFromABackup"))} {t("docs.showsWhatTheFileContainsThenEitherMergesItInto")}{" "}
          <a href={`${repository}#storage-and-backups`} target="_blank" rel="noreferrer">
            {t("docs.repositoryGuide")}
          </a>{" "}
          {t("docs.alsoCoversCopyingTheDockerVolume")}
        </p>
      </>
    ),
  },
];

function Contents() {
  return (
    <Box
      component="nav"
      aria-label={t("docs.onThisPage")}
      sx={{ display: { xs: "none", md: "block" }, position: "sticky", top: 100, alignSelf: "start" }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".16em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          mb: 1.5,
          pl: 2,
        }}
      >
        {t("docs.onThisPage")}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {sections().map(({ id, label, icon: Icon }) => (
          <Box
            key={id}
            component="a"
            href={`#${id}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              pl: 2,
              pr: 1.5,
              py: 1,
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink-soft)",
              textDecoration: "none",
              "&:hover": { bgcolor: "var(--sunken)", color: "var(--ink)" },
              "&:focus-visible": { outline: "2px solid var(--brand-text)", outlineOffset: 2 },
            }}
          >
            <Icon sx={{ fontSize: 18 }} />
            {label}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function DocsPage() {
  return (
    <Container maxWidth="lg">
      <PageIntro
        eyebrow={t("docs.howToUse")}
        title={t("docs.getFromShelfToSession")}
        description={t("docs.aPracticalGuideToSettingUpPaintVaultAndUsing")}
      />
      <Box
        component="ol"
        sx={{
          listStyle: "none",
          m: 0,
          p: 0,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
        {steps().map((step, index) => (
          <Surface key={step.title} component="li" sx={{ p: 3, position: "relative" }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 36,
                height: 36,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                bgcolor: "var(--gold-soft)",
                color: "var(--gold-text)",
                fontFamily: serif,
                fontWeight: 600,
                fontSize: 17,
                mb: 2.5,
              }}
            >
              {index + 1}
            </Box>
            <Typography component="h2" sx={{ fontWeight: 600, fontSize: 17, mb: 1 }}>
              {step.title}
            </Typography>
            <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.65, fontSize: 14.5 }}>
              {step.body}
            </Typography>
          </Surface>
        ))}
      </Box>

      <Screenshot
        src="/images/app/workbench.webp"
        width={2400}
        height={1500}
        alt={t("docs.thePaintVaultWorkbench2Of5MiniaturesReadyTo")}
        caption={t("docs.theWorkbenchTheFirstScreenAfterSetup")}
        sx={{ mt: { xs: 8, md: 10 } }}
      />

      <Box
        sx={{
          mt: { xs: 8, md: 12 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "220px minmax(0, 1fr)" },
          gap: { xs: 0, md: 6 },
        }}
      >
        <Contents />
        <Box sx={{ display: "grid", gap: 2 }}>
          {sections().map(({ id, label, title, icon: Icon, body, image }) => (
            <Surface key={id} component="section" sx={{ p: { xs: 3, md: 4 }, scrollMarginTop: 96 }}>
              <Box id={id} sx={{ scrollMarginTop: 96 }} />
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5 }}>
                <IconTile>
                  <Icon />
                </IconTile>
                <Box>
                  <Typography
                    sx={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".16em",
                      textTransform: "uppercase",
                      color: "var(--ink-faint)",
                    }}
                  >
                    {label}
                  </Typography>
                  <Typography
                    component="h2"
                    sx={{
                      fontFamily: serif,
                      fontWeight: 600,
                      fontSize: { xs: 23, md: 27 },
                      lineHeight: 1.2,
                      color: "#ececec",
                    }}
                  >
                    {title}
                  </Typography>
                </Box>
              </Box>
              <Box
                sx={{
                  color: "var(--ink-soft)",
                  lineHeight: 1.75,
                  fontSize: 15.5,
                  "& p": { m: 0 },
                  "& p + p": { mt: 2 },
                  "& strong": { color: "var(--ink)", fontWeight: 600 },
                  "& a": { color: "var(--brand-text)", fontWeight: 600 },
                }}
              >
                {body}
              </Box>
              {image && (
                <Screenshot
                  src={image.src}
                  width={image.width}
                  height={image.height}
                  alt={image.alt}
                  caption={image.caption}
                  sx={{ mt: 3.5, maxWidth: image.maxWidth, mx: "auto" }}
                />
              )}
            </Surface>
          ))}
        </Box>
      </Box>

      <Box sx={{ mt: { xs: 8, md: 10 } }}>
        <CtaBand
          title={t("docs.needTheInstallationSteps")}
          body={t("docs.pickTheDesktopAppOrASelfHostedVault")}
          action={t("docs.goToDownloads")}
          href="/download/"
          icon={<ArrowForwardIcon />}
        />
      </Box>
    </Container>
  );
}
