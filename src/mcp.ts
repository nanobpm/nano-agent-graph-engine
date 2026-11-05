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
import { api, ensureDaemon } from "./paths.ts";
import { summarize } from "./summary.ts";

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };
const text = (t: string, isError = false): Result => ({ content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));

const UI_URI = "ui://agent-graph/explorer.html";

const INSTRUCTIONS = `Agent Graph Engine: durable workflows ("flows") that orchestrate scripts, AI agent steps, the user (forms) and timers; they run in a local background engine and survive restarts.
Before writing or changing a flow, call flow_guide once. Write flows with flow_write, then fix every problem it reports. Start with flow_start and show progress with show_explorer.
When a flow waits for the user (task_list), use task_ask or show_explorer — never answer a user task yourself. When session_job_next has work (agent steps assigned to you), do it and hand back the result with session_job_complete.`;

function guideText(): string {
  for (const rel of ["./guide.md", "../skills/agent-graph/SKILL.md"]) {
    const u = new URL(rel, import.meta.url);
    if (fs.existsSync(u)) return fs.readFileSync(u, "utf8").replace(/^---[\s\S]*?---\n/, "");
  }
  return "guide not found";
}

export function createServer(project: string): McpServer {
  const server = new McpServer({ name: "agent-graph-engine", version: "0.1.0" }, { instructions: INSTRUCTIONS });
  const daemon = () => ensureDaemon(project);
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
        const info = await daemon();
        const d = await api(info, "/api/reload", {});
        const st = await api(info, "/api/state");
        reload =
          `\n\nlive: ${st.flows.map((f: any) => f.id).join(", ")}${d.deployed.length ? ` (new version: ${d.deployed.join(", ")})` : ""}` +
          `\nBPMN: .agent-graph/compiled/<flow>.bpmn — explorer ${info.url}`;
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
      for (const [f, body] of Object.entries(prompts ?? {})) fs.writeFileSync(path.join(dir, "prompts", f), body);
      const file = path.join(dir, `${name}.flow.ts`);
      fs.writeFileSync(file, source);
      const r = await checkFile(file);
      const bad = r.problems.some((p) => p.severity === "error");
      let tail = "";
      if (!bad) {
        const info = await daemon();
        await api(info, "/api/reload", {});
        tail = `\n\nDeployed: ${r.flows.map((f) => f.id).join(", ")}. Start it with flow_start; show it with show_explorer.`;
      }
      return text(`${formatProblems([r])}\nwritten ${path.relative(project, file)}${tail}`, bad);
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
      const info = await daemon();
      const hash = taskKey ? `task=${taskKey}` : instanceKey ? `instance=${instanceKey}` : flowId ? `flow=${flowId}` : "";
      const r: any = text(`${summarize(await api(info, "/api/state"))}\n\nShowing the explorer${hash ? ` (${hash})` : ""}. Also in a browser: ${info.url}/${hash ? `#${hash}` : ""}`);
      r.structuredContent = { hash, url: info.url };
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
        if (!/^\/api\/[\w/.-]*$/.test(p) || p === "/api/shutdown") throw new Error("not allowed");
        const data = await api(await daemon(), p, body);
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
        "Overview of the project's engine: deployed flows, active instances and where they wait, open user tasks, session jobs, incidents, running jobs. Pass instanceKey for one instance in detail (variables, activity).",
      inputSchema: { instanceKey: z.string().optional() },
    },
    guard(async ({ instanceKey }) => {
      const info = await daemon();
      if (instanceKey) return json(await api(info, `/api/instances/${instanceKey}`));
      return text(`${summarize(await api(info, "/api/state"))}\n\nexplorer: ${info.url}`);
    }),
  );

  server.registerTool(
    "flow_start",
    {
      title: "Start a flow",
      description: "Start an instance of a deployed flow. Returns the instance key; the daemon runs it in the background (it keeps running after this session ends).",
      inputSchema: {
        flowId: z.string(),
        variables: z.record(z.string(), z.any()).optional().describe("Initial process variables"),
        title: z.string().optional().describe("Short label for this run, shown in the task list and explorer"),
      },
    },
    guard(async ({ flowId, variables, title }) => {
      const info = await daemon();
      const r = await api(info, "/api/start", { flowId, variables: variables ?? {}, title });
      return text(`Started ${flowId} instance ${r.instanceKey}. Watch it at ${info.url}/#instance=${r.instanceKey}`);
    }),
  );

  server.registerTool(
    "task_list",
    {
      title: "Open user tasks",
      description: "User tasks (human steps) waiting for an answer, with their forms and the instance variables they show.",
      inputSchema: {},
    },
    guard(async () => {
      const s = await api(await daemon(), "/api/state");
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
      const info = await daemon();
      const s = await api(info, "/api/state");
      const t = s.userTasks.find((u: any) => u.key === taskKey);
      if (!t) return text(`No open user task ${taskKey}`, true);
      const form = t.form ?? { title: `${t.flowId}: ${t.elementId}`, fields: { response: { type: "string", title: "Your answer" } }, required: ["response"] };
      const message = [form.title, form.description].filter(Boolean).join("\n\n") + (t.title ? `\n\n(${t.flowId} — ${t.title})` : "");
      if (!server.server.getClientCapabilities()?.elicitation) {
        return text(
          `This client can't show a form dialog. Ask the user, then call task_complete with taskKey ${taskKey}.\n\n${message}\n\nFields: ${JSON.stringify(form.fields, null, 2)}${form.required ? `\nRequired: ${form.required.join(", ")}` : ""}\n\nOr answer in the explorer: ${info.url}/#task=${taskKey}`,
        );
      }
      const r = await server.server.elicitInput({
        mode: "form",
        message,
        requestedSchema: { type: "object", properties: form.fields, required: form.required },
      } as any);
      if (r.action !== "accept") return text(`The user ${r.action === "decline" ? "declined" : "dismissed"} the form; task ${taskKey} is still open.`);
      await api(info, `/api/user-tasks/${taskKey}/complete`, { variables: r.content ?? {} });
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
      await api(await daemon(), `/api/user-tasks/${taskKey}/complete`, { variables });
      return text(`Task ${taskKey} completed.`);
    }),
  );

  server.registerTool(
    "session_job_next",
    {
      title: "Take a job meant for this session",
      description:
        'Claim the next agent step a flow assigned to you, the live assistant: w.task steps with jobType "session", and jobType "claude" steps when no Claude Code CLI is installed. Returns the step\'s prompt, variables and (if any) outputSchema; do the work, then call session_job_complete with the result as variables (matching outputSchema), or session_job_fail.',
      inputSchema: { jobType: z.string().optional().describe("Default: every job type meant for you") },
    },
    guard(async ({ jobType }) => {
      const jobs = await api(await daemon(), "/api/jobs/claim", { type: jobType, max: 1 });
      if (!jobs.length) return text("No session jobs waiting.");
      return json(jobs[0]);
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
      await api(await daemon(), `/api/jobs/${jobKey}/complete`, { variables });
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
      await api(await daemon(), `/api/jobs/${jobKey}/fail`, { message, retries });
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
      const info = await daemon();
      if (a.action === "retry") {
        if (!a.incidentKey) return text("incidentKey required", true);
        await api(info, `/api/incidents/${a.incidentKey}/resolve`, {});
        return text(`Incident ${a.incidentKey} resolved; the job is retried.`);
      }
      if (a.action === "cancel") {
        if (!a.instanceKey) return text("instanceKey required", true);
        await api(info, `/api/instances/${a.instanceKey}/cancel`, {});
        return text(`Instance ${a.instanceKey} cancelled.`);
      }
      if (!a.name) return text("name required", true);
      await api(info, "/api/messages", { name: a.name, correlationKey: a.correlationKey ?? "", variables: a.variables ?? {} });
      return text(`Message ${a.name} sent.`);
    }),
  );

  return server;
}

export async function runMcp(project: string) {
  const server = createServer(project);
  await server.connect(new StdioServerTransport());
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
