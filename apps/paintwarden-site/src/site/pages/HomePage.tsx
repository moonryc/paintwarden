import AccessibilityNew from "@mui/icons-material/AccessibilityNew";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BookmarksOutlined from "@mui/icons-material/BookmarksOutlined";
import CheckIcon from "@mui/icons-material/Check";
import ColorizeOutlined from "@mui/icons-material/ColorizeOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import DesktopWindowsOutlined from "@mui/icons-material/DesktopWindowsOutlined";
import DnsOutlined from "@mui/icons-material/DnsOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import LockOutlined from "@mui/icons-material/LockOutlined";
import OpacityOutlined from "@mui/icons-material/OpacityOutlined";
import PaletteOutlined from "@mui/icons-material/PaletteOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import { Box, Button, Container, Typography } from "@mui/material";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import type { ComponentType, ReactNode } from "react";

import { CtaBand, IconTile, Screenshot, SectionTitle, Surface, serif } from "../components/primitives";
import { siteT as t } from "../i18n";
import { HomePhonePrivacy } from "./PhonePage";

// The app's navigation, in the order its sidebar lists it.
const screens = (): [ComponentType<SvgIconProps>, string, string][] => [
  [DashboardOutlined, t("home.workbench"), t("home.seeWhichMiniaturesAreReadyToPaintAndHowMany")],
  [AccessibilityNew, t("home.miniatures"), t("home.trackEveryModelYouOwnOrWantWithPhotosNotes")],
  [OpacityOutlined, t("home.paints"), t("home.searchYourInstalledRangesMarkBottlesAsOwnedAndKeep")],
  [FavoriteBorder, t("home.wishlist"), t("home.collectMissingPaintsAndWantedMiniaturesInOneListFor")],
  [PaletteOutlined, t("home.schemes"), t("home.saveOrderedColorRecipesWithStepsAndReferenceImagesThen")],
  [BookmarksOutlined, t("home.templates"), t("home.startAMiniatureFromATemplateThatAlreadyCarriesIts")],
  [ColorizeOutlined, t("home.paintTools"), t("home.compareColorsAndConvertASchemeIntoOneBuiltFrom")],
];

const stats = () => [
  {
    value: t("home.plugins"),
    label: t("home.catalogsYouChoose"),
    detail: t("home.paintsSchemesAndTemplatesFromGitHubOrAZip"),
  },
  {
    value: t("home.yours"),
    label: t("home.customColors"),
    detail: t("home.addPaintsSchemesAndTemplatesOfYourOwn"),
  },
  {
    value: t("home.1File"),
    label: t("home.completeBackups"),
    detail: t("home.recordsPhotosAndPluginsInOneZip"),
  },
  { value: t("home.2"), label: t("home.waysToRunIt"), detail: t("home.desktopAppOrYourOwnServer") },
];

function Check({ children }: { children: ReactNode }) {
  return (
    <Box
      component="li"
      sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, fontSize: 15, lineHeight: 1.5 }}
    >
      <Box
        component="span"
        aria-hidden="true"
        sx={{
          mt: "1px",
          width: 20,
          height: 20,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: 999,
          bgcolor: "var(--ok-soft)",
          color: "var(--ok)",
        }}
      >
        <CheckIcon sx={{ fontSize: 13 }} />
      </Box>
      <span>{children}</span>
    </Box>
  );
}

function Showcase({
  eyebrow,
  title,
  body,
  points,
  link,
  preview,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  link: { label: string; href: string };
  preview: ReactNode;
  reverse?: boolean;
}) {
  return (
    <Box
      component="section"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: reverse ? "minmax(0, 1.1fr) minmax(0, .9fr)" : "minmax(0, .9fr) minmax(0, 1.1fr)",
        },
        gap: { xs: 5, md: 8 },
        alignItems: "center",
      }}
    >
      <Box sx={{ order: { md: reverse ? 2 : 1 } }}>
        <SectionTitle eyebrow={eyebrow} title={title} body={body} />
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1.5, mb: 3.5 }}>
          {points.map((point) => (
            <Check key={point}>{point}</Check>
          ))}
        </Box>
        <Button href={link.href} variant="outlined" endIcon={<ArrowForwardIcon />}>
          {link.label}
        </Button>
      </Box>
      <Box sx={{ order: { md: reverse ? 1 : 2 }, position: "relative", minWidth: 0 }}>{preview}</Box>
    </Box>
  );
}

