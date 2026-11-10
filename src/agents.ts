// Agent profiles: which CLI runs an agent step. A profile names a command and how to talk
// to it — "acp" (Agent Client Protocol over stdio: nano-coder, OpenCode, Gemini CLI,
// codex-acp, claude-code-acp, …) or "claude" (`claude -p`, Claude Code's print mode).
//
// Where profiles come from, later wins on a name clash:
//   built-ins < a flow file's `export const agentProfiles` < ~/.agent-graph/agents.json
// The user's file wins so a shared flow can't swap the CLI (or subscription) you run.
//
// Agent steps follow the nano-workforce convention: an external service task with the
// `<zeebe:agentDefinition agentType="external"/>` marker, a linked prompt, and a job type
// `<rank>:<task>` (e.g. `senior:summarize`). The flow says WHAT kind of agent a step
// needs; the person running it decides WHICH CLI and model does it. A flow written for
// one CLI runs on another machine with that machine's CLI.
//
// Which profile (and model) a step uses, first match wins:
//   1. this run's override        (start { agents: { <step>|"*": { use, model } } })
//   2. your step assignment        (agents.json flows.<flowId>.steps.<step>)
//   3. your flow assignment        (agents.json flows.<flowId>.use)
//   4. your rank assignment        (agents.json ranks.<rank>, e.g. senior → claude)
//   5. the author's suggestion     (the step's `use`, then `defaultAgent`) — if installed here
//   6. your default                (agents.json default)
//   7. the CLI of the host that started the run, then the first one installed.
// A model can be set on its own at levels 1–3 (keeps whichever CLI was picked).
import fs from "node:fs";
import path from "node:path";
import { engineDir } from "./paths.ts";

export interface AgentProfile {
  /** "acp": Agent Client Protocol over stdio. "claude": `claude -p` print mode. */
  protocol: "acp" | "claude";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  /** Default model for this profile ("provider/model" for nano-coder and OpenCode). */
  model?: string;
  /** How the model is passed: a flag (e.g. "--model") … */
  modelArg?: string;
  /** … or env vars, with "{model}" replaced (OpenCode: OPENCODE_CONFIG_CONTENT). */
  modelEnv?: Record<string, string>;
  /** Shown in `age agents` and the explorer. */
  description?: string;
}

export const BUILTIN_PROFILES: Record<string, AgentProfile> = {
  claude: { protocol: "claude", command: "claude", modelArg: "--model", description: "Claude Code, headless (claude -p)" },
  opencode: {
    protocol: "acp",
    command: "opencode",
    args: ["acp"],
    modelEnv: { OPENCODE_CONFIG_CONTENT: '{"model":"{model}"}' },
    description: "OpenCode over ACP (opencode acp)",
  },
  "nano-coder": { protocol: "acp", command: "nano-coder", args: ["--acp"], modelArg: "--model", description: "nano-coder over ACP (nano-coder --acp)" },
  gemini: { protocol: "acp", command: "gemini", args: ["--experimental-acp"], modelArg: "--model", description: "Gemini CLI over ACP" },
};

/** The CLI each host runs on: a run started from that host defaults to it. */
export const HOST_PROFILE: Record<string, string> = { "claude-code": "claude", "claude-desktop": "claude", "claude-ai": "claude", opencode: "opencode", "nano-coder": "nano-coder" };

/** A choice of CLI and/or model for an agent step. */
export interface AgentChoice {
  use?: string;
  model?: string;
}

/** Your assignments for one flow (by flow id, so they follow the flow across projects). */
export interface FlowAssignment extends AgentChoice {
  steps?: Record<string, AgentChoice>;
}

export interface AgentsFile {
  default?: string;
  profiles?: Record<string, AgentProfile>;
  /** Rank → profile: who serves `<rank>:*` agent steps (e.g. { senior: "claude", junior: "nano-coder" }). */
  ranks?: Record<string, string>;
  flows?: Record<string, FlowAssignment>;
}

/** Per-run overrides: by step name, or "*" for every agent step of the run. */
export type RunAgents = Record<string, AgentChoice>;

/** The rank of a nano-workforce agent job type (`senior:feature` → senior). Same grammar as
 *  nano-workforce's jobTypeToRoutingToken: one colon, rank a bare `[a-z][a-z0-9-]*` segment. */
export function rankOf(jobType: string): string | undefined {
  const m = /^([a-z][a-z0-9-]*):([^:]+)$/.exec(jobType);
  return m?.[1];
}

export function agentsFile(): string {
  return path.join(engineDir(), "agents.json");
}

