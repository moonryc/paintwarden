import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { buildColorIndex, nearestPaints } from "@paintwarden/core/color-matching";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "../Components/Modal";
import { SwatchScanCanvas, type ScanPin } from "../Components/SwatchScanCanvas";
import { useColorIndex } from "../graphql/color-tools-hooks";
import { useMiniatureActions } from "../graphql/miniature-actions";
import { useMiniatureDetail } from "../graphql/miniature-detail-hooks";
import type { MiniatureDetailView } from "../graphql/miniature-detail-loader";
import { useSchemes } from "../graphql/schemes-hooks";
import type { RecipeStep } from "../types";
import { getSteps } from "../utils/constants";

export function SwatchScan({ miniatureId, onClose }: { miniatureId: string; onClose(): void }) {
  const { t, i18n } = useTranslation("components");
  const number = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language, { maximumFractionDigits: 2 });
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
  const [assignPaint, setAssignPaint] = useState<string | null>(null);
  const pin = pins.find((row) => row.id === selected);
  const matches = pin ? nearestPaints(index, pin.hex, { limit: 5 }) : [];
  const miniature = detail.data?.miniature;
  const ready = !colors.loading && !colors.error && !detail.loading && !detail.error;
  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      aria-labelledby="swatch-scan-title"
      slotProps={{ paper: { sx: { bgcolor: "var(--surface)" } } }}
    >
      <Stack
        spacing={2}
        aria-busy={colors.loading || detail.loading}
        sx={{ p: { xs: 2, md: 3 }, width: "100%", maxWidth: 1200, mx: "auto", boxSizing: "border-box" }}
      >
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Typography id="swatch-scan-title" variant="h5" component="h2">
            {t("scanTitle")}
          </Typography>
          <Button onClick={onClose}>{t("close")}</Button>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t("scanDisclaimer")}
        </Typography>
        {detail.error && (
          <Alert severity="error" action={<Button onClick={detail.refresh}>{t("retry")}</Button>}>
            {detail.error.message}
          </Alert>
        )}
        {colors.error && (
          <Alert severity="error" action={<Button onClick={colors.refetch}>{t("retry")}</Button>}>
            {colors.error.message}
          </Alert>
        )}
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
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}
        >
          <ToggleButtonGroup
            exclusive
            value={mode}
            onChange={(_, value: "paint" | "scheme" | null) => value && setMode(value)}
            aria-label={t("scanMode")}
          >
            <ToggleButton value="paint">{t("scanByPaint")}</ToggleButton>
            <ToggleButton value="scheme">{t("scanByScheme")}</ToggleButton>
          </ToggleButtonGroup>
          <Button
            disabled={!pins.length}
            onClick={() => {
              setPins([]);
              setSelected(null);
            }}
          >
            {t("scanClear")}
          </Button>
        </Stack>
        <Box
          component="ol"
          aria-label={t("scanPins")}
          sx={{ display: "flex", flexWrap: "wrap", gap: 1, listStyle: "none", p: 0, m: 0 }}
        >
          {pins.map((item, i) => {
            const match = nearestPaints(index, item.hex, { limit: 1 })[0];
            return (
              <Box component="li" key={item.id} sx={{ minWidth: 0, maxWidth: "100%" }}>
                <Button
                  sx={{ whiteSpace: "normal", textAlign: "left", overflowWrap: "anywhere", maxWidth: "100%" }}
                  variant={item.id === selected ? "contained" : "outlined"}
                  aria-pressed={item.id === selected}
                  onClick={() => setSelected(item.id)}
                >
                  {t("scanPinMatch", {
                    number: i + 1,
                    hex: item.hex,
                    name: match?.paint.name ?? t("scanNoMatch"),
                  })}
                </Button>
              </Box>
            );
          })}
        </Box>
        {colors.loading && !colors.paints.length && (
          <Stack role="status" aria-label={t("scanLoading")} spacing={1}>
            <Skeleton aria-hidden animation={false} height={70} />
            <Skeleton aria-hidden animation={false} height={70} />
            <Skeleton aria-hidden animation={false} height={70} />
          </Stack>
        )}
        {!pin && <Typography color="text.secondary">{t("scanTapHint")}</Typography>}
        {pin && (
          <Box aria-live="polite" aria-atomic="true">
            <Typography component="h3" variant="subtitle1">
              {t("scanSampled", { hex: pin.hex })}
            </Typography>
          </Box>
        )}
        {pin && !colors.loading && !matches.length && <Alert severity="info">{t("scanNoMatch")}</Alert>}
        {pin && mode === "paint" && (
          <Stack
            component="ul"
            spacing={1}
            aria-label={t("scanMatches")}
            sx={{ p: 0, m: 0, listStyle: "none" }}
          >
            {matches.map(({ paint, deltaE }, i) => (
              <Box
                component="li"
                key={paint.id}
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}
              >
                {i === 1 && (
                  <Typography component="h3" variant="subtitle2">
                    {t("scanAlternatives")}
                  </Typography>
                )}
                <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                  <Box
                    aria-hidden
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: paint.hex,
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                  <Box sx={{ flex: "1 1 180px" }}>
                    <Typography sx={{ fontWeight: 700 }}>{paint.name}</Typography>
                    <Typography variant="body2">
                      {paint.brand} · {paint.hex} · {t("scanDelta", { value: number.format(deltaE) })}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={
                      (paint.owned
                        ? t("scanOwned")
                        : paint.available
                          ? t("scanAvailable")
                          : t("scanNotOwned")) +
                      (paint.owned && !paint.available ? ` · ${t("paintUnavailable")}` : "")
                    }
                  />
                  <Button disabled={!ready} onClick={() => setAssignPaint(paint.id)}>
                    {t("scanAssign")}
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
        {pin && mode === "scheme" && matches[0] && (
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Box aria-hidden sx={{ width: 36, height: 36, bgcolor: matches[0].paint.hex, borderRadius: 1 }} />
            <Typography>
              {matches[0].paint.name} · {matches[0].paint.brand} · {matches[0].paint.hex} ·{" "}
              {t("scanDelta", { value: number.format(matches[0].deltaE) })} ·{" "}
              {matches[0].paint.owned
                ? t("scanOwned")
                : matches[0].paint.available
                  ? t("scanAvailable")
                  : t("scanNotOwned")}
              {matches[0].paint.owned && !matches[0].paint.available && ` · ${t("paintUnavailable")}`}
            </Typography>
          </Stack>
        )}
        {pin && mode === "scheme" && matches[0] && (
          <ScanSchemes
            key={matches[0].paint.id}
            paintId={matches[0].paint.id}
            miniatureId={miniatureId}
            detail={detail.data}
            disabled={!ready}
          />
        )}
        {assignPaint && detail.data && (
          <ScanAssignPaint
            data={detail.data}
            paintId={assignPaint}
            disabled={!ready}
            onClose={() => setAssignPaint(null)}
          />
        )}
      </Stack>
    </Dialog>
  );
}

function ScanSchemes({
  paintId,
  miniatureId,
  detail,
  disabled,
}: {
  paintId: string;
  miniatureId: string;
  detail: MiniatureDetailView | null;
  disabled: boolean;
}) {
  const { t } = useTranslation("components");
  const schemes = useSchemes({
    search: "",
    category: null,
    sourceId: null,
    noSource: false,
    readiness: null,
    usesPaintIds: [paintId],
  });
  const actions = useMiniatureActions();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
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
        {t("scanSchemeHint")}
      </Typography>
      {schemes.loading && !schemes.items.length && <Skeleton aria-hidden animation={false} height={90} />}
      {schemes.error && (
        <Alert severity="error" action={<Button onClick={schemes.refetch}>{t("retry")}</Button>}>
          {schemes.error.message}
        </Alert>
      )}
      {!schemes.loading && !schemes.error && !schemes.items.length && (
        <Alert severity="info">{t("scanNoSchemes")}</Alert>
      )}
      {schemes.items.map((scheme) => (
        <Stack
          key={scheme.id}
          direction="row"

          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            p: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Typography>{scheme.name}</Typography>
          <Button
            disabled={disabled || pending || detail?.schemes.nodes.some((row) => row.scheme.id === scheme.id)}
            onClick={() => void attach(scheme.id)}
          >
            {t("scanAttach")}
          </Button>
        </Stack>
      ))}
      {schemes.hasNextPage && (
        <Button disabled={schemes.loading} onClick={schemes.loadMore}>
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
