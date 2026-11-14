import { i18n } from "../../i18n";
import { publicErrorMessage } from "../../utils/public-error";

// Types and helpers shared by the Sources page and its cards and dialogs.

export type ItemCounts = { paints: number; schemes: number; templates: number };

// `id` is the plugin's UUID in this vault; `repository` is `owner/name`, or `upload:<name>` for a
// plugin installed from a .zip.
export type CatalogSource = {
  id: string;
  repository: string;
  url: string;
  name: string;
  version: string;
  license?: string | null;
  attribution?: string | null;
  dependencies: { repository: string; minimumVersion?: string }[];
  lastError: string | null;
  lastErrorInfo?: { code: string; parameters: { name: string; value: string }[] } | null;
  logoUrl?: string | null;
  counts?: ItemCounts;
};

export type SourceVersion = {
  id: string;
  availableVersion?: string;
  updateAvailable?: boolean;
  error?: string;
};

export type SourceRemoval = {
  source: { id: string; name: string; version: string };
  removes: ItemCounts;
  blockers: { label: string; count: number }[];
  canRemove: boolean;
};

type ShareItem = { id: string; name: string };

export type Shareable = { paints: ShareItem[]; schemes: ShareItem[]; templates: ShareItem[] };

export type Pending = "load" | "add" | "upload" | "update-all" | "remove" | `update:${string}` | null;

export const KINDS = ["paints", "schemes", "templates"] as const;

export const SEMVER = /^\d+\.\d+\.\d+$/;

export const sourceKey = (value: string) =>
  value
    .trim()
    .replace(/^github:/i, "https://github.com/")
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "https://github.com/")
    .replace(/\.git\/?$/i, "")
    .replace(/\/$/, "")
    .toLowerCase();

export const repositoryLabel = (url: string) => url.replace(/^https:\/\/github\.com\//i, "");

// Plugins installed from an uploaded .zip have no repository and are updated by uploading again.
export const isUploadedSource = (source: Pick<CatalogSource, "repository">) =>
  source.repository.startsWith("upload:");

const countKeys = {
  paints: "pages:sourcesCountPaints",
  schemes: "pages:sourcesCountSchemes",
  templates: "pages:sourcesCountTemplates",
  plugins: "pages:sourcesCountPlugins",
  items: "pages:sourcesCountItems",
} as const;
export const plural = (count: number, word: keyof typeof countKeys) => i18n.t(countKeys[word], { count });

export const message = publicErrorMessage;
