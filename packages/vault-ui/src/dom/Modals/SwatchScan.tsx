import Check from "@mui/icons-material/Check";
import Close from "@mui/icons-material/Close";
import Colorize from "@mui/icons-material/Colorize";
import {
  Alert,
  Box,
  Button,
  Dialog,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  averageLab,
  buildColorIndex,
  buildSchemeColorIndex,
  hexToLab,
  labToHex,
  nearestPaints,
  rankSchemeColorIndex,
  rankSchemeColorIndexForPins,
} from "@paintwarden/core/color-matching";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { MatchQualityChip } from "../Components/MatchQualityChip";
import { Modal } from "../Components/Modal";
import { ErrorSurface, QueryErrorNotice } from "../Components/QueryErrorNotice";
import { SwatchScanCanvas, type ScanPin } from "../Components/SwatchScanCanvas";
import { useColorIndex, useSchemeColorIndex } from "../graphql/color-tools-hooks";
import { useMiniatureActions } from "../graphql/miniature-actions";
import { useMiniatureDetail } from "../graphql/miniature-detail-hooks";
import type { MiniatureDetailView } from "../graphql/miniature-detail-loader";
import type { RecipeStep } from "../types";
import { getSteps } from "../utils/constants";

import { SwatchScanMatch } from "./SwatchScanMatch";
import { SwatchScanPins } from "./SwatchScanPins";

type PinScope = "pin" | "all";
const scopeKey = "paintwarden:scan-pin-scope";
function readScope(): PinScope {
  try {
    return sessionStorage.getItem(scopeKey) === "all" ? "all" : "pin";
  } catch {
    return "pin";
  }
}

const wide = "@container (min-width: 880px)";

