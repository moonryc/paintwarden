import type { SupportSummary } from "./utils/support";

import type { ColorCategory } from "@paintwarden/core/color-categories";
import type {
  MiniaturePaintSubstitution,
  PaintSubstitution,
  PaintSubstitutionIngredient,
} from "@paintwarden/core/paint-substitutions";
import type { RecipeStep } from "@paintwarden/core/recipe-steps";

export type PaintingStatus = "NOT_STARTED" | "ASSEMBLED" | "PRIMED" | "IN_PROGRESS" | "COMPLETE";

export type { RecipeStep };

export type StockLevel = "FULL" | "LOW" | "EMPTY";

export type Miniature = {
  id: string;
  title: string;
  status: "OWNED" | "WISHLIST";
  notes: string;
  manufacturer: string;
  faction: string;
  scale: string;
  paintingStatus: PaintingStatus;
  imageUrl: string | null;
  createdAt: number;
};

export type Paint = {
  id: string;
  brand: string;
  range: string;
  name: string;
  colorHex: string | null;
  sourceUrl: string | null;
  isCustom: boolean;
  sourceName?: string;
  sourceLogoUrl?: string | null;
};

export type PaintStatus = "OWNED" | "WISHLIST";

// Sets a paint's status; null clears it. Stock and quantity apply to owned paints.
export type PaintStateSetter = (
  id: string,
  state: PaintStatus | null,
  stock?: StockLevel,
  quantity?: number,
) => void;

// One paint in a miniature's recipe. A paint may appear in several steps, but once per step.
export type Requirement = {
  id: string;
  miniatureId: string;
  paintId: string;
  notes: string;
  sortOrder: number;
  step: RecipeStep;
};

export type MiniatureRecipeStep = { miniatureId: string; step: RecipeStep };

