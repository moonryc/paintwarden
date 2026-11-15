import { StableAutocomplete } from "../../Components/StableAutocomplete";
import Check from "@mui/icons-material/Check";
import {
  Alert,
  Box,
  Button,
  Card,
  Skeleton,
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
} from "@mui/material";
import { normalizeColorHex } from "@paintwarden/core/color-hex";
import {
  buildColorIndex,
  derivePaintRoles,
  nearestPaints,
  NO_CLOSE_MATCH_DELTA_E,
} from "@paintwarden/core/color-matching";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ColorMatchSwatch } from "../../Components/ColorMatchSwatch";
import { MatchQualityChip } from "../../Components/MatchQualityChip";
import { useColorIndex } from "../../graphql/color-tools-hooks";
import { usePaintOptions } from "../../graphql/detail-hooks";
import { paintModel } from "../../graphql/miniature-scheme-model";
import type { Paint } from "../../types";

import { ComplementaryPalette } from "./ComplementaryPalette";
import { ComplementarySave } from "./ComplementarySave";

const roleKeys = {
  base: "complementaryBase",
  complement: "complementaryComplement",
  highlight: "complementaryHighlight",
  shadow: "complementaryShadow",
} as const;
type Role = keyof typeof roleKeys;
const roles = Object.keys(roleKeys) as Role[];
const schemeOrder: Role[] = ["shadow", "base", "highlight", "complement"];
const strengthKey = "paintwarden.complementary.strength";

function initialStrength() {
  try {
    const saved = localStorage.getItem(strengthKey);
    const value = saved === null ? 50 : Number(saved);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : 50;
  } catch {
    return 50;
  }
}

function ColorSwatch({ hex }: { hex: string }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: 1,
        bgcolor: hex,
        border: "1px solid",
        borderColor: "divider",
      }}
    />
  );
}

