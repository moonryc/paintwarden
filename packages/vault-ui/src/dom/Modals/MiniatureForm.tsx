import { useTranslation } from "react-i18next";
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import Box from "@mui/material/Box";
import { useEffect, useRef, useState } from "react";

import { Modal } from "../Components/Modal";
import { Archive, Check, Heart, Save, Trash2 } from "../icons";
import { useTemplateCatalog } from "../store/template-hooks";
import { up } from "../theme-tokens";
import type {
  Miniature,
  MiniatureFormValues,
  MiniatureTemplate,
  PaintStatus,
  PaintingStatus,
} from "../types";
import { getStages } from "../utils/constants";

import { MiniatureImageField } from "./MiniatureImageField";

export function MiniatureForm({
  onClose,
  onSubmit,
  onDelete,
  initial,
  initialTemplateId,
}: {
  onClose(): void;
  onSubmit(v: MiniatureFormValues): Promise<void>;
  onDelete?: () => Promise<void>;
  initial?: Miniature;
  initialTemplateId?: string | null;
}) {
  const { t } = useTranslation("components");
  const [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [removeImage, setRemoveImage] = useState(false),
    [title, setTitle] = useState(initial?.title ?? ""),
    [status, setStatus] = useState<PaintStatus>(initial?.status ?? "OWNED"),
    [notes, setNotes] = useState(initial?.notes ?? ""),
    [paintingStatus, setPaintingStatus] = useState<PaintingStatus>(initial?.paintingStatus ?? "NOT_STARTED"),
    [image, setImage] = useState<File | null>(null);
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? ""),
    [faction, setFaction] = useState(initial?.faction ?? ""),
    [scale] = useState(initial?.scale ?? "");
  const [templateCategory, setTemplateCategory] = useState("ALL"),
    [templateSearch, setTemplateSearch] = useState(""),
    [selectedTemplate, setSelectedTemplate] = useState<MiniatureTemplate | null>(null),
    [templateImageUrl, setTemplateImageUrl] = useState("");
  const catalogQuery = useTemplateCatalog(!initial, {
    search: templateSearch,
    category: templateCategory === "ALL" ? null : templateCategory,
  });
  // Opening Add from a distant card must not depend on the first summary page.
  const selectedQuery = useTemplateCatalog(!initial && !!initialTemplateId, { id: initialTemplateId });
  const templateCatalog = catalogQuery.data;
  const templateError = catalogQuery.error?.message ?? selectedQuery.error?.message ?? "";
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);
  const appliedTemplateId = useRef<string | null>(null);
  useEffect(() => {
    if (
      initial ||
      !initialTemplateId ||
      !selectedQuery.data ||
      appliedTemplateId.current === initialTemplateId
    )
      return;
    const match = selectedQuery.data.templates.find((template) => template.id === initialTemplateId);
    if (match) {
      appliedTemplateId.current = initialTemplateId;
      setSelectedTemplate(match);
      setTemplateSearch(match.name);
      setTitle(match.name);
      setManufacturer(match.manufacturer);
      setFaction(match.faction);
      setTemplateImageUrl(match.imageUrl);
    }
  }, [initial, initialTemplateId, selectedQuery.data]);
  const templateMatches = templateCatalog?.templates ?? [];
  return (
    <Modal
      title={initial ? t("editMiniature") : t("addAMiniature")}
      subtitle={initial ? t("keepTheProjectDetailsCurrent") : t("startFromAMiniTemplateOrBuildYourOwn")}
      onClose={onClose}
    >
      <Box
        component="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSubmit({
              title: title.trim(),
              status,
              notes,
              manufacturer,
              faction,
              scale,
              paintingStatus,
              image,
              removeImage,
              templateId: selectedTemplate?.id ?? null,
              includeTemplateImage: !!templateImageUrl && !removeImage,
            });
          } catch {
            setBusy(false);
          }
        }}
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
      >
        {!initial && (
          <Box
            component="div"
            sx={{
              boxSizing: "border-box",
              borderRadius: "1rem",
              borderStyle: "solid",
              borderWidth: "1px",
              borderColor: "var(--line)",
              bgcolor: "color-mix(in oklab, var(--sunken) 45%, transparent)",
              p: 1.5,
            }}
          >
            <Box
              component="div"
              sx={{
                mb: 1.5,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 1.5,
              }}
            >
              <div>
                <Box
                  component="p"
                  sx={{
                    m: 0,
                    mb: 0.7,
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--ink-faint)",
                  }}
                >
                  {t("miniTemplate")}
                </Box>
                <Box
                  component="p"
                  sx={{
                    m: 0,
                    mt: 0.5,
                    fontSize: "0.75rem",
                    lineHeight: 4 / 3,
                    color: "var(--ink-soft)",
                  }}
                >
                  {t("chooseASourceOrPersonalTemplateToAddIts")}
                </Box>
              </div>
              {!templateCatalog && !templateError && (
                <CircularProgress size={18} aria-label={t("loadingTemplates")} />
              )}
            </Box>
            <Box
              component="div"
              sx={{
                display: "grid",
                gap: 1.5,
                [up.sm]: {
                  gridTemplateColumns: "minmax(0,.8fr) minmax(0,1.2fr)",
                },
              }}
            >
              <TextField
                select
                fullWidth
                size="small"
                label={t("category")}
                value={templateCategory}
                disabled={!templateCatalog}
                onChange={(e) => {
                  if (selectedTemplate && title === selectedTemplate.name) setTitle("");
                  setTemplateCategory(e.target.value);
                  setTemplateSearch("");
                  setSelectedTemplate(null);
                  setTemplateImageUrl("");
                  setManufacturer("");
                  setFaction("");
                }}
              >
                <MenuItem value="ALL">{t("allCategories")}</MenuItem>
                {catalogQuery.categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </TextField>
              <Autocomplete
                options={templateMatches}
                filterOptions={(options) => options}
                value={selectedTemplate}
                inputValue={templateSearch}
                onInputChange={(_, value) => setTemplateSearch(value)}
                loading={catalogQuery.loading}
                getOptionLabel={(option) => option.name}
                getOptionKey={(option) => option.id}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                onChange={(_, template) => {
                  setSelectedTemplate(template);
                  setTemplateSearch(template?.name ?? "");
                  if (!template) {
                    setTemplateImageUrl("");
                    return;
                  }
                  setTitle(template.name);
                  setManufacturer(template.manufacturer);
                  setFaction(template.faction);
                  setImage(null);
                  setRemoveImage(false);
                  setTemplateImageUrl(template.imageUrl);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label={t("model")}
                    placeholder={t("searchEveryModel")}
                  />
                )}
              />
            </Box>
            {templateCatalog?.hasNextPage && (
              <Button disabled={catalogQuery.loading} onClick={catalogQuery.loadMore}>
                {t("loadMoreModels")}
              </Button>
            )}
            {templateError && (
              <Alert
                severity="warning"
                action={
                  <Button
                    onClick={() => {
                      catalogQuery.refetch();
                      selectedQuery.refetch();
                    }}
                  >
                    {t("retry")}
                  </Button>
                }
                sx={{
                  boxSizing: "border-box",
                  marginTop: "0.75rem",
                }}
              >
                {t("manualMiniatureAfterError", { message: templateError })}
              </Alert>
            )}
            {selectedTemplate && (
              <Box
                component="div"
                sx={{
                  mt: 1.5,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 0.75,
                }}
              >
                <Chip size="small" label={t("schemeCount", { count: selectedTemplate.schemeCount })} />
                <Chip size="small" label={t("paintCount", { count: selectedTemplate.paintCount })} />
                {selectedTemplate.faction && (
                  <Chip size="small" variant="outlined" label={selectedTemplate.faction} />
                )}
              </Box>
            )}
          </Box>
        )}
        <MiniatureImageField
          image={image}
          onImageChange={setImage}
          removeImage={removeImage}
          onRemoveImageChange={setRemoveImage}
          savedImageUrl={initial?.imageUrl}
          templateImageUrl={templateImageUrl}
        />
        <TextField
          required
          fullWidth
          label={t("name")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("eGSpaceMarineCaptain")}
        />
        <Box
          component="div"
          sx={{
            "& > :where(:not(:last-child))": { mb: 1 },
          }}
        >
          <Box
            component="p"
            sx={{
              m: 0,
              mb: 0.7,
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            {t("collection")}
          </Box>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={status}
            onChange={(_, v: PaintStatus | null) => v && setStatus(v)}
            aria-label={t("collection")}
          >
            <ToggleButton
              value="OWNED"
              sx={[
                {
                  boxSizing: "border-box",
                  gap: "0.5rem",
                  fontSize: "0.875rem",
                  lineHeight: "calc(10 / 7)",
                },
                {
                  "&.Mui-selected, &.Mui-selected:hover": {
                    bgcolor: "var(--brand)",
                    color: "var(--brand-fg)",
                    boxShadow: "var(--shadow-sm)",
                  },
                },
              ]}
            >
              {status === "OWNED" ? <Check size={16} strokeWidth={3} /> : <Archive size={16} />}{" "}
              {t("onMyShelf")}
            </ToggleButton>
            <ToggleButton
              value="WISHLIST"
              sx={[
                {
                  boxSizing: "border-box",
                  gap: "0.5rem",
                  fontSize: "0.875rem",
                  lineHeight: "calc(10 / 7)",
                },
                {
                  "&.Mui-selected, &.Mui-selected:hover": {
                    bgcolor: "var(--brand)",
                    color: "var(--brand-fg)",
                    boxShadow: "var(--shadow-sm)",
                  },
                },
              ]}
            >
              {status === "WISHLIST" ? <Check size={16} strokeWidth={3} /> : <Heart size={16} />}{" "}
              {t("onMyWishlist")}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <TextField
          fullWidth
          select
          label={t("paintingStage")}
          value={paintingStatus}
          onChange={(e) => setPaintingStatus(e.target.value as PaintingStatus)}
        >
          {getStages().map(([v, l]) => (
            <MenuItem key={v} value={v}>
              {l}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          multiline
          minRows={3}
          label={t("notesOptional")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("schemeArmyProjectNotes")}
        />
        <Button
          type="submit"
          variant="contained"
          loading={busy}
          disabled={!title.trim() || deleting}
          startIcon={<Save size={15} />}
          fullWidth
        >
          {t("save")}
        </Button>
        {initial && onDelete && (
          <Button
            type="button"
            variant="text"
            color="error"
            disabled={busy || deleting}
            loading={deleting}
            startIcon={<Trash2 size={15} />}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              setDeleting(true);
              void onDelete().catch(() => {
                setDeleting(false);
                setConfirmDelete(false);
              });
            }}
          >
            {confirmDelete ? t("tapAgainToDeleteMiniature") : t("deleteMiniature")}
          </Button>
        )}
      </Box>
    </Modal>
  );
}