function Hero() {
  return (
    <Box component="section" sx={{ position: "relative", overflow: "hidden" }}>
      <Box
        component="img"
        src="/images/paint-desk-hero.webp"
        srcSet="/images/paint-desk-hero-720.webp 720w, /images/paint-desk-hero-1200.webp 1200w, /images/paint-desk-hero.webp 1672w"
        sizes="100vw"
        width={1672}
        height={941}
        alt=""
        fetchPriority="high"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: { xs: 560, md: 760 },
          objectFit: "cover",
          objectPosition: { xs: "70% center", md: "center 40%" },
          opacity: 0.45,
          maskImage: "linear-gradient(to bottom, #000 0%, rgb(0 0 0 / 70%) 45%, transparent 100%)",
        }}
      />
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, var(--canvas) 0%, rgb(32 32 32 / 85%) 40%, rgb(32 32 32 / 30%) 100%), radial-gradient(60% 50% at 50% 100%, rgb(64 106 194 / 22%), transparent)",
        }}
      />
      <Container maxWidth="lg" sx={{ position: "relative", pt: { xs: 8, md: 13 } }}>
        <Box sx={{ maxWidth: 680 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              mb: 3,
              pl: 0.75,
              pr: 1.75,
              py: 0.6,
              borderRadius: 999,
              border: "1px solid var(--line-strong)",
              bgcolor: "rgb(38 38 38 / 70%)",
              backdropFilter: "blur(8px)",
              fontSize: 13,
              color: "var(--ink-soft)",
            }}
          >
            <Box
              component="span"
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 999,
                bgcolor: "var(--gold-soft)",
                color: "var(--gold-text)",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {t("home.new")}
            </Box>
            {t("home.paintToolsCompareColorsAndConvertSchemes")}
          </Box>
          <Typography
            component="h1"
            sx={{
              fontFamily: serif,
              fontWeight: 600,
              fontSize: { xs: 44, sm: 60, md: 76 },
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              color: "#ececec",
              mb: 3,
            }}
          >
            {t("home.paintMore")}{" "}
            <Box component="span" sx={{ color: "var(--gold-text)", fontStyle: "italic", fontWeight: 500 }}>
              {t("home.huntLess")}
            </Box>
          </Typography>
          <Typography
            sx={{
              color: "var(--ink-soft)",
              fontSize: { xs: 17, md: 20 },
              lineHeight: 1.6,
              maxWidth: 560,
              mb: 4,
            }}
          >
            {t("home.paintwardenKeepsYourPaintsMiniaturesAndColorRecipesTogether")}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            <Button
              href="/download/"
              variant="contained"
              size="large"
              startIcon={<DownloadIcon />}
              sx={{ px: 3 }}
            >
              {t("home.getPaintwarden")}
            </Button>
            <Button
              href="/docs/"
              variant="outlined"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{ px: 3 }}
            >
              {t("home.seeHowItWorks")}
            </Button>
          </Box>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: { xs: 1.5, sm: 3 },
              mt: 3.5,
              color: "var(--ink-faint)",
              fontSize: 13,
            }}
          >
            {[
              [<DesktopWindowsOutlined key="d" />, t("home.macOSAndWindows")],
              [<DnsOutlined key="s" />, t("home.selfHostedWebApp")],
              [<LockOutlined key="l" />, t("home.yourDataStaysYours")],
            ].map(([icon, label]) => (
              <Box
                key={label as string}
                sx={{ display: "flex", alignItems: "center", gap: 0.75, "& svg": { fontSize: 17 } }}
              >
                {icon}
                {label}
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ mt: { xs: 7, md: 9 }, position: "relative" }}>
          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              insetInline: "10%",
              top: "8%",
              bottom: "-4%",
              background: "radial-gradient(closest-side, rgb(64 106 194 / 35%), transparent)",
              filter: "blur(40px)",
            }}
          />
          <Screenshot
            priority
            src="/images/app/workbench.webp"
            width={1440}
            height={1000}
            alt={t("home.thePaintwardenWorkbench2Of5MiniaturesReadyTo")}
            caption={t("home.theWorkbenchInThePaintwardenApp")}
            sx={{ display: { xs: "none", sm: "block" }, position: "relative", mr: { md: "12%" } }}
          />
          {/* Phones get the phone layout, which stays readable; wide screens overlay it on the window. */}
          <Screenshot
            src="/images/app/phone-workbench.webp"
            width={780}
            height={1688}
            alt={t("home.thePaintwardenWorkbenchOnAPhoneWithTheSummary")}
            caption={t("home.theWorkbenchOnAPhone")}
            sx={{
              display: { xs: "block", sm: "none", md: "block" },
              position: { xs: "relative", md: "absolute" },
              mx: { xs: "auto", md: 0 },
              right: { md: 0 },
              bottom: { md: "-6%" },
              width: { xs: "72%", md: "21%" },
              maxWidth: 300,
              "& img": { borderRadius: "22px", border: "6px solid #111" },
              "& figcaption": { display: { md: "none" } },
            }}
          />
        </Box>
      </Container>
    </Box>
  );
}