export function ComplementaryTool() {
  const { t, i18n } = useTranslation("pages");
  const number = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language, { maximumFractionDigits: 1 });
  const [selected, setSelected] = useState<Paint | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<Role>("base");
  const [strength, setStrength] = useState(initialStrength);
  const [choices, setChoices] = useState<Partial<Record<Role, string>>>({});
  const [saveOpen, setSaveOpen] = useState(false);
  const options = usePaintOptions(query.trim(), []);
  const colors = useColorIndex();
  const index = useMemo(() => buildColorIndex(colors.paints), [colors.paints]);
  // Resolve the input against the accepted live projection, not the picker snapshot.
  const input = colors.paints.find((paint) => paint.id === selected?.id);
  const inputHex = normalizeColorHex(input?.hex);
  const targets = useMemo(
    () => (inputHex ? derivePaintRoles(inputHex, role, strength) : null),
    [inputHex, role, strength],
  );
  const results = useMemo(
    () =>
      targets
        ? roles
            .filter((item) => item !== role)
            .map((item) => ({
              role: item,
              target: targets[item],
              matches: nearestPaints(index, targets[item], {
                limit: 4,
                filter: "owned",
                excludeIds: input ? [input.id] : [],
              }),
            }))
        : [],
    [index, targets, role, input],
  );
  const picked = Object.fromEntries(
    results.map((row) => [
      row.role,
      row.matches.find((match) => match.paint.id === choices[row.role]) ?? row.matches[0],
    ]),
  );
  const entries = schemeOrder.map((item) => ({
    type: "PAINT" as const,
    paintId: item === role ? input?.id : picked[item]?.paint.id,
  }));
  const canSave =
    !!input &&
    results.length === 3 &&
    entries.every((entry) => !!entry.paintId) &&
    !colors.loading &&
    !colors.error;
  const strengthId = useId();
  const roleId = useId();
  const choose = (paint: Paint | null) => {
    setSelected(paint);
    setChoices({});
  };
  const updateStrength = (value: number) => {
    setStrength(value);
    setChoices({});
    try {
      localStorage.setItem(strengthKey, String(value));
    } catch {
      /* Device storage may be disabled. */
    }
  };

  return (
    <Card sx={{ p: { xs: 2, sm: 4 }, minWidth: 0, overflowWrap: "anywhere" }}>
      <Box component="h2" sx={{ fontSize: 18, mt: 0, mb: 0.5 }}>
        {t("complementaryTitle")}
      </Box>
      <Box sx={{ color: "text.secondary", fontSize: 13, mb: 3 }}>{t("complementaryDescription")}</Box>
      <Box sx={{ display: "grid", gap: 3 }}>
        <StableAutocomplete<Paint>
          options={options.items.map(paintModel)}
          value={selected}
          inputValue={query}
          onInputChange={(_, value) => setQuery(value)}
          onChange={(_, paint) => choose(paint)}
          loading={options.loading}
          getOptionLabel={(paint) => paint.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterOptions={(items) => items}
          noOptionsText={t("toolsNoOptions")}
          loadingText={t("toolsLoadingOptions")}
          clearText={t("toolsClear")}
          openText={t("toolsOpen")}
          closeText={t("toolsClose")}
          renderOption={(props, paint) => {
            const { key, ...rest } = props;
            return (
              <Box
                component="li"
                key={key}
                {...rest}
                sx={{ display: "flex", gap: 1.5, overflowWrap: "anywhere" }}
              >
                {paint.colorHex && <ColorSwatch hex={paint.colorHex} />}
                <Box>
                  {paint.name}
                  <Box sx={{ fontSize: 12, color: "text.secondary" }}>
                    {paint.brand} · {paint.colorHex}
                  </Box>
                </Box>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField {...params} label={t("toolsPaint")} placeholder={t("toolsSearchPaint")} />
          )}
          fullWidth
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0,1fr)", md: "auto minmax(0,1fr)" },
            columnGap: 4,
            rowGap: 3,
            alignItems: "start",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box id={roleId} sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>
              {t("complementaryRole")}
            </Box>
            <ToggleButtonGroup
              exclusive
              aria-labelledby={roleId}
              value={role}
              onChange={(_, value: Role | null) => {
                if (!value) return;
                setRole(value);
                setChoices({});
              }}
              sx={{ flexWrap: "wrap" }}
            >
              {roles.map((item) => (
                <ToggleButton key={item} value={item} sx={{ px: 2 }}>
                  {t(roleKeys[item])}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <Box sx={{ minWidth: 0, px: 1 }}>
            <Box id={strengthId} sx={{ fontSize: 14, fontWeight: 700 }}>
              {t("complementaryStrength")}
            </Box>
            <Slider
              aria-labelledby={strengthId}
              value={strength}
              onChange={(_, value) => updateStrength(value)}
              getAriaValueText={(value) => t("complementaryStrengthValue", { value: number.format(value) })}
              valueLabelDisplay="auto"
            />
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: 1,
                fontSize: 12,
                color: "text.secondary",
              }}
            >
              <span>{t("complementarySubtle")}</span>
              <span>{t("complementaryStrengthValue", { value: number.format(strength) })}</span>
              <span>{t("complementaryStrong")}</span>
            </Box>
          </Box>
        </Box>
      </Box>
      {options.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {options.error.message}
        </Alert>
      )}
      {colors.error && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={<Button onClick={colors.refetch}>{t("toolsRetry")}</Button>}
        >
          {colors.error.message}
        </Alert>
      )}
      {colors.loading && colors.paints.length === 0 ? (
        <ComplementaryLoading />
      ) : (
        <>
          {!selected && (
            <Box sx={{ mt: 3, color: "text.secondary", fontSize: 14 }}>{t("complementaryChoose")}</Box>
          )}
          {selected && !input && !colors.error && (
            <Alert severity="info" sx={{ mt: 3 }}>
              {t("complementaryInputMissing")}
            </Alert>
          )}
          {input && !targets && (
            <Alert severity="info" sx={{ mt: 3 }}>
              {t("toolsInvalidColor")}
            </Alert>
          )}
          {input && targets && (
            <>
              <ComplementaryPalette
                slots={schemeOrder.map((item) => ({
                  role: item,
                  label: t(roleKeys[item]),
                  paint: item === role ? input : picked[item]?.paint,
                  input: item === role,
                }))}
                canSave={canSave}
                onSave={() => setSaveOpen(true)}
              />
              <Box sx={{ mt: 3, color: "text.secondary", fontSize: 12 }}>
                {t("complementaryDistanceHint")}
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                  gap: 2,
                  mt: 2,
                }}
              >
                {results.map((row) => (
                  <Box
                    key={row.role}
                    component="section"
                    aria-label={t(roleKeys[row.role])}
                    sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, minWidth: 0 }}
                  >
                    <Box component="h3" sx={{ mt: 0, mb: 1, fontSize: 16 }}>
                      {t(roleKeys[row.role])}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 12, mb: 2 }}>
                      <ColorSwatch hex={row.target} />
                      {t("complementaryTarget", { hex: row.target })}
                    </Box>
                    {!row.matches.length ? (
                      <Alert severity="info">{t("complementaryNoOwned")}</Alert>
                    ) : (
                      <>
                        {row.matches[0].deltaE > NO_CLOSE_MATCH_DELTA_E && (
                          <Alert severity="info" sx={{ mb: 1 }}>
                            {t("complementaryNoClose")}
                          </Alert>
                        )}
                        <Box sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>
                          {t("complementaryAlternatives")}
                        </Box>
                        <Box sx={{ display: "grid", gap: 1 }}>
                          {row.matches.map((match) => (
                            <Button
                              key={match.paint.id}
                              disableRipple
                              variant="outlined"
                              aria-pressed={picked[row.role]?.paint.id === match.paint.id}
                              onClick={() =>
                                setChoices((previous) => ({ ...previous, [row.role]: match.paint.id }))
                              }
                              sx={{
                                textAlign: "left",
                                justifyContent: "flex-start",
                                textTransform: "none",
                                whiteSpace: "normal",
                                color: "text.primary",
                                p: 1,
                                borderWidth: 2,
                                borderColor:
                                  picked[row.role]?.paint.id === match.paint.id
                                    ? "primary.main"
                                    : "transparent",
                                bgcolor:
                                  picked[row.role]?.paint.id === match.paint.id
                                    ? "var(--sunken)"
                                    : "transparent",
                                "&:hover": { bgcolor: "var(--sunken)", borderWidth: 2 },
                                gap: 1,
                                overflowWrap: "anywhere",
                                minWidth: 0,
                              }}
                            >
                              <ColorMatchSwatch target={row.target} paint={match.paint.hex} size={40} />
                              <Box component="span" sx={{ minWidth: 0, flex: 1 }}>
                                <Box component="span" sx={{ display: "block", fontWeight: 700 }}>
                                  {match.paint.name}
                                </Box>
                                <Box
                                  component="span"
                                  sx={{ display: "block", color: "text.secondary", fontSize: 12 }}
                                >
                                  {match.paint.brand} · {match.paint.hex}
                                </Box>
                                <Box
                                  component="span"
                                  sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    gap: 0.75,
                                    mt: 0.5,
                                  }}
                                >
                                  <MatchQualityChip deltaE={match.deltaE} />
                                  {picked[row.role]?.paint.id === match.paint.id && (
                                    <Box
                                      component="span"
                                      sx={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 0.25,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "text.primary",
                                      }}
                                    >
                                      <Check aria-hidden sx={{ fontSize: 16, color: "primary.main" }} />
                                      {t("complementarySelected")}
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                            </Button>
                          ))}
                        </Box>
                      </>
                    )}
                  </Box>
                ))}
              </Box>
            </>
          )}
        </>
      )}
      {saveOpen && input && (
        <ComplementarySave
          inputName={input.name}
          entries={entries}
          ready={canSave}
          onClose={() => setSaveOpen(false)}
        />
      )}
    </Card>
  );
}

function ComplementaryLoading() {
  const { t } = useTranslation("pages");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <Box aria-busy="true" data-skeleton="complementary" sx={{ mt: 3 }}>
      <Box role="status" aria-live="polite" sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
        {t("complementaryLoading")}
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: 2,
        }}
      >
        {[0, 1, 2].map((key) => (
          <Box key={key} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Skeleton
              aria-hidden="true"
              animation={reducedMotion ? false : "pulse"}
              width="50%"
              height={24}
            />
            <Skeleton
              aria-hidden="true"
              animation={reducedMotion ? false : "pulse"}
              variant="rounded"
              height={150}
              sx={{ mt: 2 }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
