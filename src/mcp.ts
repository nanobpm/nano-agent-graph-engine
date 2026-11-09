// MCP server: a thin client over the project's daemon (started on demand). Gives the
// Claude Code agent tools to author, run and inspect flows, answer user tasks (asking
// the person through an MCP elicitation dialog when the client supports it) and take
// "session" jobs a flow hands to the live agent.
import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkFile, checkProject, flowsDir, formatProblems, listFlowFiles } from "./compile.ts";
import { appHtml } from "./explorer-html.ts";
import { defaultHome } from "./paths.ts";
import { EngineClient } from "./client.ts";
import { summarize } from "./summary.ts";

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };
const text = (t: string, isError = false): Result => ({ content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));

const UI_URI = "ui://agent-graph/explorer.html";

const INSTRUCTIONS = `Agent Graph Engine: durable workflows ("flows") that orchestrate scripts, AI agent steps, the user (forms) and timers; they run in a local background engine and survive restarts.
Before writing or changing a flow, call flow_guide once. Write flows with flow_write, then fix every problem it reports. Start with flow_start and show progress with show_explorer.
When a flow waits for the user (task_list), use task_ask or show_explorer — never answer a user task yourself. When session_job_next has work (agent steps assigned to you), do it and hand back the result with session_job_complete.`;

/** flows/*.flow.ts are ES modules; say so, or Node warns when a parent package.json (e.g. ~/package.json) lacks "type". */
function ensureModuleType(dir: string) {
  const f = path.join(dir, "package.json");
  if (!fs.existsSync(f)) fs.writeFileSync(f, '{ "type": "module" }\n');
}

function guideText(): string {
  for (const rel of ["./guide.md", "../skills/agent-graph/SKILL.md"]) {
    const u = new URL(rel, import.meta.url);
    if (fs.existsSync(u)) return fs.readFileSync(u, "utf8").replace(/^---[\s\S]*?---\n/, "");
  }
  return "guide not found";
}

