#!/usr/bin/env node
// nage — Nano Agent Graph Engine CLI. Also the entry the daemon, the MCP server and the
// Claude Code hooks run through.
import { spawn } from "node:child_process";
import path from "node:path";
import { addTypeProblems, checkFile, checkProject, formatProblems } from "./compile.ts";
import { resolveProject } from "./paths.ts";
import { EngineClient } from "./client.ts";
import { summarize } from "./summary.ts";
import { parseStartArgs } from "./input.ts";

const HELP = `nage — Nano Agent Graph Engine

  nage check [file] [--json]     type-check, compile and lint flows/*.flow.ts (or one file);
                                 exit code 1 on errors. Writes nothing. --no-types skips tsc
  nage up                        start the engine (one per user) if needed, print its URL
  nage down                      stop the engine
  nage status                    flows here; runs, open tasks, incidents in every project
  nage start <flow> [--field value …] [json] [--title t] [--agent [step=]cli] [--model [step=]m]
                                 start an instance: input fields as flags (or name=value),
                                 and/or a JSON object; the engine converts and checks them.
                                 --agent/--model override who runs agent steps, this run only
  nage tasks                     open user tasks
  nage complete <task> [json]    complete a user task
  nage open [view]               open the explorer in the browser (view: instance=K, task=K, flow=ID,
                                 or a route like /instances); prints the URL
  nage agent [list]              agent profiles (which CLI runs agent steps) and the default
  nage agent default <name>      set the default profile (~/.agent-graph/agents.json)
  nage agent add <name> --acp|--claude|--exec [--model-arg <flag>] [--model-first] [--model m]
                 [--env K=V …] [--description text] -- <command> [args…]
                                 any agent CLI: --acp speaks ACP over stdio; --exec is any other
                                 CLI (the prompt replaces {prompt} in args, else goes to stdin,
                                 and what it prints is the answer); --claude is claude -p
  nage agent remove <name>       remove a profile you added
  nage agent show <flow>         the flow's agent steps: who runs each, and why
  nage agent assign <flow>[/<step>] <cli|-> [--model m]
                                 run a flow's (or one step's) agent steps on your CLI/model,
                                 for every run from now on ("-": keep the CLI, set the model)
  nage agent assign --rank <rank> <cli>   who serves <rank>:* steps (e.g. senior → claude)
  nage agent unassign <flow>[/<step>] | --rank <rank>
  nage daemon                    run the engine in the foreground
  nage mcp [--http <port>]       run the MCP server (stdio, or Streamable HTTP)
  nage hook <event>              Claude Code hook: print pending work as context
  nage install <host> [--dry-run]
                                 add the MCP server (and skills) to claude-code, claude-desktop,
                                 opencode, codex or cursor; nage uninstall <host> removes it

  Options: --project <dir> (default: nearest dir with flows/, else the git root, else cwd)
  The engine keeps its state in ~/.agent-graph (AGE_STATE_DIR); ~/AgentGraph/flows are
  global flows, offered in every project (AGE_HOME).`;

function arg(name: string): string | undefined {
  // Not past "--": what follows is someone else's command line (nage agent add … -- <cmd>).
  const end = process.argv.indexOf("--");
  const i = process.argv.indexOf(name);
  if (i < 0 || (end >= 0 && i > end)) return undefined;
  const v = process.argv[i + 1];
  process.argv.splice(i, 2);
  return v;
}

