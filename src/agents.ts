// Agent profiles: which CLI runs an agent step. A profile names a command and how to talk
// to it — "acp" (Agent Client Protocol over stdio: nano-coder, OpenCode, Gemini CLI,
// codex-acp, claude-code-acp, …) or "claude" (`claude -p`, Claude Code's print mode).
//
// Where profiles come from, later wins on a name clash:
//   built-ins < a flow file's `export const agentProfiles` < ~/.agent-graph/agents.json
// The user's file wins so a shared flow can't swap the CLI (or subscription) you run.
//
// Which profile a step uses: the step's `use` (in `export const agents`), else the flow's
// `export const defaultAgent`, else agents.json "default", else the CLI of the host that
// started the run (Claude Code → claude, OpenCode → opencode), else the first installed.
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

export interface AgentsFile {
  default?: string;
  profiles?: Record<string, AgentProfile>;
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
export function allProfiles(flowProfiles: Record<string, AgentProfile> = {}): Record<string, AgentProfile & { source: string }> {
  const out: Record<string, AgentProfile & { source: string }> = {};
  for (const [n, p] of Object.entries(BUILTIN_PROFILES)) out[n] = { ...p, source: "built-in" };
  for (const [n, p] of Object.entries(flowProfiles)) out[n] = { ...p, source: "flow" };
  for (const [n, p] of Object.entries(readAgentsFile().profiles ?? {})) out[n] = { ...p, source: "agents.json" };
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
  /** Why this profile: "step", "flow default", "agents.json default", "host", "installed". */
  reason: string;
}

/** Pick the profile for a step. Undefined when nothing usable is installed. */
export function resolveAgent(opts: { use?: string; flowDefault?: string; host?: string; flowProfiles?: Record<string, AgentProfile> }): ResolvedAgent | undefined {
  const profiles = allProfiles(opts.flowProfiles);
  const pick = (name: string | undefined, reason: string, mustExist: boolean): ResolvedAgent | undefined => {
    if (!name) return undefined;
    const profile = profiles[name];
    if (!profile) {
      if (mustExist) throw new Error(`unknown agent profile "${name}" (known: ${Object.keys(profiles).join(", ")})`);
      return undefined;
    }
    if (!mustExist && !which(commandOf(name, profile))) return undefined;
    return { name, profile, reason };
  };
  return (
    pick(opts.use, "step", true) ??
    pick(opts.flowDefault, "flow default", true) ??
    pick(readAgentsFile().default, "agents.json default", true) ??
    pick(opts.host && HOST_PROFILE[opts.host], "host", false) ??
    ["claude", "opencode", "nano-coder"].map((n) => pick(n, "installed", false)).find(Boolean)
  );
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
