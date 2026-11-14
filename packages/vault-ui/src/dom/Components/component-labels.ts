import type { ColorCategory } from "@paintwarden/core/color-categories";

import { i18n } from "../i18n";
import { getSteps } from "../utils/constants";

const colorKeys = {
  RED: "colorRed",
  PINK: "colorPink",
  ORANGE: "colorOrange",
  YELLOW: "colorYellow",
  GREEN: "colorGreen",
  TURQUOISE: "colorTurquoise",
  BLUE: "colorBlue",
  PURPLE: "colorPurple",
  BROWN: "colorBrown",
  BLACK: "colorBlack",
  GREY: "colorGrey",
  WHITE: "colorWhite",
  GOLD: "colorGold",
  SILVER: "colorSilver",
  BONE: "colorBone",
  FLESH: "colorFlesh",
} as const satisfies Record<ColorCategory, string>;

export function colorCategoryLabel(category: ColorCategory): string {
  return i18n.t(`components:${colorKeys[category]}`);
}

const milestoneKeys = {
  "GET READY!": "milestoneGetReady",
  "YOU'RE READY!": "milestoneReady",
  "GET BATTLE READY!": "milestoneGetBattleReady",
  "YOU'RE BATTLE READY!": "milestoneBattleReady",
  "GET PARADE READY!": "milestoneGetParadeReady",
  "YOU'RE PARADE READY!": "milestoneParadeReady",
} as const;

// Translate only application-defined choices; preserve arbitrary catalog/user labels.
export function dividerLabel(label: string): string {
  const step = getSteps().find(([id]) => id === label);
  if (step) return step[1];
  if (Object.hasOwn(milestoneKeys, label)) {
    return i18n.t(`components:${milestoneKeys[label as keyof typeof milestoneKeys]}`);
  }
  return label;
}
