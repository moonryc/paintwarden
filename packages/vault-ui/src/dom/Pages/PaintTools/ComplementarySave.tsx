import { Alert, Box, Button, MenuItem, TextField } from "@mui/material";
import { COLOR_CATEGORIES, type ColorCategory } from "@paintwarden/core/color-categories";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "../../Components/Modal";
import { useSchemeActions, type SchemeInput } from "../../graphql/scheme-actions";
import { useVaultStore } from "../../store/hooks";
import { REQUIRED_MILESTONE_LABELS } from "../../utils/scheme-milestones";

const categoryKeys = {
  RED: "toolsCategoryRed",
  PINK: "toolsCategoryPink",
  ORANGE: "toolsCategoryOrange",
  YELLOW: "toolsCategoryYellow",
  GREEN: "toolsCategoryGreen",
  TURQUOISE: "toolsCategoryTurquoise",
  BLUE: "toolsCategoryBlue",
  PURPLE: "toolsCategoryPurple",
  BROWN: "toolsCategoryBrown",
  BLACK: "toolsCategoryBlack",
  GREY: "toolsCategoryGrey",
  WHITE: "toolsCategoryWhite",
  GOLD: "toolsCategoryGold",
  SILVER: "toolsCategorySilver",
  BONE: "toolsCategoryBone",
  FLESH: "toolsCategoryFlesh",
} as const;

export function ComplementarySave({
  inputName,
  entries,
  ready,
  onClose,
}: {
  inputName: string;
  entries: SchemeInput["entries"];
  ready: boolean;
  onClose(): void;
}) {
  const { t } = useTranslation("pages");
  const actions = useSchemeActions();
  const notify = useVaultStore((store) => store.notify);
  const [name, setName] = useState(() => t("complementaryDefaultName", { name: inputName }));
  const [category, setCategory] = useState<ColorCategory>("GREY");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    if (!ready || !name.trim() || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await actions.create({
        name: name.trim(),
        category,
        entries: [
          { type: "DIVIDER", label: REQUIRED_MILESTONE_LABELS.START, tone: "MILESTONE", role: "START" },
          { type: "DIVIDER", label: "OTHER", tone: "SECTION" },
          ...entries,
          { type: "DIVIDER", label: REQUIRED_MILESTONE_LABELS.COMPLETE, tone: "MILESTONE", role: "COMPLETE" },
        ],
      });
      notify(t("complementarySaved"));
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={t("complementarySave")}
      subtitle={t("complementarySaveDescription")}
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <>
          <Button disabled={saving} onClick={onClose}>
            {t("toolsClose")}
          </Button>
          <Button variant="contained" disabled={!ready || !name.trim() || saving} onClick={() => void save()}>
            {saving ? t("toolsSaving") : t("complementarySave")}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "grid", gap: 2 }}>
        <TextField
          label={t("complementaryName")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={saving}
          fullWidth
        />
        <TextField
          select
          label={t("toolsCategory")}
          value={category}
          onChange={(event) => setCategory(event.target.value as ColorCategory)}
          disabled={saving}
          fullWidth
        >
          {COLOR_CATEGORIES.map((item) => (
            <MenuItem key={item} value={item}>
              {t(categoryKeys[item])}
            </MenuItem>
          ))}
        </TextField>
        {failed && <Alert severity="error">{t("complementarySaveFailed")}</Alert>}
      </Box>
    </Modal>
  );
}