const projectOpt = arg("--project");
const project = projectOpt ? path.resolve(projectOpt) : resolveProject();
const [cmd, ...rest] = process.argv.slice(2);
// `age` was the command's first name; it clashes with the age encryption tool.
if (path.basename(process.argv[1] ?? "") === "age" && cmd !== "mcp" && cmd !== "hook" && cmd !== "daemon")
  console.error("note: `age` is now `nage` (the old name goes away in a later release)");

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
      const json = rest.includes("--json");
      const file = rest.find((a) => !a.startsWith("--"));
      const r = file ? [await checkFile(path.resolve(file))] : await checkProject(project);
      const typed = rest.includes("--no-types") || addTypeProblems(r);
      if (json)
        console.log(JSON.stringify({ ok: !r.some((x) => x.problems.some((p) => p.severity === "error")), typesChecked: typed && !rest.includes("--no-types"), files: r.map((x) => ({ file: x.file, flows: x.flows.map((f) => ({ id: f.id, input: f.input })), problems: x.problems })) }, null, 2));
      else if (!r.length) console.log(`no flows in ${path.join(project, "flows")}`);
      else console.log(formatProblems(r) + (typed ? "" : "\n(type check skipped: dist/typecheck missing — rebuild the plugin)"));
      const code = r.some((x) => x.problems.some((p) => p.severity === "error")) ? 1 : 0;
      // Don't wait for a background diagram layout (layout.ts); the engine redoes it on deploy.
      process.stdout.write("", () => process.exit(code));
      return;
    }
    case "agent": {
      const { allProfiles, readAgentsFile, writeAgentsFile, agentsFile, commandOf, which, resolveAgent } = await import("./agents.ts");
      if (rest[0] === "show") {
        if (!rest[1]) throw new Error("usage: nage agent show <flow>");
        const { formatAgentPlan } = await import("./summary.ts");
        console.log(formatAgentPlan(await (await EngineClient.connect(project)).agentPlan(rest[1], "cli")));
        break;
      }
      if (rest[0] === "assign" || rest[0] === "unassign") {
        const c = await EngineClient.connect(project);
        const take = (name: string) => {
          const i = rest.indexOf(name);
          return i < 0 ? undefined : rest.splice(i, 2)[1];
        };
        const rank = take("--rank");
        const model = take("--model");
        const clear = rest[0] === "unassign";
        const usage = "usage: nage agent assign <flow>[/<step>] <cli|-> [--model m] | --rank <rank> <cli>; nage agent unassign <flow>[/<step>] | --rank <rank>";
        if (rank) {
          const use = clear ? null : rest[1];
          if (use === undefined) throw new Error(usage);
          await c.assignAgent({ rank, use });
          console.log(clear ? `rank ${rank}: unassigned` : `rank ${rank} → ${use}`);
          break;
        }
        const target = rest[1];
        if (!target || (!clear && !rest[2] && !model)) throw new Error(usage);
        const [flowId, step] = target.split("/");
        const use = clear ? null : !rest[2] || rest[2] === "-" ? undefined : rest[2];
        await c.assignAgent({ flowId, step, use, model: clear ? null : model });
        const { formatAgentPlan } = await import("./summary.ts");
        console.log(formatAgentPlan(await c.agentPlan(flowId, "cli")));
        break;
      }
      if (rest[0] === "add") {
        const { parseAgentAdd, addProfile } = await import("./agents.ts");
        const { name, profile } = parseAgentAdd(rest.slice(1));
        const note = addProfile(name, profile);
        const cmd = commandOf(name, profile);
        console.log(`added ${name}: ${profile.protocol} ${[cmd, ...(profile.args ?? [])].join(" ")}${which(cmd) ? "" : "  (not installed here yet)"} (${agentsFile()})${note ? `\n${note}` : ""}`);
        console.log(`use it: nage agent default ${name} | nage agent assign <flow>[/<step>] ${name} | nage start <flow> --agent ${name}`);
        break;
      }
      if (rest[0] === "remove") {
        const { removeProfile } = await import("./agents.ts");
        if (!rest[1]) throw new Error("usage: nage agent remove <name>");
        console.log(removeProfile(rest[1]));
        break;
      }
      if (rest[0] === "default") {
        const all = allProfiles();
        if (!rest[1] || !all[rest[1]]) throw new Error(`usage: nage agent default <${Object.keys(all).join("|")}>`);
        writeAgentsFile({ ...readAgentsFile(), default: rest[1] });
        console.log(`default agent: ${rest[1]} (${agentsFile()})`);
        break;
      }
      let dflt: ReturnType<typeof resolveAgent>;
      let dfltError = "";
      try {
        dflt = resolveAgent({});
      } catch (e: any) {
        dfltError = e.message;
      }
      for (const [name, p] of Object.entries(allProfiles())) {
        const cmd = commandOf(name, p);
        const found = which(cmd);
        console.log(`${name === dflt?.name ? "*" : " "} ${name.padEnd(14)} ${p.protocol.padEnd(6)} ${[cmd, ...(p.args ?? [])].join(" ")}${p.model ? `  model=${p.model}` : ""}  [${p.source}${found ? "" : ", not installed"}]`);
      }
      console.log(`\n* default (${dflt?.reason ?? (dfltError || "none installed")}). Add profiles or set "default" in ${agentsFile()};`);
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
      if (!rest[0]) throw new Error("usage: nage start <flow> [--field value …] [json]");
      const { takeRunAgents } = await import("./agents.ts");
      const { agents, rest: args } = takeRunAgents(rest.slice(1));
      const { variables, title } = parseStartArgs(args);
      const r = await c.start(rest[0], variables, title, "cli", agents);
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
    case "install":
    case "uninstall": {
      const { install } = await import("./install.ts");
      const dryRun = rest.includes("--dry-run");
      install(rest.filter((a) => a !== "--dry-run")[0] ?? "", { remove: cmd === "uninstall", dryRun });
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
