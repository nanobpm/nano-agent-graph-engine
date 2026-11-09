// A pool of step threads (node:worker_threads). The engine's thread keeps ticking timers
// and serving the API while steps compute; a step that hangs, even in a synchronous loop,
// is stopped by terminating its thread. Each thread runs one step at a time.
import fs from "node:fs";
import { Worker as Thread } from "node:worker_threads";
import type { StepReply, StepRequest } from "./step-thread.ts";

/** How long a step gets to stop after its signal aborts, before its thread is terminated. */
const GRACE_MS = 2_000;

interface Slot {
  thread: Thread;
  busy?: { id: number; resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void };
  /** Replace the thread when its step ends (flows were reloaded). */
  stale?: boolean;
}

function threadUrl(): URL {
  const js = new URL("./step-thread.js", import.meta.url);
  return fs.existsSync(js) ? js : new URL("./step-thread.ts", import.meta.url);
}

export class StepPool {
  private slots: Slot[] = [];
  private nextId = 1;
  private size: number;
  private onLog: (message: string) => void;

  constructor(size: number, onLog: (message: string) => void = () => {}) {
    this.size = size;
    this.onLog = onLog;
  }

  /** Run one step on an idle thread (a new one if all are busy, up to the size). */
  run(req: Omit<StepRequest, "id">, signal: AbortSignal): Promise<Record<string, unknown>> {
    const slot = this.slots.find((s) => !s.busy) ?? (this.slots.length < this.size ? this.spawn() : this.spawn(true));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      slot.busy = { id, resolve, reject };
      const onAbort = () => {
        slot.thread.postMessage({ abort: true });
        const t = setTimeout(() => {
          if (slot.busy?.id !== id) return;
          this.kill(slot, new Error(String(signal.reason?.message ?? signal.reason ?? "aborted")));
        }, GRACE_MS);
        t.unref();
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
      slot.thread.postMessage({ ...req, id });
    });
  }

  /** Flows were reloaded: threads have the old modules cached, so replace them. */
  recycle() {
    for (const s of [...this.slots]) {
      if (s.busy) s.stale = true;
      else this.remove(s);
    }
  }

  async close() {
    const all = [...this.slots];
    this.slots = [];
    await Promise.all(all.map((s) => s.thread.terminate()));
  }

  get threads(): number {
    return this.slots.length;
  }

  private spawn(extra = false): Slot {
    // `extra`: the worker's concurrency limit already holds; a slot past `size` is only a
    // stopgap while a terminated thread is replaced.
    if (extra) this.onLog(`step pool: all ${this.size} threads busy, starting another`);
    const slot: Slot = { thread: new Thread(threadUrl(), { stdout: false, stderr: false }) };
    slot.thread.unref();
    slot.thread.on("message", (m: StepReply) => {
      const b = slot.busy;
      if (!b || b.id !== m.id) return;
      slot.busy = undefined;
      if (m.ok) b.resolve(m.variables);
      else b.reject(new Error(m.error));
      if (slot.stale) this.remove(slot);
    });
    slot.thread.on("error", (e) => this.kill(slot, e instanceof Error ? e : new Error(String(e))));
    slot.thread.on("exit", (code) => this.kill(slot, new Error(`the step's thread exited (code ${code}): did it call process.exit()?`)));
    this.slots.push(slot);
    return slot;
  }

  /** End a slot: fail its step with `why`, terminate the thread, forget it. */
  private kill(slot: Slot, why: Error) {
    const b = slot.busy;
    slot.busy = undefined;
    if (b) b.reject(why);
    this.remove(slot);
  }

  private remove(slot: Slot) {
    const i = this.slots.indexOf(slot);
    if (i < 0) return;
    this.slots.splice(i, 1);
    slot.thread.removeAllListeners();
    slot.thread.on("error", () => {});
    void slot.thread.terminate();
  }
}
