import { Box, Button, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

import { siteT as t } from "../i18n";

type SxItem = Exclude<SxProps<Theme>, readonly unknown[]>;

/** Flattens an optional `sx` prop so it can follow a component's base styles. */
export function sxItems(sx?: SxProps<Theme>): SxItem[] {
  if (sx === undefined) return [];
  return Array.isArray(sx) ? (sx as SxItem[]) : [sx as SxItem];
}

export const serif = '"Fraunces", Georgia, "Times New Roman", serif';

/** The same paint-pot mark used by the app's favicon. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Box
      component="img"
      src="/favicon.svg"
      alt=""
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
      }}
    />
  );
}

export function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <BrandMark size={size === "sm" ? 32 : 40} />
      <Box component="span">
        <Box
          component="span"
          sx={{
            display: "block",
            fontFamily: serif,
            fontWeight: 600,
            fontSize: size === "sm" ? 16 : 18,
            lineHeight: 1,
            color: "var(--ink)",
          }}
        >
          {t("primitives.paintwarden")}
        </Box>
        <Box
          component="span"
          sx={{
            display: "block",
            mt: 0.5,
            fontSize: size === "sm" ? 9 : 10,
            fontWeight: 600,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          {t("primitives.miniatureStudio")}
        </Box>
      </Box>
    </Box>
  );
}

export function Eyebrow({ children, tone = "faint" }: { children: ReactNode; tone?: "faint" | "gold" }) {
  return (
    <Typography
      component="p"
      sx={{
        m: 0,
        mb: 1.25,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".16em",
        textTransform: "uppercase",
        color: tone === "gold" ? "var(--gold-text)" : "var(--ink-faint)",
      }}
    >
      {children}
    </Typography>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Box component="section" sx={{ position: "relative", pt: { xs: 7, md: 11 }, pb: { xs: 5, md: 7 } }}>
      <Glow />
      <Box sx={{ position: "relative", maxWidth: 760 }}>
        <Eyebrow tone="gold">{eyebrow}</Eyebrow>
        <Typography
          component="h1"
          sx={{
            fontFamily: serif,
            fontWeight: 600,
            fontSize: { xs: 40, sm: 52, md: 64 },
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            color: "#ececec",
            mb: 2.5,
          }}
        >
          {title}
        </Typography>
        <Typography sx={{ color: "var(--ink-soft)", fontSize: { xs: 16, md: 18 }, lineHeight: 1.65 }}>
          {description}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  body,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
}) {
  return (
    <Box sx={{ mb: { xs: 4, md: 5 }, maxWidth: 640, mx: align === "center" ? "auto" : 0, textAlign: align }}>
      <Eyebrow tone="gold">{eyebrow}</Eyebrow>
      <Typography
        component="h2"
        sx={{
          fontFamily: serif,
          fontWeight: 600,
          fontSize: { xs: 30, md: 42 },
          lineHeight: 1.1,
          letterSpacing: "-0.025em",
          color: "#ececec",
          mb: body ? 1.75 : 0,
        }}
      >
        {title}
      </Typography>
      {body && (
        <Typography sx={{ color: "var(--ink-soft)", lineHeight: 1.7, fontSize: { xs: 15, md: 16 } }}>
          {body}
        </Typography>
      )}
    </Box>
  );
}

/** Soft brand and gold light behind page headings. */
export function Glow({ sx }: { sx?: SxProps<Theme> }) {
  return (
    <Box
      aria-hidden="true"
      sx={[
        {
          position: "absolute",
          pointerEvents: "none",
          top: { xs: -40, md: -80 },
          left: { xs: -120, md: -200 },
          width: { xs: 420, md: 760 },
          height: { xs: 320, md: 520 },
          background:
            "radial-gradient(closest-side, rgb(64 106 194 / 22%), transparent), radial-gradient(closest-side at 70% 60%, rgb(217 183 43 / 9%), transparent)",
          filter: "blur(10px)",
        },
        ...sxItems(sx),
      ]}
    />
  );
}

/** Matches the app's outlined MUI Card surface. */
export function Surface({
  children,
  sx,
  component = "div",
}: {
  children: ReactNode;
  sx?: SxProps<Theme>;
  component?: "div" | "section" | "article" | "li";
}) {
  return (
    <Box
      component={component}
      sx={[
        {
          border: "1px solid var(--line)",
          borderRadius: "20px",
          bgcolor: "var(--surface)",
          boxShadow: "0 1px 2px rgb(0 0 0 / 6%), 0 1px 1px rgb(0 0 0 / 4%)",
        },
        ...sxItems(sx),
      ]}
    >
      {children}
    </Box>
  );
}

export function IconTile({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "gold" | "ok";
}) {
  const colors = {
    brand: ["var(--brand-soft)", "var(--brand-text)"],
    gold: ["var(--gold-soft)", "var(--gold-text)"],
    ok: ["var(--ok-soft)", "var(--ok)"],
  }[tone];
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        width: 44,
        height: 44,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        borderRadius: "12px",
        bgcolor: colors[0],
        color: colors[1],
        "& svg": { fontSize: 22 },
      }}
    >
      {children}
    </Box>
  );
}

export function CtaBand({
  title,
  body,
  action,
  href,
  icon,
}: {
  title: string;
  body: string;
  action: string;
  href: string;
  icon?: ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "24px",
        border: "1px solid #34466e",
        background: "linear-gradient(135deg, #2b3d66 0%, #263452 45%, #262626 100%)",
        p: { xs: 3.5, md: 6 },
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 3,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          right: -60,
          top: -90,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgb(217 183 43 / 18%), transparent)",
        }}
      />
      <Box sx={{ position: "relative", display: "flex", gap: 2.5, alignItems: "center" }}>
        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <BrandMark size={56} />
        </Box>
        <Box>
          <Typography
            component="h2"
            sx={{
              fontFamily: serif,
              fontWeight: 600,
              fontSize: { xs: 28, md: 38 },
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: "#ececec",
              mb: 1,
            }}
          >
            {title}
          </Typography>
          <Typography sx={{ color: "#c3cbe0" }}>{body}</Typography>
        </Box>
      </Box>
      <Button
        href={href}
        variant="contained"
        size="large"
        endIcon={icon}
        sx={{
          position: "relative",
          bgcolor: "#f0f0f0",
          color: "#1f2b45",
          px: 3,
          "&:hover": { bgcolor: "#ffffff" },
        }}
      >
        {action}
      </Button>
    </Box>
  );
}

/** A screenshot of the real app, framed like a window, with alt text and a visible caption. */
export function Screenshot({
  src,
  alt,
  width,
  height,
  caption,
  priority = false,
  sx,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  priority?: boolean;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box component="figure" sx={[{ m: 0, minWidth: 0 }, ...sxItems(sx)]}>
      <Box
        component="img"
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        sx={{
          display: "block",
          width: "100%",
          height: "auto",
          borderRadius: "14px",
          border: "1px solid var(--line-strong)",
          bgcolor: "var(--surface)",
          boxShadow: "0 30px 80px -30px rgb(0 0 0 / 70%)",
        }}
      />
      {caption && (
        <Box
          component="figcaption"
          sx={{ color: "var(--ink-faint)", fontSize: 12.5, mt: 1.5, textAlign: "center" }}
        >
          {caption}
        </Box>
      )}
    </Box>
  );
}
