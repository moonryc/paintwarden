// Query results never move the stream forward. Only delivered log events do that.
export const VAULT_FAMILIES = [
  "LIBRARY",
  "PAINT",
  "OPTIONS",
  "HOME",
  "MINIATURES",
  "WISHLIST",
  "SCHEMES",
  "TEMPLATES",
  "SOURCES",
] as const;
export type VaultFamily = (typeof VAULT_FAMILIES)[number];
export type Revision = { epoch: string; seq: string };
export type Invalidation = Revision & { reset: boolean; families: readonly VaultFamily[] };
export type ReadTicket = { generation: number };
const sequence = (revision: Revision) => BigInt(revision.seq);

export class VaultInvalidationController {
  private generation = 0;
  private cursor: Revision | null = null;
  private earliest: Revision | null = null;
  private dirty = new Map<VaultFamily, bigint>();
  private listeners = new Set<{ families: readonly VaultFamily[]; callback: () => void }>();
  private cursorListeners = new Set<() => void>();
  private stopped = false;
  private retiredEpochs = new Set<string>();
  private acceptedPaintRevision = 0n;
  private acceptedMiniatureRevision = 0n;

  constructor(
    private readonly evict: (families: readonly VaultFamily[], reset: boolean) => void = () => {},
  ) {}

  capture(): ReadTicket {
    return { generation: this.generation };
  }
  isCurrent(ticket: ReadTicket) {
    return !this.stopped && ticket.generation === this.generation;
  }
  getCursor = (): Revision | null => this.cursor;
  // React subscribes to the stream baseline, not every acknowledged event. A
  // parent rerender must not tear down/reopen a healthy stream on each stock edit.
  getBaseline = (): Revision | null => this.earliest;
  onCursor = (callback: () => void) => {
    this.cursorListeners.add(callback);
    return () => {
      this.cursorListeners.delete(callback);
    };
  };
  listen(families: readonly VaultFamily[], callback: () => void) {
    const listener = { families, callback };
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private announceCursor() {
    for (const callback of this.cursorListeners) callback();
  }

  // A screen can finish before or after another parallel initial read. If an earlier
  // same-epoch envelope arrives, reconnect from it, never silently skip its interval.
  observe(revision: Revision) {
    if (this.stopped) return;
    if (
      !this.cursor ||
      (revision.epoch === this.cursor.epoch && this.earliest && sequence(revision) < sequence(this.earliest))
    ) {
      this.earliest = revision;
      this.cursor = revision;
      this.announceCursor();
    }
  }
  isFresh(revision: Revision, families: readonly VaultFamily[]): boolean {
    return (
      !this.stopped &&
      (!this.cursor || revision.epoch === this.cursor.epoch) &&
      families.every((family) => sequence(revision) >= (this.dirty.get(family) ?? 0n))
    );
  }
  accepts(ticket: ReadTicket, revision: Revision, families: readonly VaultFamily[]): boolean {
    if (this.stopped || ticket.generation !== this.generation) return false;
    if (!this.isFresh(revision, families)) return false;
    // These families normalize the same Paint records. Even before the SSE event
    // arrives, an older detail/options response must not overwrite a newer list's
    // inventory (or vice versa). Retry that envelope, without advancing the stream.
    const includesPaint = families.some((family) => ["LIBRARY", "PAINT", "OPTIONS"].includes(family));
    if (includesPaint && sequence(revision) < this.acceptedPaintRevision) return false;
    const includesMiniature = families.some((family) => ["HOME", "MINIATURES"].includes(family));
    if (includesMiniature && sequence(revision) < this.acceptedMiniatureRevision) return false;
    this.observe(revision);
    if (includesPaint) this.acceptedPaintRevision = sequence(revision);
    if (includesMiniature) this.acceptedMiniatureRevision = sequence(revision);
    return true;
  }
  private invalidate(families: readonly VaultFamily[], reset: boolean) {
    this.evict(families, reset);
    for (const listener of this.listeners) {
      if (reset || listener.families.some((family) => families.includes(family))) listener.callback();
    }
  }
  event(event: Invalidation) {
    // An aborted old stream/focus request may still finish after an epoch reset.
    if (this.stopped || this.retiredEpochs.has(event.epoch)) return;
    const epochChanged = Boolean(this.cursor && event.epoch !== this.cursor.epoch);
    if (event.reset || epochChanged) {
      if (epochChanged && this.cursor) this.retiredEpochs.add(this.cursor.epoch);
      this.generation += 1;
      this.dirty.clear();
      this.acceptedPaintRevision = 0n;
      this.acceptedMiniatureRevision = 0n;
      this.cursor = { epoch: event.epoch, seq: event.seq };
      this.earliest = this.cursor;
      for (const family of VAULT_FAMILIES) this.dirty.set(family, sequence(event));
      this.invalidate(VAULT_FAMILIES, true);
      this.announceCursor();
      return;
    }
    if (this.cursor && sequence(event) <= sequence(this.cursor)) return;
    this.cursor = { epoch: event.epoch, seq: event.seq };
    if (!this.earliest) this.earliest = this.cursor;
    for (const family of event.families) {
      const watermark = this.dirty.get(family) ?? 0n;
      this.dirty.set(family, sequence(event) > watermark ? sequence(event) : watermark);
    }
    if (event.families.length) this.invalidate(event.families, false);
    // Advancing a live stream does not require restarting it. onCursor only signals
    // initial baseline / rewind / epoch reset; the SSE transport owns reconnects.
  }
  // A committed mutation dirties its projections, but MUST NOT advance the stream:
  // another client's earlier change may affect a different family.
  committed(revision: Revision, families: readonly VaultFamily[]) {
    if (this.stopped) return;
    if (this.cursor && revision.epoch !== this.cursor.epoch) {
      this.event({ ...revision, reset: true, families: VAULT_FAMILIES });
      return;
    }
    this.observe(revision);
    for (const family of families) {
      const watermark = this.dirty.get(family) ?? 0n;
      this.dirty.set(family, sequence(revision) > watermark ? sequence(revision) : watermark);
    }
    this.invalidate(families, false);
  }
  // REST-only operations (images, sources, backup restore) have no GraphQL envelope.
  // Retire in-flight reads and atomically refetch mounted projections, including
  // metadata-only changes that do not advance the database revision.
  refresh() {
    if (this.stopped) return;
    this.generation += 1;
    this.invalidate(VAULT_FAMILIES, false);
  }
  dispose() {
    this.stopped = true;
    this.generation += 1;
    this.listeners.clear();
    this.cursorListeners.clear();
    this.cursor = null;
    this.earliest = null;
    this.dirty.clear();
  }
}
