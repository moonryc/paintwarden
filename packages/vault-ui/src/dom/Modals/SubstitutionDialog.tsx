import { Alert, Autocomplete, Button, Card, IconButton, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useState } from "react";

import { Modal } from "../Components/Modal";
import { PaintBottle } from "../Components/PaintBottle";
import { usePaintDetail, usePaintOptions } from "../graphql/detail-hooks";
import type { DetailPaintFragment } from "../graphql/generated/graphql";
import { usePaintCommands } from "../graphql/paint-actions";
import { Plus, X } from "../icons";
import { useVaultStore } from "../store/hooks";
import type { Paint } from "../types";
import { noop } from "../utils/constants";
import { truncateSx } from "../utils/truncate";

import { SavedMixCard, type SavedMixProjection } from "./SavedMixCard";

const detailPaint = (paint: DetailPaintFragment): Paint => ({
  ...paint,
  sourceName: paint.sourceName ?? undefined,
});

type DialogProps = { paint: Paint; onClose: () => void };
type PickerProps = {
  excludeIds: string[];
  choice: Paint | null;
  query: string;
  onChoice: (value: Paint | null) => void;
  onQuery: (value: string) => void;
};

export function SubstitutionDialog(props: DialogProps) {
  const detail = usePaintDetail(props.paint.id);
  const recipes = (detail.data?.substitutions.nodes ?? []).map((mix) => ({
    mix,
    ingredients: mix.ingredients.nodes.map((row) => ({ ...row, paint: detailPaint(row.paint) })),
    brokenReason: mix.brokenReason,
    hasMoreIngredients: mix.ingredients.pageInfo.hasNextPage,
    onLoadMoreIngredients: () => void detail.loadMoreIngredients(mix.id),
  }));
  return (
    <SubstitutionDialogView
      {...props}
      recipes={recipes}
      defaultRecipe={detail.data?.paint?.activeSubstitution ?? undefined}
      loading={detail.loading}
      error={detail.error?.message}
      onRetry={() => void detail.refresh()}
      hasMore={detail.data?.substitutions.pageInfo.hasNextPage}
      onLoadMore={() => void detail.loadMoreSubstitutions()}
    />
  );
}

