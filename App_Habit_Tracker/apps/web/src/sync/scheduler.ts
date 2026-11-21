import type { SyncResult } from './engine';

const WRITE_DELAY_MS = 2000;
const VERSION_POLL_MS = 15_000;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 5 * 60 * 1000;

export interface SchedulerDeps {
  // One sync, session check included.
  attempt: () => Promise<SyncResult>;
  // The server's version, or null when it could not be read.
  version: () => Promise<number | null>;
  cursor: () => Promise<number>;
  visible: () => boolean;
  onResult: (result: SyncResult) => void;
  random?: () => number;
}

// 1 s, 2 s, 4 s… up to 5 minutes, with ±20 % so two devices do not retry in step.
export function backoffDelay(failures: number, random: () => number = Math.random): number {
  const base = Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
  return Math.round(base * (0.8 + 0.4 * random()));
}

// Decides when to sync (ADR 0006); what a sync does is syncOnce's business. Plain timers,
// no React, so its timing can be tested with fake timers.
export class SyncScheduler {
  private running = false;
  private again = false;
  private failures = 0;
  private lastStatus: SyncResult['status'] | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;

  constructor(private readonly deps: SchedulerDeps) {}

  // On open: sync now, then watch the version while the app is visible.
  start(): void {
    this.request();
    this.pollTimer = setInterval(() => void this.checkVersion(), VERSION_POLL_MS);
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.writeTimer);
    clearTimeout(this.retryTimer);
    clearInterval(this.pollTimer);
  }

  // Sign-in, coming back to the app, the connection coming back.
  request(): void {
    if (this.stopped) return;
    if (this.running) {
      this.again = true;
      return;
    }
    void this.run();
  }

  // Each write restarts the 2 s wait, so a burst of taps is one push.
  localWrite(): void {
    clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      this.request();
    }, WRITE_DELAY_MS);
  }

  private async run(): Promise<void> {
    this.running = true;
    clearTimeout(this.retryTimer);
    const result = await this.deps.attempt();
    this.running = false;
    if (this.stopped) return;
    this.lastStatus = result.status;
    this.deps.onResult(result);

    if (result.status === 'offline' || result.status === 'error') {
      this.failures += 1;
      this.retryTimer = setTimeout(
        () => {
          this.request();
        },
        backoffDelay(this.failures, this.deps.random),
      );
    } else {
      // Synced, or no session: a closed session waits for the next sign-in.
      this.failures = 0;
    }

    if (this.again) {
      this.again = false;
      this.request();
    }
  }

  private async checkVersion(): Promise<void> {
    if (this.stopped || !this.deps.visible() || this.lastStatus === 'unauthenticated') return;
    const version = await this.deps.version();
    if (version !== null && version > (await this.deps.cursor())) this.request();
  }
}
