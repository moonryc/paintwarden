import Apple from "@mui/icons-material/Apple";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import DesktopWindowsOutlined from "@mui/icons-material/DesktopWindowsOutlined";
import DnsOutlined from "@mui/icons-material/DnsOutlined";
import Microsoft from "@mui/icons-material/Microsoft";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
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
import { releases, repository } from "../links";

type Choice = "desktop" | "server";

const platforms = [
  {
    platform: "macOS",
    icon: <Apple />,
    detail: "Built for Apple silicon Macs.",
  },
  {
    platform: "Windows",
    icon: <Microsoft />,
    detail: "Install a build made for Windows on a Windows machine.",
  },
];

const commands = [
  "git clone https://github.com/moonryc/paint-tracker.git",
  "cd paint-tracker",
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
        <Box sx={{ flex: 1, ml: 1, fontSize: 12, color: "var(--ink-faint)" }}>Terminal</Box>
        <Tooltip title={copied ? "Copied" : "Copy commands"}>
          <IconButton
            size="small"
            onClick={copy}
            aria-label="Copy commands"
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
          # Clone and start the web app
        </Box>
        {commands.map((command) => (
          <Box key={command} component="span" sx={{ display: "block" }}>
            <Box component="span" aria-hidden="true" sx={{ color: "var(--gold)", userSelect: "none" }}>
              ${" "}
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
        {platforms.map((item) => (
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
                Desktop
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
              View releases
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
            First launch
          </Typography>
          <Steps
            items={[
              {
                title: "Choose a connection",
                body: (
                  <>
                    Pick <strong>Use this computer</strong> for a local vault, or connect to a Paint Vault
                    server you already run.
                  </>
                ),
              },
              {
                title: "Create the owner account",
                body: "Set a username and a password of at least 12 characters.",
              },
              {
                title: "Install a catalog",
                body: "Open Data & settings → Plugins and add a paint catalog from GitHub or a .zip.",
              },
              { title: "Switch any time", body: "Change the connection later from Data & settings." },
            ]}
          />
        </Box>
        <Box>
          <Typography
            component="h2"
            sx={{ fontFamily: serif, fontWeight: 600, fontSize: 24, mb: 2.5, color: "#ececec" }}
          >
            No packaged build listed?
          </Typography>
          <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.7, fontSize: 14.5 }}>
            The releases page is the place to check for downloadable builds. You can also build the desktop
            app from source on its target operating system with{" "}
            <Box component="code" sx={code}>
              npm run desktop:package
            </Box>
            .
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
          Run it with Docker Compose
        </Typography>
        <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.7, mb: 3.5 }}>
          You need Docker Engine, Docker Compose v2, and Git.
        </Typography>
        <Steps
          items={[
            { title: "Clone and start", body: "Run the commands to build and start the service." },
            {
              title: "Open your vault",
              body: (
                <>
                  Visit{" "}
                  <Box component="code" sx={code}>
                    http://localhost:3000
                  </Box>{" "}
                  and create the owner account, using the setup code from{" "}
                  <Box component="code" sx={code}>
                    docker compose logs paint-vault
                  </Box>
                  .
                </>
              ),
            },
            {
              title: "Your data persists",
              body: "The database and uploaded images are stored in a persistent Docker volume.",
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
          Full setup guide
        </Button>
      </Box>
      <Terminal />
    </Box>
  );
}

export function DownloadPage() {
  const [choice, setChoice] = useState<Choice>("desktop");
  return (
    <Container maxWidth="lg">
      <PageIntro
        eyebrow="Get Paint Vault"
        title="Pick your kind of vault."
        description="Keep it on one computer, connect the desktop app to your own server, or open a self-hosted vault in the browser."
      />
      <ToggleButtonGroup
        exclusive
        value={choice}
        onChange={(_, value: Choice | null) => value && setChoice(value)}
        aria-label="Installation method"
        sx={{ mb: 4, "& .MuiToggleButton-root": { px: { xs: 2, sm: 2.5 }, py: 1.1, fontSize: 14, gap: 1 } }}
      >
        <ToggleButton value="desktop" aria-controls="desktop-panel">
          <DesktopWindowsOutlined fontSize="small" /> Desktop app
        </ToggleButton>
        <ToggleButton value="server" aria-controls="server-panel">
          <DnsOutlined fontSize="small" /> Self-hosted web
        </ToggleButton>
      </ToggleButtonGroup>
      <Box id="desktop-panel" role="region" aria-label="Desktop app" hidden={choice !== "desktop"}>
        <DesktopPanel />
      </Box>
      <Box id="server-panel" role="region" aria-label="Self-hosted web" hidden={choice !== "server"}>
        <ServerPanel />
      </Box>
      <Box sx={{ mt: { xs: 8, md: 10 } }}>
        <CtaBand
          title="Once it is running"
          body="Follow the quick guide to add your first paints and model."
          action="Read how to use it"
          href="/docs/"
          icon={<ArrowForwardIcon />}
        />
      </Box>
    </Container>
  );
}
