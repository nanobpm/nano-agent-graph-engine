// Authoring API for Agent Graph Engine flows. A flow file (flows/*.flow.ts) imports
// from "agent-graph-engine" — the daemon resolves that specifier to this module.
import { spawn } from "node:child_process";

export { defineFlow, envelope } from "@nanobpm/workflow";
export type { FlowBuilder, Job, JsonObject } from "@nanobpm/workflow";

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

/** Declare the forms the flow's `w.human(name, { form })` steps refer to. Export the
 *  result as `forms` from the flow file. */
export function defineForms<T extends Record<string, FormDef>>(forms: T): T {
  return forms;
}

/** Options for agent tasks — `w.task(name, { jobType: "claude", prompt })` — keyed by
 *  step name. Export the result as `agents` from the flow file. */
export interface AgentOptions extends Omit<ClaudeOptions, "cwd" | "timeoutMs"> {
  /** Variables to pass as context (default: all instance variables). */
  context?: string[];
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
      cwd: opts.cwd ?? process.env.AGE_PROJECT ?? process.cwd(),
      env: { ...process.env, ...opts.env },
      stdio: ["pipe", "pipe", "pipe"],
      timeout: opts.timeoutMs,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      const r = { stdout, stderr, code: code ?? -1 };
      if (r.code !== 0 && !opts.allowFail) {
        reject(new Error(`sh exited ${r.code}: ${command}\n${stderr.slice(-2000) || stdout.slice(-2000)}`));
      } else resolve(r);
    });
    child.stdin.end(opts.input ?? "");
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
      cwd: opts.cwd ?? process.env.AGE_PROJECT ?? process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: opts.timeoutMs ?? 30 * 60_000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`${cmd} exited ${code}: ${(stderr || stdout).slice(-2000)}`)),
    );
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