function Stats() {
  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 8, md: 10 } }}>
      <Surface
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          overflow: "hidden",
        }}
      >
        {stats().map((stat, index) => (
          <Box
            key={stat.label}
            sx={{
              p: { xs: 2.5, md: 3.5 },
              borderLeft: {
                xs: index % 2 ? "1px solid var(--line)" : 0,
                md: index ? "1px solid var(--line)" : 0,
              },
              borderTop: { xs: index > 1 ? "1px solid var(--line)" : 0, md: 0 },
            }}
          >
            <Box
              sx={{
                fontFamily: serif,
                fontWeight: 600,
                fontSize: { xs: 30, md: 40 },
                lineHeight: 1,
                color: "#ececec",
              }}
            >
              {stat.value}
            </Box>
            <Box sx={{ mt: 1, fontSize: 14, fontWeight: 600 }}>{stat.label}</Box>
            <Box sx={{ mt: 0.25, fontSize: 12.5, color: "var(--ink-faint)", lineHeight: 1.5 }}>
              {stat.detail}
            </Box>
          </Box>
        ))}
      </Surface>
    </Container>
  );
}

function Screens() {
  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 12, md: 16 } }}>
      <SectionTitle
        eyebrow={t("home.theWorkbench")}
        title={t("home.everythingOnYourPaintingDeskConnected")}
        body={t("home.sevenPlacesInTheAppEachOneAwareOfThe")}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 2,
        }}
      >
        {screens().map(([Icon, label, copy]) => (
          <Surface
            key={label}
            component="article"
            sx={{
              p: 3,
              transition: "border-color 150ms, transform 150ms",
              "&:hover": { borderColor: "var(--line-strong)", transform: "translateY(-2px)" },
            }}
          >
            <IconTile>
              <Icon />
            </IconTile>
            <Typography
              component="h3"
              sx={{ fontFamily: serif, fontWeight: 600, fontSize: 21, mt: 2.5, mb: 1, color: "#ececec" }}
            >
              {label}
            </Typography>
            <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.65, fontSize: 14.5 }}>
              {copy}
            </Typography>
          </Surface>
        ))}
        <Surface
          component="article"
          sx={{ p: 3, bgcolor: "var(--canvas)", borderStyle: "dashed", borderColor: "var(--line-strong)" }}
        >
          <IconTile tone="gold">
            <SettingsOutlined />
          </IconTile>
          <Typography
            component="h3"
            sx={{ fontFamily: serif, fontWeight: 600, fontSize: 21, mt: 2.5, mb: 1, color: "#ececec" }}
          >
            {t("home.dataSettings")}
          </Typography>
          <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.65, fontSize: 14.5 }}>
            {t("home.exportAndRestoreABackupChangeTheServerConnectionAnd")}
          </Typography>
        </Surface>
      </Box>
    </Container>
  );
}