export function SwatchScan({ miniatureId, onClose }: { miniatureId: string; onClose: () => void }) {
  const { t } = useTranslation("components");
  const detail = useMiniatureDetail(miniatureId);
  const colors = useColorIndex();
  const index = useMemo(() => buildColorIndex(colors.paints), [colors.paints]);
  const [pins, setPins] = useState<ScanPin[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const source = detail.data?.miniature?.imageUrl ?? null;
  const [pinSource, setPinSource] = useState(source);
  if (pinSource !== source) {
    setPinSource(source);
    setPins([]);
    setSelected(null);
  }

  const serial = useRef(0);
  const [mode, setMode] = useState<"paint" | "scheme">("paint");
  const [scope, setScope] = useState<PinScope>(readScope);
  const allPins = scope === "all" && pins.length > 1;
  const aggregate = useMemo(
    () => (pins.length ? averageLab(pins.map((row) => hexToLab(row.hex))) : null),
    [pins],
  );
  const [assignPaint, setAssignPaint] = useState<string | null>(null);
  const pin = pins.find((row) => row.id === selected);
  const sampleHex = allPins && aggregate ? labToHex(aggregate) : pin?.hex;
  const matches = sampleHex
    ? nearestPaints(index, allPins && aggregate ? aggregate : sampleHex, { limit: 5 })
    : [];
  const schemePins = useMemo(() => (allPins ? pins : pin ? [pin] : []), [allPins, pins, pin]);
  const miniature = detail.data?.miniature;
  const ready = !colors.pending && !colors.error && !detail.pending && !detail.error;
  const removePin = (id: number) => {
    const rest = pins.filter((row) => row.id !== id);
    setPins(rest);
    if (selected === id) setSelected(rest.at(-1)?.id ?? null);
  };
  const assignButton = (paintId: string, primary: boolean) => (
    <Button
      variant={primary ? "contained" : "outlined"}
      size={primary ? "medium" : "small"}
      disabled={!ready}
      onClick={() => setAssignPaint(paintId)}
      sx={{ flexShrink: 0 }}
    >
      {t("scanAssign")}
    </Button>
  );
  const card = { border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5 } as const;
  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      aria-labelledby="swatch-scan-title"
      slotProps={{ paper: { sx: { bgcolor: "var(--surface)" } } }}
    >
      <Stack
        component="header"
        direction="row"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          alignItems: "center",
          gap: 2,
          px: { xs: 2, md: 3 },
          py: 1.5,
          bgcolor: "var(--surface)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="swatch-scan-title" variant="h5" component="h2">
            {t("scanTitle")}
          </Typography>
          {miniature && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {miniature.title}
            </Typography>
          )}
        </Box>
        <Button onClick={onClose} startIcon={<Close />}>
          {t("close")}
        </Button>
      </Stack>
      <ErrorSurface showConnection bannerSx={{ px: { xs: 2, md: 3 }, pt: 2 }}>
        <Box sx={{ containerType: "inline-size", width: "100%" }}>
          <Box
            aria-busy={colors.loading || detail.loading}
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 3,
              p: { xs: 2, md: 3 },
              maxWidth: 1400,
              mx: "auto",
              boxSizing: "border-box",
              [wide]: { gridTemplateColumns: "minmax(0, 3fr) minmax(320px, 2fr)", alignItems: "start" },
            }}
          >
            <Stack spacing={1.5} sx={{ minWidth: 0, [wide]: { position: "sticky", top: 96 } }}>
              {detail.error && <QueryErrorNotice error={detail.error.message} onRetry={detail.refresh} />}
              {colors.error && <QueryErrorNotice error={colors.error.message} onRetry={colors.refetch} />}
              {!miniature && detail.loading && (
                <Skeleton aria-hidden animation={false} variant="rectangular" height="45vh" />
              )}
              {miniature?.imageUrl && (
                <SwatchScanCanvas
                  src={miniature.imageUrl}
                  alt={miniature.title}
                  pins={pins}
                  selected={selected}
                  onSelect={setSelected}
                  onSample={(point, hex) => {
                    const id = ++serial.current;
                    setPins((old) => [...old, { ...point, hex, id }]);
                    setSelected(id);
                  }}
                />
              )}
              {!detail.loading && !miniature?.imageUrl && <Alert severity="info">{t("scanNoImage")}</Alert>}
              <Typography variant="caption" color="text.secondary">
                {t("scanDisclaimer")}
              </Typography>
            </Stack>
            <Stack spacing={2} sx={{ minWidth: 0 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={mode}
                  onChange={(_, value: "paint" | "scheme" | null) => value && setMode(value)}
                  aria-label={t("scanMode")}
                >
                  <ToggleButton value="paint">{t("scanByPaint")}</ToggleButton>
                  <ToggleButton value="scheme">{t("scanByScheme")}</ToggleButton>
                </ToggleButtonGroup>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={allPins ? "all" : "pin"}
                  disabled={pins.length < 2}
                  onChange={(_, value: PinScope | null) => {
                    if (!value) return;
                    setScope(value);
                    try {
                      sessionStorage.setItem(scopeKey, value);
                    } catch {
                      /* Session storage can be unavailable. */
                    }
                  }}
                  aria-label={t("scanPinScope")}
                >
                  <ToggleButton value="pin">{t("scanThisPin")}</ToggleButton>
                  <ToggleButton value="all">{t("scanAllPins", { count: pins.length })}</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Typography component="h3" variant="subtitle2" color="text.secondary">
                  {t("scanPins")}
                </Typography>
                <Button
                  size="small"
                  disabled={!pins.length}
                  onClick={() => {
                    setPins([]);
                    setSelected(null);
                  }}
                >
                  {t("scanClear")}
                </Button>
              </Stack>
              <SwatchScanPins
                pins={pins}
                selected={selected}
                nameFor={(hex) => nearestPaints(index, hex, { limit: 1 })[0]?.paint.name ?? t("scanNoMatch")}
                onSelect={setSelected}
                onRemove={removePin}
              />
              {colors.loading && !colors.paints.length && (
                <Stack role="status" aria-label={t("scanLoading")} spacing={1}>
                  <Skeleton aria-hidden animation={false} height={70} />
                  <Skeleton aria-hidden animation={false} height={70} />
                  <Skeleton aria-hidden animation={false} height={70} />
                </Stack>
              )}
              {!pin && (
                <Stack
                  sx={{
                    alignItems: "center",
                    textAlign: "center",
                    gap: 1,
                    p: 3,
                    border: "1px dashed",
                    borderColor: "divider",
                    borderRadius: 2,
                    color: "text.secondary",
                  }}
                >
                  <Colorize aria-hidden />
                  <Typography>{t("scanTapHint")}</Typography>
                </Stack>
              )}
              {pin && (
                <Stack
                  direction="row"
                  aria-live="polite"
                  aria-atomic="true"
                  sx={{ alignItems: "center", gap: 1 }}
                >
                  {(!allPins || mode === "paint") && (
                    <Box
                      aria-hidden
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        bgcolor: sampleHex,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    />
                  )}
                  <Typography component="h3" variant="subtitle1">
                    {allPins
                      ? mode === "paint"
                        ? t("scanCombined", { count: pins.length, hex: sampleHex })
                        : t("scanAllPins", { count: pins.length })
                      : t("scanSampled", { hex: pin.hex })}
                  </Typography>
                </Stack>
              )}
              {pin && mode === "paint" && !colors.loading && !matches.length && (
                <Alert severity="info">{t("scanNoMatch")}</Alert>
              )}
              {pin && mode === "paint" && matches[0] && (
                <Stack
                  component="ul"
                  spacing={1.5}
                  aria-label={t("scanMatches")}
                  sx={{ p: 0, m: 0, listStyle: "none" }}
                >
                  <Box component="li" sx={{ ...card, borderColor: "primary.main", borderWidth: 2 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                      {t("scanBestMatch")}
                    </Typography>
                    <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5, mt: 0.5 }}>
                      <SwatchScanMatch sample={sampleHex!} match={matches[0]} size={64} />
                      {assignButton(matches[0].paint.id, true)}
                    </Stack>
                  </Box>
                  {matches.length > 1 && (
                    <Box component="li">
                      <Typography component="h3" variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        {t("scanAlternatives")}
                      </Typography>
                      <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: "none" }}>
                        {matches.slice(1).map((match) => (
                          <Box component="li" key={match.paint.id} sx={card}>
                            <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                              <SwatchScanMatch sample={sampleHex!} match={match} size={44} />
                              {assignButton(match.paint.id, false)}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}
              {pin && mode === "scheme" && (
                <ScanSchemes
                  pins={schemePins}
                  allPins={allPins}
                  miniatureId={miniatureId}
                  detail={detail.data}
                  disabled={detail.loading || Boolean(detail.error)}
                />
              )}
            </Stack>
          </Box>
        </Box>
        {assignPaint && detail.data && (
          <ScanAssignPaint
            data={detail.data}
            paintId={assignPaint}
            disabled={!ready}
            onClose={() => setAssignPaint(null)}
          />
        )}
      </ErrorSurface>
    </Dialog>
  );
}

function ScanSchemes({
  pins,
  allPins,
  miniatureId,
  detail,
  disabled,
}: {
  pins: ScanPin[];
  allPins: boolean;
  miniatureId: string;
  detail: MiniatureDetailView | null;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation("components");
  const schemes = useSchemeColorIndex();
  const index = useMemo(() => buildSchemeColorIndex(schemes.schemes), [schemes.schemes]);
  const hex = pins[0].hex;
  const matches = useMemo(
    () =>
      allPins
        ? rankSchemeColorIndexForPins(
            index,
            pins.map((row) => row.hex),
          )
        : rankSchemeColorIndex(index, hex).map((match) => ({
            ...match,
            matches: [{ paint: match.paint, deltaE: match.deltaE }],
            worstDeltaE: match.deltaE,
          })),
    [index, hex, pins, allPins],
  );
  const sampleKey = allPins ? `all:${pins.map((row) => `${row.id}:${row.hex}`).join(";")}` : hex;
  const [visible, setVisible] = useState(10);
  const actions = useMiniatureActions();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [previousHex, setPreviousHex] = useState(sampleKey);
  if (previousHex !== sampleKey) {
    setPreviousHex(sampleKey);
    setVisible(10);
    setSaved(null);
  }
  const attached = (schemeId: string) =>
    Boolean(detail?.schemes.nodes.some((row) => row.scheme.id === schemeId));
  const attach = async (schemeId: string) => {
    if (!detail || disabled) return;
    setPending(true);
    try {
      await actions.setSchemes(miniatureId, [
        ...new Set([...detail.schemes.nodes.map((row) => row.scheme.id), schemeId]),
      ]);
      setSaved(schemeId);
    } catch {
      /* Command hook shows the localized error; keep the pin and allow retry. */
    } finally {
      setPending(false);
    }
  };
  return (
    <Stack spacing={1}>
      <Typography component="h3" variant="subtitle1">
        {t("scanSchemeMatches")}
      </Typography>
      {schemes.loading && !schemes.schemes.length && <Skeleton aria-hidden animation={false} height={90} />}
      {schemes.error && <QueryErrorNotice error={schemes.error.message} onRetry={schemes.refetch} />}
      {!schemes.loading && !schemes.error && !matches.length && (
        <Alert severity="info">{t("scanNoSchemes")}</Alert>
      )}
      <Stack
        component="ul"
        spacing={1.5}
        aria-label={t("scanSchemeMatches")}
        sx={{ p: 0, m: 0, listStyle: "none" }}
      >
        {matches.slice(0, visible).map(({ scheme, matches: pinMatches, deltaE, worstDeltaE }) => (
          <Stack
            component="li"
            key={scheme.id}
            spacing={1.5}
            sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2, minWidth: 0 }}
          >
            <Typography component="h4" variant="subtitle1" sx={{ overflowWrap: "anywhere" }}>
              {scheme.name}
            </Typography>
            <Box aria-hidden sx={{ display: "flex", height: 20, borderRadius: 1, overflow: "hidden" }}>
              {scheme.paints.map((entry, i) => (
                <Box
                  key={`${entry.id}:${i}`}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    bgcolor: entry.hex,
                    ...(pinMatches.some((match) => match.paint.id === entry.id) && {
                      border: "2px solid",
                      borderColor: "primary.main",
                    }),
                  }}
                />
              ))}
            </Box>
            <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
              <Stack spacing={1} sx={{ minWidth: 0, flex: "1 1 200px" }}>
                {allPins && (
                  <>
                    <Typography variant="body2">{t("scanCoverage")}</Typography>
                    <Box>
                      <MatchQualityChip deltaE={deltaE} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t("scanWorstPin", {
                        value: worstDeltaE.toLocaleString(i18n.resolvedLanguage ?? i18n.language, {
                          maximumFractionDigits: 1,
                        }),
                      })}
                    </Typography>
                  </>
                )}
                {pinMatches.map((match, i) => (
                  <Stack key={pins[i].id} spacing={0.5}>
                    {allPins && (
                      <Typography variant="caption">{t("scanPinNumber", { number: i + 1 })}</Typography>
                    )}
                    <Stack direction="row">
                      <SwatchScanMatch sample={pins[i].hex} match={match} size={allPins ? 36 : 52} />
                    </Stack>
                  </Stack>
                ))}
              </Stack>
              <Button
                variant="outlined"
                size="small"
                startIcon={attached(scheme.id) ? <Check /> : undefined}
                disabled={
                  disabled || schemes.loading || Boolean(schemes.error) || pending || attached(scheme.id)
                }
                onClick={() => void attach(scheme.id)}
                sx={{ flexShrink: 0 }}
              >
                {t("scanAttach")}
              </Button>
            </Stack>
          </Stack>
        ))}
      </Stack>
      {visible < matches.length && (
        <Button disabled={schemes.loading} onClick={() => setVisible((count) => count + 10)}>
          {t("scanMoreSchemes")}
        </Button>
      )}
      {saved && (
        <Alert severity="success" role="status">
          {t("scanAssigned")}
        </Alert>
      )}
    </Stack>
  );
}

