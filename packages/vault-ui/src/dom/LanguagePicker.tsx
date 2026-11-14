import { Alert, Box, MenuItem, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { languages, useLanguage } from "./i18n";

export function LanguagePicker() {
  const { t } = useTranslation("common");
  const { language, setLanguage } = useLanguage();
  const [error, setError] = useState(false);
  return (
    <Box sx={{ p: 3, border: "1px solid var(--line)", borderRadius: 3 }}>
      <TextField
        select
        fullWidth
        label={t("language")}
        value={language}
        onChange={(event) => {
          setError(false);
          void setLanguage(event.target.value).catch(() => setError(true));
        }}
      >
        {languages.map(({ code, name }) => (
          <MenuItem key={code} value={code} lang={code}>
            {name}
          </MenuItem>
        ))}
        {language === "en-XA" && <MenuItem value="en-XA">［Pseudo］</MenuItem>}
      </TextField>
      <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
        {t("languageDescription")}
      </Typography>
      {error && <Alert severity="error">{t("languageSaveFailed")}</Alert>}
    </Box>
  );
}