function Hosting() {
  const options = [
    {
      icon: <DesktopWindowsOutlined />,
      title: t("home.onYourComputer"),
      body: t("home.theDesktopAppRunsAPrivateVaultOnMacOSOr"),
    },
    {
      icon: <DnsOutlined />,
      title: t("home.onYourOwnServer"),
      body: t("home.runTheWebAppWithDockerComposeAndOpenIt"),
    },
    {
      icon: <LockOutlined />,
      title: t("home.behindYourSignIn"),
      body: t("home.aOneTimeSetupCodeProtectsCreatingTheOwnerAccount"),
    },
  ];
  return (
    <Box
      sx={{
        mt: { xs: 12, md: 16 },
        borderBlock: "1px solid var(--line)",
        bgcolor: "var(--surface)",
        py: { xs: 8, md: 12 },
      }}
    >
      <Container maxWidth="lg">
        <SectionTitle
          eyebrow={t("home.yourVaultYourRules")}
          title={t("home.yourCollectionLivesWhereYouChoose")}
          body={t("home.paintwardenStoresYourCollectionInASQLiteDatabaseOn")}
          align="center"
        />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
          {options.map((option) => (
            <Box
              key={option.title}
              sx={{ p: 3, borderRadius: "20px", border: "1px solid var(--line)", bgcolor: "var(--canvas)" }}
            >
              <IconTile tone="gold">{option.icon}</IconTile>
              <Typography component="h3" sx={{ fontWeight: 600, fontSize: 17, mt: 2.5, mb: 0.75 }}>
                {option.title}
              </Typography>
              <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.65, fontSize: 14.5 }}>
                {option.body}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

function AppGallery() {
  const items = [
    ["workbench", t("home.screenWorkbench")],
    ["miniature", t("home.screenMiniature")],
    ["recipe", t("home.screenRecipe")],
    ["scan", t("home.screenScan")],
    ["complement", t("home.screenComplement")],
    ["paints", t("home.screenPaints")],
    ["wishlist", t("home.screenWishlist")],
    ["plugins", t("home.screenPlugins")],
    ["settings", t("home.screenSettings")],
  ];
  return (
    <Container component="section" id="screenshots" maxWidth="lg" sx={{ mt: { xs: 10, md: 14 } }}>
      <SectionTitle
        eyebrow={t("home.realScreensTitle")}
        title={t("home.realScreensTitle")}
        body={t("home.realScreensBody")}
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
        {items.map(([name, title]) => (
          <Surface key={name} component="article" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
            <Typography component="h3" sx={{ fontWeight: 600, mb: 2 }}>
              {title}
            </Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center", justifyContent: "center" }}>
              <Box sx={{ width: "76%", display: { xs: "none", sm: "block" } }}>
                <a href={`/images/app/${name}.webp`}>
                  <Screenshot
                    src={`/images/app/${name}.webp`}
                    width={1440}
                    height={1000}
                    alt={`${title} — ${t("home.desktop")}`}
                    caption={t("home.desktop")}
                  />
                </a>
              </Box>
              <Box sx={{ width: { xs: "78%", sm: "22%" }, maxWidth: { xs: 290, sm: 120 } }}>
                <a href={`/images/app/phone-${name}.webp`}>
                  <Screenshot
                    src={`/images/app/phone-${name}.webp`}
                    width={780}
                    height={1688}
                    alt={`${title} — ${t("home.phone")}`}
                    caption={t("home.phone")}
                  />
                </a>
              </Box>
            </Box>
            <Box sx={{ display: { xs: "block", sm: "none" }, textAlign: "center", mt: 2 }}>
              <a href={`/images/app/${name}.webp`}>{t("home.desktop")}</a>
            </Box>
          </Surface>
        ))}
      </Box>
    </Container>
  );
}

export function HomePage() {
  return (
    <>
      <Hero />
      <HomePhonePrivacy />
      <Stats />
      <Screens />
      <Container maxWidth="lg" sx={{ mt: { xs: 12, md: 16 }, display: "grid", gap: { xs: 12, md: 16 } }}>
        <Showcase
          eyebrow={t("home.paints")}
          title={t("home.knowExactlyWhatSOnYourShelf")}
          body={t("home.everyBottleInOneSearchableLibraryInstallPaintRangesAs")}
          points={[
            t("home.installPaintCatalogsAsPluginsFromGitHubOrAZip"),
            t("home.ownedWishlistAndQuantityAtAGlance"),
            t("home.addCustomColorsYourCatalogIsMissing"),
          ]}
          link={{ label: t("home.exploreThePaintLibrary"), href: "/docs/#paints" }}
          preview={
            <Screenshot
              src="/images/app/paints.webp"
              width={1440}
              height={1000}
              alt={t("home.thePaintsLibraryFilteredToOwnedPaintsEachRowWith")}
              caption={t("home.thePaintLibrary")}
            />
          }
        />
        <Showcase
          reverse
          eyebrow={t("home.projects")}
          title={t("home.openAModelSeeWhatSMissing")}
          body={t("home.eachMiniatureKeepsItsNotesPhotosAndPaintRecipePaint")}
          points={[
            t("home.recipesCheckThemselvesAgainstYourCollection"),
            t("home.sendMissingPaintsToTheWishlistInOneTap"),
            t("home.attachReusableSchemesToAnyMiniature"),
          ]}
          link={{ label: t("home.planAMiniature"), href: "/docs/#miniatures" }}
          preview={
            <Screenshot
              src="/images/app/phone-recipe.webp"
              width={780}
              height={1688}
              alt={t("home.screenRecipe")}
              caption={t("home.aMiniatureSRecipeAndPaintingStage")}
              sx={{ maxWidth: 440, mx: "auto" }}
            />
          }
        />
        <Showcase
          eyebrow={t("home.paintTools")}
          title={t("home.complementTitle")}
          body={t("home.complementBody")}
          points={[t("home.complementStrength"), t("home.complementTargets"), t("home.complementSave")]}
          link={{ label: t("home.learnAboutPaintTools"), href: "/docs/#paint-tools" }}
          preview={
            <Screenshot
              src="/images/app/complement.webp"
              width={1440}
              height={1000}
              alt={t("home.screenComplement")}
              caption={t("home.screenComplement")}
            />
          }
        />
      </Container>
      <AppGallery />
      <Hosting />
      <Container maxWidth="lg" sx={{ mt: { xs: 8, md: 10 } }}>
        <CtaBand
          title={t("home.readyForTheNextSession")}
          body={t("home.installTheDesktopAppOrRunYourOwnWebVault")}
          action={t("home.getStarted")}
          href="/download/"
          icon={<ArrowForwardIcon />}
        />
      </Container>
    </>
  );
}
