// A step thread: runs `run` step handlers off the engine's thread. It imports the flow
// file (the same version the engine compiled), finds the handler for the job type, and
// runs it in the run's project. One job at a time; the pool sends the next.
import { parentPort } from "node:worker_threads";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { installResolveHook } from "./resolve-hook.ts";

export interface StepRequest {
  id: number;
  file: string;
  stamp: number;
  /** The flow's id as authored (the export to look in). */
  flowId: string;
  /** The engine's process id for the flow (job types of run steps start with it). */
  flowKey: string;
  type: string;
  project: string;
  job: { jobKey: string; processInstanceKey: string; elementId: string; type: string; variables: Record<string, unknown> };
}

export type StepReply = { id: number; ok: true; variables: Record<string, unknown> } | { id: number; ok: false; error: string };

installResolveHook();
const api: Promise<typeof import("./index.ts")> = import("@nanobpm/nano-agent-graph-engine" as string);

let current: AbortController | undefined;

async function handlerFor(r: StepRequest): Promise<(job: any) => unknown> {
  const mod: Record<string, any> = await import(`${pathToFileURL(path.resolve(r.file)).href}?v=${r.stamp}`);
  const flow = Object.values(mod).find((v: any) => v && v.kind === "declarative" && v.id === r.flowId) as any;
  const name = r.type.startsWith(r.flowKey + ":") ? r.type.slice(r.flowKey.length + 1) : r.type;
  const h = flow?.handlers?.[name] ?? mod.workers?.[r.type];
  if (typeof h !== "function") throw new Error(`no handler for ${r.type} in ${path.basename(r.file)}`);
  return h;
}

parentPort!.on("message", async (msg: StepRequest | { abort: true }) => {
  if ("abort" in msg) return current?.abort();
  const r = msg;
  current = new AbortController();
  let reply: StepReply;
  try {
    const h = await handlerFor(r);
    const { runInProject } = await api;
    const out = await runInProject(r.project, () => h(r.job), current.signal);
    // Only JSON crosses back: what the engine would store anyway.
    const variables = out && typeof out === "object" ? JSON.parse(JSON.stringify(out)) : {};
    reply = { id: r.id, ok: true, variables };
  } catch (e: any) {
    reply = { id: r.id, ok: false, error: String(e?.message ?? e) };
  }
  current = undefined;
  parentPort!.postMessage(reply);
});

// Stray errors from flow code: report, keep the thread.
process.on("unhandledRejection", (e: any) => console.error(`[step thread] unhandled rejection: ${e?.stack ?? e}`));
