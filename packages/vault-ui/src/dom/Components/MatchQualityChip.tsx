import { matchCloseness, type MatchCloseness } from "@paintwarden/core/color-matching";
import { useTranslation } from "react-i18next";

import type { Tone } from "../utils/tones";

import { StatusChip } from "./StatusChip";

const closenessTone = {
  exact: "ok",
  close: "ok",
  similar: "gold",
  distant: "muted",
} satisfies Record<MatchCloseness, Tone>;

const closenessKey = {
  exact: "matchQualityExact",
  close: "matchQualityClose",
  similar: "matchQualitySimilar",
  distant: "matchQualityDistant",
} as const satisfies Record<MatchCloseness, string>;

/** Puts a ΔE distance into words, keeping the number for users who compare values. */
export function MatchQualityChip({ deltaE }: { deltaE: number }) {
  const { t, i18n } = useTranslation("components");
  const closeness = matchCloseness(deltaE);
  const value = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language, {
    maximumFractionDigits: 1,
  }).format(deltaE);
  return (
    <StatusChip
      tone={closenessTone[closeness]}
      sx={{ flexShrink: 1, minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}
    >
      {t("matchQualityLabel", { quality: t(closenessKey[closeness]), value })}
    </StatusChip>
  );
}
