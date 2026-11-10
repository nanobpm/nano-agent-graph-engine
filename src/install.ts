// `nage install <host>` / `nage uninstall <host>`: register the MCP server (and the skills,
// where the host reads them) with an agent host, so nobody hand-edits JSON or TOML.
// Every write keeps a .bak of the file it changes; --dry-run prints instead.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PACKAGE = "@nanobpm/nano-agent-graph-engine";
/** The server's key in every host config (tool names are mcp__agent-graph__* in Claude Code). */
export const SERVER = "agent-graph";
const SKILLS = ["agent-graph", "agent-graph-authoring"];
export const HOSTS = ["claude-code", "claude-desktop", "opencode", "codex", "cursor"] as const;
export type Host = (typeof HOSTS)[number];

const pkgRoot = () => path.resolve(path.dirname(fs.realpathSync(process.argv[1])), "..");

/** How a host should start the server. Absolute paths: desktop apps don't load your shell
 *  PATH. Run from npx's cache (which npm may clear), it's `npx -y <package> mcp`; from an
 *  installed or checked-out copy, node + that copy's cli.js. */
export function serverCommand(): { command: string; args: string[] } {
  const cli = fs.realpathSync(process.argv[1]);
  if (/[\\/]_npx[\\/]/.test(cli)) {
    const npx = path.join(path.dirname(process.execPath), process.platform === "win32" ? "npx.cmd" : "npx");
    return { command: fs.existsSync(npx) ? npx : "npx", args: ["-y", PACKAGE, "mcp"] };
  }
  return { command: process.execPath, args: [cli, "mcp"] };
}

function claudeDesktopConfig(): string {
  if (process.platform === "darwin") return path.join(os.homedir(), "Library/Application Support/Claude/claude_desktop_config.json");
  if (process.platform === "win32") return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData/Roaming"), "Claude/claude_desktop_config.json");
  return path.join(os.homedir(), ".config/Claude/claude_desktop_config.json");
}

interface Plan {
  file?: string;
  before?: string;
  after?: string;
  skillsDir?: string;
  run?: string[][];
  notes: string[];
}

