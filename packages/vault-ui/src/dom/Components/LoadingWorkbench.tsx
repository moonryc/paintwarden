import { Skeleton } from "@mui/material";
import Box from "@mui/material/Box";

import { down, up } from "../theme-tokens";

export function LoadingWorkbench() {
  return (
    <Box
      component="div"
      role="status"
      aria-busy="true"
      aria-label="Opening your paint vault"
      sx={{
        "& > :where(:not(:last-child))": { mb: 4 },
      }}
    >
      <Box
        component="div"
        sx={{
          "& > :where(:not(:last-child))": { mb: 1 },
        }}
      >
        <Skeleton
          variant="text"
          sx={{
            boxSizing: "border-box",
            width: "7rem",
          }}
        />
        <Skeleton
          variant="rounded"
          sx={{
            boxSizing: "border-box",
            height: "2.5rem",
            width: "14rem",
            borderRadius: "16px",
          }}
        />
      </Box>
      <Skeleton
        variant="rounded"
        sx={{
          boxSizing: "border-box",
          height: "10rem",
          borderRadius: "20px",
          [up.lg]: {
            height: "9rem",
          },
        }}
      />
      <Box
        component="div"
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 1.5,
          [up.sm]: {
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 2,
          },
          [up.lg]: {
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            variant="rounded"
            sx={{
              boxSizing: "border-box",
              aspectRatio: "4/5",
              height: "auto",
              borderRadius: "20px",
              "&:nth-child(n+3)": {
                [down.sm]: {
                  display: "none",
                },
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
