import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { usePageLoading } from "../../Components/PageLoadingStatus";
import type { PhoneAccessState } from "../../types";

import { SettingsRow } from "./SettingsSection";

// The QR encoder is bundled locally: vault addresses never leave this device.
export function PhoneAccessSettings() {
  const { t } = useTranslation("pages");
  const bridge = window.paintwardenDesktop;
  const [state, setState] = useState<PhoneAccessState | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState("");
  const [qr, setQr] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"" | "copied" | "failed">("");
  const address = state?.enabled
    ? state.addresses.includes(selected)
      ? selected
      : (state.addresses[0] ?? "")
    : "";

  useEffect(() => {
    if (!bridge) return;
    let active = true;
    void bridge
      .getPhoneAccess()
      .then((next) => {
        if (active) {
          setState(next);
          setFailed(Boolean(next.error));
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [bridge]);

  useEffect(() => {
    let active = true;
    setQr("");
    setQrFailed(false);
    setCopyStatus("");
    if (address) {
      void import("qrcode")
        .then((encoder) => encoder.toDataURL(address, { width: 224, margin: 4, errorCorrectionLevel: "M" }))
        .then((data) => {
          if (active) setQr(data);
        })
        .catch(() => {
          if (active) setQrFailed(true);
        });
    }
    return () => {
      active = false;
    };
  }, [address]);

  async function update(enabled?: boolean) {
    if (!bridge) return;
    setBusy(true);
    setFailed(false);
    setCopyStatus("");
    try {
      const next =
        enabled === undefined ? await bridge.getPhoneAccess() : await bridge.setPhoneAccess(enabled);
      setState(next);
      setFailed(Boolean(next.error));
    } catch {
      // IPC diagnostics may include local paths; only present the localized public message.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  usePageLoading(Boolean(bridge && state?.available !== false && (busy || (address && !qr && !qrFailed))));
  if (!bridge || state?.available === false) return null;
  const command = `tailscale serve http://127.0.0.1:${state?.port ?? 0}`;
  return (
    <SettingsRow
      icon={<DevicesOutlinedIcon />}
      title={t("phoneAccess.title")}
      description={t("phoneAccess.description")}
      action={
        <Switch
          checked={state?.enabled ?? false}
          disabled={busy || !state}
          onChange={(_, enabled) => void update(enabled)}
          slotProps={{ input: { "aria-label": t("phoneAccess.title") } }}
        />
      }
    >
      <Stack
        spacing={2}
        aria-busy={busy || Boolean(address && !qr && !qrFailed)}
        role="region"
        aria-label={t("phoneAccess.title")}
        tabIndex={0}
        sx={{ height: "24rem", overflowY: "auto", scrollbarGutter: "stable", pr: 1 }}
      >
        <Box
          aria-hidden="true"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            height: "3rem",
            flexShrink: 0,
            visibility: busy ? "visible" : "hidden",
          }}
        >
          <CircularProgress size={16} aria-hidden="true" />
          {t("phoneAccess.loading")}
        </Box>
        {failed && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" disabled={busy} onClick={() => void update()}>
                {t("phoneAccess.retry")}
              </Button>
            }
          >
            {t("phoneAccess.error")}
          </Alert>
        )}
        <Alert severity="warning">{t("phoneAccess.warning")}</Alert>
        <Typography variant="body2">{t("phoneAccess.firewall")}</Typography>
        {state?.enabled && (
          <>
            <Typography variant="body2">{t("phoneAccess.networkHint")}</Typography>
            {state.tailscale && <Typography variant="body2">{t("phoneAccess.tailscaleDetected")}</Typography>}
            {!state.addresses.length && <Alert severity="info">{t("phoneAccess.noAddresses")}</Alert>}
            {address && (
              <>
                <RadioGroup
                  value={address}
                  onChange={(_, value) => setSelected(value)}
                  aria-label={t("phoneAccess.addresses")}
                >
                  {state.addresses.map((url) => (
                    <Box key={url} sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                      <FormControlLabel
                        value={url}
                        control={<Radio />}
                        label={
                          <Box
                            component="span"
                            sx={{
                              userSelect: "text",
                              overflowWrap: "anywhere",
                              fontFamily: "monospace",
                              fontSize: 13,
                            }}
                          >
                            {url}
                          </Box>
                        }
                        sx={{ minWidth: 0, flex: "1 1 200px" }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        aria-label={t("phoneAccess.copyAddress", { address: url })}
                        onClick={() => void copy(url)}
                      >
                        {t("phoneAccess.copy")}
                      </Button>
                    </Box>
                  ))}
                </RadioGroup>
                <Box sx={{ display: "grid", justifyItems: "start", gap: 1 }}>
                  <Box
                    sx={{
                      width: 224,
                      maxWidth: "100%",
                      aspectRatio: "1",
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                      borderRadius: 1,
                    }}
                  >
                    {qr ? (
                      <Box
                        component="img"
                        src={qr}
                        alt={t("phoneAccess.qrAlt", { address })}
                        sx={{ width: 224, maxWidth: "100%", height: "auto", borderRadius: 1 }}
                      />
                    ) : qrFailed ? (
                      <Alert severity="error">{t("phoneAccess.qrError")}</Alert>
                    ) : (
                      <Typography variant="body2">{t("phoneAccess.qrLoading")}</Typography>
                    )}
                  </Box>
                  <Typography variant="body2">{t("phoneAccess.scan")}</Typography>
                </Box>
              </>
            )}
            <Alert severity="info">{t("phoneAccess.httpLimit")}</Alert>
            <Box>
              <Typography component="h3" variant="subtitle2">
                {t("phoneAccess.httpsTitle")}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t("phoneAccess.httpsInstructions")}
              </Typography>
              <Box
                component="code"
                sx={{
                  display: "block",
                  userSelect: "text",
                  overflowWrap: "anywhere",
                  p: 1.5,
                  bgcolor: "var(--sunken)",
                  borderRadius: 1,
                }}
              >
                {command}
              </Box>
              <Button size="small" sx={{ mt: 1 }} onClick={() => void copy(command)}>
                {t("phoneAccess.copyCommand")}
              </Button>
            </Box>
          </>
        )}
        <Box role="status" aria-live="polite">
          {copyStatus === "copied"
            ? t("phoneAccess.copied")
            : copyStatus === "failed"
              ? t("phoneAccess.copyFailed")
              : ""}
        </Box>
      </Stack>
    </SettingsRow>
  );
}
