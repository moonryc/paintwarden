import { Autocomplete, Button, Card, IconButton, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { useMemo, useState } from "react";

import { Modal } from "../Components/Modal";
import { PaintBottle } from "../Components/PaintBottle";
import { Plus, X } from "../icons";
import { useVault, useVaultStore } from "../store/hooks";
import type { Paint } from "../types";
import { noop } from "../utils/constants";
import { truncateSx } from "../utils/truncate";
import { useFuzzySearch } from "../utils/use-fuzzy-search";

import { SavedMixCard } from "./SavedMixCard";

const paintSearchText = (paint: Paint) => `${paint.name} ${paint.brand} ${paint.range}`;

export function SubstitutionDialog({ paint, onClose }: { paint: Paint; onClose(): void }) {
  const data = useVault();
  const api = useVaultStore((s) => s.api);
  const notify = useVaultStore((s) => s.notify);
  const recipes = data.paintSubstitutions.filter((row) => row.targetPaintId === paint.id);
  const defaultRecipe = recipes.find((recipe) => recipe.isDefault);
  const [name, setName] = useState(""),
    [ingredients, setIngredients] = useState<{ paintId: string; parts: number }[]>([]),
    [choice, setChoice] = useState<Paint | null>(null),
    [ingredientQuery, setIngredientQuery] = useState(""),
    [busy, setBusy] = useState(false);
  const candidates = useMemo(
    () =>
      data.catalog.filter(
        (candidate) => candidate.id !== paint.id && !ingredients.some((row) => row.paintId === candidate.id),
      ),
    [data.catalog, paint.id, ingredients],
  );
  const ingredientMatches = useFuzzySearch(candidates, ingredientQuery, paintSearchText, 60);
  const addIngredient = () => {
    if (!choice) return;
    setIngredients((rows) => [...rows, { paintId: choice.id, parts: 1 }]);
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
        <Card
          sx={{
            boxSizing: "border-box",
            p: 1.5,
          }}
        >
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
                api("/api/paint-substitutions", {
                  method: "PUT",
                  body: JSON.stringify({ action: "default", id: defaultRecipe.id, enabled: false }),
                }).then(() => notify(`${paint.name} is now the default`), noop)
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
        {recipes.map((recipe) => (
          <SavedMixCard
            key={recipe.id}
            mix={recipe}
            onToggleDefault={() =>
              api("/api/paint-substitutions", {
                method: "PUT",
                body: JSON.stringify({ action: "default", id: recipe.id, enabled: !recipe.isDefault }),
              }).then(
                () =>
                  notify(
                    recipe.isDefault
                      ? `${paint.name} is now the default`
                      : `${recipe.name} is now the default`,
                  ),
                noop,
              )
            }
            onDelete={() =>
              api(`/api/paint-substitutions?id=${encodeURIComponent(recipe.id)}`, { method: "DELETE" }).then(
                () => notify("Substitution deleted"),
                noop,
              )
            }
          />
        ))}
        {!recipes.length && (
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
        <Box
          component="div"
          sx={{
            display: "flex",
            gap: 1,
          }}
        >
          <Autocomplete
            fullWidth
            size="small"
            value={choice}
            inputValue={ingredientQuery}
            options={ingredientMatches}
            filterOptions={(options) => options}
            getOptionLabel={(option) => `${option.name} · ${option.brand}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onInputChange={(_, value) => setIngredientQuery(value)}
            onChange={(_, value) => setChoice(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Ingredient paint"
                placeholder="Search by paint, brand, or range…"
              />
            )}
          />
          <Button variant="outlined" disabled={!choice} onClick={addIngredient}>
            Add
          </Button>
        </Box>
        {ingredients.map((ingredient, index) => {
          const ingredientPaint = data.catalog.find((item) => item.id === ingredient.paintId);
          return (
            <Box
              component="div"
              key={ingredient.paintId}
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
              <PaintBottle paint={ingredientPaint!} size="sm" />
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
                {ingredientPaint?.name}
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
                sx={{
                  boxSizing: "border-box",
                  width: "6rem",
                }}
              />
              <IconButton
                size="small"
                onClick={() => setIngredients((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                aria-label={`Remove ${ingredientPaint?.name}`}
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
              await api("/api/paint-substitutions", {
                method: "POST",
                body: JSON.stringify({ targetPaintId: paint.id, name, ingredients }),
              });
              setName("");
              setIngredients([]);
              notify("Substitution saved");
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
