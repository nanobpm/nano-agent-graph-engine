// The Agent Graph Engine daemon: one per project. Hosts the WASM engine, keeps its
// event log on disk (replayed on start), runs job workers, ticks timers, and serves
// the HTTP API + web explorer on 127.0.0.1.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { checkProject, flowsDir, type CompiledFlow, type Problem } from "./compile.ts";
import { claude } from "./index.ts";
import { newEngine, type TestEngine } from "./wasm.ts";
import { stateDir, type DaemonInfo } from "./paths.ts";
import { explorerHtml } from "./explorer-html.ts";
import * as explorer from "./explorer-api.ts";

const WORKER = "age-daemon";
const TICK_MS = 500;
const MAX_CONCURRENT = Number(process.env.AGE_MAX_CONCURRENT ?? 4);

interface Activity {
  at: string;
  kind: string;
  instanceKey?: string;
  elementId?: string;
  message: string;
  costUsd?: number;
}

export class Host {
  readonly project: string;
  readonly dir: string;
  engine: TestEngine;
  flows = new Map<string, CompiledFlow>();
  problems: { file: string; problems: Problem[] }[] = [];
  running = new Map<string, { type: string; elementId: string; instanceKey: string; since: number }>();
  backoff = new Map<string, number>();
  activity: Activity[] = [];
  instanceMeta: Record<string, { flowId: string; startedAt: string; title?: string }> = {};
  deployed: Record<string, string> = {};
  /** Who runs `jobType: "claude"` agent tasks: a headless `claude -p` ("cli"), or the
   *  chat/session agent through session_job_next ("session"). */
  agentMode: "cli" | "session" = agentMode();
  private dirty = false;
  private timer?: NodeJS.Timeout;

  constructor(project: string) {
    this.project = path.resolve(project);
    this.dir = stateDir(this.project);
    fs.mkdirSync(path.join(this.dir, "compiled"), { recursive: true });
    this.engine = newEngine();
    const journal = path.join(this.dir, "journal.json");
    if (fs.existsSync(journal)) {
      this.engine.replayEvents(fs.readFileSync(journal, "utf8"));
      this.log({ kind: "daemon", message: `replayed event log (${this.snapshot().eventCount} events)` });
    }
    this.deployed = this.readJson("deployed.json", {});
    this.instanceMeta = this.readJson("instances.json", {});
    this.activity = this.readJson("activity.json", []);
    this.engine.tickNow(Date.now());
    this.releaseOrphanedJobs();
  }

