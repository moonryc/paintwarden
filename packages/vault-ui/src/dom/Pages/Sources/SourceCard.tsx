import { translateServerError } from "../../i18n";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import NewReleasesOutlinedIcon from "@mui/icons-material/NewReleasesOutlined";
import { Alert, Box, Button, Card, CircularProgress, IconButton, Tooltip } from "@mui/material";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatNumber } from "../../i18n";
import { ExternalLink, FileUp, RotateCw, Trash2 } from "../../icons";
import { imageUrl } from "../../utils/image-cache";

import { type CatalogSource, type SourceVersion, isUploadedSource, repositoryLabel } from "./sources.utils";

function SourceStatus({
  source,
  remote,
  checking,
}: {
  source: CatalogSource;
  remote?: SourceVersion;
  checking: boolean;
}) {
  const { t } = useTranslation("pages");
  const [tone, icon, label] = isUploadedSource(source)
    ? (["muted", null, t("sourcesUploadedFile")] as const)
    : source.lastError
      ? (["rust", <ErrorOutlineIcon key="i" sx={{ fontSize: 14 }} />, t("sourcesUpdateFailed")] as const)
      : remote?.updateAvailable
        ? ([
            "gold",
            <NewReleasesOutlinedIcon key="i" sx={{ fontSize: 14 }} />,
            t("sourcesVersionAvailable", { version: remote.availableVersion }),
          ] as const)
        : checking && !remote
          ? ([
              "muted",
              <CircularProgress
                key="i"
                size={10}
                color="inherit"
                aria-label={t("sourcesCheckingPluginUpdate")}
              />,
              t("sourcesChecking"),
            ] as const)
          : remote && !remote.error
            ? ([
                "ok",
                <CheckCircleOutlineIcon key="i" sx={{ fontSize: 14 }} />,
                t("sourcesUpToDate"),
              ] as const)
            : (["muted", null, t("sourcesOfflineCopy")] as const);
  const colors = {
    rust: { bg: "var(--rust-soft)", fg: "var(--rust)" },
    gold: { bg: "var(--gold-soft)", fg: "var(--gold-text)" },
    ok: { bg: "var(--ok-soft)", fg: "var(--ok)" },
    muted: { bg: "var(--sunken)", fg: "var(--ink-faint)" },
  }[tone];
  return (
    <Tooltip title={remote?.error ? t("sourcesCouldnTReachGitHubToCheckForUpdates") : ""}>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          flexShrink: 0,
          px: 1,
          py: 0.25,
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 650,
          bgcolor: colors.bg,
          color: colors.fg,
        }}
      >
        {icon}
        {label}
      </Box>
    </Tooltip>
  );
}

function CountChip({ count, label }: { count: number; label: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: "8px",
        bgcolor: "var(--sunken)",
        fontSize: 12,
        color: count ? "var(--ink-soft)" : "var(--ink-faint)",
      }}
    >
      <Box
        component="strong"
        sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}
      >
        {formatNumber(count)}
      </Box>
      {label}
    </Box>
  );
}

function MetaLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ fontSize: 12, color: "var(--ink-faint)", overflowWrap: "anywhere" }}>
      <Box component="span" sx={{ fontWeight: 650, color: "var(--ink-soft)" }}>
        {label}
      </Box>{" "}
      {children}
    </Box>
  );
}

