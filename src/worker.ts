// The worker side of the engine: runs activated jobs through a handler, with a timeout and
// concurrency limits, and reports the outcome back to the engine. A handler that throws,
// rejects or hangs fails its job (retry, then incident); it never takes the engine down.
//
// The engine and the worker meet only through `JobPort` (complete/fail) and `ActivatedJob`,
// so the worker can be tested with a fake engine, and later moved to a child process.

export interface ActivatedJob {
  key: string;
  type: string;
  elementId: string;
  instanceKey: string;
  bpmnProcessId?: string;
  retries?: number;
  variables?: Record<string, unknown>;
}

export interface JobResult {
  variables?: Record<string, unknown>;
  costUsd?: number;
}

/** Runs one job. `signal` aborts when the job times out or the worker stops. */
export type JobHandler = (job: ActivatedJob, signal: AbortSignal) => Promise<JobResult | void>;

/** What the worker needs from the engine. */
export interface JobPort {
  complete(key: string, variables: Record<string, unknown>): void;
  fail(key: string, retries: number, message: string): void;
}

export interface WorkerEvent {
  kind: "job" | "done" | "retry" | "incident";
  instanceKey: string;
  elementId: string;
  message: string;
  costUsd?: number;
}

export interface WorkerOptions {
  /** Jobs running at once, over all types. */
  maxConcurrent: number;
  /** Lower limits for some types, e.g. { claude: 2 }. */
  perType?: Record<string, number>;
  /** A shared limit key for several job types (agent steps of any job type → "claude"):
   *  a type without its own limit counts against its class's. */
  classOf?: (type: string) => string | undefined;
  /** How long a job of this type may run before it fails as timed out. */
  timeoutMs: (type: string) => number;
  /** Base delay before a failed job is retried (doubles as retries run out). */
  backoffMs?: number;
  log?: (e: WorkerEvent) => void;
  /** Called when a job ends, either way (the host persists state). */
  settled?: () => void;
  /** Lets the host take over a failure (return true = handled, don't fail the job). */
  onError?: (job: ActivatedJob, error: Error) => boolean;
}

export class TimeoutError extends Error {}

/** `AGE_CONCURRENCY="claude=2,shell=1"` → { claude: 2, shell: 1 } */
export function parseLimits(spec = ""): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^([\w.:-]+)=(\d+)$/);
    if (m) out[m[1]] = Number(m[2]);
  }
  return out;
}

export class Worker {
  readonly running = new Map<string, { type: string; elementId: string; instanceKey: string; since: number; abort: AbortController }>();
  /** Job key → earliest time it may run again. */
  readonly backoff = new Map<string, number>();

  private port: JobPort;
  private opts: WorkerOptions;
  private stopping = false;

  constructor(port: JobPort, opts: WorkerOptions) {
    this.port = port;
    this.opts = opts;
  }

  /** How many more jobs of `type` may start now. */
  free(type: string): number {
    const all = this.opts.maxConcurrent - this.running.size;
    const own = this.opts.perType?.[type];
    const cls = own === undefined ? this.opts.classOf?.(type) : undefined;
    const cap = own ?? (cls !== undefined ? this.opts.perType?.[cls] : undefined);
    if (cap === undefined) return Math.max(0, all);
    const same = (t: string) => (own !== undefined ? t === type : this.opts.classOf?.(t) === cls);
    let ofType = 0;
    for (const r of this.running.values()) if (same(r.type)) ofType++;
    return Math.max(0, Math.min(all, cap - ofType));
  }

  backingOff(key: string, now = Date.now()): boolean {
    return (this.backoff.get(key) ?? 0) > now;
  }

  /** Run a job to the end. Never rejects. */
  async run(job: ActivatedJob, handler: JobHandler): Promise<void> {
    const key = String(job.key);
    const abort = new AbortController();
    this.running.set(key, { type: job.type, elementId: job.elementId, instanceKey: job.instanceKey, since: Date.now(), abort });
    this.opts.log?.({ kind: "job", instanceKey: job.instanceKey, elementId: job.elementId, message: `running ${job.elementId} (${job.type})` });
    const limit = this.opts.timeoutMs(job.type);
    let timer: NodeJS.Timeout | undefined;
    try {
      const out = await Promise.race([
        Promise.resolve().then(() => handler(job, abort.signal)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            abort.abort();
            reject(new TimeoutError(`timed out after ${fmtMs(limit)}`));
          }, limit);
          timer.unref?.();
        }),
      ]);
      const r = out && typeof out === "object" ? (out as JobResult) : {};
      this.port.complete(key, r.variables ?? {});
      this.backoff.delete(key);
      this.opts.log?.({ kind: "done", instanceKey: job.instanceKey, elementId: job.elementId, message: `completed ${job.elementId}`, costUsd: r.costUsd });
    } catch (e: any) {
      // Stopping: leave the job activated; the next engine start hands it out again.
      if (this.stopping) return;
      const err = e instanceof Error ? e : new Error(String(e));
      if (this.opts.onError?.(job, err)) return;
      const msg = String(err.message).slice(0, 4000);
      const retries = Math.max(0, (job.retries ?? 1) - 1);
      try {
        this.port.fail(key, retries, msg);
        if (retries > 0) this.backoff.set(key, Date.now() + (this.opts.backoffMs ?? 5_000) * 2 ** (3 - Math.min(3, retries)));
      } catch {
        /* job vanished (instance cancelled) */
      }
      this.opts.log?.({
        kind: retries ? "retry" : "incident",
        instanceKey: job.instanceKey,
        elementId: job.elementId,
        message: `${job.elementId} failed${retries ? `, ${retries} retries left` : " — incident raised"}: ${msg.slice(0, 500)}`,
      });
    } finally {
      clearTimeout(timer);
      this.running.delete(key);
      this.opts.settled?.();
    }
  }

  /** Abort every running job (shutdown). */
  stop() {
    this.stopping = true;
    for (const r of this.running.values()) r.abort.abort();
  }
}

function fmtMs(ms: number): string {
  return ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`;
}