export function createServer(project: string): McpServer {
  const server = new McpServer({ name: "agent-graph-engine", version: "0.1.0" }, { instructions: INSTRUCTIONS });
  // One engine serves every project: the client scopes calls and explorer links to this one.
  const engine = () => EngineClient.connect(project);
  const guard =
    <A,>(fn: (a: A) => Promise<Result>) =>
    async (a: A): Promise<Result> => {
      try {
        return await fn(a);
      } catch (e: any) {
        return text(String(e?.message ?? e), true);
      }
    };

  server.registerTool(
    "flow_check",
    {
      title: "Compile and lint flows",
      description:
        "Compile every flows/*.flow.ts in the project to BPMN (with diagram layout) and lint it: missing handlers, forms or prompt files, unknown job types, and whatever the engine rejects. Run after every edit to a flow. The daemon deploys flows that pass automatically.",
      inputSchema: {},
    },
    guard(async () => {
      const r = await checkProject(project);
      if (!r.length) return text(`No flows yet. Create ${path.join(project, "flows")}/<name>.flow.ts (see the agent-graph skill).`);
      const bad = r.some((x) => x.problems.some((p) => p.severity === "error"));
      let reload = "";
      if (!bad) {
        const c = await engine();
        const d = await c.reload();
        const st = await c.state();
        reload =
          `\n\nlive: ${st.flows.map((f: any) => f.id).join(", ")}${d.deployed.length ? ` (new version: ${d.deployed.join(", ")})` : ""}` +
          `\nBPMN: ~/.agent-graph/compiled/<flow>.bpmn — explorer ${c.explorerUrl()}`;
      }
      return text(formatProblems(r) + reload, bad);
    }),
  );

  server.registerTool(
    "flow_guide",
    {
      title: "How to write flows",
      description: "The flow authoring guide: defineFlow steps, forms, agent tasks, examples. Read it before writing or changing a flow.",
      inputSchema: {},
    },
    guard(async () => text(`Project folder: ${project}\n\n${guideText()}`)),
  );

  server.registerTool(
    "flow_write",
    {
      title: "Write a flow",
      description:
        "Create or replace flows/<name>.flow.ts (TypeScript, see flow_guide) and any prompt files for its agent steps (flows/prompts/<file>), then compile + lint it. If it passes it is deployed at once. Fix every reported error and write again.",
      inputSchema: {
        name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).describe('File name without extension, e.g. "release-notes"'),
        source: z.string().describe("The full TypeScript source of the flow file"),
        prompts: z.record(z.string().regex(/^[\w.-]+$/), z.string()).optional().describe('Prompt files for agent steps: { "summarize.md": "…" }'),
      },
    },
    guard(async ({ name, source, prompts }) => {
      const dir = flowsDir(project);
      fs.mkdirSync(path.join(dir, "prompts"), { recursive: true });
      ensureModuleType(dir);
      for (const [f, body] of Object.entries(prompts ?? {})) fs.writeFileSync(path.join(dir, "prompts", f), body);
      const file = path.join(dir, `${name}.flow.ts`);
      fs.writeFileSync(file, source);
      const r = await checkFile(file);
      const bad = r.problems.some((p) => p.severity === "error");
      let tail = "";
      if (!bad) {
        await (await engine()).reload();
        tail = `\n\nDeployed: ${r.flows.map((f) => f.id).join(", ")}. Start it with flow_start; show it with show_explorer.`;
      }
      return text(`${formatProblems([r])}\nwritten ${path.relative(project, file)}${tail}`, bad);
    }),
  );

  server.registerTool(
    "flow_list",
    {
      title: "List flows",
      description:
        "List the flows in this project and the global ones (the library, ~/AgentGraph/flows, where Claude Desktop keeps its flows), with id, description, steps and whether they compile. Global flows can be started in any project with flow_start; use flow_import only to copy one here and change it.",
      inputSchema: {},
    },
    guard(async () => {
      const home = defaultHome();
      const places = [[project, "this project"], ...(path.resolve(home) !== path.resolve(project) ? [[home, "global (library)"]] : [])];
      const out: string[] = [];
      for (const [dir, label] of places) {
        out.push(`## ${label} (${flowsDir(dir)})`);
        const files = listFlowFiles(dir);
        if (!files.length) out.push("(none)");
        for (const f of files) {
          const r = await checkFile(f);
          const name = path.basename(f).replace(/\.flow\.\w+$/, "");
          const errs = r.problems.filter((p) => p.severity === "error").length;
          for (const fl of r.flows) {
            const steps = [...fl.tasks.map((t) => `${t.name}(${t.jobType})`), ...fl.humans.map((h) => `${h.name}(human)`), ...Object.keys(fl.handlers).map((h) => h.split(":").pop())];
            out.push(`- ${name}: flow "${fl.id}"${fl.description ? ` — ${fl.description}` : ""}\n  steps: ${steps.join(", ")}`);
          }
          if (!r.flows.length || errs) out.push(`- ${name}: ${errs} error(s)`);
        }
      }
      return text(out.join("\n"));
    }),
  );

  server.registerTool(
    "flow_import",
    {
      title: "Import a library flow",
      description: "Copy a global flow (and the prompt files it uses) from the library (~/AgentGraph) into this project's flows/ to customize it; the copy then replaces the global one in this project. Global flows can be started here without importing. Won't overwrite unless overwrite=true.",
      inputSchema: { name: z.string().describe("File name without .flow.ts, as shown by flow_list"), overwrite: z.boolean().optional() },
    },
    guard(async ({ name, overwrite }) => {
      const home = defaultHome();
      if (path.resolve(home) === path.resolve(project)) return text("This project is the library already.", true);
      const src = listFlowFiles(home).find((f) => path.basename(f).replace(/\.flow\.\w+$/, "") === name);
      if (!src) return text(`No library flow ${name} in ${flowsDir(home)}`, true);
      const dst = path.join(flowsDir(project), path.basename(src));
      if (fs.existsSync(dst) && !overwrite) return text(`${path.relative(project, dst)} exists; pass overwrite=true to replace it.`, true);
      fs.mkdirSync(path.join(flowsDir(project), "prompts"), { recursive: true });
      ensureModuleType(flowsDir(project));
      fs.copyFileSync(src, dst);
      const copied = [path.relative(project, dst)];
      const r0 = await checkFile(src);
      for (const fl of r0.flows)
        for (const t of fl.tasks)
          if (t.prompt) {
            const p = path.join(flowsDir(home), "prompts", t.prompt.resourceId);
            const q = path.join(flowsDir(project), "prompts", t.prompt.resourceId);
            if (fs.existsSync(p) && (overwrite || !fs.existsSync(q))) {
              fs.copyFileSync(p, q);
              copied.push(path.relative(project, q));
            }
          }
      const r = await checkFile(dst);
      const bad = r.problems.some((p) => p.severity === "error");
      if (!bad) await (await engine()).reload();
      return text(`copied ${copied.join(", ")}\n${formatProblems([r])}${bad ? "" : `\nDeployed here: ${r.flows.map((f) => f.id).join(", ")}`}`, bad);
    }),
  );

  server.registerTool(
    "flow_read",
    {
      title: "Read flow files",
      description: "List the flow files, or return the source of one (by file name without .flow.ts) and its prompt files.",
      inputSchema: { name: z.string().optional() },
    },
    guard(async ({ name }) => {
      const files = listFlowFiles(project);
      if (!name) return text(files.length ? files.map((f) => path.basename(f)).join("\n") : `No flows yet in ${flowsDir(project)}.`);
      const f = files.find((x) => path.basename(x).replace(/\.flow\.\w+$/, "") === name);
      if (!f) return text(`No flow file ${name}.flow.ts`, true);
      const pdir = path.join(flowsDir(project), "prompts");
      const prompts = fs.existsSync(pdir) ? fs.readdirSync(pdir).map((p) => `--- prompts/${p}\n${fs.readFileSync(path.join(pdir, p), "utf8")}`) : [];
      return text([`--- ${path.basename(f)}`, fs.readFileSync(f, "utf8"), ...prompts].join("\n"));
    }),
  );

  registerAppTool(
    server,
    "show_explorer",
    {
      title: "Show the flow explorer",
      description:
        "Show the user the live flow explorer: diagrams with where each run is, the task inbox with forms they can fill in, incidents, variables. Optionally focus a flow, an instance or a user task.",
      inputSchema: {
        flowId: z.string().optional(),
        instanceKey: z.string().optional(),
        taskKey: z.string().optional(),
      },
      _meta: { ui: { resourceUri: UI_URI } },
    },
    guard(async ({ flowId, instanceKey, taskKey }: { flowId?: string; instanceKey?: string; taskKey?: string }) => {
      const c = await engine();
      const hash = taskKey ? `task=${taskKey}` : instanceKey ? `instance=${instanceKey}` : flowId ? `flow=${flowId}` : "";
      const r: any = text(`${summarize(await c.state(), project)}\n\nShowing the explorer${hash ? ` (${hash})` : ""}. Also in a browser: ${c.explorerUrl(hash)}`);
      r.structuredContent = { hash, url: c.url, project };
      return r;
    }),
  );

  registerAppTool(
    server,
    "ui_api",
    {
      title: "Explorer API proxy",
      description: "Used by the explorer view to reach the engine.",
      inputSchema: { path: z.string(), body: z.any().optional() },
      _meta: { ui: { resourceUri: UI_URI, visibility: ["app"] } },
    },
    async ({ path: p, body }: { path: string; body?: unknown }) => {
      try {
        if (!/^\/api\/[\w/.-]*(\?[\w=&.%-]*)?$/.test(p) || p === "/api/shutdown") throw new Error("not allowed");
        const data = await (await engine()).call(p, body);
        return { content: [{ type: "text" as const, text: "ok" }], structuredContent: { data } };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: String(e?.message ?? e) }], structuredContent: { error: String(e?.message ?? e) }, isError: true };
      }
    },
  );

  registerAppResource(server, "Agent Graph explorer", UI_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{ uri: UI_URI, mimeType: RESOURCE_MIME_TYPE, text: appHtml(), _meta: { ui: { prefersBorder: true } } }],
  }));

  server.registerTool(
    "flow_status",
    {
      title: "Engine status",
      description:
        "Overview of the engine: the flows this project can start (its own and the global ones), and active instances, open user tasks, incidents and running jobs in every project (others marked [project]). Pass instanceKey for one instance in detail (variables, activity).",
      inputSchema: { instanceKey: z.string().optional() },
    },
    guard(async ({ instanceKey }) => {
      const c = await engine();
      if (instanceKey) return json(await c.instance(instanceKey));
      return text(`${summarize(await c.state(), project)}\n\nexplorer: ${c.explorerUrl()}`);
    }),
  );

  server.registerTool(
    "flow_start",
    {
      title: "Start a flow",
      description:
        "Start an instance of a flow in this project: one of its own flows/, or a global one from ~/AgentGraph/flows (it runs here, in this project). Returns the instance key; the engine runs it in the background (it keeps running after this session ends).",
      inputSchema: {
        flowId: z.string(),
        variables: z.record(z.string(), z.any()).optional().describe("Initial process variables"),
        title: z.string().optional().describe("Short label for this run, shown in the task list and explorer"),
      },
    },
    guard(async ({ flowId, variables, title }) => {
      const c = await engine();
      const r = await c.start(flowId, variables ?? {}, title);
      return text(`Started ${flowId} instance ${r.instanceKey}. Watch it at ${c.explorerUrl(`instance=${r.instanceKey}`)}`);
    }),
  );

  server.registerTool(
    "task_list",
    {
      title: "Open user tasks",
      description: "User tasks (human steps) waiting for an answer in any project (each says its project), with their forms and the instance variables they show.",
      inputSchema: {},
    },
    guard(async () => {
      const s = await (await engine()).state();
      if (!s.userTasks.length) return text("No user tasks waiting.");
      return json(s.userTasks.map((t: any) => ({ ...t, variables: undefined })));
    }),
  );

  server.registerTool(
    "task_ask",
    {
      title: "Ask the user a task's form",
      description:
        "Show a waiting user task's form to the person in a dialog and complete the task with their answer. This is how a flow's human step reaches the user. If the client can't show dialogs, the form is returned: ask the user yourself, then call task_complete. Never answer a human step on the user's behalf.",
      inputSchema: { taskKey: z.string() },
    },
    guard(async ({ taskKey }) => {
      const c = await engine();
      const s = await c.state();
      const t = s.userTasks.find((u: any) => u.key === taskKey);
      if (!t) return text(`No open user task ${taskKey}`, true);
      const form = t.form ?? { title: `${t.flowId}: ${t.elementId}`, fields: { response: { type: "string", title: "Your answer" } }, required: ["response"] };
      const message = [form.title, form.description].filter(Boolean).join("\n\n") + (t.title ? `\n\n(${t.flowId} — ${t.title})` : "");
      if (!server.server.getClientCapabilities()?.elicitation) {
        return text(
          `This client can't show a form dialog. Ask the user, then call task_complete with taskKey ${taskKey}.\n\n${message}\n\nFields: ${JSON.stringify(form.fields, null, 2)}${form.required ? `\nRequired: ${form.required.join(", ")}` : ""}\n\nOr answer in the explorer: ${c.explorerUrl(`task=${taskKey}`)}`,
        );
      }
      const r = await server.server.elicitInput({
        mode: "form",
        message,
        requestedSchema: { type: "object", properties: form.fields, required: form.required },
      } as any);
      if (r.action !== "accept") return text(`The user ${r.action === "decline" ? "declined" : "dismissed"} the form; task ${taskKey} is still open.`);
      await c.completeTask(taskKey, r.content ?? {});
      return text(`Task ${taskKey} completed with ${JSON.stringify(r.content)}. The flow continues.`);
    }),
  );

  server.registerTool(
    "task_complete",
    {
      title: "Complete a user task",
      description: "Complete a waiting user task with the variables the user gave (field names from the task's form). Only with the user's actual answer.",
      inputSchema: { taskKey: z.string(), variables: z.record(z.string(), z.any()) },
    },
    guard(async ({ taskKey, variables }) => {
      await (await engine()).completeTask(taskKey, variables);
      return text(`Task ${taskKey} completed.`);
    }),
  );

  server.registerTool(
    "session_job_next",
    {
      title: "Take a job meant for this session",
      description:
        'Claim the next agent step a flow assigned to you, the live assistant: w.task steps with jobType "session", and jobType "claude" steps when no Claude Code CLI is installed. Returns the step\'s prompt, variables and (if any) outputSchema; do the work, then call session_job_complete with the result as variables (matching outputSchema), or session_job_fail. With max > 1 you get a batch (e.g. the branches of a parallel/forEach fan-out): hand each to a subagent if you have them, and complete each job by its key.',
      inputSchema: {
        jobType: z.string().optional().describe("Default: every job type meant for you"),
        max: z.number().int().min(1).max(20).optional().describe("Claim up to this many at once (default 1)"),
      },
    },
    guard(async ({ jobType, max }) => {
      // Only this project's runs: the work happens in this session's folder.
      const jobs = await (await engine()).claimJobs(jobType, max ?? 1);
      if (!jobs.length) return text("No session jobs waiting.");
      return json(max && max > 1 ? jobs : jobs[0]);
    }),
  );

  server.registerTool(
    "session_job_complete",
    {
      title: "Complete a session job",
      description: "Hand a claimed session job's result back to its flow as variables.",
      inputSchema: { jobKey: z.string(), variables: z.record(z.string(), z.any()) },
    },
    guard(async ({ jobKey, variables }) => {
      await (await engine()).completeJob(jobKey, variables);
      return text(`Job ${jobKey} completed.`);
    }),
  );

  server.registerTool(
    "session_job_fail",
    {
      title: "Fail a session job",
      description: "Report that a claimed job can't be done. With retries left it goes back in the queue; at 0 it becomes an incident.",
      inputSchema: { jobKey: z.string(), message: z.string(), retries: z.number().int().min(0).optional() },
    },
    guard(async ({ jobKey, message, retries }) => {
      await (await engine()).failJob(jobKey, message, retries);
      return text(`Job ${jobKey} failed: ${message}`);
    }),
  );

  server.registerTool(
    "flow_operate",
    {
      title: "Operate instances",
      description:
        "retry: resolve an incident and retry its job (after fixing the cause). cancel: cancel an instance. message: correlate a message (w.signal steps) by name + correlationKey.",
      inputSchema: {
        action: z.enum(["retry", "cancel", "message"]),
        incidentKey: z.string().optional(),
        instanceKey: z.string().optional(),
        name: z.string().optional(),
        correlationKey: z.string().optional(),
        variables: z.record(z.string(), z.any()).optional(),
      },
    },
    guard(async (a) => {
      const c = await engine();
      if (a.action === "retry") {
        if (!a.incidentKey) return text("incidentKey required", true);
        await c.resolveIncident(a.incidentKey);
        return text(`Incident ${a.incidentKey} resolved; the job is retried.`);
      }
      if (a.action === "cancel") {
        if (!a.instanceKey) return text("instanceKey required", true);
        await c.cancel(a.instanceKey);
        return text(`Instance ${a.instanceKey} cancelled.`);
      }
      if (!a.name) return text("name required", true);
      await c.message(a.name, a.correlationKey ?? "", a.variables ?? {});
      return text(`Message ${a.name} sent.`);
    }),
  );

  // Prompts: one "start <flow>" per flow in the project (slash commands in Claude Code,
  // the prompt menu in Claude Desktop, commands in other MCP clients), plus "flows".
  server.registerPrompt(
    "flows",
    { title: "Agent Graph: what's going on", description: "Show running flows, tasks waiting for you, agent steps waiting for this session, and incidents" },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Show me what's going on in my Agent Graph flows: call flow_status, then task_list and session_job_next. If tasks wait for me, ask me with task_ask. If agent steps wait for this session, do them. Offer to open show_explorer.",
          },
        },
      ],
    }),
  );
  const flowPrompts = new Map<string, ReturnType<McpServer["registerPrompt"]>>();
  (server as any).syncFlowPrompts = async () => {
    const seen = new Set<string>();
    for (const f of listFlowFiles(project)) {
      let r;
      try {
        r = await checkFile(f);
      } catch {
        continue;
      }
      for (const fl of r.flows) {
        const name = `start-${fl.id}`;
        seen.add(name);
        if (flowPrompts.has(name)) continue;
        const steps = [...fl.tasks.map((t) => t.name), ...fl.humans.map((h) => h.name)].join(", ");
        flowPrompts.set(
          name,
          server.registerPrompt(
            name,
            {
              title: `Start flow: ${fl.id}`,
              description: fl.description || `Start the ${fl.id} flow (steps: ${steps})`,
              argsSchema: { inputs: z.string().optional().describe("What to run it on: plain words or JSON variables") },
            },
            ({ inputs }) => ({
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: `Start the Agent Graph flow "${fl.id}"${fl.description ? ` (${fl.description})` : ""}.${inputs ? `\nInputs: ${inputs}` : ""}\nWork out the start variables the flow reads (flow_read "${fl.id}" if unsure; ask me only for what's missing and can't be inferred), call flow_start with a short title, then show_explorer for the new instance. If agent steps come to this session (session_job_next), do them.`,
                  },
                },
              ],
            }),
          ),
        );
      }
    }
    for (const [name, p] of flowPrompts) if (!seen.has(name)) (p.remove(), flowPrompts.delete(name));
  };

  return server;
}

