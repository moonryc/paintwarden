import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import DesktopWindowsOutlined from "@mui/icons-material/DesktopWindowsOutlined";
import DnsOutlined from "@mui/icons-material/DnsOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import AccessibilityNew from "@mui/icons-material/AccessibilityNew";
import BookmarksOutlined from "@mui/icons-material/BookmarksOutlined";
import ColorizeOutlined from "@mui/icons-material/ColorizeOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import LockOutlined from "@mui/icons-material/LockOutlined";
import OpacityOutlined from "@mui/icons-material/OpacityOutlined";
import PaletteOutlined from "@mui/icons-material/PaletteOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import { Box, Button, Container, Typography } from "@mui/material";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import type { ComponentType, ReactNode } from "react";

import { CtaBand, IconTile, Screenshot, SectionTitle, Surface, serif } from "../components/primitives";

// The app's navigation, in the order its sidebar lists it.
const screens: [ComponentType<SvgIconProps>, string, string][] = [
  [
    DashboardOutlined,
    "Workbench",
    "See which miniatures are ready to paint and how many paints each project still needs.",
  ],
  [
    AccessibilityNew,
    "Miniatures",
    "Track every model you own or want, with photos, notes, and a painting stage from assembled to complete.",
  ],
  [
    OpacityOutlined,
    "Paints",
    "Search your installed ranges, mark bottles as owned, and keep count of what's on the shelf.",
  ],
  [FavoriteBorder, "Wishlist", "Collect missing paints and wanted miniatures in one list for the store."],
  [
    PaletteOutlined,
    "Schemes",
    "Save ordered color recipes with steps and reference images, then reuse them across models.",
  ],
  [
    BookmarksOutlined,
    "Templates",
    "Start a miniature from a template that already carries its schemes and paint steps.",
  ],
  [
    ColorizeOutlined,
    "Paint Tools",
    "Compare colors and convert a scheme into one built from paints you already own.",
  ],
];