export function readAgentsFile(): AgentsFile {
  try {
    return JSON.parse(fs.readFileSync(agentsFile(), "utf8"));
  } catch {
    return {};
  }
}

export function writeAgentsFile(f: AgentsFile) {
  fs.mkdirSync(path.dirname(agentsFile()), { recursive: true });
  fs.writeFileSync(agentsFile(), JSON.stringify(f, null, 2) + "\n");
}

/** All profiles a flow can use, with where each came from. */
export function allProfiles(flowProfiles: Record<string, AgentProfile> = {}, file: AgentsFile = readAgentsFile()): Record<string, AgentProfile & { source: string }> {
  const out: Record<string, AgentProfile & { source: string }> = {};
  for (const [n, p] of Object.entries(BUILTIN_PROFILES)) out[n] = { ...p, source: "built-in" };
  for (const [n, p] of Object.entries(flowProfiles)) out[n] = { ...p, source: "flow" };
  for (const [n, p] of Object.entries(file.profiles ?? {})) out[n] = { ...p, source: "agents.json" };
  return out;
}

const found = new Map<string, string | undefined>();
/** Absolute path of a command, looking past the minimal PATH Desktop starts us with. */
export function which(command: string): string | undefined {
  if (path.isAbsolute(command)) return fs.existsSync(command) ? command : undefined;
  if (found.has(command)) return found.get(command);
  const home = process.env.HOME ?? "";
  const dirs = [...(process.env.PATH ?? "").split(":"), `${home}/.local/bin`, `${home}/.claude/local`, `${home}/.opencode/bin`, "/opt/homebrew/bin", "/usr/local/bin"];
  let hit: string | undefined;
  for (const d of dirs) {
    const f = d && path.join(d, command);
    if (f && fs.existsSync(f)) {
      hit = f;
      break;
    }
  }
  found.set(command, hit);
  return hit;
}

export interface ResolvedAgent {
  name: string;
  profile: AgentProfile;
  /** The model to run with (undefined: the CLI's own default). */
  model?: string;
  /** Why this profile, e.g. "run override", "your step assignment", "rank senior", "author (step)", "host". */
  reason: string;
  /** The author's suggestion that was skipped (unknown or not installed here), if any. */
  skipped?: string;
}

export interface ResolveInput {
  flowId?: string;
  step?: string;
  jobType?: string;
  /** The author's choices from the flow file. */
  use?: string;
  model?: string;
  flowDefault?: string;
  flowProfiles?: Record<string, AgentProfile>;
  /** Overrides for this run. */
  run?: RunAgents;
  host?: string;
  /** Read instead of ~/.agent-graph/agents.json (tests, previews). */
  file?: AgentsFile;
}

/** Pick the profile and model for an agent step. Undefined when nothing usable is installed.
 *  The user's own choices (run, step, flow, rank, default) must name a known profile — a typo
 *  there is an error, not a silent fallback. The author's suggestions only apply when that
 *  CLI is known and installed here, so a flow from someone on another CLI just runs on yours. */
export function resolveAgent(opts: ResolveInput): ResolvedAgent | undefined {
  const file = opts.file ?? readAgentsFile();
  const profiles = allProfiles(opts.flowProfiles, file);
  const fa = (opts.flowId && file.flows?.[opts.flowId]) || {};
  const sa = (opts.step && fa.steps?.[opts.step]) || {};
  const ro = (opts.step && opts.run?.[opts.step]) || {};
  const rall = opts.run?.["*"] ?? {};
  // A model chosen by the user wins whichever CLI is picked; the author's model only goes
  // with the author's CLI.
  const userModel = ro.model ?? rall.model ?? sa.model ?? fa.model;
  let skipped: string | undefined;
  const pick = (name: string | undefined, reason: string, mode: "user" | "author" | "auto", model?: string): ResolvedAgent | undefined => {
    if (!name) return undefined;
    const profile = profiles[name];
    if (!profile) {
      if (mode === "user") throw new Error(`unknown agent profile "${name}" (${reason}; known: ${Object.keys(profiles).join(", ")})`);
      if (mode === "author") skipped ??= `${name} (unknown here)`;
      return undefined;
    }
    if (mode !== "user" && !which(commandOf(name, profile))) {
      if (mode === "author") skipped ??= `${name} (not installed)`;
      return undefined;
    }
    return { name, profile, model: userModel ?? model ?? profile.model, reason };
  };
  const rank = opts.jobType ? rankOf(opts.jobType) : undefined;
  const r =
    pick(ro.use, "run override", "user", ro.model) ??
    pick(rall.use, "run override", "user", rall.model) ??
    pick(sa.use, "your step assignment", "user", sa.model) ??
    pick(fa.use, "your flow assignment", "user", fa.model) ??
    pick(rank && file.ranks?.[rank], `your rank ${rank}`, "user") ??
    pick(opts.use, "author (step)", "author", opts.model) ??
    pick(opts.flowDefault, "author (flow default)", "author", opts.use ? undefined : opts.model) ??
    pick(file.default, "your default", "user") ??
    pick(opts.host && HOST_PROFILE[opts.host], "host", "auto") ??
    ["claude", "opencode", "nano-coder"].map((n) => pick(n, "installed", "auto")).find(Boolean);
  return r && skipped ? { ...r, skipped } : r;
}

