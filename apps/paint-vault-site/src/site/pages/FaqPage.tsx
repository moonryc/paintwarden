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

type Group = "data" | "desktop" | "tools";

const groups: { id: Group; title: string; icon: ReactNode }[] = [
  { id: "data", title: "Your data & account", icon: <StorageOutlined /> },
  { id: "desktop", title: "Desktop app", icon: <DesktopWindowsOutlined /> },
  { id: "tools", title: "Paints & Paint Tools", icon: <SwapHoriz /> },
];

const questions: { question: string; answer: string; group: Group }[] = [
  {
    question: "Where is my vault data stored?",
    group: "data",
    answer:
      "The self-hosted server stores app records in SQLite and uploaded images as files in its data directory. The desktop app uses its own application-data folder on your computer. Your desktop and web vaults are separate unless the desktop app connects to that web server.",
  },
  {
    question: "Do I need an account?",
    group: "data",
    answer:
      "Each vault has one owner account, created on first use. A server asks for a one-time setup code from its log, so only the person running it can create the owner. The owner can require sign-in, and change the username or password, in Data & settings. If sign-in is turned off, only expose the server on a trusted network or behind an authenticated proxy.",
  },
  {
    question: "Can the desktop app connect to my server?",
    group: "desktop",
    answer:
      "Yes. At first launch, choose the bundled local server or connect to an existing Paint Vault server. You can switch that choice later in Data & settings.",
  },
  {
    question: "Does the app work offline?",
    group: "desktop",
    answer:
      "A desktop vault running on your computer can be used without a separate remote server. A desktop app connected to a remote server needs that server to be reachable. The self-hosted web app needs its server running.",
  },
  {
    question: "Does a backup include my photos?",
    group: "data",
    answer:
      "Yes. Export in Data & settings saves one .zip with your records, miniature photos, and installed plugins. Restoring it lets you merge into the current vault or replace it. Your account and password are not included.",
  },
  {
    question: "Where do the paints come from?",
    group: "tools",
    answer:
      "From plugins. Paint Vault doesn't bundle a catalog, so a new vault starts empty. Open Data & settings → Plugins and add a public GitHub repository or upload a plugin .zip to install its paints, color schemes, and miniature templates.",
  },
  {
    question: "Can I share my own schemes and paints?",
    group: "tools",
    answer:
      "Yes. Create plugin in the Plugins dialog packages your own paints, schemes, and templates as a .zip. Publish it as a public GitHub repository, or send the .zip so others can upload it.",
  },
  {
    question: "How accurate is Paint Compare?",
    group: "tools",
    answer:
      "It compares the catalog's screen colors. A high score does not guarantee two paints look identical on a model. Finish, opacity, primer, and lighting can change the result.",
  },
  {
    question: "Does the Recipe converter replace my original scheme?",
    group: "tools",
    answer:
      "No. It saves a new reusable scheme with your reviewed paint choices. The original scheme remains available.",
  },
  {
    question: "Can I add paints that no plugin includes?",
    group: "tools",
    answer: "Yes. Use Add paint in the Paints library to create a custom color entry.",
  },
];

export function FaqPage() {
  return (
    <Container maxWidth="lg">
      <PageIntro
        eyebrow="Frequently asked questions"
        title="The little details matter."
        description="Answers about setup, storage, desktop use, and the paint planning tools."
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
          {groups.map((group) => (
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
                {questions
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
            Still figuring it out?
          </Typography>
          <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.65, fontSize: 14.5, mb: 2.5 }}>
            The getting started guide walks through the core workflow, from your first paint to your first
            finished recipe.
          </Typography>
          <Button href="/docs/" variant="outlined" fullWidth endIcon={<ArrowForwardIcon />}>
            Read the guide
          </Button>
        </Surface>
      </Box>
    </Container>
  );
}
