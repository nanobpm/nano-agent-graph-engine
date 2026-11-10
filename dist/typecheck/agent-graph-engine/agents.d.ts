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
export declare const BUILTIN_PROFILES: Record<string, AgentProfile>;
/** The CLI each host runs on: a run started from that host defaults to it. */
export declare const HOST_PROFILE: Record<string, string>;
export interface AgentsFile {
    default?: string;
    profiles?: Record<string, AgentProfile>;
}
export declare function agentsFile(): string;
export declare function readAgentsFile(): AgentsFile;
export declare function writeAgentsFile(f: AgentsFile): void;
/** All profiles a flow can use, with where each came from. */
export declare function allProfiles(flowProfiles?: Record<string, AgentProfile>): Record<string, AgentProfile & {
    source: string;
}>;
/** Absolute path of a command, looking past the minimal PATH Desktop starts us with. */
export declare function which(command: string): string | undefined;
export interface ResolvedAgent {
    name: string;
    profile: AgentProfile;
    /** Why this profile: "step", "flow default", "agents.json default", "host", "installed". */
    reason: string;
}
/** Pick the profile for a step. Undefined when nothing usable is installed. */
export declare function resolveAgent(opts: {
    use?: string;
    flowDefault?: string;
    host?: string;
    flowProfiles?: Record<string, AgentProfile>;
}): ResolvedAgent | undefined;
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
