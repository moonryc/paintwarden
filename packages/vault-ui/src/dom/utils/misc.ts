import { i18n } from "@paint-vault/i18n/runtime";
export const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    // Desktop browsers do not support vibration.
  }
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12
    ? i18n.t("shell:goodMorning")
    : h < 18
      ? i18n.t("shell:goodAfternoon")
      : i18n.t("shell:goodEvening");
};
