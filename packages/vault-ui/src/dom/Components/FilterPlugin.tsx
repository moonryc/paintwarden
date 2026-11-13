import { MenuItem, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useState } from "react";

// Sentinel values; real plugin names never contain a NUL character.
const ALL_PLUGINS = "\u0000all";
const NO_PLUGIN = "\u0000none";

type FromPlugin = { sourceName?: string };

export type FilterPluginState = ReturnType<typeof useFilterPlugin>;

// Filters items by the plugin (catalog source) that installed them. Items without a source
// match the "not from a plugin" option.
export function useFilterPlugin(items: readonly FromPlugin[]) {
  const [plugin, setPlugin] = useState(ALL_PLUGINS);
  const plugins = useMemo(
    () =>
      [...new Set(items.flatMap((item) => (item.sourceName ? [item.sourceName] : [])))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      ),
    [items],
  );
  // Fall back to all plugins when the chosen one is removed.
  useEffect(() => {
    if (plugin !== ALL_PLUGINS && plugin !== NO_PLUGIN && !plugins.includes(plugin)) setPlugin(ALL_PLUGINS);
  }, [plugin, plugins]);
  // Stable until the chosen plugin changes, so pages can list it as a memo dependency.
  const matches = useCallback(
    (item: FromPlugin) =>
      plugin === ALL_PLUGINS || (plugin === NO_PLUGIN ? !item.sourceName : item.sourceName === plugin),
    [plugin],
  );
  return {
    plugin,
    plugins,
    setPlugin,
    active: plugin !== ALL_PLUGINS,
    // A phrase for empty states, such as "from Paint Vault test source".
    description:
      plugin === ALL_PLUGINS ? null : plugin === NO_PLUGIN ? "not from a plugin" : `from ${plugin}`,
    matches,
    reset: () => setPlugin(ALL_PLUGINS),
  };
}

// The Plugin select; renders nothing until at least one item comes from a plugin.
export function FilterPluginSelect({
  filter,
  onChange,
  sx,
}: {
  filter: FilterPluginState;
  onChange?(): void;
  sx?: SxProps<Theme>;
}) {
  if (!filter.plugins.length) return null;
  return (
    <TextField
      select
      fullWidth
      size="small"
      label="Plugin"
      value={filter.plugin}
      onChange={(event) => {
        filter.setPlugin(event.target.value);
        onChange?.();
      }}
      sx={sx}
    >
      <MenuItem value={ALL_PLUGINS}>All plugins</MenuItem>
      {filter.plugins.map((name) => (
        <MenuItem key={name} value={name}>
          {name}
        </MenuItem>
      ))}
      <MenuItem value={NO_PLUGIN}>Not from a plugin</MenuItem>
    </TextField>
  );
}
