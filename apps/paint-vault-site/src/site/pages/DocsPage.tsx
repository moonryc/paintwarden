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
import { examplePlugin, repository } from "../links";

const steps = [
  {
    title: "Choose where your vault runs",
    body: "Install the desktop app for a local vault, connect it to an existing server, or run the web app with Docker Compose.",
  },
  {
    title: "Create the owner account",
    body: "On first use, set an owner username and a password of at least 12 characters. A server also asks for the one-time setup code printed in its log. Existing data remains when an older vault is upgraded.",
  },
  {
    title: "Install a catalog plugin",
    body: "A new vault starts empty. Open Data & settings → Plugins and add a catalog of paints, schemes, and templates from GitHub or a .zip file.",
  },
  {
    title: "Add paints and a miniature",
    body: "Mark bottles as owned, set quantities, then add a miniature and attach paint requirements or reusable schemes.",
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

const sections: Section[] = [
  {
    id: "plugins",
    label: "Plugins",
    title: "Install catalogs as plugins",
    icon: ExtensionOutlined,
    image: {
      src: "/images/app/plugins.webp",
      width: 1000,
      height: 1048,
      alt: "The Plugins dialog with a GitHub repository field, an Upload .zip button, and one installed plugin with 48 paints, 10 schemes, and 3 templates.",
      caption: "Data & settings → Plugins",
      maxWidth: 460,
    },
    body: (
      <>
        <p>
          Paint Vault doesn&rsquo;t bundle a paint catalog. Paints, color schemes, and miniature templates
          come from {strong("plugins")}: public GitHub repositories, or .zip files, in the Paint Vault source
          format. Open {strong("Data & settings → Plugins")}, then paste a repository in{" "}
          <code>owner/repository</code> form or choose {strong("Upload .zip")}. Plugins a catalog depends on
          are installed with it.
        </p>
        <p>
          To try it, install the example plugin{" "}
          <a href={`https://github.com/${examplePlugin}`} target="_blank" rel="noreferrer">
            <code>{examplePlugin}</code>
          </a>
          , a small catalog of sample paints, schemes, and templates. It can be removed afterward, as long as
          nothing in your vault uses its items.
        </p>
        <p>
          Installed catalogs stay available offline. Plugins from GitHub can be checked for updates and
          synced. To update an uploaded plugin, upload a newer version of it; uploading the same version
          changes nothing, and an older version is refused until the installed one is removed. A plugin can be
          removed once your vault no longer uses its paints, schemes, or templates; the app lists anything
          that still does.
        </p>
        <p>
          {strong("Create plugin")} packages your own paints, schemes, and templates as a ready-to-publish
          repository. The{" "}
          <a href={`${repository}/blob/main/docs/source-format.md`} target="_blank" rel="noreferrer">
            source format guide
          </a>{" "}
          describes every file.
        </p>
      </>
    ),
  },
  {
    id: "paints",
    label: "Paints",
    title: "Keep your paint library current",
    icon: ScienceOutlined,
    body: (
      <>
        <p>
          Open {strong("Paints")} to search the paints from your plugins, mark a paint as owned or wishlisted,
          and update the number of bottles on hand. Add your own paints when a color is missing from your
          catalog.
        </p>
      </>
    ),
  },
  {
    id: "miniatures",
    label: "Workbench",
    title: "Plan a miniature",
    icon: DashboardOutlined,
    image: {
      src: "/images/app/miniature.webp",
      width: 960,
      height: 1350,
      alt: "A miniature's detail view with its painting stage, the paints still to gather, and attached color schemes.",
      caption: "A miniature's detail view",
      maxWidth: 420,
    },
    body: (
      <>
        <p>
          Use {strong("Miniature")} in the sidebar to add a model to your collection or wishlist. Open its
          detail view to add notes, images, and paint requirements. Attach schemes to reuse a color recipe
          across models.
        </p>
        <p>
          The {strong("Workbench")} summarizes which projects are ready to paint and which paints are still
          missing. From a model’s paint recipe, add missing colors to your wishlist.
        </p>
      </>
    ),
  },
  {
    id: "schemes",
    label: "Schemes",
    title: "Build reusable schemes",
    icon: LayersOutlined,
    image: {
      src: "/images/app/schemes.webp",
      width: 2400,
      height: 1500,
      alt: "The Schemes screen with color recipe cards, each showing whether every paint is available and how many miniatures use it.",
      caption: "Schemes, filtered by plugin, color, and availability",
    },
    body: (
      <p>
        Open {strong("Schemes")} to browse color recipes or create your own. A scheme can include ordered
        paints, dividers, and reference images. Attach one to a miniature when you want its recipe available
        in the project.
      </p>
    ),
  },
  {
    id: "templates",
    label: "Templates",
    title: "Start from a template",
    icon: BookmarksOutlined,
    body: (
      <p>
        A {strong("template")} is a miniature&rsquo;s starting setup: its maker, faction, color schemes, and
        paint steps. Browse the templates from your plugins in {strong("Templates")}, pick one when you add a
        miniature, or use {strong("Save as template")} on a miniature you&rsquo;ve already planned.
      </p>
    ),
  },
  {
    id: "paint-tools",
    label: "Paint Tools",
    title: "Compare colors and convert recipes",
    icon: SwapHoriz,
    image: {
      src: "/images/app/converter.webp",
      width: 1600,
      height: 1189,
      alt: "The Recipe converter keeping three owned paints from a scheme and suggesting Scarlet, an 86% match, in place of a missing Ember Red.",
      caption: "Recipe converter",
    },
    body: (
      <>
        <p>
          {strong("Paint compare")} ranks catalog paints by screen-color similarity, with notes on lightness,
          hue, and vividness. Treat the score as a starting point: finish, primer, and coverage can change the
          real result.
        </p>
        <p>
          The {strong("Recipe converter")} adapts a scheme to your collection. Review the suggestions and save
          a new scheme; the source remains unchanged.
        </p>
      </>
    ),
  },
  {
    id: "wishlist",
    label: "Wishlist",
    title: "Gather what is missing",
    icon: ChecklistIcon,
    body: (
      <p>
        The {strong("Wishlist")} collects paints and miniatures you want. Add paints from a model’s missing
        recipe, then use the list while shopping. Updating paint ownership brings your collection and project
        readiness back together.
      </p>
    ),
  },
  {
    id: "backup",
    label: "Backups",
    title: "Back up your vault",
    icon: SaveOutlined,
    body: (
      <>
        <p>
          In {strong("Data & settings")}, {strong("Export")} saves one .zip file with everything in the vault:
          miniatures and their photos, paints, recipes, schemes, templates, and installed plugins. Your
          account and password aren&rsquo;t included.
        </p>
        <p>
          {strong("Restore from a backup")} shows what the file contains, then either merges it into the
          current vault or replaces the vault with it. The{" "}
          <a href={`${repository}#storage-and-backups`} target="_blank" rel="noreferrer">
            repository guide
          </a>{" "}
          also covers copying the Docker volume.
        </p>
      </>
    ),
  },
];

function Contents() {
  return (
    <Box
      component="nav"
      aria-label="On this page"
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
        On this page
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {sections.map(({ id, label, icon: Icon }) => (
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
        eyebrow="How to use"
        title="Get from shelf to session."
        description="A practical guide to setting up Paint Vault and using it during your miniature painting workflow."
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
        {steps.map((step, index) => (
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
        alt="The Paint Vault workbench: 2 of 5 miniatures ready to paint, 3 paints missing, and project cards showing how many paints each still needs."
        caption="The workbench, the first screen after setup"
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
          {sections.map(({ id, label, title, icon: Icon, body, image }) => (
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
          title="Need the installation steps?"
          body="Pick the desktop app or a self-hosted vault."
          action="Go to downloads"
          href="/download/"
          icon={<ArrowForwardIcon />}
        />
      </Box>
    </Container>
  );
}
