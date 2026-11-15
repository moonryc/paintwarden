import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

import { X } from "../icons";

export function ModalHeader({
  title,
  subtitle,
  badge,
  onClose,
  id,
  size = "lg",
  sx,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  onClose(): void;
  id?: string;
  size?: "md" | "lg";
  sx?: SxProps<Theme>;
}) {
  const { t } = useTranslation("components");
  return (
    <Box
      component="div"
      sx={[
        {
          boxSizing: "border-box",
          minWidth: 0,
          overflowWrap: "anywhere",
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          bgcolor: "var(--surface)",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        component="div"
        sx={{
          minWidth: 0,
        }}
      >
        <Box
          component="h2"
          id={id}
          sx={[
            {
              m: 0,
              fontFamily: "var(--font-serif)",
              letterSpacing: "-0.02em",
              fontOpticalSizing: "auto",
              fontWeight: 600,
            },
            size === "md"
              ? {
                  fontSize: "1.25rem",
                  lineHeight: 1.4,
                }
              : {
                  fontSize: "1.5rem",
                  lineHeight: 4 / 3,
                },
          ]}
        >
          {title}
        </Box>
        {badge ? (
          <Box
            component="div"
            sx={{
              mt: 0.75,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              columnGap: 1.25,
              rowGap: 0.75,
            }}
          >
            {subtitle && (
              <Box
                component="p"
                sx={{
                  m: 0,
                  fontSize: "0.875rem",
                  lineHeight: 10 / 7,
                  color: "var(--ink-faint)",
                }}
              >
                {subtitle}
              </Box>
            )}
            {badge}
          </Box>
        ) : (
          subtitle && (
            <Box
              component="p"
              sx={{
                m: 0,
                mt: 0.5,
                fontSize: "0.875rem",
                lineHeight: 10 / 7,
                color: "var(--ink-faint)",
              }}
            >
              {subtitle}
            </Box>
          )
        )}
      </Box>
      <IconButton
        onClick={onClose}
        aria-label={t("close")}
        sx={{
          boxSizing: "border-box",
          flexShrink: "0",
          borderRadius: "calc(infinity * 1px)",
          borderStyle: "solid",
          borderWidth: "1px",
          borderColor: "var(--line) !important",
          bgcolor: "var(--surface-raised) !important",
        }}
      >
        <X size={17} />
      </IconButton>
    </Box>
  );
}