function readJson(file: string): Record<string, any> {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, "utf8");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${file} isn't plain JSON (comments?), so it wasn't changed. Add this under its servers yourself:\n${JSON.stringify({ [SERVER]: serverCommand() }, null, 2)}`);
  }
}

/** A JSON config where the entry lives at obj[key][SERVER]. */
function jsonPlan(file: string, key: string, entry: unknown, remove: boolean): Plan {
  const cfg = readJson(file);
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined;
  const servers = (cfg[key] ??= {});
  if (remove) delete servers[SERVER];
  else servers[SERVER] = entry;
  return { file, before, after: JSON.stringify(cfg, null, 2) + "\n", notes: [] };
}

const tomlString = (s: string) => JSON.stringify(s);

/** Codex's config.toml: our table is replaced or removed as a block, the rest kept as is. */
function codexPlan(remove: boolean): Plan {
  const file = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "config.toml");
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const header = `[mcp_servers.${SERVER}]`;
  const lines = before.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const l of lines) {
    const t = l.trim();
    if (t === header || t.startsWith(`[mcp_servers.${SERVER}.`)) skipping = true;
    else if (t.startsWith("[")) skipping = false;
    if (!skipping) out.push(l);
  }
  let after = out.join("\n").replace(/\n{3,}$/, "\n\n");
  if (!remove) {
    const { command, args } = serverCommand();
    after = `${after.replace(/\s*$/, "")}${after.trim() ? "\n\n" : ""}${header}\ncommand = ${tomlString(command)}\nargs = [${args.map(tomlString).join(", ")}]\n`;
  }
  return { file, before: before || undefined, after, skillsDir: path.join(path.dirname(file), "skills"), notes: [] };
}

export function planFor(host: Host, remove = false): Plan {
  const { command, args } = serverCommand();
  switch (host) {
    case "claude-code":
      return {
        run: remove
          ? [["claude", "plugin", "uninstall", "nano-agent-graph-engine@nanobpm"]]
          : [
              ["claude", "plugin", "marketplace", "add", "nanobpm/nano-agent-graph-engine"],
              ["claude", "plugin", "install", "nano-agent-graph-engine@nanobpm"],
            ],
        notes: remove ? [] : ["The plugin brings the MCP server, both skills, the hooks and the /flows mod. Restart Claude Code to load it."],
      };
    case "claude-desktop": {
      const p = jsonPlan(claudeDesktopConfig(), "mcpServers", { command, args }, remove);
      p.notes.push("Quit Claude Desktop (⌘Q) and reopen it to load the server.");
      return p;
    }
    case "opencode": {
      const dir = path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "opencode");
      const p = jsonPlan(path.join(dir, "opencode.json"), "mcp", { type: "local", command: [command, ...args], enabled: true }, remove);
      p.skillsDir = path.join(dir, "skills");
      p.notes.push("Check with `opencode mcp list`; restart the OpenCode app if it's running.");
      return p;
    }
    case "codex": {
      const p = codexPlan(remove);
      p.notes.push("Check with `codex mcp list`.");
      return p;
    }
    case "cursor": {
      const p = jsonPlan(path.join(os.homedir(), ".cursor", "mcp.json"), "mcpServers", { command, args }, remove);
      p.notes.push("Enable it under Cursor Settings → MCP if Cursor asks.");
      return p;
    }
  }
}

function backup(file: string) {
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
}

/** Skills are copied, not linked: an npx cache copy can vanish. Reinstall to update them. */
function placeSkills(dir: string, remove: boolean, dry: boolean, log: (s: string) => void) {
  for (const s of SKILLS) {
    const to = path.join(dir, s);
    if (remove) {
      if (fs.existsSync(to)) {
        log(`remove skill ${to}`);
        if (!dry) fs.rmSync(to, { recursive: true, force: true });
      }
      continue;
    }
    const from = path.join(pkgRoot(), "skills", s);
    log(`skill ${s} → ${to}`);
    if (dry) continue;
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.cpSync(from, to, { recursive: true });
  }
}

export function install(host: string, opts: { remove?: boolean; dryRun?: boolean; log?: (s: string) => void } = {}): void {
  const log = opts.log ?? ((s: string) => console.log(s));
  if (!(HOSTS as readonly string[]).includes(host)) throw new Error(`usage: nage ${opts.remove ? "uninstall" : "install"} <${HOSTS.join("|")}> [--dry-run]`);
  const plan = planFor(host as Host, opts.remove);
  const dry = !!opts.dryRun;
  if (plan.file && plan.after !== undefined) {
    if (plan.after === plan.before) log(`${plan.file}: already up to date`);
    else {
      log(`${dry ? "would write" : "write"} ${plan.file}${plan.before !== undefined && !dry ? " (previous version: .bak)" : ""}`);
      if (dry) log(plan.after);
      else {
        backup(plan.file);
        fs.mkdirSync(path.dirname(plan.file), { recursive: true });
        fs.writeFileSync(plan.file, plan.after);
      }
    }
  }
  if (plan.skillsDir) placeSkills(plan.skillsDir, !!opts.remove, dry, log);
  for (const cmd of plan.run ?? []) {
    log(`${dry ? "would run" : "run"}: ${cmd.join(" ")}`);
    if (!dry) {
      try {
        execFileSync(cmd[0], cmd.slice(1), { stdio: "inherit" });
      } catch (e: any) {
        if (e?.code === "ENOENT") throw new Error(`${cmd[0]} isn't on PATH. Install Claude Code first, or run: ${cmd.join(" ")}`);
        throw e;
      }
    }
  }
  if (!dry) for (const n of plan.notes) log(n);
}