const stats = [
  {
    value: "Plugins",
    label: "Catalogs you choose",
    detail: "Paints, schemes, and templates from GitHub or a .zip",
  },
  { value: "Yours", label: "Custom colors", detail: "Add paints, schemes, and templates of your own" },
  { value: "1 file", label: "Complete backups", detail: "Records, photos, and plugins in one .zip" },
  { value: "2", label: "Ways to run it", detail: "Desktop app or your own server" },
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
        src="/images/paint-desk-hero.png"
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
              New
            </Box>
            Paint Tools: compare colors and convert schemes
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
            Paint more.{" "}
            <Box component="span" sx={{ color: "var(--gold-text)", fontStyle: "italic", fontWeight: 500 }}>
              Hunt less.
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
            Paint Vault keeps your paints, miniatures, and color recipes together, so you know what&apos;s
            ready before you sit down to paint.
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            <Button
              href="/download/"
              variant="contained"
              size="large"
              startIcon={<DownloadIcon />}
              sx={{ px: 3 }}
            >
              Get Paint Vault
            </Button>
            <Button
              href="/docs/"
              variant="outlined"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{ px: 3 }}
            >
              See how it works
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
              [<DesktopWindowsOutlined key="d" />, "macOS & Windows"],
              [<DnsOutlined key="s" />, "Self-hosted web app"],
              [<LockOutlined key="l" />, "Your data stays yours"],
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
            width={2400}
            height={1500}
            alt="The Paint Vault workbench: 2 of 5 miniatures ready to paint, 3 paints missing, and project cards showing how many paints each still needs."
            caption="The workbench in the Paint Vault app"
            sx={{ display: { xs: "none", sm: "block" }, position: "relative", mr: { md: "12%" } }}
          />
          {/* Phones get the phone layout, which stays readable; wide screens overlay it on the window. */}
          <Screenshot
            src="/images/app/phone-workbench.webp"
            width={780}
            height={1688}
            alt="The Paint Vault workbench on a phone, with the summary and project cards stacked in one column."
            caption="The workbench on a phone"
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
        {stats.map((stat, index) => (
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
        eyebrow="The workbench"
        title="Everything on your painting desk, connected"
        body="Seven places in the app, each one aware of the others. Mark a paint as owned and every project that needs it updates."
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 2,
        }}
      >
        {screens.map(([Icon, label, copy]) => (
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
            Data & settings
          </Typography>
          <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.65, fontSize: 14.5 }}>
            Export and restore a backup, change the server connection, and choose whether sign-in is required.
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
      title: "On your computer",
      body: "The desktop app runs a private vault on macOS or Windows. No separate server to set up.",
    },
    {
      icon: <DnsOutlined />,
      title: "On your own server",
      body: "Run the web app with Docker Compose and open it from any browser on your network.",
    },
    {
      icon: <LockOutlined />,
      title: "Behind your sign-in",
      body: "A one-time setup code protects creating the owner account. The owner decides whether vault data needs sign-in.",
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
          eyebrow="Your vault, your rules"
          title="Your collection lives where you choose"
          body="Paint Vault stores your collection in a SQLite database on hardware you choose. The desktop app can also connect to a server you already run."
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

export function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <Screens />
      <Container maxWidth="lg" sx={{ mt: { xs: 12, md: 16 }, display: "grid", gap: { xs: 12, md: 16 } }}>
        <Showcase
          eyebrow="Paints"
          title="Know exactly what's on your shelf"
          body="Every bottle in one searchable library. Install paint ranges as plugins, mark what you own, set quantities, and add anything your catalog is missing."
          points={[
            "Install paint catalogs as plugins from GitHub or a .zip",
            "Owned, wishlist, and quantity at a glance",
            "Add custom colors your catalog is missing",
          ]}
          link={{ label: "Explore the paint library", href: "/docs/#paints" }}
          preview={
            <Screenshot
              src="/images/app/paints.webp"
              width={1600}
              height={1216}
              alt="The Paints library filtered to owned paints, each row with a color swatch, its range, and a bottle count."
              caption="The paint library"
            />
          }
        />
        <Showcase
          reverse
          eyebrow="Projects"
          title="Open a model, see what's missing"
          body="Each miniature keeps its notes, photos, and paint recipe. Paint Vault checks the recipe against your shelf and tells you what to buy."
          points={[
            "Recipes check themselves against your collection",
            "Send missing paints to the wishlist in one tap",
            "Attach reusable schemes to any miniature",
          ]}
          link={{ label: "Plan a miniature", href: "/docs/#miniatures" }}
          preview={
            <Screenshot
              src="/images/app/miniature.webp"
              width={960}
              height={1350}
              alt="A Knight Captain miniature in progress: painting stage, 2 paints to gather with 12 of 14 on hand, and three attached color schemes."
              caption="A miniature's recipe and painting stage"
              sx={{ maxWidth: 440, mx: "auto" }}
            />
          }
        />
        <Showcase
          eyebrow="Paint Tools"
          title="Find a stand-in from paints you own"
          body="Paint compare ranks catalog colors by how close they look on screen. The Recipe converter swaps a scheme's paints for ones on your shelf and saves a new copy."
          points={[
            "Lightness, hue, and vividness differences explained",
            "Review every swap before you save",
            "Your original scheme stays unchanged",
          ]}
          link={{ label: "Learn about Paint Tools", href: "/docs/#paint-tools" }}
          preview={
            <Screenshot
              src="/images/app/compare.webp"
              width={1600}
              height={1189}
              alt="Paint compare ranking the closest paints to Crimson Base by match percentage, with lightness, hue, and vividness differences."
              caption="Paint compare"
            />
          }
        />
      </Container>
      <Hosting />
      <Container maxWidth="lg" sx={{ mt: { xs: 8, md: 10 } }}>
        <CtaBand
          title="Ready for the next session?"
          body="Install the desktop app or run your own web vault."
          action="Get started"
          href="/download/"
          icon={<ArrowForwardIcon />}
        />
      </Container>
    </>
  );
}
