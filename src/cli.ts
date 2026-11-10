#!/usr/bin/env node
// age — Agent Graph Engine CLI. Also the entry the daemon, the MCP server and the
// Claude Code hooks run through.
import { spawn } from "node:child_process";
import path from "node:path";
import { addTypeProblems, checkFile, checkProject, formatProblems } from "./compile.ts";
import { resolveProject } from "./paths.ts";
import { EngineClient } from "./client.ts";
import { summarize } from "./summary.ts";
import { parseStartArgs } from "./input.ts";

const HELP = `age — Agent Graph Engine

  age check [file] [--json]     type-check, compile and lint flows/*.flow.ts (or one file);
                                exit code 1 on errors. Writes nothing. --no-types skips tsc
  age up                        start the engine (one per user) if needed, print its URL
  age down                      stop the engine
  age status                    flows here; runs, open tasks, incidents in every project
  age start <flow> [--field value …] [json] [--title t] [--agent [step=]cli] [--model [step=]m]
                                start an instance: input fields as flags (or name=value),
                                and/or a JSON object; the engine converts and checks them.
                                --agent/--model override who runs agent steps, this run only
  age tasks                     open user tasks
  age complete <task> [json]    complete a user task
  age open [view]               open the explorer in the browser (view: instance=K, task=K, flow=ID,
                                or a route like /instances); prints the URL
  age agent [list]              agent profiles (which CLI runs agent steps) and the default
  age agent default <name>      set the default profile (~/.agent-graph/agents.json)
  age agent show <flow>         the flow's agent steps: who runs each, and why
  age agent assign <flow>[/<step>] <cli|-> [--model m]
                                run a flow's (or one step's) agent steps on your CLI/model,
                                for every run from now on ("-": keep the CLI, set the model)
  age agent assign --rank <rank> <cli>   who serves <rank>:* steps (e.g. senior → claude)
  age agent unassign <flow>[/<step>] | --rank <rank>
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
      const json = rest.includes("--json");
      const file = rest.find((a) => !a.startsWith("--"));
      const r = file ? [await checkFile(path.resolve(file))] : await checkProject(project);
      const typed = rest.includes("--no-types") || addTypeProblems(r);
      if (json)
        console.log(JSON.stringify({ ok: !r.some((x) => x.problems.some((p) => p.severity === "error")), typesChecked: typed && !rest.includes("--no-types"), files: r.map((x) => ({ file: x.file, flows: x.flows.map((f) => ({ id: f.id, input: f.input })), problems: x.problems })) }, null, 2));
      else if (!r.length) console.log(`no flows in ${path.join(project, "flows")}`);
      else console.log(formatProblems(r) + (typed ? "" : "\n(type check skipped: dist/typecheck missing — rebuild the plugin)"));
      process.exitCode = r.some((x) => x.problems.some((p) => p.severity === "error")) ? 1 : 0;
      return;
    }
    case "agent": {
      const { allProfiles, readAgentsFile, writeAgentsFile, agentsFile, commandOf, which, resolveAgent } = await import("./agents.ts");
      if (rest[0] === "show") {
        if (!rest[1]) throw new Error("usage: age agent show <flow>");
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
        const usage = "usage: age agent assign <flow>[/<step>] <cli|-> [--model m] | --rank <rank> <cli>; age agent unassign <flow>[/<step>] | --rank <rank>";
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
      if (!rest[0]) throw new Error("usage: age start <flow> [--field value …] [json]");
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
