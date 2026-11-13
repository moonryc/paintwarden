import { ButtonBase } from "@mui/material";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

import { visuallyHiddenSx } from "../utils/visually-hidden";

// A button that opens a paint's details. Its name is the visible text, such as the paint's name
// and range, followed by "open details" for screen readers.
export function PaintDetailsButton({
  onClick,
  sx,
  children,
}: {
  onClick(): void;
  sx?: SxProps<Theme>;
  children: ReactNode;
}) {
  return (
    <ButtonBase onClick={onClick} sx={sx}>
      {children}
      <Box component="span" sx={visuallyHiddenSx}>
        , open details
      </Box>
    </ButtonBase>
  );
}