/** Pull `--agent [step=]profile` and `--model [step=]model` (repeatable) out of CLI args:
 *  per-run overrides, "*" = every agent step. Returns the remaining args. */
export function takeRunAgents(args: string[]): { agents?: RunAgents; rest: string[] } {
  const agents: RunAgents = {};
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const m = /^--(agent|model)(?:=(.*))?$/.exec(args[i]);
    if (!m) {
      rest.push(args[i]);
      continue;
    }
    const v = m[2] ?? args[++i];
    if (!v) throw new Error(`--${m[1]} needs a value: --${m[1]} <${m[1] === "agent" ? "profile" : "model"}> or --${m[1]} <step>=<value>`);
    const eq = v.indexOf("=");
    const [step, val] = eq > 0 ? [v.slice(0, eq), v.slice(eq + 1)] : ["*", v];
    (agents[step] ??= {})[m[1] === "agent" ? "use" : "model"] = val;
  }
  return { agents: Object.keys(agents).length ? agents : undefined, rest };
}

/** Set (or clear, with use/model null) an assignment in agents.json. No step: the whole flow. */
export function assignAgent(a: { flowId?: string; step?: string; rank?: string; use?: string | null; model?: string | null }): AgentsFile {
  const file = readAgentsFile();
  const known = allProfiles({}, file);
  if (a.use && !known[a.use]) throw new Error(`unknown agent profile "${a.use}" (known: ${Object.keys(known).join(", ")})`);
  if (a.rank) {
    if (!/^[a-z][a-z0-9-]*$/.test(a.rank)) throw new Error(`bad rank "${a.rank}"`);
    file.ranks ??= {};
    if (a.use) file.ranks[a.rank] = a.use;
    else delete file.ranks[a.rank];
  } else {
    if (!a.flowId) throw new Error("assign needs a flowId (or a rank)");
    file.flows ??= {};
    const fa = (file.flows[a.flowId] ??= {});
    const target: AgentChoice = a.step && a.step !== "*" ? ((fa.steps ??= {})[a.step] ??= {}) : fa;
    for (const k of ["use", "model"] as const) {
      const v = a[k];
      if (v === null || v === "") delete target[k];
      else if (v !== undefined) target[k] = v;
    }
    if (fa.steps) for (const [k, v] of Object.entries(fa.steps)) if (!v.use && !v.model) delete fa.steps[k];
    if (fa.steps && !Object.keys(fa.steps).length) delete fa.steps;
    if (!fa.use && !fa.model && !fa.steps) delete file.flows[a.flowId];
  }
  writeAgentsFile(file);
  return file;
}

/** The binary a profile runs. AGE_CLAUDE_CMD still swaps the built-in claude (tests). */
export function commandOf(name: string, p: AgentProfile): string {
  if (name === "claude" && p.command === "claude" && process.env.AGE_CLAUDE_CMD) return process.env.AGE_CLAUDE_CMD;
  return p.command;
}

/** Is any agent CLI usable here (else agent steps go to the chat assistant)? */
export function anyAgentInstalled(): boolean {
  const d = readAgentsFile().default;
  if (d) return true;
  return ["claude", "opencode", "nano-coder"].some((n) => which(commandOf(n, BUILTIN_PROFILES[n])));
}

/** Command line + env for a profile run with a model. */
export function launch(name: string, p: AgentProfile, model?: string): { command: string; args: string[]; env: Record<string, string> } {
  const command = which(commandOf(name, p)) ?? commandOf(name, p);
  const args = [...(p.args ?? [])];
  const env: Record<string, string> = { ...(p.env ?? {}) };
  const m = model ?? p.model;
  if (m && p.modelArg && p.protocol === "acp") args.push(p.modelArg, m);
  if (m && p.modelEnv) for (const [k, v] of Object.entries(p.modelEnv)) env[k] = v.replaceAll("{model}", m);
  return { command, args, env };
}
