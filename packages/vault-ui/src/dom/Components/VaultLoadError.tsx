import { useTranslation } from "react-i18next";
import { Box, Button, Card } from "@mui/material";

import { RotateCw } from "../icons";

// Replaces the app when the vault can't be loaded, so an unreachable server never looks like an
// empty collection. The desktop app can also switch servers from here.
export function VaultLoadError({
  message,
  onRetry,
  onChangeServer,
}: {
  message: string;
  onRetry: () => void;
  onChangeServer?: () => void;
}) {
  const { t } = useTranslation("components");
  return (
    <Box
      component="main"
      sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 2, bgcolor: "var(--canvas)" }}
    >
      <Card role="alert" sx={{ width: "100%", maxWidth: 480, p: { xs: 3, sm: 4 }, display: "grid", gap: 2 }}>
        <Box
          component="h1"
          sx={{ m: 0, fontFamily: "var(--font-serif)", fontSize: "1.5rem", letterSpacing: "-0.02em" }}
        >
          {t("vaultOpenErrorTitle")}
        </Box>
        <Box component="p" sx={{ m: 0, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.5 }}>
          {t("vaultOpenErrorBody", { message })}
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "flex-end" }}>
          {onChangeServer && (
            <Button variant="outlined" onClick={onChangeServer}>
              {t("changeServer")}
            </Button>
          )}
          <Button variant="contained" startIcon={<RotateCw size={16} />} onClick={onRetry}>
            {t("tryAgain")}
          </Button>
        </Box>
      </Card>
    </Box>
  );
}
