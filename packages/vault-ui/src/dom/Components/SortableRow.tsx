import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

import { DragHandle } from "./DragHandle";

export function SortableRow({
  id,
  label,
  sx,
  handleSx,
  nested = false,
  children,
}: {
  id: string;
  label: string;
  sx?: SxProps<Theme>;
  // Extra styles for the drag handle, such as its color.
  handleSx?: SxProps<Theme>;
  nested?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation("components");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <Box
      component="li"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined }}
      sx={[
        {
          boxSizing: "border-box",
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottomStyle: "solid",
          borderBottomWidth: "1px",
          borderColor: "var(--line)",
          p: 1.25,
          "&:last-child": {
            borderBottomStyle: "solid",
            borderBottomWidth: "0px",
          },
        },
        isDragging && {
          opacity: 0.45,
          boxShadow: "var(--shadow-lg)",
        },
        nested && { pl: 3.5, borderLeft: "3px solid var(--brand)" },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <DragHandle
        label={t("reorderItem", { name: label })}
        attributes={attributes}
        listeners={listeners}
        sx={handleSx}
      />
      {children}
    </Box>
  );
}
