import type { Paint } from "../types";
import { customSchemeMilestones } from "../utils/scheme-order";

import { ApolloProjectSchemeDialog } from "./ApolloProjectSchemeDialog";
import { ProjectSchemeEditor } from "./ProjectSchemeEditor";

// Both entry points share the fully-paged scheme projection. Creation has no
// snapshot dependency either: paint search is served by Apollo autocomplete.
export function ColorSchemesDialog({
  initialId,
  toggleOwned,
  onClose,
}: {
  initialId: string | null;
  toggleOwned?(paint: Paint): void;
  onClose(): void;
}) {
  return initialId === null ? (
    <ProjectSchemeEditor
      key="create"
      mode="create"
      scheme={{ id: "", name: "", category: null, isSystem: false }}
      entries={customSchemeMilestones()}
      paints={[]}
      onClose={onClose}
    />
  ) : (
    <ApolloProjectSchemeDialog
      key={initialId}
      schemeId={initialId}
      markOwnedOnly={false}
      toggleOwned={toggleOwned}
      onClose={onClose}
    />
  );
}
