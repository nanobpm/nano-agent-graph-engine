// Authoring API for Agent Graph Engine flows. A flow file (flows/*.flow.ts) imports
// from "@nanobpm/nano-agent-graph-engine" — the daemon resolves that specifier to this module.
import { AsyncLocalStorage } from "node:async_hooks";
import { spawn } from "node:child_process";
import path from "node:path";

export { defineFlow, envelope, validateEnvelope } from "@nanobpm/workflow";
export type { Envelope, EnvelopeProblem, FlowBuilder, Job, JsonObject, StartVars } from "@nanobpm/workflow";
export type { StartFormHints } from "./input.ts";

/** Display hints for the start form of a flow with an input (`{ Start: { in: Input } }`):
 *  a title, a description, and per field a title, description, choices (`enum`) or default.
 *  The fields come from the input, which this takes so field names are type-checked.
 *  Export the result as `startForm`. */
export function defineStartForm<E extends import("@nanobpm/workflow").Envelope<any>>(
  _input: E,
  hints: Omit<import("./input.ts").StartFormHints, "fields"> & { fields?: { [K in keyof E["type"] & string]?: NonNullable<import("./input.ts").StartFormHints["fields"]>[string] } },
): import("./input.ts").StartFormHints {
  // Optional mapped keys widen to `| undefined`; the hints are read the same either way.
  return hints as import("./input.ts").StartFormHints;
}

/** A field of a human-task form. Mirrors the MCP elicitation primitive schema, so a
 *  form can be asked in Claude Code (elicitation dialog) and in the web explorer. */
export type FormField =
  | { type: "string"; title?: string; description?: string; enum?: string[]; enumNames?: string[]; default?: string; format?: "uri" | "email" | "date" | "date-time" }
  | { type: "boolean"; title?: string; description?: string; default?: boolean }
  | { type: "number" | "integer"; title?: string; description?: string; minimum?: number; maximum?: number; default?: number };

export interface FormDef {
  title?: string;
  /** Shown above the fields. `{{var}}` is replaced with the instance variable. */
  description?: string;
  fields: Record<string, FormField>;
  required?: string[];
}

/** The project the current job runs for (one engine serves every project). Kept on
 *  globalThis: the engine and flow files may load this module from different copies. */
const jobContext: AsyncLocalStorage<{ project: string; signal?: AbortSignal }> = ((globalThis as any)[Symbol.for("agent-graph.job")] ??= new AsyncLocalStorage());

/** The project folder of the run this job belongs to: sh() and claude() run there. */
export function jobProject(): string | undefined {
  return jobContext.getStore()?.project;
}

/** Aborts when the current job times out or the engine stops. sh() and claude() stop
 *  their process on it; pass it to fetch() and other long calls in a handler. */
export function jobSignal(): AbortSignal | undefined {
  return jobContext.getStore()?.signal;
}

/** A path in the project the current run belongs to. Use it for files a step reads or
 *  writes: the engine serves every project, so its working directory is not yours. */
export function projectPath(...parts: string[]): string {
  return path.resolve(jobProject() ?? process.env.AGE_PROJECT ?? process.cwd(), ...parts);
}

/** Run fn as part of a job for `project` (the engine wraps every handler in this). */
export function runInProject<T>(project: string, fn: () => T, signal?: AbortSignal): T {
  return jobContext.run({ project, signal }, fn);
}

/** Declare the forms the flow's `w.human(name, { form })` steps refer to. Export the
 *  result as `forms` from the flow file. */
export function defineForms<T extends Record<string, FormDef>>(forms: T): T {
  return forms;
}

/** Options for agent tasks — `w.task(name, { jobType: "senior:<task>", prompt })` — keyed
 *  by step name. Export the result as `agents` from the flow file.
 *
 *  Agent steps follow the nano-workforce convention: the job type names a rank and a task
 *  (`senior:review`, `junior:triage`), never a CLI, so the flow runs on anyone's machine.
 *  Who runs it is the user's choice (`nage agent assign`, flow_agents, the explorer);
 *  `use`/`model` here are only the author's suggestion. ("claude" is the legacy job type.) */
export interface AgentOptions extends Omit<ClaudeOptions, "cwd" | "timeoutMs"> {
  /** Variables to append to the prompt as JSON (default: all instance variables; `[]`:
   *  none — use when the prompt file pulls in what it needs with {{name}} placeholders). */
  context?: string[];
  /** Working directory for the agent, absolute or relative to the run's project; may use
   *  {{name}} placeholders, e.g. "{{workDir}}". Default: the run's project. */
  cwd?: string;
  /** Extra environment variables for the agent process; values may use {{name}}
   *  placeholders, e.g. { AGENT_WORKSPACE: "{{workDir}}", PR_URL: "{{prUrl}}" }. */
  env?: Record<string, string>;
  /** Give the agent a way to notice the run was cancelled: sets AGE_JOB_STATUS_URL and appends
   *  an "Abort if this run was cancelled" section telling it to `curl -fsS` that URL before
   *  pushing or other irreversible actions (the URL 404s once the step is cancelled). */
  abortCheck?: boolean;
  /** Suggested agent profile: "claude", "opencode", "nano-coder", "gemini", "qwen", "kimi", "copilot", or one from
   *  `agentProfiles`. Applies only where that CLI is installed and the user hasn't assigned
   *  this flow, step or rank to something else; otherwise the user's default runs it. */
  use?: string;
}

