import { Alert, Box, Button, Card, Stack, Typography } from "@mui/material";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import licenseText from "../../../../../LICENSE?raw";

import { getSupportSummary, saveSupportBundle, type SupportSummary } from "../utils/support";

import { Modal } from "./Modal";
import { ReportBugButton } from "./ReportBugButton";

type Props = {
  loadSummary?: typeof getSupportSummary;
  saveBundle?: typeof saveSupportBundle;
  report?: (language: string) => Promise<void>;
  desktop?: boolean;
  embedded?: boolean;
};

export function HelpAbout({
  loadSummary = getSupportSummary,
  saveBundle = saveSupportBundle,
  report,
  desktop = Boolean(window.paintwardenDesktop),
  embedded = false,
}: Props) {
  const { t, i18n } = useTranslation("components");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const headingId = useId();
  const [summary, setSummary] = useState<SupportSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let current = true;
    setSummary(null);
    setFailed(false);
    void loadSummary(language).then(
      (value) => {
        if (current) setSummary(value);
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [language, loadSummary]);

  async function save() {
    setSaving(true);
    setFailed(false);
    setSaved(false);
    try {
      if (await saveBundle(language)) {
        setSaved(true);
        setPreview(false);
      }
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const details = summary
    ? [
        [t("supportVersion"), summary.version === "unknown" ? t("supportUnavailable") : summary.version],
        [
          t("supportChannel"),
          summary.version === "unknown"
            ? t("supportUnavailable")
            : t(summary.version.includes("-beta.") ? "supportChannelBeta" : "supportChannelStable"),
        ],
        [t("supportPlatform"), summary.os === "Other" ? t("supportUnavailable") : summary.os],
        [t("supportMode"), summary.mode === "local" ? t("supportLocal") : t("supportRemote")],
        [t("supportLanguage"), summary.language],
        ...(summary.mode === "remote"
          ? [
              [
                t("supportServerVersion"),
                summary.serverVersion && summary.serverVersion !== "unknown"
                  ? summary.serverVersion
                  : t("supportUnavailable"),
              ],
            ]
          : []),
      ]
    : [];
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ minWidth: 0 }}>
      <Typography
        component="h2"
        id={headingId}
        sx={{
          mb: 1,
          px: embedded ? 0 : 0.5,
          fontFamily: "var(--font-serif)",
          fontSize: "1.125rem",
          fontWeight: 600,
        }}
      >
        {t("supportTitle")}
      </Typography>
      <Box component={embedded ? "div" : Card} sx={{ p: embedded ? 0 : { xs: 2, md: 2.5 } }}>
        {!summary && !failed && <Typography role="status">{t("supportLoading")}</Typography>}
        {summary && (
          <Box
            component="dl"
            sx={{
              m: 0,
              mt: 1,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 1,
            }}
          >
            {details.map(([label, value]) => (
              <Box key={label} sx={{ display: "contents" }}>
                <Typography component="dt" color="text.secondary" variant="body2">
                  {label}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: "anywhere" }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Typography variant="body2">{t("licenseLabel")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("licenseSummary")}
          </Typography>
          <Box>
            <Button variant="text" onClick={() => setLicenseOpen(true)}>
              {t("licenseRead")}
            </Button>
          </Box>
          {failed && !preview && <Alert severity="error">{t("supportFailure")}</Alert>}
          {saved && <Alert severity="success">{t("supportSaved")}</Alert>}
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 1 }}>
            <ReportBugButton report={report} showHint={false} />
            <Button
              variant="outlined"
              disabled={!summary}
              onClick={() => {
                setSaved(false);
                setFailed(false);
                setPreview(true);
              }}
            >
              {t("supportSave")}
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t("reportBugHint")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {desktop ? t("supportDesktopLogs") : t("supportWebOnly")}
          </Typography>
        </Stack>
      </Box>
      {licenseOpen && (
        <Modal title={t("licenseLabel")} subtitle={t("licenseSummary")} onClose={() => setLicenseOpen(false)}>
          <Box
            component="pre"
            lang="en"
            sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13 }}
          >
            {licenseText}
          </Box>
        </Modal>
      )}
      {preview && (
        <Modal
          title={t("supportPreviewTitle")}
          subtitle={t("supportPreviewBody")}
          onClose={() => {
            if (!saving) setPreview(false);
          }}
          footer={
            <>
              <Button disabled={saving} onClick={() => setPreview(false)}>
                {t("supportCancel")}
              </Button>
              <Button variant="contained" loading={saving} onClick={() => void save()}>
                {t("supportConfirm")}
              </Button>
            </>
          }
        >
          <Box
            component="pre"
            sx={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              p: 2,
              bgcolor: "action.hover",
              borderRadius: 1,
              fontSize: 13,
            }}
          >
            {JSON.stringify(summary, null, 2)}
          </Box>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {desktop ? t("supportDesktopLogs") : t("supportWebOnly")}
          </Typography>
          <Alert severity="info">{t("supportPrivacy")}</Alert>
          {failed && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t("supportFailure")}
            </Alert>
          )}
        </Modal>
      )}
    </Box>
  );
}
