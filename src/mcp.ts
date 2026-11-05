// MCP server: a thin client over the project's daemon (started on demand). Gives the
// Claude Code agent tools to author, run and inspect flows, answer user tasks (asking
// the person through an MCP elicitation dialog when the client supports it) and take
// "session" jobs a flow hands to the live agent.
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkProject, formatProblems } from "./compile.ts";
import { api, ensureDaemon } from "./paths.ts";
import { summarize } from "./summary.ts";

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };
const text = (t: string, isError = false): Result => ({ content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));

export function createServer(project: string): McpServer {
  const server = new McpServer({ name: "agent-graph-engine", version: "0.1.0" });
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
        'Claim the next job a flow assigned to the live Claude Code session (steps declared w.task(name, { jobType: "session" })). Returns the job\'s prompt and variables; do the work, then call session_job_complete with the result variables (or session_job_fail).',
      inputSchema: { jobType: z.string().optional().describe('Default "session"') },
    },
    guard(async ({ jobType }) => {
      const jobs = await api(await daemon(), "/api/jobs/claim", { type: jobType ?? "session", max: 1 });
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