  private readJson<T>(name: string, dflt: T): T {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.dir, name), "utf8"));
    } catch {
      return dflt;
    }
  }

  private writeAtomic(name: string, data: string) {
    const p = path.join(this.dir, name);
    fs.writeFileSync(`${p}.tmp`, data);
    fs.renameSync(`${p}.tmp`, p);
  }

  /** Write the event log and side tables. The journal is the source of truth. */
  persist() {
    if (!this.dirty) return;
    this.dirty = false;
    this.writeAtomic("journal.json", this.engine.events());
    this.writeAtomic("deployed.json", JSON.stringify(this.deployed));
    this.writeAtomic("instances.json", JSON.stringify(this.instanceMeta));
    this.writeAtomic("activity.json", JSON.stringify(this.activity.slice(-500)));
  }

  /** Mark state changed; persisted at the end of the current tick / request. */
  touch() {
    this.dirty = true;
  }

  log(a: Omit<Activity, "at">) {
    this.activity.push({ at: new Date().toISOString(), ...a });
    if (this.activity.length > 1000) this.activity.splice(0, this.activity.length - 500);
    this.touch();
  }

  snapshot(): any {
    return JSON.parse(this.engine.snapshot());
  }

  /** Jobs a previous daemon had activated but never finished: hand them back out. */
  private releaseOrphanedJobs() {
    for (const j of this.snapshot().jobs ?? []) {
      if (j.state === "Activated" && j.jobType !== "session" && !(this.agentMode === "session" && j.jobType === "claude")) {
        try {
          this.engine.failJob(j.key, j.retries, "daemon restarted while the job ran; retrying");
          this.touch();
        } catch {
          /* already gone */
        }
      }
    }
  }

  /** Compile flows/ and deploy every flow whose BPMN changed. */
  async reload(): Promise<{ deployed: string[]; problems: Host["problems"] }> {
    const results = await checkProject(this.project);
    this.problems = results.filter((r) => r.problems.length).map((r) => ({ file: path.relative(this.project, r.file), problems: r.problems }));
    const deployed: string[] = [];
    const flows = new Map<string, CompiledFlow>();
    for (const r of results) {
      if (r.problems.some((p) => p.severity === "error")) continue;
      for (const f of r.flows) {
        flows.set(f.id, f);
        fs.writeFileSync(path.join(this.dir, "compiled", `${f.id}.bpmn`), f.xml);
        const hash = crypto.createHash("sha256").update(f.xml).digest("hex");
        if (this.deployed[f.id] !== hash) {
          this.engine.deploy(f.xml);
          this.deployed[f.id] = hash;
          deployed.push(f.id);
          this.log({ kind: "deploy", message: `deployed flow ${f.id}` });
        }
      }
    }
    // Keep handlers of flows that failed to compile this time, so running instances continue.
    for (const [id, f] of this.flows) if (!flows.has(id)) flows.set(id, f);
    this.flows = flows;
    this.touch();
    this.persist();
    return { deployed, problems: this.problems };
  }

  start(flowId: string, variables: Record<string, unknown> = {}, title?: string): string {
    if (!this.flows.has(flowId) && !this.deployed[flowId]) throw new Error(`unknown flow "${flowId}"`);
    const s = JSON.parse(this.engine.createInstance(flowId, JSON.stringify(variables)));
    const key = String(s.created);
    this.instanceMeta[key] = { flowId, startedAt: new Date().toISOString(), title };
    this.log({ kind: "start", instanceKey: key, message: `started ${flowId}${title ? ` — ${title}` : ""}` });
    this.persist();
    return key;
  }

  /** Every job type this daemon serves itself. */
  private servedTypes(): string[] {
    const types = new Set<string>(this.agentMode === "cli" ? ["claude"] : []);
    for (const f of this.flows.values()) for (const t of Object.keys(f.handlers)) types.add(t);
    return [...types];
  }

  private handlerFor(type: string): ((job: any) => unknown) | undefined {
    for (const f of this.flows.values()) if (f.handlers[type]) return f.handlers[type];
    return undefined;
  }

  tick() {
    try {
      const before = this.snapshot();
      this.engine.tickNow(Date.now());
      const after = this.snapshot();
      if (after.eventCount !== before.eventCount) this.touch();
      for (const type of this.servedTypes()) {
        const free = MAX_CONCURRENT - this.running.size;
        if (free <= 0) break;
        const now = Date.now();
        const waiting = (after.jobs ?? []).some(
          (j: any) => j.jobType === type && j.state === "Created" && (this.backoff.get(j.key) ?? 0) <= now,
        );
        if (!waiting) continue;
        const lockMs = type === "claude" ? 60 * 60_000 : 30 * 60_000;
        const jobs = JSON.parse(this.engine.activateJobs(type, free, lockMs, WORKER));
        if (jobs.length) this.touch();
        for (const job of jobs) {
          if ((this.backoff.get(job.key) ?? 0) > now) {
            this.engine.failJob(job.key, job.retries, "backing off");
            continue;
          }
          this.runJob(job);
        }
      }
    } catch (e: any) {
      this.log({ kind: "error", message: `tick: ${e?.message ?? e}` });
    }
    this.persist();
  }

  private async runJob(job: any) {
    const key = String(job.key);
    this.running.set(key, { type: job.type, elementId: job.elementId, instanceKey: job.instanceKey, since: Date.now() });
    this.log({ kind: "job", instanceKey: job.instanceKey, elementId: job.elementId, message: `running ${job.elementId} (${job.type})` });
    const vjob = {
      jobKey: key,
      processInstanceKey: String(job.instanceKey),
      elementId: job.elementId,
      type: job.type,
      variables: job.variables ?? {},
    };
    try {
      let vars: Record<string, unknown> = {};
      let costUsd: number | undefined;
      if (job.type === "claude") {
        const r = await this.runAgent(job);
        vars = r.vars;
        costUsd = r.costUsd;
      } else {
        const h = this.handlerFor(job.type);
        if (!h) throw new Error(`no handler for ${job.type}`);
        const out = await h(vjob);
        if (out && typeof out === "object") vars = out as Record<string, unknown>;
      }
      this.engine.completeJob(key, JSON.stringify(vars));
      this.log({ kind: "done", instanceKey: job.instanceKey, elementId: job.elementId, message: `completed ${job.elementId}`, costUsd });
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 4000);
      if (job.type === "claude" && process.env.AGE_AGENT_MODE !== "cli" && /401|authenticat|not logged in|ENOENT/i.test(msg)) {
        // The Claude Code CLI can't run here (missing or logged out): hand agent steps to
        // the chat/session assistant instead of burning retries.
        this.agentMode = "session";
        try {
          this.engine.failJob(key, job.retries ?? 3, "handed to the session assistant");
        } catch {
          /* gone */
        }
        this.log({ kind: "retry", instanceKey: job.instanceKey, elementId: job.elementId, message: `claude CLI unavailable (${msg.slice(0, 160)}); agent steps now go to the chat assistant (session_job_next)` });
        return;
      }
      const retries = Math.max(0, (job.retries ?? 1) - 1);
      try {
        this.engine.failJob(key, retries, msg);
        if (retries > 0) this.backoff.set(key, Date.now() + Number(process.env.AGE_BACKOFF_MS ?? 5_000) * 2 ** (3 - Math.min(3, retries)));
      } catch {
        /* job vanished (instance cancelled) */
      }
      this.log({
        kind: retries ? "retry" : "incident",
        instanceKey: job.instanceKey,
        elementId: job.elementId,
        message: `${job.elementId} failed${retries ? `, ${retries} retries left` : " — incident raised"}: ${msg.slice(0, 500)}`,
      });
    } finally {
      this.running.delete(key);
      this.persist();
    }
  }

  /** Built-in "claude" worker: prompt file + variables → headless Claude Code. */
  private async runAgent(job: any): Promise<{ vars: Record<string, unknown>; costUsd?: number }> {
    const flow = this.flows.get(job.bpmnProcessId);
    const task = flow?.tasks.find((t) => t.name === job.elementId);
    if (!flow || !task?.prompt) throw new Error(`no prompt bound to ${job.bpmnProcessId}/${job.elementId}`);
    const promptFile = path.join(flow.projectDir, "flows", "prompts", task.prompt.resourceId);
    const opts = flow.agents[task.name] ?? {};
    const vars = job.variables ?? {};
    const ctx = opts.context ? Object.fromEntries(opts.context.map((k) => [k, vars[k]])) : vars;
    const prompt =
      `${fs.readFileSync(promptFile, "utf8").trim()}\n\n## Context (process variables)\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n` +
      (vars.appendPrompt ? `\n${vars.appendPrompt}\n` : "");
    const { context: _c, ...claudeOpts } = opts;
    const r = await claude<unknown>(prompt, { ...claudeOpts, cwd: this.project });
    let out: unknown = r.result;
    if (typeof out === "string") {
      const m = out.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ?? out.match(/^\s*(\{[\s\S]*\})\s*$/);
      if (m) {
        try {
          out = JSON.parse(m[1]);
        } catch {
          /* keep text */
        }
      }
    }
    const result = out && typeof out === "object" && !Array.isArray(out) ? (out as Record<string, unknown>) : { [`${task.name}Result`]: out };
    return { vars: result, costUsd: r.costUsd };
  }

  // ---------- read model for the API / MCP / UI ----------

  userTaskView(t: any, snap: any) {
    const inst = (snap.instances ?? []).find((i: any) => i.key === t.instanceKey);
    const flowId = inst?.processId ?? this.instanceMeta[t.instanceKey]?.flowId;
    const flow = flowId ? this.flows.get(flowId) : undefined;
    const human = flow?.humans.find((h) => h.name === t.elementId);
    const form = human ? flow?.forms[human.form] : undefined;
    const variables = inst?.variables ?? {};
    const fill = (s?: string) => s?.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => {
      const v = variables[k];
      return v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v, null, 2);
    });
    return {
      key: t.key,
      instanceKey: t.instanceKey,
      flowId,
      elementId: t.elementId,
      title: this.instanceMeta[t.instanceKey]?.title,
      formId: human?.form,
      form: form ? { ...form, title: fill(form.title), description: fill(form.description) } : undefined,
      variables,
    };
  }

  state() {
    const snap = this.snapshot();
    const instances = (snap.instances ?? []).map((i: any) => ({
      ...this.instanceMeta[i.key],
      key: i.key,
      flowId: i.processId,
      state: i.state,
      completed: i.completed,
      activeElements: (i.activeElements ?? []).map((a: any) => a.elementId),
    }));
    return {
      project: this.project,
      now: snap.now,
      eventCount: snap.eventCount,
      flows: [...this.flows.values()].map((f) => ({
        id: f.id,
        file: path.relative(this.project, f.file),
        description: f.description,
        humans: f.humans,
        tasks: f.tasks.map((t) => ({ name: t.name, jobType: t.jobType, agent: t.agent })),
      })),
      problems: this.problems,
      instances,
      userTasks: (snap.userTasks ?? []).filter((t: any) => t.state === "Created").map((t: any) => this.userTaskView(t, snap)),
      agentMode: this.agentMode,
      sessionJobs: (snap.jobs ?? []).filter((j: any) => j.jobType === "session" || (this.agentMode === "session" && j.jobType === "claude")),
      jobs: snap.jobs ?? [],
      running: [...this.running.entries()].map(([key, r]) => ({ key, ...r })),
      incidents: snap.incidents ?? [],
      timers: snap.timers ?? [],
      messageSubscriptions: snap.messageSubscriptions ?? [],
      activity: this.activity.slice(-100),
    };
  }

  instance(key: string) {
    const snap = this.snapshot();
    const inst = (snap.instances ?? []).find((i: any) => i.key === key);
    if (!inst) throw new Error(`no instance ${key}`);
    return {
      ...inst,
      ...this.instanceMeta[key],
      incidents: (snap.incidents ?? []).filter((i: any) => i.instanceKey === key),
      userTasks: (snap.userTasks ?? []).filter((t: any) => t.instanceKey === key && t.state === "Created").map((t: any) => this.userTaskView(t, snap)),
      jobs: (snap.jobs ?? []).filter((j: any) => j.instanceKey === key),
      activity: this.activity.filter((a) => a.instanceKey === key).slice(-50),
    };
  }

  /** What an instance did, from the engine's event log: completed elements (with
   *  counts, for loops), sequence flows taken, and a timeline. */
  history(key: string) {
    const k = Number(key);
    const completed: Record<string, number> = {};
    const flows: [string, string][] = [];
    const timeline: { at: number; type: string; elementId?: string }[] = [];
    const variables: Record<string, unknown> = {};
    for (const e of JSON.parse(this.engine.events()) as any[]) {
      if (e.instance_key !== k) continue;
      if (e.type === "ProcessInstanceCreated" || e.type === "VariablesUpdated")
        for (const [n, v] of Object.entries(e.variables ?? {})) variables[n] = decodeValue(v);
      if (e.type === "ElementCompleted") completed[e.element_id] = (completed[e.element_id] ?? 0) + 1;
      else if (e.type === "SequenceFlowTaken") flows.push([e.from, e.to]);
      if (/^(ElementActivated|ElementCompleted|JobFailed|IncidentCreated|UserTaskCreated|UserTaskCompleted|ProcessInstance\w+|ElementTerminated)$/.test(e.type))
        timeline.push({ at: e.now, type: e.type, elementId: e.element_id });
    }
    return { completed, flows, variables, timeline: timeline.slice(-300) };
  }

  completeUserTask(key: string, variables: Record<string, unknown>) {
    const snap = this.snapshot();
    const t = (snap.userTasks ?? []).find((u: any) => u.key === key);
    if (!t) throw new Error(`no open user task ${key}`);
    this.engine.completeUserTask(key, JSON.stringify(variables));
    this.log({ kind: "human", instanceKey: t.instanceKey, elementId: t.elementId, message: `user task ${t.elementId} completed` });
    this.persist();
  }

  /** Claim jobs for the live Claude Code session (job type "session" or another the caller names). */
  claimJobs(type?: string, max = 1) {
    const types = type ? [type] : this.agentMode === "session" ? ["session", "claude"] : ["session"];
    const jobs: any[] = [];
    for (const t of types) {
      if (jobs.length >= max) break;
      jobs.push(...JSON.parse(this.engine.activateJobs(t, max - jobs.length, 60 * 60_000, "claude-session")));
    }
    this.touch();
    this.persist();
    return jobs.map((j: any) => {
      const flow = this.flows.get(j.bpmnProcessId);
      const task = flow?.tasks.find((t) => t.name === j.elementId);
      const promptFile = task?.prompt ? path.join(flow!.projectDir, "flows", "prompts", task.prompt.resourceId) : undefined;
      return {
        key: j.key,
        flowId: j.bpmnProcessId,
        elementId: j.elementId,
        instanceKey: j.instanceKey,
        variables: j.variables,
        prompt: promptFile && fs.existsSync(promptFile) ? fs.readFileSync(promptFile, "utf8") : undefined,
        outputSchema: flow?.agents[j.elementId]?.schema,
      };
    });
  }

  completeJob(key: string, variables: Record<string, unknown>) {
    this.engine.completeJob(key, JSON.stringify(variables));
    this.log({ kind: "done", message: `job ${key} completed by session` });
    this.persist();
  }

  failJob(key: string, message: string, retries?: number) {
    const j = (this.snapshot().jobs ?? []).find((x: any) => x.key === key);
    this.engine.failJob(key, retries ?? Math.max(0, (j?.retries ?? 1) - 1), message);
    this.log({ kind: "retry", instanceKey: j?.instanceKey, elementId: j?.elementId, message: `job ${key} failed: ${message}` });
    this.persist();
  }

  resolveIncident(key: string, retries = 1) {
    const snap = this.snapshot();
    const inc = (snap.incidents ?? []).find((i: any) => i.key === key);
    if (!inc) throw new Error(`no incident ${key}`);
    // Failed jobs leave the snapshot; the incident's event names the job.
    const raised = (JSON.parse(this.engine.events()) as any[]).findLast((e) => e.type === "IncidentRaised" && String(e.incident_key) === String(key));
    const jobKey = raised?.job_key ?? (snap.jobs ?? []).find((j: any) => j.instanceKey === inc.instanceKey && j.elementId === inc.elementId)?.key;
    if (jobKey != null) {
      this.engine.updateRetries(String(jobKey), retries);
      this.backoff.delete(String(jobKey));
    }
    this.engine.resolveIncident(key);
    this.log({ kind: "resolve", instanceKey: inc.instanceKey, elementId: inc.elementId, message: `incident at ${inc.elementId} resolved — retrying` });
    this.persist();
  }

  setVariables(scopeKey: string, variables: Record<string, unknown>, local = false) {
    this.engine.setVariables(scopeKey, JSON.stringify(variables), local);
    this.log({ kind: "variables", instanceKey: scopeKey, message: `variables ${Object.keys(variables).join(", ")} set` });
    this.persist();
  }

  cancel(key: string) {
    this.engine.cancelInstance(key);
    this.log({ kind: "cancel", instanceKey: key, message: `instance ${key} cancelled` });
    this.persist();
  }

  correlate(name: string, correlationKey: string, variables: Record<string, unknown>) {
    this.engine.correlateMessage(name, correlationKey, JSON.stringify(variables));
    this.log({ kind: "message", message: `message ${name} (${correlationKey}) correlated` });
    this.persist();
  }

  run() {
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.dirty = true;
    this.persist();
  }
}

