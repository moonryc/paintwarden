import Apple from "@mui/icons-material/Apple";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import DesktopWindowsOutlined from "@mui/icons-material/DesktopWindowsOutlined";
import DnsOutlined from "@mui/icons-material/DnsOutlined";
import Microsoft from "@mui/icons-material/Microsoft";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Alert,
  Box,
  Button,
  Container,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState, type ReactNode } from "react";

import { CtaBand, IconTile, PageIntro, Surface, serif } from "../components/primitives";
import { siteT as t } from "../i18n";
import { betaTesterGuide, releases, releasesAvailable, repository } from "../links";

type Choice = "desktop" | "server";

const platforms = () => [
  {
    platform: "macOS",
    icon: <Apple />,
    detail: t("download.builtForAppleSiliconMacs"),
  },
  {
    platform: "Windows",
    icon: <Microsoft />,
    detail: t("download.installABuildMadeForWindowsOnAWindowsMachine"),
  },
];

const commands = [
  "git clone --branch v1.0.0-beta.1 --depth 1 https://github.com/moonryc/paintwarden.git",
  "cd paintwarden",
  "docker compose up -d --build",
];

function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 2.5 }}>
      {items.map((item, index) => (
        <Box component="li" key={item.title} sx={{ display: "flex", gap: 2 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              bgcolor: "var(--gold-soft)",
              color: "var(--gold-text)",
              fontFamily: serif,
              fontWeight: 600,
            }}
          >
            {index + 1}
          </Box>
          <Box>
            <Typography component="h3" sx={{ fontWeight: 600, fontSize: 16, mb: 0.5 }}>
              {item.title}
            </Typography>
            <Typography component="div" sx={{ color: "var(--ink-soft)", lineHeight: 1.7, fontSize: 14.5 }}>
              {item.body}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

const code = {
  px: 0.75,
  py: 0.25,
  borderRadius: "6px",
  bgcolor: "var(--sunken)",
  color: "var(--ink)",
  fontSize: "0.9em",
};

function Terminal() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(commands.join("\n"))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => undefined);
  };
  return (
    <Box
      sx={{
        borderRadius: "16px",
        border: "1px solid var(--line-strong)",
        bgcolor: "#161616",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 2,
          pr: 1,
          height: 44,
          borderBottom: "1px solid var(--line)",
          bgcolor: "#1b1b1b",
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
          <Box
            key={color}
            aria-hidden="true"
            sx={{ width: 11, height: 11, borderRadius: 999, bgcolor: color, opacity: 0.8 }}
          />
        ))}
        <Box sx={{ flex: 1, ml: 1, fontSize: 12, color: "var(--ink-faint)" }}>{t("download.terminal")}</Box>
        <Tooltip title={copied ? t("download.copied") : t("download.copyCommands")}>
          <IconButton
            size="small"
            onClick={copy}
            aria-label={t("download.copyCommands")}
            sx={{ color: copied ? "var(--ok)" : "var(--ink-faint)" }}
          >
            {copied ? <CheckIcon fontSize="small" /> : <ContentCopyOutlined fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: { xs: 2, md: 3 },
          overflowX: "auto",
          fontFamily: "var(--default-mono-font-family)",
          fontSize: { xs: 12.5, sm: 14 },
          lineHeight: 2,
          color: "#dfe5f3",
        }}
      >
        <Box component="span" sx={{ color: "var(--ink-faint)" }}>
          {t("download.cloneAndStartTheWebApp")}
        </Box>
        {commands.map((command) => (
          <Box key={command} component="span" sx={{ display: "block" }}>
            <Box component="span" aria-hidden="true" sx={{ color: "var(--gold)", userSelect: "none" }}>
              {t("download.text")}{" "}
            </Box>
            {command}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function DesktopPanel() {
  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        {platforms().map((item) => (
          <Surface
            key={item.platform}
            component="article"
            sx={{ p: { xs: 3, md: 4 }, display: "flex", flexDirection: "column", minHeight: { md: 250 } }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
              <IconTile>{item.icon}</IconTile>
              <Box
                sx={{
                  px: 1.25,
                  py: 0.4,
                  borderRadius: 999,
                  bgcolor: "var(--sunken)",
                  color: "var(--ink-faint)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                {t("download.desktop")}
              </Box>
            </Box>
            <Typography
              component="h2"
              sx={{ fontFamily: serif, fontWeight: 600, fontSize: 30, mb: 1, color: "#ececec" }}
            >
              {item.platform}
            </Typography>
            <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.7, mb: 3 }}>{item.detail}</Typography>
            <Button
              href={releases}
              target="_blank"
              rel="noreferrer"
              variant="contained"
              size="large"
              endIcon={<OpenInNewIcon />}
              sx={{ alignSelf: "start", mt: "auto" }}
            >
              {t("download.viewReleases")}
            </Button>
          </Surface>
        ))}
      </Box>
      <Surface
        sx={{
          mt: 2,
          p: { xs: 3, md: 4 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: { xs: 4, md: 6 },
        }}
      >
        <Box>
          <Typography
            component="h2"
            sx={{ fontFamily: serif, fontWeight: 600, fontSize: 24, mb: 2.5, color: "#ececec" }}
          >
            {t("download.firstLaunch")}
          </Typography>
          <Steps
            items={[
              {
                title: t("download.chooseAConnection"),
                body: (
                  <>
                    {t("download.pick")} <strong>{t("download.useThisComputer")}</strong>{" "}
                    {t("download.forALocalVaultOrConnectToAPaintwarden")}
                  </>
                ),
              },
              {
                title: t("download.createTheOwnerAccount"),
                body: t("download.setAUsernameAndAPasswordOfAtLeast12"),
              },
              {
                title: t("download.installACatalog"),
                body: t("download.openDataSettingsPluginsAndAddAPaintCatalogFrom"),
              },
              {
                title: t("download.switchAnyTime"),
                body: t("download.changeTheConnectionLaterFromDataSettings"),
              },
            ]}
          />
        </Box>
        <Box>
          <Typography
            component="h2"
            sx={{ fontFamily: serif, fontWeight: 600, fontSize: 24, mb: 2.5, color: "#ececec" }}
          >
            {t("download.noPackagedBuildListed")}
          </Typography>
          <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.7, fontSize: 14.5 }}>
            {t("download.theReleasesPageIsThePlaceToCheckForDownloadable")}{" "}
            <Box component="code" sx={code}>
              {t("download.npmRunDesktopPackage")}
            </Box>
            {t("download.text2")}
          </Typography>
        </Box>
      </Surface>
    </>
  );
}

function ServerPanel() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, .9fr) minmax(0, 1.1fr)" },
        gap: { xs: 4, md: 6 },
        alignItems: "start",
      }}
    >
      <Box>
        <Typography
          component="h2"
          sx={{ fontFamily: serif, fontWeight: 600, fontSize: { xs: 28, md: 34 }, mb: 1.5, color: "#ececec" }}
        >
          {t("download.runItWithDockerCompose")}
        </Typography>
        <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.7, mb: 3.5 }}>
          {t("download.youNeedDockerEngineDockerComposeV2AndGit")}
        </Typography>
        <Steps
          items={[
            {
              title: t("download.cloneAndStart"),
              body: t("download.runTheCommandsToBuildAndStartTheService"),
            },
            {
              title: t("download.openYourVault"),
              body: (
                <>
                  {t("download.visit")}{" "}
                  <Box component="code" sx={code}>
                    {t("download.httpLocalhost3000")}
                  </Box>{" "}
                  {t("download.andCreateTheOwnerAccountUsingTheSetupCodeFrom")}{" "}
                  <Box component="code" sx={code}>
                    {t("download.dockerComposeLogsPaintwarden")}
                  </Box>
                  {t("download.text2")}
                </>
              ),
            },
            {
              title: t("download.yourDataPersists"),
              body: t("download.theDatabaseAndUploadedImagesAreStoredInAPersistent"),
            },
          ]}
        />
        <Button
          href={`${repository}#docker-compose-setup`}
          target="_blank"
          rel="noreferrer"
          variant="outlined"
          endIcon={<OpenInNewIcon />}
          sx={{ mt: 3.5 }}
        >
          {t("download.fullSetupGuide")}
        </Button>
      </Box>
      <Terminal />
    </Box>
  );
}

