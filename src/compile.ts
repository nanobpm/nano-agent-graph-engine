// Load flow files, compile them to BPMN (with generated DI) and lint the result.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inlineJobTypes, walkNodes } from "@nanobpm/workflow";
import { layoutFlow } from "./layout.ts";
import type { AgentOptions, FormDef } from "./index.ts";
import { allProfiles, rankOf, type AgentProfile } from "./agents.ts";
import { newEngine } from "./wasm.ts";
import { hintProblems, inputForm, type FlowInput, type StartFormHints } from "./input.ts";
import { installResolveHook } from "./resolve-hook.ts";
import { typecheckFlows } from "./typecheck.ts";
import { promptFile } from "./paths.ts";

export { installResolveHook };

/** Job types served by built-in workers rather than by a `run` handler. */
export const BUILTIN_JOB_TYPES = {
  claude: "agent step (legacy name) — prefer the nano-workforce form jobType: \"senior:<task>\"",
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
  /** An agent step (nano-workforce convention: the external AgentTask marker + a prompt),
   *  run by the built-in agent worker with the CLI the user assigns. */
  agent: boolean;
  /** The rank of a `<rank>:<task>` job type the author wrote (senior, junior, …). */
  rank?: string;
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
  /** Per agent-task options (schema, allowedTools, model, use), keyed by step name. */
  agents: Record<string, AgentOptions>;
  /** `export const agentProfiles` / `export const defaultAgent` from the flow file. */
  agentProfiles: Record<string, AgentProfile>;
  defaultAgent?: string;
  /** The process id in the engine: "<projectSlug>.<id>" for project flows, the id for global ones. */
  key: string;
  /** The flow file's mtime when it was loaded: step threads import the same version. */
  stamp: number;
  /** Its file was deleted: not listed or startable; running instances finish. */
  retired?: boolean;
  /** Project root the flow file belongs to (parent of flows/). */
  projectDir: string;
  /** "project": from this project's flows/. "global": from the shared library
   *  (~/AgentGraph/flows), available in every project and run there. */
  scope: "project" | "global";
  description?: string;
  /** The flow's input (its `Start` contract's envelope), if it declares one. */
  input?: FlowInput;
  /** The start form derived from the input and `export const startForm` hints. */
  startForm?: FormDef;
}

