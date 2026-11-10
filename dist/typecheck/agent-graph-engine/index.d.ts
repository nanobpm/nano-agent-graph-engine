export { defineFlow, envelope, validateEnvelope } from "@nanobpm/workflow";
export type { Envelope, EnvelopeProblem, FlowBuilder, Job, JsonObject, StartVars } from "@nanobpm/workflow";
export type { StartFormHints } from "./input.ts";
/** Display hints for the start form of a flow with an input (`{ Start: { in: Input } }`):
 *  a title, a description, and per field a title, description, choices (`enum`) or default.
 *  The fields come from the input, which this takes so field names are type-checked.
 *  Export the result as `startForm`. */
export declare function defineStartForm<E extends import("@nanobpm/workflow").Envelope<any>>(_input: E, hints: Omit<import("./input.ts").StartFormHints, "fields"> & {
    fields?: {
        [K in keyof E["type"] & string]?: NonNullable<import("./input.ts").StartFormHints["fields"]>[string];
    };
}): import("./input.ts").StartFormHints;
/** A field of a human-task form. Mirrors the MCP elicitation primitive schema, so a
 *  form can be asked in Claude Code (elicitation dialog) and in the web explorer. */
export type FormField = {
    type: "string";
    title?: string;
    description?: string;
    enum?: string[];
    enumNames?: string[];
    default?: string;
    format?: "uri" | "email" | "date" | "date-time";
} | {
    type: "boolean";
    title?: string;
    description?: string;
    default?: boolean;
} | {
    type: "number" | "integer";
    title?: string;
    description?: string;
    minimum?: number;
    maximum?: number;
    default?: number;
};
export interface FormDef {
    title?: string;
    /** Shown above the fields. `{{var}}` is replaced with the instance variable. */
    description?: string;
    fields: Record<string, FormField>;
    required?: string[];
}
/** The project folder of the run this job belongs to: sh() and claude() run there. */
export declare function jobProject(): string | undefined;
/** Aborts when the current job times out or the engine stops. sh() and claude() stop
 *  their process on it; pass it to fetch() and other long calls in a handler. */
export declare function jobSignal(): AbortSignal | undefined;
/** A path in the project the current run belongs to. Use it for files a step reads or
 *  writes: the engine serves every project, so its working directory is not yours. */
export declare function projectPath(...parts: string[]): string;
/** Run fn as part of a job for `project` (the engine wraps every handler in this). */
export declare function runInProject<T>(project: string, fn: () => T, signal?: AbortSignal): T;
/** Declare the forms the flow's `w.human(name, { form })` steps refer to. Export the
 *  result as `forms` from the flow file. */
export declare function defineForms<T extends Record<string, FormDef>>(forms: T): T;
/** Options for agent tasks — `w.task(name, { jobType: "senior:<task>", prompt })` — keyed
 *  by step name. Export the result as `agents` from the flow file.
 *
 *  Agent steps follow the nano-workforce convention: the job type names a rank and a task
 *  (`senior:review`, `junior:triage`), never a CLI, so the flow runs on anyone's machine.
 *  Who runs it is the user's choice (`age agent assign`, flow_agents, the explorer);
 *  `use`/`model` here are only the author's suggestion. ("claude" is the legacy job type.) */
export interface AgentOptions extends Omit<ClaudeOptions, "cwd" | "timeoutMs"> {
    /** Variables to append to the prompt as JSON (default: all instance variables; `[]`:
     *  none — use when the prompt file pulls in what it needs with {{name}} placeholders). */
    context?: string[];
    /** Working directory for the agent, absolute or relative to the run's project; may use
     *  {{name}} placeholders, e.g. "{{workDir}}". Default: the run's project. */
    cwd?: string;
    /** Suggested agent profile: "claude", "opencode", "nano-coder", "gemini", or one from
     *  `agentProfiles`. Applies only where that CLI is installed and the user hasn't assigned
     *  this flow, step or rank to something else; otherwise the user's default runs it. */
    use?: string;
}
export type { AgentProfile } from "./agents.ts";
/** Agent profiles this flow file offers (~/.agent-graph/agents.json wins on a name clash). */
export declare function defineAgentProfiles<T extends Record<string, import("./agents.ts").AgentProfile>>(profiles: T): T;
export declare function defineAgents<T extends Record<string, AgentOptions>>(agents: T): T;
export interface ShResult {
    stdout: string;
    stderr: string;
    code: number;
}
/** Run a shell command (bash -c). Throws on a non-zero exit unless `allowFail`. The
 *  job's variables are NOT interpolated for you — pass them via `env` to avoid
 *  quoting bugs: sh('gh issue view "$N"', { env: { N: String(job.variables.n) } }). */
export declare function sh(command: string, opts?: {
    cwd?: string;
    env?: Record<string, string>;
    input?: string;
    allowFail?: boolean;
    timeoutMs?: number;
}): Promise<ShResult>;
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
export declare function claude<T = string>(prompt: string, opts?: ClaudeOptions): Promise<ClaudeResult<T>>;
