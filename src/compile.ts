// Load flow files, compile them to BPMN (with generated DI) and lint the result.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import module from "node:module";
import { declarativeToLayoutedBpmn, inlineJobTypes, walkNodes } from "@nanobpm/workflow";
import type { AgentOptions, FormDef } from "./index.ts";
import { newEngine } from "./wasm.ts";

/** Job types served by built-in workers rather than by a `run` handler. */
export const BUILTIN_JOB_TYPES = {
  claude: "headless Claude Code agent (claude -p) — prompt from flows/prompts/<resourceId>",
  session: "claimed by the live Claude Code session through the MCP tools (agent_next_job)",
} as const;

export interface Problem {
  severity: "error" | "warning";
  message: string;
  element?: string;
}

export interface HumanStep {
  name: string;
  form: string;
}

export interface TaskStep {
  name: string;
  jobType: string;
  agent: boolean;
  prompt?: { resourceId: string; append?: string };
}

export interface CompiledFlow {
  id: string;
  file: string;
  xml: string;
  /** job type → handler for `run` steps */
  handlers: Record<string, (job: any) => unknown>;
  humans: HumanStep[];
  tasks: TaskStep[];
  forms: Record<string, FormDef>;
  /** Per agent-task options (schema, allowedTools, model), keyed by step name. */
  agents: Record<string, AgentOptions>;
  /** Project root the flow file belongs to (parent of flows/). */
  projectDir: string;
  /** "project": from this project's flows/. "global": from the shared library
   *  (~/AgentGraph/flows), available in every project and run there. */
  scope: "project" | "global";
  description?: string;
}

export interface CheckResult {
  file: string;
  flows: CompiledFlow[];
  problems: Problem[];
}

let hooksInstalled = false;
/** Make `import … from "agent-graph-engine"` in a flow file resolve to this package,
 *  wherever the flow lives (the user's project has no node_modules for it). */
export function installResolveHook(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  const here = new URL(".", import.meta.url);
  const js = new URL("./index.js", here);
  const target = fs.existsSync(js) ? js.href : new URL("./index.ts", here).href;
  module.registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "agent-graph-engine") return { url: target, shortCircuit: true };
      return next(specifier, context);
    },
  });
}

export function flowsDir(project: string): string {
  return path.join(project, "flows");
}

export function listFlowFiles(project: string): string[] {
  const dir = flowsDir(project);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.flow\.(ts|mts|js|mjs)$/.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

function isFlow(v: any): boolean {
  return v && typeof v === "object" && v.kind === "declarative" && typeof v.id === "string" && Array.isArray(v.steps);
}

/** Import a flow file fresh (cache-busted, so edits are picked up) and compile every
 *  flow it exports. Never throws: problems are reported. */
export async function checkFile(file: string): Promise<CheckResult> {
  installResolveHook();
  const problems: Problem[] = [];
  const flows: CompiledFlow[] = [];
  let mod: Record<string, any>;
  try {
    const stamp = fs.statSync(file).mtimeMs;
    mod = await import(`${pathToFileURL(path.resolve(file)).href}?v=${stamp}`);
  } catch (e: any) {
    // defineFlow validates while building, so most authoring mistakes land here.
    problems.push({ severity: "error", message: `cannot load ${path.basename(file)}: ${e?.message ?? e}` });
    return { file, flows, problems };
  }
  const forms: Record<string, FormDef> = mod.forms ?? {};
  const found = Object.values(mod).filter(isFlow);
  if (!found.length) problems.push({ severity: "error", message: `${path.basename(file)} exports no defineFlow(...) flow` });

  for (const flow of found as any[]) {
    let xml: string;
    try {
      xml = await declarativeToLayoutedBpmn(flow);
    } catch (e: any) {
      problems.push({ severity: "error", message: `flow "${flow.id}": compile failed: ${e?.message ?? e}` });
      continue;
    }
    const handlers: CompiledFlow["handlers"] = {};
    for (const type of inlineJobTypes(flow)) {
      const name = type.slice(flow.id.length + 1);
      const h = flow.handlers?.[name];
      if (typeof h === "function") handlers[type] = h;
      else problems.push({ severity: "error", element: name, message: `run("${name}") has no handler` });
    }
    const humans: HumanStep[] = [];
    const tasks: TaskStep[] = [];
    walkNodes(flow.steps, (n: any) => {
      if (n.kind === "human") humans.push({ name: n.name, form: n.form });
      if (n.kind === "task")
        tasks.push({ name: n.name, jobType: n.jobType ?? `${flow.id}:${n.name}`, agent: !!n.agent || !!n.prompt, prompt: n.prompt });
    });
    for (const h of humans) {
      if (!forms[h.form])
        problems.push({
          severity: "warning",
          element: h.name,
          message: `human("${h.name}") uses form "${h.form}" which is not in the exported forms — it will be asked as free text`,
        });
    }
    const projectDir = path.dirname(path.dirname(path.resolve(file)));
    for (const t of tasks) {
      const builtin = t.jobType in BUILTIN_JOB_TYPES;
      if (!builtin && !(mod.workers && typeof mod.workers[t.jobType] === "function"))
        problems.push({
          severity: "warning",
          element: t.name,
          message: `task("${t.name}") has job type "${t.jobType}" that no worker serves (built-ins: ${Object.keys(BUILTIN_JOB_TYPES).join(", ")}; or export workers = { "${t.jobType}": handler })`,
        });
      if (t.jobType === "claude" && !t.prompt)
        problems.push({ severity: "error", element: t.name, message: `task("${t.name}") with jobType "claude" needs { prompt: { resourceId } }` });
      if (t.prompt && !fs.existsSync(path.join(projectDir, "flows", "prompts", t.prompt.resourceId)))
        problems.push({ severity: "error", element: t.name, message: `prompt file flows/prompts/${t.prompt.resourceId} not found` });
    }
    if (mod.workers) {
      for (const [type, h] of Object.entries(mod.workers)) if (typeof h === "function") handlers[type] = h as any;
    }
    // The engine is the final judge: deploy into a throwaway engine.
    try {
      newEngine().deploy(xml);
    } catch (e: any) {
      problems.push({ severity: "error", message: `flow "${flow.id}": engine rejected the BPMN: ${e?.message ?? e}` });
    }
    flows.push({ id: flow.id, file, xml, handlers, humans, tasks, forms, agents: mod.agents ?? {}, projectDir, scope: "project", description: mod.description });
  }
  return { file, flows, problems };
}

export async function checkProject(project: string): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  for (const f of listFlowFiles(project)) out.push(await checkFile(f));
  return out;
}

export function formatProblems(results: CheckResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    const ids = r.flows.map((f) => f.id).join(", ");
    const errs = r.problems.filter((p) => p.severity === "error").length;
    lines.push(`${errs ? "✗" : "✓"} ${path.basename(r.file)}${ids ? ` (${ids})` : ""}`);
    for (const p of r.problems) lines.push(`  ${p.severity}${p.element ? ` [${p.element}]` : ""}: ${p.message}`);
  }
  return lines.join("\n");
}
