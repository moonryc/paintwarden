import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import BugReportOutlined from "@mui/icons-material/BugReportOutlined";
import ChevronRight from "@mui/icons-material/ChevronRight";
import CopyrightOutlined from "@mui/icons-material/CopyrightOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import PrivacyTipOutlined from "@mui/icons-material/PrivacyTipOutlined";
import SourceOutlined from "@mui/icons-material/SourceOutlined";
import {
  Alert,
  Box,
  Button,
  Card,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import licenseText from "../../../../../LICENSE?raw";
import { betaTesterGuideUrl, privacyNetworkUrl, securityReportUrl } from "../utils/project-links";
import { getSupportSummary, reportBug, saveSupportBundle, type SupportSummary } from "../utils/support";

import { Modal } from "./Modal";
import { QueryErrorNotice } from "./QueryErrorNotice";
import { OpenSourceLicensesModal } from "./OpenSourceLicensesModal";

type SupportProps = {
  loadSummary?: typeof getSupportSummary;
  saveBundle?: typeof saveSupportBundle;
  desktop?: boolean;
};
type Props = SupportProps & {
  report?: typeof reportBug;
  embedded?: boolean;
};
type Section = "about" | "report" | "bundle" | "privacy" | "license" | "notices" | "trademarks";

const entries = [
  ["about", "supportAboutTitle", "supportAboutDescription", InfoOutlined],
  ["report", "reportBug", "supportReportDescription", BugReportOutlined],
  ["bundle", "supportSave", "supportBundleDescription", DownloadOutlined],
  ["privacy", "supportPrivacyTitle", "supportPrivacyDescription", PrivacyTipOutlined],
  ["license", "licenseLabel", "licenseRead", ArticleOutlined],
  ["notices", "noticesTitle", "noticesRead", SourceOutlined],
  ["trademarks", "supportTrademarksTitle", "supportTrademarksDescription", CopyrightOutlined],
] as const;

// Also used by startup/crash recovery: no vault or application provider is required.
export function HelpAbout({ embedded = false, ...props }: Props) {
  const { t } = useTranslation("components");
  const headingId = useId();
  const [section, setSection] = useState<Section | null>(null);
  const close = () => setSection(null);
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
      <Box component={embedded ? "div" : Card} sx={{ overflow: "hidden" }}>
        <List disablePadding>
          {entries.map(([key, title, description, Icon]) => (
            <ListItem key={key} disablePadding>
              <ListItemButton
                aria-haspopup="dialog"
                onClick={() => setSection(key)}
                divider={key !== "trademarks"}
                sx={{ px: { xs: 2, md: 2.5 }, py: 1.25, gap: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={t(title)}
                  secondary={t(description)}
                  slotProps={{
                    primary: { id: `${headingId}-${key}`, sx: { fontWeight: 600, color: "text.primary" } },
                    secondary: { noWrap: true },
                  }}
                  sx={{ minWidth: 0 }}
                />
                <ChevronRight fontSize="small" color="action" />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
      {section === "about" && <AboutModal loadSummary={props.loadSummary} onClose={close} />}
      {section === "report" && <ReportBugModal {...props} onClose={close} />}
      {section === "bundle" && <SupportBundleModal {...props} onClose={close} />}
      {section === "privacy" && (
        <Modal title={t("supportPrivacyTitle")} subtitle={t("supportPrivacyDescription")} onClose={close}>
          <Stack spacing={2}>
            <Typography variant="body2">{t("privacyNetworkSummary")}</Typography>
            <Box>
              <Button href={privacyNetworkUrl} target="_blank" rel="noopener noreferrer">
                {t("privacyNetworkLink")}
              </Button>
              <Button href={securityReportUrl} target="_blank" rel="noopener noreferrer">
                {t("securityReportLink")}
              </Button>
            </Box>
          </Stack>
        </Modal>
      )}
      {section === "license" && (
        <Modal title={t("licenseLabel")} subtitle={t("licenseSummary")} onClose={close}>
          <Box
            component="pre"
            lang="en"
            sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13 }}
          >
            {licenseText}
          </Box>
        </Modal>
      )}
      {section === "notices" && <OpenSourceLicensesModal onClose={close} />}
      {section === "trademarks" && (
        <Modal title={t("supportTrademarksTitle")} subtitle="" onClose={close}>
          <Typography variant="body2">{t("manufacturerNonAffiliation")}</Typography>
        </Modal>
      )}
    </Box>
  );
}

function useSupportSummary(loadSummary: typeof getSupportSummary) {
  const { i18n } = useTranslation("components");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [summary, setSummary] = useState<SupportSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
  }, [language, loadSummary, attempt]);
  return { summary, failed, language, retry: () => setAttempt((value) => value + 1) };
}

function SummaryStatus({ failed, retry }: { failed: boolean; retry(): void }) {
  const { t } = useTranslation("components");
  return failed ? (
    <QueryErrorNotice
      error={t("supportFailure")}
      onRetry={() => {
        // The retry control disappears while loading; retain focus in the dialog.
        document.activeElement?.closest<HTMLElement>('[role="dialog"]')?.focus();
        retry();
      }}
    />
  ) : (
    <Box role="status" aria-label={t("supportLoading")}>
      <Skeleton />
      <Skeleton />
      <Skeleton width="65%" />
    </Box>
  );
}

function AboutModal({
  loadSummary = getSupportSummary,
  onClose,
}: Pick<SupportProps, "loadSummary"> & { onClose(): void }) {
  const { t } = useTranslation("components");
  const { summary, failed, retry } = useSupportSummary(loadSummary);
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
    <Modal title={t("supportAboutTitle")} subtitle={t("supportAboutDescription")} onClose={onClose}>
      {!summary && <SummaryStatus failed={failed} retry={retry} />}
      {summary && (
        <Box
          component="dl"
          sx={{ m: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 1 }}
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
      <Button sx={{ mt: 2 }} href={betaTesterGuideUrl} target="_blank" rel="noopener noreferrer">
        {t("betaTesterGuide")}
      </Button>
    </Modal>
  );
}

export function ReportBugModal({
  report = reportBug,
  onClose,
  ...supportProps
}: Props & { onClose(): void }) {
  const { t, i18n } = useTranslation("components");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState(false);
  async function openReport() {
    setBusy(true);
    setFailed(false);
    try {
      await report(i18n.resolvedLanguage ?? i18n.language);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={t("reportBug")} subtitle={t("supportReportDescription")} onClose={onClose}>
      <Stack spacing={2}>
        <Typography variant="body2">{t("reportBugHint")}</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Button variant="contained" loading={busy} onClick={() => void openReport()}>
            {t("reportBug")}
          </Button>
          <Button variant="outlined" onClick={() => setPreview(true)}>
            {t("supportSave")}
          </Button>
        </Box>
        {failed && <Alert severity="error">{t("supportFailure")}</Alert>}
      </Stack>
      {preview && <SupportBundleModal {...supportProps} onClose={() => setPreview(false)} />}
    </Modal>
  );
}

export function SupportBundleModal({
  loadSummary = getSupportSummary,
  saveBundle = saveSupportBundle,
  desktop = Boolean(window.paintwardenDesktop),
  onClose,
}: SupportProps & { onClose(): void }) {
  const { t } = useTranslation("components");
  const { summary, failed: loadFailed, language, retry } = useSupportSummary(loadSummary);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  async function save() {
    setSaving(true);
    setFailed(false);
    setSaved(false);
    try {
      if (await saveBundle(language)) setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={t("supportPreviewTitle")}
      subtitle={t("supportPreviewBody")}
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <>
          <Button disabled={saving} onClick={onClose}>
            {t("supportCancel")}
          </Button>
          <Button variant="contained" disabled={!summary} loading={saving} onClick={() => void save()}>
            {t("supportConfirm")}
          </Button>
        </>
      }
    >
      {!summary && <SummaryStatus failed={loadFailed} retry={retry} />}
      {summary && (
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
      )}
      <Typography variant="body2" sx={{ mb: 2 }}>
        {desktop ? t("supportDesktopLogs") : t("supportWebOnly")}
      </Typography>
      <Alert severity="info">{t("supportPrivacy")}</Alert>
      {failed && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t("supportFailure")}
        </Alert>
      )}
      {saved && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {t("supportSaved")}
        </Alert>
      )}
    </Modal>
  );
}