/** Keep the per-flow prompts in step with flows/ (long-lived stdio sessions only). */
function watchFlowPrompts(server: McpServer, project: string) {
  const sync = () => (server as any).syncFlowPrompts().catch(() => {});
  let t: NodeJS.Timeout | undefined;
  try {
    fs.mkdirSync(flowsDir(project), { recursive: true });
    fs.watch(flowsDir(project), () => {
      clearTimeout(t);
      t = setTimeout(sync, 300);
    }).unref();
  } catch {}
}

export async function runMcp(project: string) {
  const server = createServer(project);
  // list the per-flow prompts before connecting: some clients (OpenCode) read prompts once at startup
  await Promise.race([(server as any).syncFlowPrompts().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
  await server.connect(new StdioServerTransport());
  watchFlowPrompts(server, project);
}

/** Streamable HTTP (stateless) for MCP Apps hosts and inspectors: `age mcp --http 3001`. */
export async function runMcpHttp(project: string, port: number) {
  const http = await import("node:http");
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
  http
    .createServer(async (req, res) => {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "*");
      res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
      res.setHeader("access-control-expose-headers", "mcp-session-id");
      if (req.method === "OPTIONS") return res.end();
      if (!req.url?.startsWith("/mcp")) return res.writeHead(404).end();
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
      const server = createServer(project);
      if (String(body?.method ?? "").startsWith("prompts/")) await (server as any).syncFlowPrompts().catch(() => {});
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    })
    .listen(port, "127.0.0.1", () => console.error(`agent-graph MCP on http://127.0.0.1:${port}/mcp`));
}
