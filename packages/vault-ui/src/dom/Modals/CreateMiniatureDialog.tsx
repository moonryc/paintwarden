import { i18n } from "@paintwarden/i18n/runtime";

import { DeferredDialog } from "../Components/DeferredDialog";
import { dialogs } from "../dialog-preload";
import { useMiniatureActions } from "../graphql/miniature-actions";
import { useVaultStore } from "../store/hooks";

const MiniatureForm = dialogs.miniature.Component;

/** Adds a miniature, starting in the given folder (the form can change it), then opens it. */
export function CreateMiniatureDialog({
  initialFolderId,
  initialTemplateId,
  onClose,
}: {
  initialFolderId: string | null;
  initialTemplateId: string | null;
  onClose(): void;
}) {
  const actions = useMiniatureActions();
  const openMini = useVaultStore((store) => store.openMini);
  const notify = useVaultStore((store) => store.notify);
  return (
    <DeferredDialog kind="miniature" title={i18n.t("components:addAMiniature")} onClose={onClose}>
      <MiniatureForm
        initialTemplateId={initialTemplateId}
        initialFolderId={initialFolderId}
        onClose={onClose}
        onSubmit={async (values) => {
          const id = await actions.create(values);
          onClose();
          notify(i18n.t("shell:added", { value1: values.title }));
          openMini(id);
        }}
      />
    </DeferredDialog>
  );
}
