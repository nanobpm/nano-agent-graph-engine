#!/usr/bin/env node
// age — Agent Graph Engine CLI. Also the entry the daemon, the MCP server and the
// Claude Code hooks run through.
import { spawn } from "node:child_process";
import path from "node:path";
import { checkProject, formatProblems } from "./compile.ts";
import { resolveProject } from "./paths.ts";
import { EngineClient } from "./client.ts";
import { summarize } from "./summary.ts";

const HELP = `age — Agent Graph Engine

  age check                     compile + lint flows/*.flow.ts (writes nothing)
  age up                        start the engine (one per user) if needed, print its URL
  age down                      stop the engine
  age status                    flows here; runs, open tasks, incidents in every project
  age start <flow> [json]       start an instance with variables
  age tasks                     open user tasks
  age complete <task> [json]    complete a user task
  age open [view]               open the explorer in the browser (view: instance=K, task=K, flow=ID,
                                or a route like /instances); prints the URL
  age agent [list]              agent profiles (which CLI runs agent steps) and the default
  age agent default <name>      set the default profile (~/.agent-graph/agents.json)
  age daemon                    run the engine in the foreground
  age mcp [--http <port>]       run the MCP server (stdio, or Streamable HTTP)
  age hook <event>              Claude Code hook: print pending work as context

  Options: --project <dir> (default: nearest dir with flows/, else the git root, else cwd)
  The engine keeps its state in ~/.agent-graph (AGE_STATE_DIR); ~/AgentGraph/flows are
  global flows, offered in every project (AGE_HOME).`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const v = process.argv[i + 1];
  process.argv.splice(i, 2);
  return v;
}

const projectOpt = arg("--project");
const project = projectOpt ? path.resolve(projectOpt) : resolveProject();
const [cmd, ...rest] = process.argv.slice(2);

function parseVars(s?: string): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`variables must be JSON, got: ${s}`);
  }
}

async function main() {
  switch (cmd) {
    case "check": {
      const r = await checkProject(project);
      if (!r.length) console.log(`no flows in ${path.join(project, "flows")}`);
      else console.log(formatProblems(r));
      process.exitCode = r.some((x) => x.problems.some((p) => p.severity === "error")) ? 1 : 0;
      return;
    }
    case "agent": {
      const { allProfiles, readAgentsFile, writeAgentsFile, agentsFile, commandOf, which, resolveAgent } = await import("./agents.ts");
      if (rest[0] === "default") {
        const all = allProfiles();
        if (!rest[1] || !all[rest[1]]) throw new Error(`usage: age agent default <${Object.keys(all).join("|")}>`);
        writeAgentsFile({ ...readAgentsFile(), default: rest[1] });
        console.log(`default agent: ${rest[1]} (${agentsFile()})`);
        break;
      }
      const dflt = resolveAgent({});
      for (const [name, p] of Object.entries(allProfiles())) {
        const cmd = commandOf(name, p);
        const found = which(cmd);
        console.log(`${name === dflt?.name ? "*" : " "} ${name.padEnd(14)} ${p.protocol.padEnd(6)} ${[cmd, ...(p.args ?? [])].join(" ")}${p.model ? `  model=${p.model}` : ""}  [${p.source}${found ? "" : ", not installed"}]`);
      }
      console.log(`\n* default (${dflt?.reason ?? "none installed"}). Add profiles or set "default" in ${agentsFile()};`);
      console.log(`  a run started from a host (Claude Code, OpenCode) uses that host's CLI unless a default is set.`);
      break;
    }
    case "daemon": {
      const { serve } = await import("./daemon.ts");
      const { info } = await serve();
      console.log(`agent-graph engine ${info.url} (pid ${info.pid})`);
      return;
    }
    case "up": {
      console.log((await EngineClient.connect(project)).url);
      return;
    }
    case "open": {
      const c = await EngineClient.connect(project);
      const target = c.explorerUrl((rest[0] ?? "").replace(/^#/, ""));
      console.log(target);
      openBrowser(target);
      return;
    }
    case "down": {
      const c = await EngineClient.find(project);
      if (!c) return console.log("not running");
      await c.shutdown();
      return console.log("stopped");
    }
    case "status": {
      const c = await EngineClient.connect(project);
      console.log(`${summarize(await c.state(), project)}\nexplorer: ${c.explorerUrl()}`);
      return;
    }
    case "start": {
      const c = await EngineClient.connect(project);
      const r = await c.start(rest[0], parseVars(rest[1]));
      console.log(`started instance ${r.instanceKey} — ${c.explorerUrl(`instance=${r.instanceKey}`)}`);
      return;
    }
    case "tasks": {
      const s = await (await EngineClient.connect(project)).state(true);
      console.log(JSON.stringify(s.userTasks.map(({ variables, ...t }: any) => t), null, 2));
      return;
    }
    case "complete": {
      await (await EngineClient.connect(project)).completeTask(rest[0], parseVars(rest[1]));
      console.log("completed");
      return;
    }
    case "mcp": {
      const { runMcp, runMcpHttp } = await import("./mcp.ts");
      const i = process.argv.indexOf("--http");
      if (i > 0) await runMcpHttp(project, Number(process.argv[i + 1] ?? 3001));
      else await runMcp(project);
      return;
    }
    case "hook": {
      const { runHook } = await import("./hooks.ts");
      await runHook(project, rest[0]);
      return;
    }
    default:
      console.log(HELP);
  }
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});

/** Opens a URL in the default browser, detached (no-op with AGE_NO_BROWSER=1). */
function openBrowser(url: string) {
  if (process.env.AGE_NO_BROWSER) return;
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}
