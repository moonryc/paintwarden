import { Alert, Box, Button } from "@mui/material";
import { useTranslation } from "react-i18next";

import { Modal } from "../../Components/Modal";
import { formatNumber } from "../../i18n";
import { Trash2 } from "../../icons";

import { type SourceRemoval, KINDS } from "./sources.utils";

const blockerKeys = {
  "Miniature paint requirements": "sourcesBlockerMiniaturePaintRequirements",
  "Miniature schemes": "sourcesBlockerMiniatureSchemes",
  "Paint inventory or wishlist entries": "sourcesBlockerPaintInventoryOrWishlistEntries",
  "Other templates": "sourcesBlockerOtherTemplates",
  "Other schemes": "sourcesBlockerOtherSchemes",
  "Paint substitutions": "sourcesBlockerPaintSubstitutions",
  "Miniature substitution choices": "sourcesBlockerMiniatureSubstitutionChoices",
  "Other catalog sources": "sourcesBlockerOtherCatalogSources",
} as const;

export function RemoveSourceDialog({
  removal,
  removing,
  onClose,
  onRemove,
}: {
  removal: SourceRemoval;
  removing: boolean;
  onClose(): void;
  onRemove(): void;
}) {
  const { t } = useTranslation("pages");
  const nothing = !removal.removes.paints && !removal.removes.schemes && !removal.removes.templates;
  return (
    <Modal
      title={t("sourcesRemoveTitle", { name: removal.source.name })}
      subtitle={t("sourcesRemovalVersion", { version: removal.source.version })}
      onClose={onClose}
    >
      <Box component="p" sx={{ m: 0, fontSize: 14, color: "var(--ink-soft)" }}>
        {nothing
          ? t("sourcesNothingWillBeDeletedEverythingFromThisPluginIs")
          : t("sourcesTheseItemsWillBeDeletedFromYourVaultItems")}
      </Box>
      {!nothing && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1, mt: 2 }}>
          {KINDS.map((kind) => (
            <Box
              key={kind}
              sx={{ p: 1.5, borderRadius: "12px", bgcolor: "var(--sunken)", textAlign: "center" }}
            >
              <Box sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {formatNumber(removal.removes[kind])}
              </Box>
              <Box sx={{ fontSize: 12, color: "var(--ink-faint)", textTransform: "capitalize" }}>
                {t(
                  (
                    {
                      paints: "sourcesPaintsText",
                      schemes: "sourcesSchemesText",
                      templates: "sourcesTemplatesText",
                    } as const
                  )[kind],
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {removal.blockers.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Box sx={{ fontWeight: 650 }}>{t("sourcesThisPluginIsStillInUse")}</Box>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {removal.blockers.map((item) => (
              <li key={item.label}>
                {formatNumber(item.count)}{" "}
                {item.label in blockerKeys
                  ? t(blockerKeys[item.label as keyof typeof blockerKeys])
                  : item.label}
              </li>
            ))}
          </Box>
          <Box sx={{ mt: 0.5 }}>{t("sourcesRemoveOrChangeThoseFirstThenTryAgain")}</Box>
        </Alert>
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2.5 }}>
        <Button onClick={onClose} disabled={removing}>
          {removal.canRemove ? t("sourcesCancel") : t("sourcesClose")}
        </Button>
        <Button
          color="error"
          variant="contained"
          startIcon={<Trash2 size={16} />}
          loading={removing}
          disabled={!removal.canRemove}
          onClick={onRemove}
        >
          {t("sourcesRemovePlugin")}
        </Button>
      </Box>
    </Modal>
  );
}
