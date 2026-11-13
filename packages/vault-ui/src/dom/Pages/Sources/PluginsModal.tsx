import GitHubIcon from "@mui/icons-material/GitHub";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Skeleton,
  TextField,
  Tooltip,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "../../Components/EmptyState";
import { Modal } from "../../Components/Modal";
import { usePluginSources } from "../../graphql/sources-hooks";
import { Extension, FileUp, Layers, RotateCw } from "../../icons";
import { useVaultStore } from "../../store/hooks";

import { CreateSourceDialog } from "./CreateSourceDialog";
import { RemoveSourceDialog } from "./RemoveSourceDialog";
import { SourceCard } from "./SourceCard";
import {
  type SourceVersion,
  type Shareable,
  type Pending,
  type SourceRemoval,
  message,
  plural,
  type ItemCounts,
  sourceKey,
  repositoryLabel,
  isUploadedSource,
} from "./sources.utils";

const sectionTitleSx = {
  m: 0,
  fontFamily: "var(--font-serif)",
  fontSize: "1.0625rem",
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: "-0.02em",
} as const;

/** Installs, updates, removes and packages catalog sources ("plugins"). Opened from Settings. */
export function PluginsModal({ onClose }: { onClose(): void }) {
  const notify = useVaultStore((s) => s.notify);
  const authHeaders = useVaultStore((s) => s.authHeaders);
  const refresh = useVaultStore((s) => s.refresh);
  const sourceRead = usePluginSources();
  const { sources } = sourceRead;
  const checkedSources = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [sourceVersions, setSourceVersions] = useState<Record<string, SourceVersion>>({});
  const [versionsChecking, setVersionsChecking] = useState(false);
  const [shareable, setShareable] = useState<Shareable>({ paints: [], schemes: [], templates: [] });
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState("");
  const [addError, setAddError] = useState("");
  const [removal, setRemoval] = useState<SourceRemoval | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = pending !== null || sourceRead.loading;

  async function loadVersions() {
    setVersionsChecking(true);
    try {
      // Source/network operations intentionally stay REST; Apollo reads the locally
      // cached result. A GraphQL field resolver never contacts GitHub.
      const response = await fetch("/api/catalog-sources?versions=1", { headers: authHeaders() });
      if (!response.ok) throw new Error("Could not check for plugin updates");
      const versions = await sourceRead.versions();
      setSourceVersions(Object.fromEntries(versions.map((item) => [item.id, item])));
    } catch {
      setSourceVersions({});
    } finally {
      setVersionsChecking(false);
    }
  }
  async function loadSources() {
    await sourceRead.reload();
    await loadVersions();
  }
  async function openCreate() {
    setPending("load");
    setError("");
    try {
      setShareable(await sourceRead.shareable());
      setCreateOpen(true);
    } catch (cause) {
      setError(message(cause, "Could not load shareable content"));
    } finally {
      setPending(null);
    }
  }
  // The old startup PUT had no badge/toast consumer. Keep its non-blocking
  // behavior, but only once the Plugins list is usable, never on Settings entry.
  useEffect(() => {
    if (sourceRead.loading || sourceRead.error || checkedSources.current) return;
    checkedSources.current = true;
    void (async () => {
      await loadVersions();
      if (!mounted.current) return;
      const response = await fetch("/api/catalog-sources", { method: "PUT", headers: authHeaders() });
      if (!response.ok || !mounted.current) return;
      // The write may change every data family; do not retain/parse its payload.
      await refresh();
      await loadSources();
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRead.loading, sourceRead.error]);

  async function addSource() {
    if (busy || !url.trim()) return;
    setPending("add");
    setAddError("");
    try {
      const response = await fetch("/api/catalog-sources", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ url: url.trim() }),
      });
      const result = (await response.json()) as { error?: string; updated?: boolean };
      if (!response.ok) throw new Error(result.error || "Could not install plugin");
      setUrl("");
      await refresh();
      await loadSources();
      notify(result.updated ? "Plugin installed" : "Plugin is already installed and up to date");
    } catch (cause) {
      setAddError(message(cause, "Could not install plugin"));
    } finally {
      setPending(null);
    }
  }

  async function uploadSource(file: File) {
    if (busy) return;
    setPending("upload");
    setError("");
    try {
      const response = await fetch("/api/catalog-sources", {
        method: "POST",
        headers: { "content-type": "application/zip", ...authHeaders() },
        body: file,
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        name?: string;
        updated?: boolean;
      };
      if (!response.ok) throw new Error(result.error || "Could not install plugin");
      await refresh();
      await loadSources();
      const plugin = result.name ?? "Plugin";
      notify(
        result.updated === false ? `${plugin} is already installed at this version` : `${plugin} installed`,
      );
    } catch (cause) {
      setError(message(cause, "Could not install plugin"));
    } finally {
      setPending(null);
    }
  }

  async function updateSource(id: string) {
    if (busy) return;
    setPending(`update:${id}`);
    setError("");
    try {
      const response = await fetch(`/api/catalog-sources?id=${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: authHeaders(),
      });
      const result = (await response.json()) as { error?: string; updated?: boolean };
      if (!response.ok || result.error) throw new Error(result.error || "Could not update plugin");
      await refresh();
      await loadSources();
      notify(result.updated ? "Plugin updated" : "Plugin is up to date");
    } catch (cause) {
      setError(message(cause, "Could not update plugin"));
      await loadSources().catch(() => undefined);
    } finally {
      setPending(null);
    }
  }

  async function updateAllSources() {
    if (busy || !sources.length) return;
    setPending("update-all");
    setError("");
    try {
      const response = await fetch("/api/catalog-sources", { method: "PUT", headers: authHeaders() });
      if (!response.ok) throw new Error("Could not update plugins");
      const { results } = (await response.json()) as { results: { updated?: boolean; error?: string }[] };
      await refresh();
      await loadSources();
      const updated = results.filter((result) => result.updated).length;
      const failed = results.filter((result) => result.error).length;
      if (failed) setError(`${plural(failed, "plugins")} could not be updated`);
      if (updated) notify(`${plural(updated, "plugins")} updated`);
      else if (!failed) notify("All plugins are up to date");
    } catch (cause) {
      setError(message(cause, "Could not update plugins"));
    } finally {
      setPending(null);
    }
  }

  async function previewRemoval(id: string) {
    setError("");
    try {
      setRemoval(await sourceRead.removal(id));
    } catch (cause) {
      setError(message(cause, "Could not check plugin usage"));
    }
  }

  async function removeSource() {
    if (!removal?.canRemove || busy) return;
    setPending("remove");
    setError("");
    try {
      const response = await fetch(`/api/catalog-sources?id=${encodeURIComponent(removal.source.id)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const result = (await response.json()) as SourceRemoval & { error?: string };
      if (response.status === 409) {
        setRemoval(result);
        return;
      }
      if (!response.ok) throw new Error(result.error || "Could not remove plugin");
      setRemoval(null);
      await refresh();
      await loadSources();
      notify("Plugin removed");
    } catch (cause) {
      setError(message(cause, "Could not remove plugin"));
    } finally {
      setPending(null);
    }
  }

  const totals = sources.reduce<ItemCounts>(
    (sum, source) => ({
      paints: sum.paints + (source.counts?.paints ?? 0),
      schemes: sum.schemes + (source.counts?.schemes ?? 0),
      templates: sum.templates + (source.counts?.templates ?? 0),
    }),
    { paints: 0, schemes: 0, templates: 0 },
  );
  const updatesAvailable = sources.filter((source) => sourceVersions[source.id]?.updateAvailable).length;
  const nameByKey = new Map(sources.map((source) => [sourceKey(source.url), source.name]));

  return (
    <Modal
      title="Plugins"
      subtitle="Install public catalogs of paints, schemes, and templates from GitHub, or package your own to share."
      onClose={onClose}
      footer={
        <Button
          variant="outlined"
          startIcon={<Extension size={18} />}
          onClick={() => void openCreate()}
          disabled={busy}
        >
          Create plugin
        </Button>
      }
    >
      <Box component="section" sx={{ mb: 3 }}>
        <Box component="h3" sx={sectionTitleSx}>
          Add a plugin
        </Box>
        <Box component="p" sx={{ color: "var(--ink-faint)", fontSize: 13, mt: 0.5, mb: 2 }}>
          Paste a GitHub repository or upload a plugin .zip. Required plugins install automatically, and
          everything stays available offline.
        </Box>
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            void addSource();
          }}
          sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 1 }}
        >
          <TextField
            size="small"
            label="GitHub repository"
            placeholder="owner/repository"
            value={url}
            disabled={pending === "add"}
            error={!!addError}
            helperText={addError || "A full URL or owner/repository both work."}
            onChange={(event) => {
              setUrl(event.target.value);
              if (addError) setAddError("");
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <GitHubIcon fontSize="small" sx={{ color: "var(--ink-faint)" }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ flex: "1 1 280px" }}
          />
          <Button
            type="submit"
            variant="contained"
            loading={pending === "add"}
            disabled={!url.trim() || (busy && pending !== "add")}
            sx={{ minWidth: 120, height: 40 }}
          >
            Add plugin
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileUp size={16} />}
            loading={pending === "upload"}
            disabled={busy && pending !== "upload"}
            onClick={() => fileInputRef.current?.click()}
            sx={{ height: 40 }}
          >
            Upload .zip
          </Button>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void uploadSource(file);
            }}
          />
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box component="h3" sx={sectionTitleSx}>
            Installed
          </Box>
          {sources.length > 0 && (
            <Box sx={{ color: "var(--ink-faint)", fontSize: 13, mt: 0.5 }}>
              {[
                plural(sources.length, "plugins"),
                plural(totals.paints, "paints"),
                plural(totals.schemes, "schemes"),
                plural(totals.templates, "templates"),
              ].join(" · ")}
            </Box>
          )}
        </Box>
        {sources.some((source) => !isUploadedSource(source)) && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title="Check for updates">
              <span>
                <IconButton
                  size="small"
                  aria-label="Check for updates"
                  disabled={versionsChecking || busy}
                  onClick={() => void loadVersions()}
                >
                  {versionsChecking ? (
                    <CircularProgress size={16} aria-label="Checking plugin updates" />
                  ) : (
                    <RotateCw size={18} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
            <Button
              size="small"
              variant={updatesAvailable ? "contained" : "outlined"}
              loading={pending === "update-all"}
              disabled={busy && pending !== "update-all"}
              onClick={() => void updateAllSources()}
            >
              {updatesAvailable ? `Update all (${updatesAvailable})` : "Update all"}
            </Button>
          </Box>
        )}
      </Box>

      {(error || sourceRead.error) && (
        <Alert
          severity="error"
          onClose={error ? () => setError("") : undefined}
          action={
            sourceRead.error ? (
              <Button color="inherit" onClick={() => void loadSources()}>
                Retry
              </Button>
            ) : undefined
          }
          sx={{ mb: 2 }}
        >
          {error || sourceRead.error}
        </Alert>
      )}

      {sourceRead.loading && !sources.length ? (
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {[0, 1].map((index) => (
            <Skeleton key={index} variant="rounded" sx={{ height: 128, borderRadius: "16px" }} />
          ))}
        </Box>
      ) : !sources.length && !sourceRead.error ? (
        <EmptyState
          icon={<Layers size={26} />}
          title="No plugins yet"
          body="Add a GitHub repository above to bring its paints, color schemes, and miniature templates into your vault."
        />
      ) : (
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              remote={sourceVersions[source.id]}
              checking={versionsChecking}
              requires={source.dependencies.map(
                (dependency) =>
                  nameByKey.get(sourceKey(dependency.repository)) ?? repositoryLabel(dependency.repository),
              )}
              requiredBy={sources
                .filter(
                  (other) =>
                    other.id !== source.id &&
                    other.dependencies.some(
                      (dependency) => sourceKey(dependency.repository) === sourceKey(source.url),
                    ),
                )
                .map((other) => other.name)}
              updating={pending === `update:${source.id}`}
              disabled={busy}
              onUpdate={() => void updateSource(source.id)}
              onRemove={() => void previewRemoval(source.id)}
            />
          ))}
        </Box>
      )}

      {createOpen && <CreateSourceDialog shareable={shareable} onClose={() => setCreateOpen(false)} />}
      {removal && (
        <RemoveSourceDialog
          removal={removal}
          removing={pending === "remove"}
          onClose={() => pending !== "remove" && setRemoval(null)}
          onRemove={() => void removeSource()}
        />
      )}
    </Modal>
  );
}