export interface CheckResult {
  file: string;
  flows: CompiledFlow[];
  problems: Problem[];
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
export async function checkFile(file: string, keyFor: (id: string) => string = (id) => id): Promise<CheckResult> {
  installResolveHook();
  const problems: Problem[] = [];
  const flows: CompiledFlow[] = [];
  let mod: Record<string, any>;
  let stamp = 0;
  try {
    stamp = fs.statSync(file).mtimeMs;
    mod = await import(`${pathToFileURL(path.resolve(file)).href}?v=${stamp}`);
  } catch (e: any) {
    // defineFlow validates while building, so most authoring mistakes land here.
    problems.push({ severity: "error", message: `cannot load ${path.basename(file)}: ${e?.message ?? e}` });
    return { file, flows, problems };
  }
  const forms: Record<string, FormDef> = mod.forms ?? {};
  const found = Object.values(mod).filter(isFlow);
  if (!found.length) problems.push({ severity: "error", message: `${path.basename(file)} exports no defineFlow(...) flow` });

  for (const authored of found as any[]) {
    // The engine knows a flow by its key (project-prefixed process id); job types derive from it.
    const flow = { ...authored, id: keyFor(authored.id) };
    let xml: string;
    try {
      xml = await layoutFlow(flow);
    } catch (e: any) {
      problems.push({ severity: "error", message: `flow "${authored.id}": compile failed: ${e?.message ?? e}` });
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
      if (n.kind === "task") {
        const jobType = n.jobType ?? `${flow.id}:${n.name}`;
        const agent = (n.agent ?? !!n.prompt) && jobType !== "session" && typeof mod.workers?.[jobType] !== "function";
        tasks.push({ name: n.name, jobType, agent, rank: agent && n.jobType ? rankOf(n.jobType) : undefined, prompt: n.prompt });
      }
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
      const builtin = t.agent || t.jobType in BUILTIN_JOB_TYPES;
      if (!builtin && !(mod.workers && typeof mod.workers[t.jobType] === "function"))
        problems.push({
          severity: "warning",
          element: t.name,
          message: `task("${t.name}") has job type "${t.jobType}" that no worker serves (built-ins: ${Object.keys(BUILTIN_JOB_TYPES).join(", ")}; or export workers = { "${t.jobType}": handler })`,
        });
      if (t.agent && !t.prompt)
        problems.push({ severity: "error", element: t.name, message: `agent task("${t.name}") needs { prompt: { resourceId } } (or a worker: export workers = { "${t.jobType}": handler })` });
      if (t.agent && !t.rank && t.jobType !== "claude" && !t.jobType.startsWith(`${authored.id}:`))
        problems.push({ severity: "warning", element: t.name, message: `agent job type "${t.jobType}" isn't the nano-workforce form <rank>:<task> (e.g. "senior:${t.name}")` });
      const use = (mod.agents?.[t.name] as AgentOptions | undefined)?.use ?? (t.agent ? mod.defaultAgent : undefined);
      // The author's CLI is a suggestion: someone without it runs the step on their own.
      if (use && !allProfiles(mod.agentProfiles).hasOwnProperty(use))
        problems.push({ severity: "warning", element: t.name, message: `the flow suggests agent profile "${use}", which isn't known here — the step will run on your assignment or default (nage agent show ${authored.id})` });
      if (t.prompt && !fs.existsSync(promptFile(projectDir, t.prompt.resourceId)))
        problems.push({ severity: "error", element: t.name, message: `prompt file flows/prompts/${t.prompt.resourceId} not found` });
    }
    if (mod.workers) {
      for (const [type, h] of Object.entries(mod.workers)) if (typeof h === "function") handlers[type] = h as any;
    }
    const input: FlowInput | undefined = authored.input
      ? { name: authored.input.name, fields: authored.input.fields.map((f: any) => ({ name: f.name, type: f.type, optional: !!f.optional, list: !!f.list })) }
      : undefined;
    const hints: StartFormHints | undefined = mod.startForm;
    for (const message of hintProblems(input, hints)) problems.push({ severity: "error", element: "Start", message });
    // The engine is the final judge: deploy into a throwaway engine.
    try {
      newEngine().deploy(xml);
    } catch (e: any) {
      problems.push({ severity: "error", message: `flow "${authored.id}": engine rejected the BPMN: ${e?.message ?? e}` });
    }
    flows.push({ id: authored.id, key: flow.id, file, stamp, xml, handlers, humans, tasks, forms, agents: mod.agents ?? {}, agentProfiles: mod.agentProfiles ?? {}, defaultAgent: typeof mod.defaultAgent === "string" ? mod.defaultAgent : undefined, projectDir, scope: "project", description: mod.description, input, startForm: input ? inputForm(input, hints) : undefined });
  }
  return { file, flows, problems };
}

export async function checkProject(project: string, keyFor?: (id: string) => string): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  for (const f of listFlowFiles(project)) out.push(await checkFile(f, keyFor));
  return out;
}

/** Add type errors to check results (authoring checks: `nage check`, flow_check,
 *  flow_write — the daemon doesn't type-check, it loads flows with types stripped).
 *  Returns false when the type-check kit isn't available. */
export function addTypeProblems(results: CheckResult[]): boolean {
  const types = typecheckFlows(results.map((r) => r.file));
  if (!types) return false;
  for (const r of results) r.problems.push(...(types.get(path.resolve(r.file)) ?? []).map(({ severity, message }) => ({ severity, message })));
  return true;
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