// A source's logo.svg when it has one, otherwise the first letter of its name.
function SourceLogo({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showLogo = !!logoUrl && failedUrl !== logoUrl;
  return (
    <Box
      aria-hidden
      sx={{
        display: "grid",
        placeItems: "center",
        width: 44,
        height: 44,
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: "12px",
        bgcolor: showLogo ? "var(--sunken)" : "var(--brand-soft)",
        border: showLogo ? "1px solid var(--line)" : 0,
        color: "var(--brand)",
        fontFamily: "var(--font-serif, serif)",
        fontSize: 20,
        fontWeight: 700,
      }}
    >
      {showLogo ? (
        <Box
          component="img"
          src={imageUrl(logoUrl)}
          alt=""
          draggable={false}
          onError={() => setFailedUrl(logoUrl)}
          sx={{ width: "100%", height: "100%", p: 0.75, objectFit: "contain" }}
        />
      ) : (
        name.trim().charAt(0).toUpperCase() || "?"
      )}
    </Box>
  );
}

export function SourceCard({
  source,
  remote,
  checking,
  requires,
  requiredBy,
  updating,
  disabled,
  onUpdate,
  onRemove,
}: {
  source: CatalogSource;
  remote?: SourceVersion;
  checking: boolean;
  requires: string[];
  requiredBy: string[];
  updating: boolean;
  disabled: boolean;
  onUpdate(): void;
  onRemove(): void;
}) {
  const { t } = useTranslation("pages");
  const counts = source.counts;
  const uploaded = isUploadedSource(source);
  const hasUpdate = !uploaded && !!remote?.updateAvailable;
  const hasMeta = requires.length > 0 || requiredBy.length > 0 || source.license || source.attribution;
  return (
    <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
      {/* Logo, name and repository on the left; the source's actions on the right. */}
      <Box sx={{ display: "flex", gap: 1.75, alignItems: "flex-start" }}>
        <SourceLogo name={source.name} logoUrl={source.logoUrl} />
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            columnGap: 2,
            rowGap: 1.25,
          }}
        >
          <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 1, rowGap: 0.5 }}>
              <Box component="h4" sx={{ m: 0, fontSize: 16, fontWeight: 650, overflowWrap: "anywhere" }}>
                {source.name}
              </Box>
              <SourceStatus source={source} remote={remote} checking={checking} />
            </Box>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                columnGap: 1,
                mt: 0.25,
                fontSize: 13,
                color: "var(--ink-faint)",
              }}
            >
              <Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {t("sourcesVersionValue", { version: source.version })}
              </Box>
              <Box component="span" aria-hidden>
                ·
              </Box>
              {uploaded ? (
                <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <FileUp size={13} />
                  {t("sourcesInstalledFromAZip")}
                </Box>
              ) : (
                <Box
                  component="a"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    minWidth: 0,
                    color: "inherit",
                    textDecoration: "none",
                    overflowWrap: "anywhere",
                    "&:hover": { color: "var(--ink)", textDecoration: "underline" },
                  }}
                >
                  {repositoryLabel(source.url)}
                  <ExternalLink size={13} />
                </Box>
              )}
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
            {!uploaded && (
              <Button
                size="small"
                variant={hasUpdate || source.lastError ? "contained" : "outlined"}
                startIcon={<RotateCw size={16} />}
                loading={updating}
                disabled={disabled && !updating}
                onClick={onUpdate}
              >
                {source.lastError
                  ? t("sourcesRetry")
                  : hasUpdate
                    ? t("sourcesUpdateVersion", { version: remote?.availableVersion })
                    : t("sourcesSync")}
              </Button>
            )}
            <Tooltip title={t("sourcesRemovePlugin")}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t("sourcesRemoveNamed", { name: source.name })}
                  disabled={disabled}
                  onClick={onRemove}
                  sx={{ color: "var(--ink-faint)", "&:hover": { color: "error.main" } }}
                >
                  <Trash2 size={18} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>
      {/* Contents and details line up under the name, or span the card on phones. */}
      <Box sx={{ ml: { xs: 0, sm: "58px" } }}>
        {counts && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5 }}>
            <CountChip count={counts.paints} label={t("sourcesPaintNoun", { count: counts.paints })} />
            <CountChip count={counts.schemes} label={t("sourcesSchemeNoun", { count: counts.schemes })} />
            <CountChip
              count={counts.templates}
              label={t("sourcesTemplateNoun", { count: counts.templates })}
            />
          </Box>
        )}
        {hasMeta && (
          <Box sx={{ display: "grid", gap: 0.25, mt: 1.25 }}>
            {requires.length > 0 && <MetaLine label={t("sourcesRequires")}>{requires.join(", ")}</MetaLine>}
            {requiredBy.length > 0 && (
              <MetaLine label={t("sourcesRequiredBy")}>{requiredBy.join(", ")}</MetaLine>
            )}
            {source.license && <MetaLine label={t("sourcesLicense")}>{source.license}</MetaLine>}
            {source.attribution && <MetaLine label={t("sourcesCredit")}>{source.attribution}</MetaLine>}
          </Box>
        )}
        {source.lastError && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {translateServerError({
              errorCode: source.lastErrorInfo?.code,
              errorParameters: Object.fromEntries(
                (source.lastErrorInfo?.parameters ?? []).map(({ name, value }) => [name, value]),
              ),
            })}
          </Alert>
        )}
      </Box>
    </Card>
  );
}