export function DownloadPage() {
  const [choice, setChoice] = useState<Choice>("desktop");
  if (!releasesAvailable) {
    return (
      <Container maxWidth="lg">
        <PageIntro
          eyebrow={t("website.download")}
          title={t("download.getPaintwarden")}
          description={t("download.comingSoon")}
        />
        <Button href="/docs/" variant="outlined" endIcon={<ArrowForwardIcon />}>
          {t("download.readHowToUseIt")}
        </Button>
      </Container>
    );
  }
  return (
    <Container maxWidth="lg">
      <PageIntro
        eyebrow={t("download.getPaintwarden")}
        title={t("download.pickYourKindOfVault")}
        description={t("download.keepItOnOneComputerConnectTheDesktopAppTo")}
      />
      <Alert severity="info" sx={{ mb: 3 }}>
        {t("download.betaScope")}
        <Box sx={{ mt: 1 }}>
          <Button href={betaTesterGuide} target="_blank" rel="noopener noreferrer">
            {t("website.betaTesterGuide")}
          </Button>
        </Box>
      </Alert>
      <ToggleButtonGroup
        exclusive
        value={choice}
        onChange={(_, value: Choice | null) => value && setChoice(value)}
        aria-label={t("download.installationMethod")}
        sx={{ mb: 4, "& .MuiToggleButton-root": { px: { xs: 2, sm: 2.5 }, py: 1.1, fontSize: 14, gap: 1 } }}
      >
        <ToggleButton value="desktop" aria-controls="desktop-panel">
          <DesktopWindowsOutlined fontSize="small" /> {t("download.desktopApp")}
        </ToggleButton>
        <ToggleButton value="server" aria-controls="server-panel">
          <DnsOutlined fontSize="small" /> {t("download.selfHostedWeb")}
        </ToggleButton>
      </ToggleButtonGroup>
      <Box
        id="desktop-panel"
        role="region"
        aria-label={t("download.desktopApp")}
        hidden={choice !== "desktop"}
      >
        <DesktopPanel />
      </Box>
      <Box
        id="server-panel"
        role="region"
        aria-label={t("download.selfHostedWeb")}
        hidden={choice !== "server"}
      >
        <ServerPanel />
      </Box>
      <Box sx={{ mt: { xs: 8, md: 10 } }}>
        <CtaBand
          title={t("download.onceItIsRunning")}
          body={t("download.followTheQuickGuideToAddYourFirstPaintsAnd")}
          action={t("download.readHowToUseIt")}
          href="/docs/"
          icon={<ArrowForwardIcon />}
        />
      </Box>
    </Container>
  );
}
