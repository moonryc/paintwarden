import ArrowForward from "@mui/icons-material/ArrowForward";
import PhoneIphoneOutlined from "@mui/icons-material/PhoneIphoneOutlined";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import { Box, Button, Container, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { IconTile, PageIntro, SectionTitle, Surface } from "../components/primitives";
import { siteT as t } from "../i18n";

const paragraph = { color: "var(--ink-soft)", lineHeight: 1.75, mt: 2 };

function GuideSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Surface component="section" sx={{ p: { xs: 3, md: 4 }, scrollMarginTop: 110 }}>
      <Typography
        id={id}
        component="h2"
        sx={{ fontSize: { xs: 23, md: 28 }, fontWeight: 600, scrollMarginTop: 110 }}
      >
        {title}
      </Typography>
      {children}
    </Surface>
  );
}

/** Homepage callouts share the page's translated, code-reviewed claims. */
export function HomePhonePrivacy() {
  return (
    <Container component="section" id="phone-privacy" maxWidth="lg" sx={{ mt: { xs: 8, md: 12 } }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
        {[
          {
            title: t("home.phoneTitle"),
            body: t("home.phoneBody"),
            action: t("home.phoneAction"),
            href: "/phone/",
            icon: <PhoneIphoneOutlined />,
          },
          {
            title: t("home.privacyTitle"),
            body: t("home.privacyBody"),
            action: t("home.privacyAction"),
            href: "/phone/#privacy",
            icon: <ShieldOutlined />,
          },
        ].map(({ title, body, action, href, icon }) => (
          <Surface key={href} sx={{ p: { xs: 3, md: 4 } }}>
            <IconTile>{icon}</IconTile>
            <Box sx={{ mt: 3 }}>
              <SectionTitle eyebrow={t("website.phonePrivacy")} title={title} body={body} />
            </Box>
            <Button href={href} variant="outlined" endIcon={<ArrowForward />}>
              {action}
            </Button>
          </Surface>
        ))}
      </Box>
    </Container>
  );
}

export function PhonePage() {
  return (
    <Container maxWidth="lg">
      <PageIntro eyebrow={t("phone.eyebrow")} title={t("phone.title")} description={t("phone.intro")} />
      <Box sx={{ display: "grid", gap: 3, maxWidth: 900, mx: "auto" }}>
        <GuideSection id="server" title={t("phone.serverTitle")}>
          <Typography sx={paragraph}>{t("phone.serverBody")}</Typography>
          <Box component="figure" sx={{ m: 0, mt: 3 }}>
            <Box
              component="img"
              src="/images/phone-access-settings.webp"
              alt={t("phone.settingsAlt")}
              width={1440}
              height={1050}
              loading="lazy"
              decoding="async"
              sx={{ display: "block", width: "100%", height: "auto", borderRadius: 2 }}
            />
            <Typography component="figcaption" sx={{ ...paragraph, fontSize: 13 }}>
              {t("phone.settingsCaption")}
            </Typography>
          </Box>
          <Typography sx={paragraph}>{t("phone.desktopNote")}</Typography>
          <Button href="/phone-access.md" variant="outlined" endIcon={<ArrowForward />} sx={{ mt: 3 }}>
            {t("phone.guideLink")}
          </Button>
        </GuideSection>
        <GuideSection id="remote" title={t("phone.remoteTitle")}>
          <Typography sx={paragraph}>{t("phone.remoteBody")}</Typography>
          <Typography sx={paragraph}>{t("phone.remoteSafety")}</Typography>
          <Button
            href="https://tailscale.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<ArrowForward />}
            sx={{ mt: 2 }}
          >
            {t("phone.tailscaleLink")}
          </Button>
        </GuideSection>
        <GuideSection id="home-screen" title={t("phone.homeScreenTitle")}>
          <Typography sx={paragraph}>{t("phone.homeScreenBody")}</Typography>
          <Typography sx={paragraph}>{t("phone.httpsNote")}</Typography>
        </GuideSection>
        <GuideSection id="privacy" title={t("phone.privacyTitle")}>
          <Typography sx={paragraph}>{t("phone.privacyBody")}</Typography>
          <Typography component="h3" sx={{ mt: 4, fontSize: 20, fontWeight: 600 }}>
            {t("phone.networkTitle")}
          </Typography>
          <Typography sx={paragraph}>{t("phone.networkBody")}</Typography>
          <Typography component="h3" sx={{ mt: 4, fontSize: 20, fontWeight: 600 }}>
            {t("phone.supportTitle")}
          </Typography>
          <Typography sx={paragraph}>{t("phone.supportBody")}</Typography>
          <Button href="/privacy.md" variant="outlined" endIcon={<ArrowForward />} sx={{ mt: 3 }}>
            {t("phone.privacyLink")}
          </Button>
        </GuideSection>
        <GuideSection id="website-privacy" title={t("phone.siteTitle")}>
          <Typography sx={paragraph}>{t("phone.siteBody")}</Typography>
        </GuideSection>
      </Box>
    </Container>
  );
}
