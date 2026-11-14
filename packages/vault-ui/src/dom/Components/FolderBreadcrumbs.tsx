import { Breadcrumbs, Link, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import type { FolderView } from "./FolderTile";

export function FolderBreadcrumbs({
  kind,
  ancestors,
  onNavigate,
}: {
  kind: "project" | "template";
  ancestors: Pick<FolderView, "id" | "name">[];
  onNavigate: (id: string | null) => void;
}) {
  const { t } = useTranslation("pages");
  const root = t(kind === "project" ? "folders.projects" : "folders.templateFolders");
  return (
    <Breadcrumbs aria-label={t("folders.breadcrumbs")}>
      {ancestors.length ? (
        <Link sx={{ color: "var(--ink)" }} component="button" type="button" onClick={() => onNavigate(null)}>
          {root}
        </Link>
      ) : (
        <Typography aria-current="page">{root}</Typography>
      )}
      {ancestors.map((folder, index) =>
        index === ancestors.length - 1 ? (
          <Typography key={folder.id} aria-current="page" sx={{ overflowWrap: "anywhere" }}>
            {folder.name}
          </Typography>
        ) : (
          <Link
            sx={{ color: "var(--ink)" }}
            key={folder.id}
            component="button"
            type="button"
            onClick={() => onNavigate(folder.id)}
          >
            {folder.name}
          </Link>
        ),
      )}
    </Breadcrumbs>
  );
}