function ScanAssignPaint({
  data,
  paintId,
  onClose,
  disabled,
}: {
  data: MiniatureDetailView;
  paintId: string;
  onClose(): void;
  disabled: boolean;
}) {
  const { t } = useTranslation("components");
  const actions = useMiniatureActions();
  const existing = getSteps().filter(
    ([id]) => data.recipeSteps.includes(id) || data.recipe.nodes.some((row) => row.step === id),
  );
  const [choice, setChoice] = useState<string>(existing[0]?.[0] ?? "new");
  const [stage, setStage] = useState<RecipeStep>("BASECOAT");
  const [pending, setPending] = useState(false);
  const save = async () => {
    if (disabled || pending || !data.miniature) return;
    const step = choice === "new" ? stage : (choice as RecipeStep);
    const rows = data.recipe.nodes.map((row) => ({
      id: row.id,
      paintId: row.paint.id,
      step: row.step as RecipeStep,
      notes: row.notes,
      sortOrder: row.sortOrder,
    }));
    if (!rows.some((row) => row.paintId === paintId && row.step === step))
      rows.push({ id: `user:${crypto.randomUUID()}`, paintId, step, notes: "", sortOrder: rows.length });
    const steps = [...new Set([...(data.recipeSteps as RecipeStep[]), step])];
    setPending(true);
    try {
      await actions.setRecipe(data.miniature.id, rows, steps);
      onClose();
    } catch {
      /* Command error is notified by the shared hook. */
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal
      title={t("scanAssignTitle")}
      subtitle={t("scanAssignHint")}
      onClose={() => !pending && onClose()}
      footer={
        <Button variant="contained" disabled={disabled || pending} onClick={() => void save()}>
          {t("scanAssign")}
        </Button>
      }
    >
      <Stack spacing={2}>
        <TextField
          select
          label={t("scanRecipeStep")}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          disabled={pending}
        >
          {existing.map(([id, label]) => (
            <MenuItem key={id} value={id}>
              {label}
            </MenuItem>
          ))}
          <MenuItem value="new">{t("scanNewStep")}</MenuItem>
        </TextField>
        {choice === "new" && (
          <TextField
            select
            label={t("scanStage")}
            value={stage}
            onChange={(event) => setStage(event.target.value as RecipeStep)}
            disabled={pending}
          >
            {getSteps().map(([id, label]) => (
              <MenuItem key={id} value={id}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>
    </Modal>
  );
}