/** AGE_AGENT_MODE=cli|session|auto (default auto: cli when a `claude` binary is found). */
function agentMode(): "cli" | "session" {
  const m = process.env.AGE_AGENT_MODE ?? "auto";
  if (m === "cli" || m === "session") return m;
  if (process.env.AGE_CLAUDE_CMD) return "cli";
  const home = process.env.HOME ?? "";
  const dirs = [...(process.env.PATH ?? "").split(":"), `${home}/.local/bin`, `${home}/.claude/local`, "/opt/homebrew/bin", "/usr/local/bin"];
  for (const d of dirs) {
    const f = path.join(d, "claude");
    if (d && fs.existsSync(f)) {
      process.env.AGE_CLAUDE_CMD = f; // Desktop starts us with a minimal PATH
      return "cli";
    }
  }
  return "session";
}

/** The event log stores variables as tagged engine values ({"Str": "x"}, "Null", …). */
function decodeValue(v: any): unknown {
  if (v === "Null") return null;
  if (!v || typeof v !== "object") return v;
  const [tag, x] = Object.entries(v)[0] ?? [];
  switch (tag) {
    case "Str":
    case "Int":
    case "Double":
    case "Bool":
      return x;
    case "List":
      return (x as any[]).map(decodeValue);
    case "Map":
      return Object.fromEntries(Object.entries(x as object).map(([k, y]) => [k, decodeValue(y)]));
    default:
      return v;
  }
}