function SubstitutionDialogView({
  paint,
  onClose,
  recipes,
  defaultRecipe,
  loading,
  error,
  onRetry,
  hasMore,
  onLoadMore,
}: DialogProps & {
  recipes: SavedMixProjection[];
  defaultRecipe?: { id: string };
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
}) {
  const commands = usePaintCommands();
  const notify = useVaultStore((s) => s.notify);
  const [name, setName] = useState(""),
    [ingredients, setIngredients] = useState<{ paint: Paint; parts: number }[]>([]),
    [choice, setChoice] = useState<Paint | null>(null),
    [ingredientQuery, setIngredientQuery] = useState(""),
    [busy, setBusy] = useState(false);
  const addIngredient = () => {
    if (!choice) return;
    setIngredients((rows) => [...rows, { paint: choice, parts: 1 }]);
    setChoice(null);
    setIngredientQuery("");
  };
  return (
    <Modal
      title={`Substitute ${paint.name}`}
      subtitle="Save multiple alternatives. Only one substitution can be used at a time."
      onClose={onClose}
    >
      <Box component="div" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Card sx={{ boxSizing: "border-box", p: 1.5 }}>
          <Box
            component="div"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <PaintBottle paint={paint} size="sm" />
            <Box
              component="div"
              sx={{
                minWidth: 0,
                flex: "1",
              }}
            >
              <Box
                component="b"
                sx={{
                  display: "block",
                  ...truncateSx,
                  fontSize: "0.875rem",
                  lineHeight: 10 / 7,
                }}
              >
                {paint.name}
              </Box>
              <Box
                component="p"
                sx={{
                  m: 0,
                  mt: 0.5,
                  fontSize: "0.75rem",
                  lineHeight: 4 / 3,
                  color: "var(--ink-faint)",
                }}
              >
                Original paint · {paint.brand} {paint.range}
              </Box>
            </Box>
            <Button
              size="small"
              variant={!defaultRecipe ? "contained" : "outlined"}
              disabled={!defaultRecipe}
              onClick={() =>
                defaultRecipe &&
                commands
                  .setSubstitutionDefault(defaultRecipe.id, false)
                  .then(() => notify(`${paint.name} is now the default`), noop)
              }
            >
              {defaultRecipe ? "Make default" : "Default"}
            </Button>
          </Box>
        </Card>
        <Box
          component="div"
          sx={{
            boxSizing: "border-box",
            borderTopStyle: "solid",
            borderTopWidth: "1px",
            borderColor: "var(--line)",
            pt: 1.5,
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
            Substitutions
          </Box>
        </Box>
        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={onRetry}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {recipes.map((projection) => (
          <SavedMixCard
            key={projection.mix.id}
            projection={projection}
            onToggleDefault={() =>
              commands
                .setSubstitutionDefault(projection.mix.id, !projection.mix.isDefault)
                .then(
                  () =>
                    notify(
                      projection.mix.isDefault
                        ? `${paint.name} is now the default`
                        : `${projection.mix.name} is now the default`,
                    ),
                  noop,
                )
            }
            onDelete={() =>
              commands.deleteSubstitution(projection.mix.id).then(() => notify("Substitution deleted"), noop)
            }
          />
        ))}
        {hasMore && (
          <Button onClick={onLoadMore} disabled={loading}>
            Load more substitutions
          </Button>
        )}
        {loading && !recipes.length && (
          <Box component="p" role="status">
            Loading substitutions…
          </Box>
        )}
        {!loading && !error && !recipes.length && (
          <Box
            component="p"
            sx={{
              boxSizing: "border-box",
              m: 0,
              borderRadius: "16px",
              bgcolor: "var(--sunken)",
              p: 2,
              textAlign: "center",
              fontSize: "0.875rem",
              lineHeight: 10 / 7,
              color: "var(--ink-faint)",
            }}
          >
            No substitutions saved yet.
          </Box>
        )}
      </Box>
      <Box
        component="div"
        sx={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          borderTopStyle: "solid",
          borderTopWidth: "1px",
          borderColor: "var(--line)",
          pt: 2.5,
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
          New substitution
        </Box>
        <TextField
          fullWidth
          size="small"
          label="Recipe name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Two-paint mix"
        />
        <Box component="div" sx={{ display: "flex", gap: 1 }}>
          <IngredientPicker
            excludeIds={[paint.id, ...ingredients.map((row) => row.paint.id)]}
            choice={choice}
            query={ingredientQuery}
            onChoice={setChoice}
            onQuery={setIngredientQuery}
          />
          <Button variant="outlined" disabled={!choice} onClick={addIngredient}>
            Add
          </Button>
        </Box>
        {ingredients.map((ingredient, index) => {
          const ingredientPaint = ingredient.paint;
          return (
            <Box
              component="div"
              key={ingredient.paint.id}
              sx={{
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                gap: 1,
                borderRadius: "16px",
                borderStyle: "solid",
                borderWidth: "1px",
                borderColor: "var(--line)",
                p: 1,
              }}
            >
              <PaintBottle paint={ingredientPaint} size="sm" />
              <Box
                component="span"
                sx={{
                  minWidth: 0,
                  flex: "1",
                  ...truncateSx,
                  fontSize: "0.875rem",
                  lineHeight: 10 / 7,
                  fontWeight: 600,
                }}
              >
                {ingredientPaint.name}
              </Box>
              <TextField
                size="small"
                type="number"
                label="Parts"
                value={ingredient.parts}
                onChange={(event) =>
                  setIngredients((rows) =>
                    rows.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, parts: Math.max(1, Number(event.target.value) || 1) }
                        : row,
                    ),
                  )
                }
                sx={{ boxSizing: "border-box", width: "6rem" }}
              />
              <IconButton
                size="small"
                onClick={() => setIngredients((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                aria-label={`Remove ${ingredientPaint.name}`}
              >
                <X size={15} />
              </IconButton>
            </Box>
          );
        })}
        <Button
          fullWidth
          variant="contained"
          disabled={!name.trim() || !ingredients.length || busy}
          loading={busy}
          startIcon={<Plus size={16} />}
          onClick={async () => {
            setBusy(true);
            try {
              await commands.createSubstitution({
                targetPaintId: paint.id,
                name,
                ingredients: ingredients.map((row) => ({ paintId: row.paint.id, parts: row.parts })),
              });
              setName("");
              setIngredients([]);
              notify("Substitution saved");
            } catch {
              // The command reports the error. Keep the draft available for retry.
            } finally {
              setBusy(false);
            }
          }}
        >
          Save substitution
        </Button>
      </Box>
    </Modal>
  );
}

function IngredientPicker(props: PickerProps) {
  const { items, loading, error } = usePaintOptions(props.query, props.excludeIds);
  return (
    <IngredientPickerView
      {...props}
      options={items.map(detailPaint)}
      loading={loading}
      error={error?.message}
    />
  );
}

function IngredientPickerView({
  choice,
  query,
  onChoice,
  onQuery,
  options,
  loading,
  error,
}: PickerProps & { options: Paint[]; loading?: boolean; error?: string }) {
  return (
    <Autocomplete
      fullWidth
      size="small"
      value={choice}
      inputValue={query}
      options={options}
      loading={loading}
      filterOptions={(rows) => rows}
      getOptionLabel={(option) => `${option.name} · ${option.brand}`}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      onInputChange={(_, value) => onQuery(value)}
      onChange={(_, value) => onChoice(value)}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Ingredient paint"
          placeholder="Search by paint, brand, or range…"
          error={!!error}
          helperText={error}
        />
      )}
    />
  );
}
