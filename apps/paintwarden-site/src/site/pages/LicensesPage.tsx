import { Box, Button, Container } from "@mui/material";

import { PageIntro } from "../components/primitives";
import { siteT as t } from "../i18n";

export function LicensesPage({ notices }: { notices: string }) {
  return (
    <Container maxWidth="lg">
      <PageIntro
        eyebrow={t("website.project")}
        title={t("website.openSourceLicenses")}
        description={t("licenses.description")}
      >
        <Button component="a" href="/THIRD_PARTY_NOTICES.txt" download variant="outlined" sx={{ mt: 3 }}>
          {t("licenses.download")}
        </Button>
      </PageIntro>
      <Box
        component="pre"
        lang="en"
        sx={{
          m: 0,
          p: { xs: 2, md: 3 },
          border: "1px solid var(--line)",
          borderRadius: 2,
          bgcolor: "var(--surface)",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {notices}
      </Box>
    </Container>
  );
}