// ---------------- HTTP ----------------

function send(res: http.ServerResponse, status: number, body: unknown, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : (body as string));
}

async function body(req: http.IncomingMessage): Promise<any> {
  let s = "";
  for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
}

export async function serve(project: string, port = Number(process.env.AGE_PORT ?? 0)) {
  const host = new Host(project);
  await host.reload();
  host.run();

  let reloadTimer: NodeJS.Timeout | undefined;
  const dir = flowsDir(host.project);
  if (fs.existsSync(dir)) {
    fs.watch(dir, { recursive: true }, () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => host.reload().catch(() => {}), 300);
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const p = url.pathname;
    const m = (re: RegExp) => p.match(re);
    let mm: RegExpMatchArray | null;
    try {
      if (req.method === "GET" && (p === "/" || p === "/index.html")) return send(res, 200, explorerHtml(), "text/html; charset=utf-8");
      if (req.method === "GET" && p === "/api/state") return send(res, 200, host.state());
      if (req.method === "GET" && (mm = m(/^\/api\/flows\/([^/]+)\/bpmn$/))) {
        const f = host.flows.get(decodeURIComponent(mm[1]));
        return f ? send(res, 200, f.xml, "application/xml") : send(res, 404, { error: "no such flow" });
      }
      if (req.method === "GET" && (mm = m(/^\/api\/instances\/([^/]+)$/))) {
        return send(res, 200, { ...host.instance(mm[1]), history: host.history(mm[1]) });
      }
      // The shared Process Explorer's wire model (see explorer-api.ts).
      if (req.method === "GET" && p === "/api/explorer/instances") {
        const q = url.searchParams;
        const hasIncident = q.get("hasIncident");
        return send(
          res,
          200,
          explorer.listInstances(host, {
            page: Number(q.get("page") ?? 0),
            pageSize: Number(q.get("pageSize") ?? 50),
            state: q.get("state") ?? undefined,
            hasIncident: hasIncident == null ? undefined : hasIncident === "true",
          }),
        );
      }
      if (req.method === "GET" && (mm = m(/^\/api\/explorer\/instances\/([^/]+)$/))) return send(res, 200, explorer.getInstance(host, mm[1]));
      if (req.method === "GET" && (mm = m(/^\/api\/explorer\/instances\/([^/]+)\/trace$/))) {
        const t = explorer.getTrace(host, mm[1]);
        return t ? send(res, 200, t) : send(res, 404, { error: "no trace" });
      }
      if (req.method !== "POST") return send(res, 404, { error: "not found" });
      const b = await body(req);
      if (p === "/api/reload") return send(res, 200, await host.reload());
      if (p === "/api/start") return send(res, 200, { instanceKey: host.start(b.flowId, b.variables ?? {}, b.title) });
      if ((mm = m(/^\/api\/user-tasks\/([^/]+)\/complete$/))) return send(res, 200, (host.completeUserTask(mm[1], b.variables ?? {}), { ok: true }));
      if (p === "/api/jobs/claim") return send(res, 200, host.claimJobs(b.type, b.max));
      if ((mm = m(/^\/api\/jobs\/([^/]+)\/complete$/))) return send(res, 200, (host.completeJob(mm[1], b.variables ?? {}), { ok: true }));
      if ((mm = m(/^\/api\/jobs\/([^/]+)\/fail$/))) return send(res, 200, (host.failJob(mm[1], b.message ?? "failed", b.retries), { ok: true }));
      if ((mm = m(/^\/api\/incidents\/([^/]+)\/resolve$/))) return send(res, 200, (host.resolveIncident(mm[1], b.retries), { ok: true }));
      if ((mm = m(/^\/api\/instances\/([^/]+)\/cancel$/))) return send(res, 200, (host.cancel(mm[1]), { ok: true }));
      if ((mm = m(/^\/api\/instances\/([^/]+)\/variables$/)))
        return send(res, 200, (host.setVariables(b.scopeKey ?? mm[1], b.variables ?? {}, !!b.local), { ok: true }));
      if (p === "/api/messages") return send(res, 200, (host.correlate(b.name, b.correlationKey ?? "", b.variables ?? {}), { ok: true }));
      if (p === "/api/shutdown") {
        send(res, 200, { ok: true });
        setTimeout(() => shutdown(), 50);
        return;
      }
      return send(res, 404, { error: "not found" });
    } catch (e: any) {
      return send(res, 400, { error: String(e?.message ?? e) });
    }
  });

  const infoFile = path.join(host.dir, "daemon.json");
  function shutdown() {
    host.stop();
    try {
      const cur = JSON.parse(fs.readFileSync(infoFile, "utf8"));
      if (cur.pid === process.pid) fs.unlinkSync(infoFile);
    } catch {
      /* ignore */
    }
    server.close();
    process.exit(0);
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const addr = server.address() as { port: number };
  const info: DaemonInfo = { pid: process.pid, port: addr.port, url: `http://127.0.0.1:${addr.port}`, project: host.project, startedAt: new Date().toISOString() };
  fs.writeFileSync(infoFile, JSON.stringify(info, null, 2));
  return { host, server, info };
}
