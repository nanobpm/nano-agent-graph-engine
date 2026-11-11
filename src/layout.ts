// Diagram layout for compiled flows. bpmn-auto-layout 2 draws the nicest diagrams, but its
// edge router grows steeply with flow size (a ~60-step flow took 2.5 minutes). So:
//   1. layouts are cached by the hash of the diagram-less BPMN and the @nanobpm/workflow version
//      that laid them out (restarts and re-checks are instant; a new layouter redraws);
//   2. a cache miss runs the v2 layout on a worker thread for up to AGE_LAYOUT_MS (default 5 s);
//   3. past that, the fast v1 layout is used now, and the v2 thread finishes in the background
//      and fills the cache, so the next deploy of the same flow gets the detailed diagram.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { declarativeToBpmn } from "@nanobpm/workflow";
// @ts-expect-error -- bpmn-auto-layout 1.x ships no types
import { layoutProcess as layoutV1 } from "bpmn-auto-layout-v1";
import { engineDir } from "./paths.ts";

/** The layouter's version: set by the build (the bundle has no node_modules), else installed. */
export const workflowVersion = (() => {
  if (process.env.NAGE_WORKFLOW_VERSION) return process.env.NAGE_WORKFLOW_VERSION;
  try {
    let dir = path.dirname(createRequire(import.meta.url).resolve("@nanobpm/workflow"));
    while (!fs.existsSync(path.join(dir, "package.json")) && path.dirname(dir) !== dir) dir = path.dirname(dir);
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version as string;
  } catch {
    return "unknown";
  }
})();

const budgetMs = () => Number(process.env.AGE_LAYOUT_MS ?? 5_000);
const cacheDir = () => path.join(engineDir(), "layout-cache");
const pending = new Map<string, Promise<string>>();

function threadUrl(): URL {
  const js = new URL("./layout-thread.js", import.meta.url);
  return fs.existsSync(js) ? js : new URL("./layout-thread.ts", import.meta.url);
}

/** v2 layout on a worker thread; the result is cached. Unref'd: a CLI can exit without it. */
function layoutV2(xml: string, file: string): Promise<string> {
  let p = pending.get(file);
  if (p) return p;
  p = new Promise<string>((resolve, reject) => {
    const w = new Worker(threadUrl(), { workerData: { xml } });
    w.unref();
    w.once("message", (out: string) => {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, out);
      } catch {
        /* cache is best-effort */
      }
      resolve(out);
      void w.terminate();
    });
    w.once("error", reject);
  }).finally(() => pending.delete(file));
  pending.set(file, p);
  return p;
}

export async function layoutXml(xml: string): Promise<string> {
  const file = path.join(cacheDir(), `${crypto.createHash("sha256").update(`${workflowVersion}\n${xml}`).digest("hex").slice(0, 32)}.bpmn`);
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    /* miss */
  }
  const v2 = layoutV2(xml, file);
  v2.catch(() => {}); // a v2 failure falls back to v1 below
  let timer: any;
  const late = new Promise<undefined>((r) => {
    timer = setTimeout(r, budgetMs());
    (timer as { unref?: () => void }).unref?.();
  });
  try {
    const out = await Promise.race([v2, late]);
    if (out) return out;
  } catch {
    /* v2 threw: use v1 */
  } finally {
    clearTimeout(timer);
  }
  const r: any = await layoutV1(xml);
  return typeof r === "string" ? r : r.xml;
}

/** The flow's BPMN with a diagram (what declarativeToLayoutedBpmn gave, without the stall). */
export function layoutFlow(flow: Parameters<typeof declarativeToBpmn>[0]): Promise<string> {
  return layoutXml(declarativeToBpmn(flow));
}