export type ColorScheme = {
  id: string;
  name: string;
  category: ColorCategory | null;
  isSystem: boolean;
  sourceName?: string;
  sourceLogoUrl?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ColorSchemePaint = { schemeId: string; paintId: string; sortOrder: number };

export type DividerTone = "SECTION" | "MILESTONE";

// START and COMPLETE mark the milestones an owner scheme must keep.
export type DividerRole = "START" | "COMPLETE";

export type ColorSchemeDivider = {
  id: string;
  schemeId: string;
  label: string;
  tone: DividerTone;
  role: DividerRole | null;
  sortOrder: number;
};

export type ColorSchemeImage = {
  id: string;
  schemeId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  imageType: string | null;
  method: string | null;
  sortOrder: number;
};

export type SchemeOrderEntry =
  | { type: "PAINT"; id: string; paintId: string; sortOrder: number }
  | {
      type: "DIVIDER";
      id: string;
      label: string;
      tone: DividerTone;
      role?: DividerRole | null;
      sortOrder: number;
    }
  | {
      type: "IMAGE";
      id: string;
      imageUrl: string;
      thumbnailUrl: string | null;
      imageType: string | null;
      method: string | null;
      sortOrder: number;
    };

export type PinnedStartMilestone = Extract<SchemeOrderEntry, { type: "DIVIDER" }> & { role: "START" };

export type ProjectSchemeEntry =
  | { type: "PAINT"; row: Requirement; paint: Paint }
  | { type: "DIVIDER"; divider: Extract<SchemeOrderEntry, { type: "DIVIDER" }> }
  | { type: "IMAGE"; image: Extract<SchemeOrderEntry, { type: "IMAGE" }> };

export type MiniatureColorScheme = { miniatureId: string; schemeId: string; sortOrder: number };

export type MiniatureTemplate = {
  thumbnailUrl?: string | null;
  id: string;
  name: string;
  imageUrl: string;
  categories: string[];
  faction: string;
  schemeCount: number;
  paintCount: number;
  manufacturer: string;
  kind: "user" | "source";
  sourceName?: string;
  sourceLogoUrl?: string | null;
};

// Loaded only for the selected template's editor, never for browsing or the miniature picker.
export type MiniatureTemplateRecipe = {
  schemeIds: string[];
  paints: { paintId: string; step: RecipeStep; notes: string; sortOrder: number }[];
};

export type MiniatureTemplateCatalog = {
  sourceVersion: number | null;
  categories: string[];
  templates: MiniatureTemplate[];
};

export type State = {
  miniatures: Miniature[];
  catalog: Paint[];
  paintStates: Record<string, PaintStatus>;
  paintRecords: Record<string, { state: PaintStatus; stockLevel: StockLevel; quantity: number }>;
  requirements: Requirement[];
  recipeSteps: MiniatureRecipeStep[];
  colorSchemes: ColorScheme[];
  colorSchemePaints: ColorSchemePaint[];
  colorSchemeDividers: ColorSchemeDivider[];
  colorSchemeImages: ColorSchemeImage[];
  miniatureColorSchemes: MiniatureColorScheme[];
  paintSubstitutions: PaintSubstitution[];
  paintSubstitutionIngredients: PaintSubstitutionIngredient[];
  miniaturePaintSubstitutions: MiniaturePaintSubstitution[];
};

export type Tab =
  "dashboard" | "miniatures" | "templates" | "paints" | "paint-tools" | "schemes" | "wishlist" | "settings";

export type Api = (path: string, options: RequestInit) => Promise<unknown>;

export type AuthHeaders = () => Record<string, string>;

export type ToastAction = { label: string; onClick(): void };

export type Toast = { id: number; message: string; tone: "ok" | "error"; action?: ToastAction };

export type Notify = (message: string, tone?: Toast["tone"], action?: ToastAction) => void;

export type MiniatureFormValues = {
  title: string;
  status: string;
  notes: string;
  manufacturer: string;
  faction: string;
  scale: string;
  paintingStatus: PaintingStatus;
  image: File | null;
  removeImage: boolean;
  templateId: string | null;
  includeTemplateImage: boolean;
};

export type AuthStatus = {
  setupRequired: boolean;
  setupCodeRequired: boolean;
  username: string | null;
  requireSignIn: boolean;
  authenticated: boolean;
};

export type DesktopConnectionChoice = { mode: "local" | "remote" | null; serverUrl?: string };

// The desktop app's self-update progress, reported by the Electron main process.
export type DesktopUpdateState = {
  status:
    | "disabled"
    | "idle"
    | "checking"
    | "up-to-date"
    | "consent-required"
    | "deferred"
    | "downloading"
    | "ready"
    | "error";
  serverVersion?: string | null;
  consentId?: string;
  currentVersion: string;
  version: string | null;
  progress: number | null;
  error: string | null;
};

export type DesktopStartupState = {
  phase: "idle" | "starting" | "backing-up" | "migrating" | "ready" | "failed";
};

export type DesktopBridge = {
  getSupportSummary(language: string): Promise<SupportSummary>;
  saveSupportBundle(language: string): Promise<boolean>;
  openBugReport(language: string): Promise<boolean>;
  getStartupState?(): Promise<DesktopStartupState>;
  onStartupState?(listener: (state: DesktopStartupState) => void): () => void;
  openLogsFolder?(): Promise<string>;
  getLanguage(): Promise<string>;
  setLanguage(language: string): Promise<string>;
  getConnection(): Promise<DesktopConnectionChoice>;
  setConnection(choice: { mode: "local" | "remote"; serverUrl?: string }): Promise<DesktopConnectionChoice>;
  saveBinary(input: { bytes: Uint8Array; filename: string; title?: string }): Promise<boolean>;
  saveBackup(input: { filename: string; authorization?: string }): Promise<boolean>;
  restoreBackup(
    file: File,
    input: { mode: "replace" | "merge"; authorization?: string },
  ): Promise<{ error?: string; errorCode?: string; errorParameters?: Record<string, string | number> }>;
  getUpdateState(): Promise<DesktopUpdateState>;
  checkForUpdates(): Promise<DesktopUpdateState>;
  respondToUpdate(input: {
    version: string;
    consentId: string;
    action: "download" | "defer";
  }): Promise<DesktopUpdateState>;
  installUpdate(): Promise<boolean>;
  onUpdateState(listener: (state: DesktopUpdateState) => void): () => void;
};

declare global {
  interface Window {
    paintwardenDesktop?: DesktopBridge;
  }
}
