import { Box, Skeleton, useMediaQuery, type SxProps, type Theme } from "@mui/material";
import { useTranslation } from "react-i18next";

import type { DialogKind } from "../dialog-preload";
import { ProjectDrawerFrame } from "../Modals/ProjectDrawerFrame";
import { visuallyHiddenSx } from "../utils/visually-hidden";

import { Modal } from "./Modal";
import { PageSkeleton } from "./PageSkeletons";

export type SkeletonDialog = DialogKind;

function Shape({
  height = 56,
  width = "100%",
  sx,
}: {
  height?: number;
  width?: number | string;
  sx?: SxProps<Theme>;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", { noSsr: true });
  return (
    <Skeleton
      aria-hidden="true"
      variant="rounded"
      animation={reducedMotion ? false : "pulse"}
      width={width}
      sx={[
        { height, transform: "none", bgcolor: "var(--sunken)", borderRadius: 1.5, maxWidth: "100%" },
        ...(Array.isArray(sx) ? sx : [sx ?? {}]),
      ]}
    />
  );
}

const pair = {
  display: "grid",
  gap: 2.5,
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
};
const stack = { display: "flex", flexDirection: "column", gap: 2.5 };
const action = { height: { xs: 44, md: 40 } };

function PaintSkeleton() {
  return (
    <Box sx={stack}>
      <Box sx={pair}>
        <Shape />
        <Shape />
      </Box>
      <Shape />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Shape width={32} height={48} />
        <Shape sx={{ flex: 1 }} />
      </Box>
      <Shape />
      <Shape sx={action} />
    </Box>
  );
}

function MiniatureSkeleton() {
  const { t } = useTranslation("components");
  return (
    <Box sx={stack}>
      <Box sx={{ border: "1px solid var(--line)", borderRadius: 2, p: 1.5 }}>
        <Box
          sx={{
            mb: 1.5,
            position: "relative",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 1.5,
          }}
        >
          <Box sx={{ visibility: "hidden" }}>
            <Box
              component="p"
              sx={{
                m: 0,
                mb: 0.7,
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              {t("miniTemplate")}
            </Box>
            <Box component="p" sx={{ m: 0, mt: 0.5, fontSize: "0.75rem", lineHeight: 4 / 3 }}>
              {t("chooseASourceOrPersonalTemplateToAddIts")}
            </Box>
          </Box>
          <Shape width={18} height={18} sx={{ flexShrink: 0 }} />
          <Shape width="28%" height={12} sx={{ position: "absolute", top: 0 }} />
          <Shape width="90%" height={16} sx={{ position: "absolute", top: 28 }} />
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))",
          }}
        >
          <Shape height={40} />
          <Shape height={40} />
        </Box>
      </Box>
      <Shape height={148} />
      <Shape />
      <Box sx={{ position: "relative" }}>
        <Box
          component="p"
          sx={{
            visibility: "hidden",
            m: 0,
            mb: 0.7,
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            position: "relative",
          }}
        >
          {t("collection")}
        </Box>
        <Shape height={12} width="24%" sx={{ position: "absolute", top: 0 }} />
        <Shape height={54} />
      </Box>
      <Shape />
      <Shape height={102} />
      <Shape sx={action} />
    </Box>
  );
}

function SchemeSkeleton() {
  const { t } = useTranslation("components");
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ ...pair, gap: 1.5 }}>
        <Shape />
        <Shape />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1 }}>
        <Shape sx={action} />
        <Shape sx={action} />
        <Shape sx={action} />
      </Box>
      <Box>
        <Box
          sx={{
            mb: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <Box
            component="p"
            sx={{
              visibility: "hidden",
              m: 0,
              mb: 0.7,
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {t("schemeOrder")}
          </Box>
          <Box component="span" sx={{ visibility: "hidden", fontSize: "0.75rem", lineHeight: 4 / 3 }}>
            {t("addPaintsInsideAStepDragItemsToReorder")}
          </Box>
          <Shape height={16} width="30%" sx={{ position: "absolute", top: 0 }} />
        </Box>
        <Box sx={{ border: "1px solid var(--line)", borderRadius: 1.5, overflow: "hidden" }}>
          <Shape height={45} sx={{ borderRadius: 0 }} />
          <Shape height={52} sx={{ borderRadius: 0 }} />
        </Box>
      </Box>
      <Box sx={{ pt: 0.5 }}>
        <Shape sx={action} />
      </Box>
    </Box>
  );
}

/** The real responsive dialog frames are shared, not approximated overlays. */
export function DialogSkeleton({
  kind,
  title,
  onClose,
}: {
  kind: SkeletonDialog;
  title: string;
  onClose(): void;
}) {
  const { t } = useTranslation("components");
  const { t: pagesT } = useTranslation("pages");
  if (kind === "project")
    return (
      <ProjectDrawerFrame title={title} onClose={onClose}>
        <PageSkeleton page="miniature-detail" />
      </ProjectDrawerFrame>
    );
  if (kind === "plugins")
    return (
      <Modal
        title={title}
        subtitle={pagesT("sourcesInstallPublicCatalogsOfPaintsSchemesAndTemplatesFrom")}
        onClose={onClose}
        footer={
          <Box aria-hidden="true">
            <Shape width={160} sx={action} />
          </Box>
        }
      >
        <PageSkeleton page="plugins" />
      </Modal>
    );
  const subtitle =
    kind === "paint"
      ? t("addACustomColorToYourPaintLibrary")
      : kind === "miniature"
        ? t("startFromAMiniTemplateOrBuildYourOwn")
        : t("groupPaintsIntoReusableOrderedPalettes");
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <Box data-dialog-skeleton={kind} aria-busy="true">
        <Box role="status" aria-busy="true" aria-live="polite" sx={visuallyHiddenSx}>
          {t("openingDialog", { title })}
        </Box>
        <Box aria-hidden="true">
          {kind === "paint" ? (
            <PaintSkeleton />
          ) : kind === "miniature" ? (
            <MiniatureSkeleton />
          ) : (
            <SchemeSkeleton />
          )}
        </Box>
      </Box>
    </Modal>
  );
}
