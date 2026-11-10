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
    /** Shown in `nage agents` and the explorer. */
    description?: string;
}
export declare const BUILTIN_PROFILES: Record<string, AgentProfile>;
/** The CLI each host runs on: a run started from that host defaults to it. */
export declare const HOST_PROFILE: Record<string, string>;
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
export declare function rankOf(jobType: string): string | undefined;
export declare function agentsFile(): string;
export declare function readAgentsFile(): AgentsFile;
export declare function writeAgentsFile(f: AgentsFile): void;
/** All profiles a flow can use, with where each came from. */
export declare function allProfiles(flowProfiles?: Record<string, AgentProfile>, file?: AgentsFile): Record<string, AgentProfile & {
    source: string;
}>;
/** Absolute path of a command, looking past the minimal PATH Desktop starts us with. */
export declare function which(command: string): string | undefined;
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
export declare function resolveAgent(opts: ResolveInput): ResolvedAgent | undefined;
/** Pull `--agent [step=]profile` and `--model [step=]model` (repeatable) out of CLI args:
 *  per-run overrides, "*" = every agent step. Returns the remaining args. */
export declare function takeRunAgents(args: string[]): {
    agents?: RunAgents;
    rest: string[];
};
/** Set (or clear, with use/model null) an assignment in agents.json. No step: the whole flow. */
export declare function assignAgent(a: {
    flowId?: string;
    step?: string;
    rank?: string;
    use?: string | null;
    model?: string | null;
}): AgentsFile;
/** The binary a profile runs. AGE_CLAUDE_CMD still swaps the built-in claude (tests). */
export declare function commandOf(name: string, p: AgentProfile): string;
/** Is any agent CLI usable here (else agent steps go to the chat assistant)? */
export declare function anyAgentInstalled(): boolean;
/** Command line + env for a profile run with a model. */
export declare function launch(name: string, p: AgentProfile, model?: string): {
    command: string;
    args: string[];
    env: Record<string, string>;
};