export type { AgentProfile } from "./agents.ts";
/** Agent profiles this flow file offers (~/.agent-graph/agents.json wins on a name clash). */
export function defineAgentProfiles<T extends Record<string, import("./agents.ts").AgentProfile>>(profiles: T): T {
  return profiles;
}
export function defineAgents<T extends Record<string, AgentOptions>>(agents: T): T {
  return agents;
}

export interface ShResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** Run a shell command (bash -c). Throws on a non-zero exit unless `allowFail`. The
 *  job's variables are NOT interpolated for you — pass them via `env` to avoid
 *  quoting bugs: sh('gh issue view "$N"', { env: { N: String(job.variables.n) } }). */
export function sh(
  command: string,
  opts: { cwd?: string; env?: Record<string, string>; input?: string; allowFail?: boolean; timeoutMs?: number } = {},
): Promise<ShResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["-c", command], {
      cwd: opts.cwd ?? jobProject() ?? process.env.AGE_PROJECT ?? process.cwd(),
      env: { ...process.env, ...opts.env },
      stdio: [opts.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      timeout: opts.timeoutMs,
      signal: jobSignal(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (d) => (stdout += d));
    child.stderr!.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      const r = { stdout, stderr, code: code ?? -1 };
      if (r.code !== 0 && !opts.allowFail) {
        reject(new Error(`sh exited ${r.code}: ${command}\n${stderr.slice(-2000) || stdout.slice(-2000)}`));
      } else resolve(r);
    });
    // A command that exits without reading its input closes the pipe first (EPIPE); its exit
    // code and output are what count, so that isn't an error of the step.
    if (child.stdin) {
      child.stdin.on("error", () => {});
      child.stdin.end(opts.input);
    }
  });
}

export interface ClaudeOptions {
  /** JSON schema the answer must match; the parsed object is returned. */
  schema?: Record<string, unknown>;
  /** Claude Code `--allowedTools` (headless runs never prompt, so list what it needs). */
  allowedTools?: string[];
  /** Claude Code `--permission-mode` (default: "dontAsk" — anything not allowed is denied). */
  permissionMode?: string;
  model?: string;
  cwd?: string;
  /** Append to the system prompt. */
  system?: string;
  timeoutMs?: number;
}

export interface ClaudeResult<T = unknown> {
  /** Parsed structured output when `schema` was given, else the final text. */
  result: T;
  costUsd?: number;
  sessionId?: string;
  turns?: number;
}

/** Run a headless Claude Code agent (`claude -p`) and return its answer. The command
 *  can be swapped with AGE_CLAUDE_CMD (e.g. a wrapper or another harness that
 *  speaks the same flags). */
export async function claude<T = string>(prompt: string, opts: ClaudeOptions = {}): Promise<ClaudeResult<T>> {
  const cmd = process.env.AGE_CLAUDE_CMD ?? "claude";
  const args = ["-p", "--output-format", "json", "--permission-mode", opts.permissionMode ?? "dontAsk"];
  if (opts.allowedTools?.length) args.push("--allowedTools", opts.allowedTools.join(","));
  if (opts.model) args.push("--model", opts.model);
  if (opts.system) args.push("--append-system-prompt", opts.system);
  if (opts.schema) args.push("--json-schema", JSON.stringify(opts.schema));
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd ?? jobProject() ?? process.env.AGE_PROJECT ?? process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: opts.timeoutMs ?? 30 * 60_000,
      signal: jobSignal(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (d) => (stdout += d));
    child.stderr!.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`${cmd} exited ${code}: ${(stderr || stdout).slice(-2000)}`)),
    );
    child.stdin.on("error", () => {}); // a CLI that dies early: its exit code and stderr report it
    child.stdin.end(prompt);
  });
  const msg = JSON.parse(out) as Record<string, any>;
  if (msg.is_error) throw new Error(`claude: ${msg.subtype ?? "error"}: ${String(msg.result ?? "").slice(0, 2000)}`);
  let result: unknown = msg.structured_output ?? msg.result;
  if (opts.schema && typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      /* leave as text */
    }
  }
  return { result: result as T, costUsd: msg.total_cost_usd, sessionId: msg.session_id, turns: msg.num_turns };
}
