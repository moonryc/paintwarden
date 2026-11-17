import CreateNewFolder from "@mui/icons-material/CreateNewFolderOutlined";
import NoteAdd from "@mui/icons-material/NoteAddOutlined";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ModalLeadContext } from "./Modal";

type Choice = "item" | "folder";

/**
 * One add dialog for a folder-organized page: a Folder/Miniature (or Folder/Template) switch sits
 * above whichever form is chosen, and switching swaps the form in place without a second dialog.
 */
export function AddChoiceDialog({
  folderView,
  itemLabel,
  item,
  folder,
}: {
  /** Flat views create items directly, without offering folder creation. */
  folderView: boolean;
  itemLabel: string;
  /** The item form's Modal, such as Add a miniature. */
  item: ReactNode;
  /** The folder form's Modal. */
  folder: ReactNode;
}) {
  const { t } = useTranslation("pages");
  const [choice, setChoice] = useState<Choice>("folder");
  const [switched, setSwitched] = useState(false);
  // The swapped form mounts a new dialog; keep keyboard focus on the switch the user just used.
  const keepFocus = (button: HTMLButtonElement | null) => {
    if (switched) button?.focus();
  };
  const lead = (
    <ToggleButtonGroup
      exclusive
      fullWidth
      size="small"
      aria-label={t("folders.addChoice")}
      value={choice}
      onChange={(_event, value: Choice | null) => {
        if (!value) return;
        setSwitched(true);
        setChoice(value);
      }}
    >
      <ToggleButton value="folder" ref={choice === "folder" ? keepFocus : undefined} sx={{ gap: 0.75 }}>
        <CreateNewFolder fontSize="small" aria-hidden />
        {t("folders.folder")}
      </ToggleButton>
      <ToggleButton value="item" ref={choice === "item" ? keepFocus : undefined} sx={{ gap: 0.75 }}>
        <NoteAdd fontSize="small" aria-hidden />
        {itemLabel}
      </ToggleButton>
    </ToggleButtonGroup>
  );
  if (!folderView) return item;
  return (
    <ModalLeadContext.Provider value={{ lead, instant: switched }}>
      {choice === "item" ? item : folder}
    </ModalLeadContext.Provider>
  );
}
