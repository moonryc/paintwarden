import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import { Alert, Box, Button, Checkbox, InputAdornment, TextField, Tooltip } from "@mui/material";
import { translateServerError } from "@paint-vault/i18n/runtime";
import { type ReactNode, useId, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { Modal } from "../../Components/Modal";
import { formatNumber } from "../../i18n";
import { Bookmarks, Extension, PaintDrop, Palette, Search } from "../../icons";
import { useVaultStore } from "../../store/hooks";

import { type Shareable, KINDS, SEMVER, plural, message } from "./sources.utils";

const KIND_META: Record<
  keyof Shareable,
  { label: "sourcesPaintsText" | "sourcesSchemesText" | "sourcesTemplatesText"; icon: ReactNode }
> = {
  paints: { label: "sourcesPaintsText" as const, icon: <PaintDrop size={18} /> },
  schemes: { label: "sourcesSchemesText" as const, icon: <Palette size={18} /> },
  templates: { label: "sourcesTemplatesText" as const, icon: <Bookmarks size={18} /> },
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function StepSection({
  step,
  title,
  aside,
  children,
}: {
  step: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box component="section" sx={{ "& + &": { mt: 3 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, minHeight: 30 }}>
        <Box
          component="span"
          aria-hidden
          sx={{
            display: "grid",
            placeItems: "center",
            width: 22,
            height: 22,
            borderRadius: "50%",
            bgcolor: "var(--sunken)",
            color: "var(--ink-soft)",
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {formatNumber(step)}
        </Box>
        <Box component="h3" sx={{ m: 0, fontSize: 14, fontWeight: 650, flex: 1, minWidth: 0 }}>
          {title}
        </Box>
        {aside}
      </Box>
      {children}
    </Box>
  );
}

export function CreateSourceDialog({ shareable, onClose }: { shareable: Shareable; onClose(): void }) {
  const { t } = useTranslation("pages");
  const notify = useVaultStore((s) => s.notify);
  const authHeaders = useVaultStore((s) => s.authHeaders);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const formId = useId();
  const total = KINDS.reduce((sum, kind) => sum + shareable[kind].length, 0);
  const kinds = KINDS.filter((kind) => shareable[kind].length > 0);
  const versionValid = SEMVER.test(version.trim());
  const nameMissing = !name.trim();
  const filename = `${slugify(name) || "paint-vault-plugin"}-${versionValid ? version.trim() : "x.y.z"}.zip`;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return Object.fromEntries(
      KINDS.map((kind) => [
        kind,
        needle ? shareable[kind].filter((item) => item.name.toLowerCase().includes(needle)) : shareable[kind],
      ]),
    ) as Shareable;
  }, [query, shareable]);
  const visible = KINDS.flatMap((kind) => filtered[kind].map((item) => `${kind}:${item.id}`));
  const allVisibleOn = visible.length > 0 && visible.every((key) => selected.has(key));
  const chosen = (kind: keyof Shareable) =>
    shareable[kind].filter((item) => selected.has(`${kind}:${item.id}`)).length;
  const summary = KINDS.filter((kind) => chosen(kind) > 0)
    .map((kind) => plural(chosen(kind), kind))
    .join(" · ");
  const blocker = !selected.size
    ? t("sourcesChooseAtLeastOneItem")
    : nameMissing
      ? t("sourcesNameYourPluginToExport")
      : !versionValid
        ? t("sourcesFixTheVersionNumber")
        : "";

  function setKeys(keys: string[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  async function exportSource() {
    setAttempted(true);
    if (exporting || blocker) return;
    setExporting(true);
    setExportError("");
    try {
      const ids = (kind: keyof Shareable) =>
        shareable[kind].filter((item) => selected.has(`${kind}:${item.id}`)).map((item) => item.id);
      const response = await fetch("/api/catalog-share", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: name.trim(),
          version: version.trim(),
          paintIds: ids("paints"),
          schemeIds: ids("schemes"),
          templateIds: ids("templates"),
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(translateServerError(result));
      }
      const blob = await response.blob();
      if (window.paintVaultDesktop) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (
          !(await window.paintVaultDesktop.saveBinary({
            bytes,
            filename,
            title: t("sourcesExportPaintVaultPlugin"),
          }))
        )
          return;
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      }
      notify(t("sourcesExportedFile", { filename }));
      onClose();
    } catch (cause) {
      setExportError(message(cause, t("sourcesCouldNotExportPlugin")));
    } finally {
      setExporting(false);
    }
  }

  const footer =
    total === 0 ? (
      <Button onClick={onClose} sx={{ ml: "auto" }}>
        {t("sourcesClose")}
      </Button>
    ) : (
      <>
        <Box
          component="span"
          aria-live="polite"
          sx={{
            flex: "1 1 0",
            minWidth: 0,
            fontSize: 13,
            color: selected.size ? "var(--ink)" : "var(--ink-faint)",
          }}
        >
          {summary || t("sourcesNothingSelected")}
        </Box>
        <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
          <Button disabled={exporting} onClick={onClose}>
            {t("sourcesCancel")}
          </Button>
          <Tooltip title={blocker} disableHoverListener={!blocker} disableFocusListener={!blocker}>
            <span>
              {/* Lives in the Modal footer, outside the form, so it submits via the form attribute. */}
              <Button
                type="submit"
                form={formId}
                variant="contained"
                startIcon={<CloudDownloadOutlinedIcon />}
                loading={exporting}
                disabled={!selected.size}
              >
                {t("sourcesExportZIP")}
              </Button>
            </span>
          </Tooltip>
        </Box>
      </>
    );
  return (
    <Modal
      title={t("sourcesCreatePlugin")}
      subtitle={t("sourcesPackageYourOwnPaintsSchemesAndTemplatesToShare")}
      onClose={() => !exporting && onClose()}
      footer={footer}
    >
      {total === 0 ? (
        <>
          <Box sx={{ display: "grid", placeItems: "center", textAlign: "center", py: 4, px: 2 }}>
            <Box
              component="span"
              sx={{
                display: "grid",
                placeItems: "center",
                width: 56,
                height: 56,
                mb: 1.5,
                borderRadius: "16px",
                bgcolor: "var(--sunken)",
                color: "var(--ink-faint)",
              }}
            >
              <Extension size={26} />
            </Box>
            <Box sx={{ fontWeight: 650, fontSize: 16 }}>{t("sourcesNothingToShareYet")}</Box>
            <Box sx={{ mt: 0.5, maxWidth: 360, fontSize: 14, color: "var(--ink-faint)" }}>
              {t("sourcesAddYourOwnPaintsSchemesOrTemplatesFirstItems")}
            </Box>
          </Box>
        </>
      ) : (
        <Box
          component="form"
          id={formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void exportSource();
          }}
        >
          <StepSection
            step={1}
            title={t("sourcesChooseWhatToInclude")}
            aside={
              visible.length > 0 && (
                <Button size="small" onClick={() => setKeys(visible, !allVisibleOn)}>
                  {allVisibleOn
                    ? t("sourcesClearAll")
                    : query.trim()
                      ? t("sourcesSelectMatches")
                      : t("sourcesSelectAll")}
                </Button>
              )
            }
          >
            {total > 5 && (
              <TextField
                size="small"
                fullWidth
                placeholder={t("sourcesSearchItems", { count: total })}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={18} />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { "aria-label": t("sourcesSearchItemsAria") },
                }}
                sx={{ mb: 1.5 }}
              />
            )}
            <Box
              sx={{
                border: "1px solid",
                borderColor: attempted && !selected.size ? "error.main" : "var(--line)",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              {visible.length === 0 ? (
                <Box sx={{ p: 3, textAlign: "center", fontSize: 14, color: "var(--ink-faint)" }}>
                  {t("sourcesNoMatches", { query: query.trim() })}
                </Box>
              ) : (
                kinds.map((kind) => {
                  const items = filtered[kind];
                  if (!items.length) return null;
                  const keys = items.map((item) => `${kind}:${item.id}`);
                  const on = keys.filter((key) => selected.has(key)).length;
                  return (
                    <Box
                      key={kind}
                      role="group"
                      aria-label={t(KIND_META[kind].label)}
                      sx={{ "& + &": { borderTop: "1px solid var(--line)" } }}
                    >
                      <Box
                        component="label"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          pl: 0.5,
                          pr: 1.5,
                          minHeight: 44,
                          cursor: "pointer",
                          bgcolor: "var(--sunken)",
                          fontSize: 13,
                          fontWeight: 650,
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={on === keys.length}
                          indeterminate={on > 0 && on < keys.length}
                          onChange={() => setKeys(keys, on < keys.length)}
                          slotProps={{
                            input: {
                              "aria-label": t("sourcesSelectAllKind", { kind: t(KIND_META[kind].label) }),
                            },
                          }}
                        />
                        <Box component="span" sx={{ display: "flex", color: "var(--ink-faint)" }}>
                          {KIND_META[kind].icon}
                        </Box>
                        <Box component="span" sx={{ flex: 1 }}>
                          {t(KIND_META[kind].label)}
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            fontWeight: 500,
                            fontSize: 12,
                            color: "var(--ink-faint)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatNumber(chosen(kind))} / {formatNumber(shareable[kind].length)}
                        </Box>
                      </Box>
                      {items.map((item) => {
                        const key = `${kind}:${item.id}`;
                        return (
                          <Box
                            component="label"
                            key={item.id}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              pl: 2.5,
                              pr: 1.5,
                              minHeight: 40,
                              cursor: "pointer",
                              fontSize: 14,
                              borderTop: "1px solid var(--line)",
                              "&:hover": { bgcolor: "var(--sunken)" },
                            }}
                          >
                            <Checkbox
                              size="small"
                              checked={selected.has(key)}
                              onChange={() => setKeys([key], !selected.has(key))}
                            />
                            <Box component="span" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                              {item.name}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })
              )}
            </Box>
            <Box
              sx={{
                mt: 1,
                fontSize: 12,
                color: attempted && !selected.size ? "error.main" : "var(--ink-faint)",
              }}
            >
              {attempted && !selected.size
                ? t("sourcesChooseAtLeastOneItemToExport")
                : t("sourcesImagesAndAnyOfYourItemsTheseDependOn")}
            </Box>
          </StepSection>

          <StepSection step={2} title={t("sourcesNameAndVersion")}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 2 }}>
              <TextField
                size="small"
                label={t("sourcesPluginName")}
                placeholder={t("sourcesMyGrimdarkSchemes")}
                value={name}
                error={attempted && nameMissing}
                helperText={
                  attempted && nameMissing
                    ? t("sourcesGiveYourPluginAName")
                    : t("sourcesSaveFilename", { filename })
                }
                onChange={(event) => setName(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: "1 1 240px" }}
              />
              <TextField
                size="small"
                label={t("sourcesVersion")}
                value={version}
                error={!versionValid}
                helperText={versionValid ? t("sourcesMajorMinorPatch") : t("sourcesUseAFormatLike100")}
                onChange={(event) => setVersion(event.target.value)}
                slotProps={{ htmlInput: { inputMode: "decimal", spellCheck: false } }}
                sx={{ flex: "0 1 160px" }}
              />
            </Box>
          </StepSection>

          <StepSection step={3} title={t("sourcesPublishOnGitHub")}>
            <Box
              component="ol"
              sx={{
                m: 0,
                pl: 2.5,
                fontSize: 13,
                color: "var(--ink-soft)",
                display: "grid",
                gap: 0.5,
                "& li::marker": { color: "var(--ink-faint)" },
              }}
            >
              <li>{t("sourcesUnzipTheExportAndUploadItsContentsToA")}</li>
              <li>
                <Trans
                  t={t}
                  i18nKey="sourcesShareInstructions"
                  components={{ repository: <Box component="code" sx={{ fontSize: 12 }} />, add: <b /> }}
                />
              </li>
              <li>{t("sourcesRequiredPluginsAreListedInTheZIPAndInstall")}</li>
              <li>
                <Trans
                  t={t}
                  i18nKey="sourcesLogoInstructions"
                  components={{ filename: <Box component="code" sx={{ fontSize: 12 }} /> }}
                />
              </li>
            </Box>
          </StepSection>

          {exportError && (
            <Alert severity="error" sx={{ mt: 2.5 }} onClose={() => setExportError("")}>
              {exportError}
            </Alert>
          )}
        </Box>
      )}
    </Modal>
  );
}
