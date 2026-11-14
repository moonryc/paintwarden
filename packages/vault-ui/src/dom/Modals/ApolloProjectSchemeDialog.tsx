import { useTranslation } from "react-i18next";
import { Alert, Button } from "@mui/material";
import Box from "@mui/material/Box";
import { useState } from "react";

import { Modal } from "../Components/Modal";
import { SchemePreview as ProjectSchemePreviewView } from "../Components/SchemePreview";
import { useMiniatureScheme } from "../graphql/miniature-scheme-hooks";
import { schemeEntryModels, schemeSummaryModel } from "../graphql/miniature-scheme-model";
import { usePaintStock } from "../graphql/stock-actions";
import type { Paint } from "../types";

import { ProjectSchemeEditor } from "./ProjectSchemeEditor";

export { SchemePreview as ProjectSchemePreviewView } from "../Components/SchemePreview";

type SchemeDialogProps = {
  schemeId: string;
  toggleOwned?(paint: Paint): void;
  markOwnedOnly?: boolean;
  onClose(): void;
};

export function ApolloProjectSchemeDialog(props: SchemeDialogProps) {
  return <ProjectSchemeContent key={props.schemeId} {...props} />;
}

function ProjectSchemeContent({ schemeId, toggleOwned, markOwnedOnly = true, onClose }: SchemeDialogProps) {
  const { t } = useTranslation("components");
  const result = useMiniatureScheme(schemeId);
  const [editing, setEditing] = useState(false);
  const { setPaintState } = usePaintStock();
  const data = result.data;
  if (!data?.scheme)
    return (
      <Modal title={t("colorScheme")} subtitle={t("orderedPaintRecipeAndReferenceImages")} onClose={onClose}>
        {result.error ? (
          <Alert severity="error" action={<Button onClick={result.refetch}>{t("retry")}</Button>}>
            {result.error.message}
          </Alert>
        ) : (
          <Box role="status">
            {result.loading ? t("loadingColorScheme") : t("thisColorSchemeIsNoLongerAvailable")}
          </Box>
        )}
      </Modal>
    );
  const scheme = schemeSummaryModel(data.scheme);
  const { entries, paints, projections } = schemeEntryModels(data.entries.nodes);
  if (editing && !scheme.isSystem)
    return (
      <ProjectSchemeEditor
        key={scheme.id}
        scheme={scheme}
        entries={entries}
        paints={paints}
        refreshError={result.error}
        refreshing={result.loading}
        onRefresh={result.refetch}
        onClose={onClose}
      />
    );
  return (
    <ProjectSchemePreviewView
      active={scheme}
      entries={entries}
      projections={projections}
      availableCount={data.scheme.availableCount}
      paintCount={data.scheme.paintCount}
      toggleOwned={
        toggleOwned ?? (markOwnedOnly ? (paint) => setPaintState(paint.id, "OWNED", "FULL", 1) : undefined)
      }
      onEdit={() => setEditing(true)}
      onClose={onClose}
      error={result.error}
      loading={result.loading}
      onRetry={result.refetch}
    />
  );
}
