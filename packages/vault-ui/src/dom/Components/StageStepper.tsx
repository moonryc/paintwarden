import { useTranslation } from "react-i18next";
import { Step, StepButton, Stepper } from "@mui/material";

import type { PaintingStatus } from "../types";
import { getStages } from "../utils/constants";

export function StageStepper({
  value,
  onChange,
}: {
  value: PaintingStatus;
  onChange(stage: PaintingStatus): void;
}) {
  const { t } = useTranslation("components");
  const current = getStages().findIndex(([stage]) => stage === value);
  const complete = value === "COMPLETE";
  const progressColor = complete ? "var(--ok)" : "var(--gold)";

  return (
    <Stepper
      alternativeLabel
      nonLinear
      activeStep={current}
      aria-label={t("paintingStage")}
      sx={{
        width: "100%",
        height: 64,
        alignItems: "stretch",
        "& .MuiStep-root": { px: 0, minWidth: 0, display: "flex", overflow: "visible" },
        // Each connector reaches into the next step's button, so keep it above that button's
        // hover background. The step icons sit later in the DOM and still draw on top.
        "& .MuiStepConnector-root": { top: 17, zIndex: 1, pointerEvents: "none" },
        "& .MuiStepConnector-line": { borderColor: "var(--line-strong)", borderTopWidth: 2 },
        "& .MuiStepConnector-root.Mui-active .MuiStepConnector-line, & .MuiStepConnector-root.Mui-completed .MuiStepConnector-line":
          { borderColor: progressColor },
      }}
    >
      {getStages().map(([stage, label], index) => {
        const active = index === current;
        return (
          <Step key={stage} completed={index < current}>
            <StepButton
              onClick={() => !active && onChange(stage)}
              aria-current={active ? "step" : undefined}
              sx={{
                width: "100%",
                height: "100%",
                m: 0,
                boxSizing: "border-box",
                minWidth: 0,
                overflow: "visible",
                px: 0.25,
                py: 0.75,
                borderRadius: 1,
                "&:hover": { bgcolor: "var(--sunken)" },
                "&.Mui-focusVisible": { outline: "2px solid var(--gold)", outlineOffset: 1 },
                "& .MuiStepLabel-root": { width: "100%", height: "100%", overflow: "visible" },
                "& .MuiStepLabel-iconContainer": {
                  position: "relative",
                  zIndex: 1,
                  flexShrink: 0,
                  overflow: "visible",
                },
                "& .MuiStepLabel-labelContainer": {
                  minWidth: 0,
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                },
                "& .MuiStepLabel-label.MuiStepLabel-alternativeLabel": {
                  mt: 0,
                  fontSize: { xs: 10, sm: 11 },
                  lineHeight: 1.2,
                  whiteSpace: "normal",
                  color: "var(--ink-faint)",
                },
                "& .MuiStepLabel-label.Mui-active": {
                  color: complete ? progressColor : "var(--ink)",
                  fontWeight: 700,
                },
                "& .MuiStepLabel-label.Mui-completed": {
                  color: complete ? progressColor : "var(--ink-soft)",
                },
                "& .MuiStepIcon-root": {
                  display: "block",
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  overflow: "visible",
                  color: "var(--line-strong)",
                },
                "& .MuiStepIcon-root.Mui-active": { color: progressColor },
                "& .MuiStepIcon-root.Mui-completed": { color: progressColor },
              }}
            >
              {label}
            </StepButton>
          </Step>
        );
      })}
    </Stepper>
  );
}
