// Live transcripts of agent steps, in Nano Workforce's transcript format: one JSON event
// per line ({"nwfTranscriptEvent":1,"kind":"message"|"tool-call"|"tool-result"|"lifecycle",…},
// encoded by @nanobpm/agentic), appended to ~/.agent-graph/transcripts/<jobKey>.jsonl while
// the agent runs. Readers poll GET /api/jobs/:key/transcript?from=<byte offset> and get
// { status, nextOffset, entries: [{offset, chunk}] } — the same shape as nwf's
// /agentic/transcripts?stream=&from=, so its cockpit and cubefarm can follow AGE steps too.
import fs from "node:fs";
import path from "node:path";
import { encodeTranscriptEvent, type TranscriptEvent } from "@nanobpm/agentic/transcript";
import { engineDir } from "./paths.ts";

/** An event as a producer writes it (the store assigns the offset). */
export type TranscriptInput = TranscriptEvent extends infer E ? (E extends unknown ? Omit<E, "offset"> : never) : never;

const KEEP_MS = 7 * 24 * 3600_000;

export function transcriptDir(): string {
  return path.join(engineDir(), "transcripts");
}

function fileOf(jobKey: string): string {
  if (!/^[\w-]+$/.test(jobKey)) throw new Error(`bad job key ${jobKey}`);
  return path.join(transcriptDir(), `${jobKey}.jsonl`);
}

/** Appends one job's events. Writes are synchronous and small: readers see each at once. */
export class TranscriptWriter {
  private fd: number | undefined;
  readonly jobKey: string;
  constructor(jobKey: string) {
    this.jobKey = jobKey;
    try {
      fs.mkdirSync(transcriptDir(), { recursive: true });
      this.fd = fs.openSync(fileOf(jobKey), "a");
    } catch {
      this.fd = undefined; // best-effort: a transcript never fails the step
    }
  }
  write(e: TranscriptInput): void {
    if (this.fd === undefined) return;
    try {
      fs.writeSync(this.fd, encodeTranscriptEvent({ ...e, offset: 0 } as TranscriptEvent) + "\n");
    } catch {
      /* best-effort */
    }
  }
  close(phase: "completed" | "exited"): void {
    this.write({ kind: "lifecycle", phase });
    if (this.fd !== undefined) fs.closeSync(this.fd);
    this.fd = undefined;
  }
}

export interface TranscriptPage {
  status: "open" | "completed";
  nextOffset: number;
  entries: { offset: number; chunk: string }[];
}

/** Complete lines from byte `from` on; null when the job has no transcript. */
export function readTranscript(jobKey: string, from: number, open: boolean): TranscriptPage | null {
  let buf: Buffer;
  try {
    buf = fs.readFileSync(fileOf(jobKey));
  } catch {
    return null;
  }
  const entries: TranscriptPage["entries"] = [];
  let at = Math.max(0, Math.min(from, buf.length));
  for (;;) {
    const nl = buf.indexOf(10, at);
    if (nl < 0) break; // a line still being written waits for the next poll
    entries.push({ offset: at, chunk: buf.subarray(at, nl + 1).toString("utf8") });
    at = nl + 1;
  }
  return { status: open ? "open" : "completed", nextOffset: at, entries };
}

/** Drop transcripts older than a week (called at engine start). */
export function pruneTranscripts(now = Date.now()): void {
  let names: string[] = [];
  try {
    names = fs.readdirSync(transcriptDir());
  } catch {
    return;
  }
  for (const n of names) {
    const f = path.join(transcriptDir(), n);
    try {
      if (now - fs.statSync(f).mtimeMs > KEEP_MS) fs.rmSync(f, { force: true });
    } catch {
      /* ignore */
    }
  }
}

/// AgentInstance -> job, for runs in flight: their history items are still pending,
/// so the engine's history can't name the job yet. Settled runs fall back to it.
const agentJobs = new Map<string, string>();
export function linkAgentJob(agentInstanceKey: string | undefined, jobKey: string): void {
  if (agentInstanceKey && !agentJobs.has(agentInstanceKey)) agentJobs.set(agentInstanceKey, jobKey);
}
export function jobForAgent(agentInstanceKey: string): string | undefined {
  return agentJobs.get(agentInstanceKey);
}
