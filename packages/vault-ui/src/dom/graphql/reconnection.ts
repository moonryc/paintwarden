// One recovery loop per vault/auth scope. Reads may be replayed; writes never are:
// a lost response cannot establish whether the server committed the command.
export const reconnectDelay = (attempt: number) => [1000, 2000, 5000, 10_000, 30_000][Math.min(attempt, 4)];

export class VaultReconnection {
  private lost = false;
  private stopped = false;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  constructor(
    private probe: () => Promise<void>,
    private recovered: () => Promise<void> | void,
    private schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> = (
      callback,
      delay,
    ) => setTimeout(callback, delay),
    private cancel: (timer: ReturnType<typeof setTimeout>) => void = (timer) => clearTimeout(timer),
  ) {}
  getSnapshot = () => this.lost;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  disconnected = () => {
    if (this.stopped) return;
    if (!this.lost) {
      this.lost = true;
      this.attempt = 0;
      this.listeners.forEach((listener) => listener());
    }
    this.enqueue();
  };
  private enqueue() {
    if (this.stopped || !this.lost || this.timer !== undefined || this.running) return;
    this.timer = this.schedule(() => {
      this.timer = undefined;
      void this.retry();
    }, reconnectDelay(this.attempt++));
  }
  retry = () => {
    if (this.stopped || !this.lost) return Promise.resolve();
    if (this.timer !== undefined) this.cancel(this.timer);
    this.timer = undefined;
    if (this.running) return this.running;
    this.running = (async () => {
      try {
        await this.probe();
        if (this.stopped) return;
        // Publish healthy before refetch: a fresh failure starts a new outage.
        this.lost = false;
        this.attempt = 0;
        this.listeners.forEach((listener) => listener());
        await this.recovered();
      } catch {
        // A probe failure is background state, not another operation banner.
        this.disconnected();
      } finally {
        this.running = null;
        this.enqueue();
      }
    })();
    return this.running;
  };
  dispose() {
    this.stopped = true;
    if (this.timer !== undefined) this.cancel(this.timer);
    this.listeners.clear();
  }
}
