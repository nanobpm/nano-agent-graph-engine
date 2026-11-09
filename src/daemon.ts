// The Agent Graph Engine daemon: one per user, serving every project. Hosts the WASM engine, keeps its
// event log on disk (replayed on start), runs job workers, ticks timers, and serves
// the HTTP API + web explorer on 127.0.0.1.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { checkProject, flowsDir, type CompiledFlow, type Problem } from "./compile.ts";
import { claude, runInProject } from "./index.ts";
import { newEngine, type TestEngine } from "./wasm.ts";
import { defaultHome, engineDir, findDaemon, projectSlug, type DaemonInfo } from "./paths.ts";
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
  /** The global flow library (~/AgentGraph): its flows are offered in every project.
   *  Claude Desktop, which has no project, works there. */
  readonly home = path.resolve(defaultHome());
  readonly dir: string;
  /** Projects whose flows/ this engine loads (registered by clients as they connect). */
  projects: string[] = [];
  engine: TestEngine;
  flows = new Map<string, CompiledFlow>();
  problems: { file: string; project?: string; problems: Problem[] }[] = [];
  running = new Map<string, { type: string; elementId: string; instanceKey: string; since: number }>();
  backoff = new Map<string, number>();
  activity: Activity[] = [];
  instanceMeta: Record<string, { flowId: string; flowKey?: string; project?: string; startedAt: string; title?: string }> = {};
  deployed: Record<string, string> = {};
  /** Who runs `jobType: "claude"` agent tasks: a headless `claude -p` ("cli"), or the
   *  chat/session agent through session_job_next ("session"). */
  agentMode: "cli" | "session" = agentMode();
  private dirty = false;
  private timer?: NodeJS.Timeout;

  constructor(dir = engineDir()) {
    this.dir = dir;
    fs.mkdirSync(path.join(this.dir, "compiled"), { recursive: true });
    this.engine = newEngine();
    const journal = path.join(this.dir, "journal.json");
    if (fs.existsSync(journal)) {
      this.engine.replayEvents(fs.readFileSync(journal, "utf8"));
      this.log({ kind: "daemon", message: `replayed event log (${this.snapshot().eventCount} events)` });
    }
    this.deployed = this.readJson("deployed.json", {});
    this.projects = this.readJson<string[]>("projects.json", []).filter((p) => fs.existsSync(p));
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
    this.writeAtomic("projects.json", JSON.stringify(this.projects));
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

  /** Add a project (its flows/ are loaded and watched). Idempotent. The library itself
   *  is not a project: its flows are global. Returns whether it was new. */
  addProject(dir: string): boolean {
    const p = path.resolve(dir);
    if (p === this.home || this.projects.includes(p)) return false;
    this.projects.push(p);
    this.touch();
    this.persist();
    return true;
  }

  /** "~/…" for paths under the home dir, for display. */
  tilde(p: string): string {
    const h = process.env.HOME;
    return h && (p === h || p.startsWith(h + path.sep)) ? `~${p.slice(h.length)}` : p;
  }

  /** Compile every project's flows/ and the library's, and deploy every flow whose BPMN
   *  changed. Project flows deploy as "<projectSlug>.<id>", global ones as "<id>". */
  async reload(): Promise<{ deployed: string[]; problems: Host["problems"] }> {
    const results = [];
    for (const project of this.projects) {
      const slug = projectSlug(project);
      results.push(...(await checkProject(project, (id) => `${slug}.${id}`)).map((r) => ({ ...r, project })));
    }
    const globals = (await checkProject(this.home)).map((r) => ({ ...r, project: undefined }));
    for (const r of globals) for (const f of r.flows) f.scope = "global";
    this.problems = [...results, ...globals]
      .filter((r) => r.problems.length)
      .map((r) => ({ file: this.tilde(r.file), project: r.project, problems: r.problems }));
    const deployed: string[] = [];
    const flows = new Map<string, CompiledFlow>();
    for (const r of [...results, ...globals]) {
      if (r.problems.some((p) => p.severity === "error")) continue;
      for (const f of r.flows) {
        if (flows.has(f.key)) continue;
        flows.set(f.key, f);
        fs.writeFileSync(path.join(this.dir, "compiled", `${f.key}.bpmn`), f.xml);
        const hash = crypto.createHash("sha256").update(f.xml).digest("hex");
        if (this.deployed[f.key] !== hash) {
          this.engine.deploy(f.xml);
          this.deployed[f.key] = hash;
          deployed.push(f.key);
          this.log({ kind: "deploy", message: `deployed flow ${f.key}` });
        }
      }
    }
    // Keep handlers of flows that failed to compile this time, so running instances continue.
    for (const [key, f] of this.flows) if (!flows.has(key) && this.deployed[key]) flows.set(key, f);
    this.flows = flows;
    this.touch();
    this.persist();
    return { deployed, problems: this.problems };
  }

  /** The flow a name means in a project: the project's own, else the global one with
   *  that id. An exact key (e.g. "nanobpmn-1a2b.release") also works. */
  resolveFlow(ref: string, project?: string): CompiledFlow | undefined {
    if (project && path.resolve(project) !== this.home) {
      const own = this.flows.get(`${projectSlug(project)}.${ref}`);
      if (own) return own;
    }
    const g = this.flows.get(ref);
    return g && (g.scope === "global" || !project || path.resolve(g.projectDir) === path.resolve(project)) ? g : undefined;
  }

  /** The flows a project can start: its own, plus the global ones it doesn't shadow. */
  flowsFor(project?: string): CompiledFlow[] {
    const all = [...this.flows.values()];
    if (!project) return all;
    const p = path.resolve(project);
    const own = p === this.home ? [] : all.filter((f) => f.scope === "project" && path.resolve(f.projectDir) === p);
    const ids = new Set(own.map((f) => f.id));
    return [...own, ...all.filter((f) => f.scope === "global" && !ids.has(f.id))];
  }

  /** The project a run belongs to (where its steps run). */
  projectOf(instanceKey: string): string {
    const meta = this.instanceMeta[instanceKey];
    if (meta?.project) return meta.project;
    const f = meta?.flowKey ? this.flows.get(meta.flowKey) : undefined;
    return f && f.scope === "project" ? f.projectDir : this.home;
  }

  /** Start a flow in a project (default: the library home). Global flows run in the
   *  project they were started from. */
  start(flowRef: string, variables: Record<string, unknown> = {}, title?: string, project?: string): string {
    const where = path.resolve(project ?? this.home);
    if (where !== this.home) this.addProject(where);
    const flow = this.resolveFlow(flowRef, where);
    if (!flow) throw new Error(`unknown flow "${flowRef}" in ${this.tilde(where)}`);
    const s = JSON.parse(this.engine.createInstance(flow.key, JSON.stringify(variables)));
    const key = String(s.created);
    this.instanceMeta[key] = { flowId: flow.id, flowKey: flow.key, project: where, startedAt: new Date().toISOString(), title };
    this.log({ kind: "start", instanceKey: key, message: `started ${flow.id} in ${path.basename(where)}${title ? ` — ${title}` : ""}` });
    this.persist();
    return key;
  }

  /** Every job type this daemon serves itself. */
  private servedTypes(): string[] {
    const types = new Set<string>(this.agentMode === "cli" ? ["claude"] : []);
    for (const f of this.flows.values()) for (const t of Object.keys(f.handlers)) types.add(t);
    return [...types];
  }

  private handlerFor(type: string, processId?: string): ((job: any) => unknown) | undefined {
    const own = processId ? this.flows.get(processId)?.handlers[type] : undefined;
    if (own) return own;
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
        const h = this.handlerFor(job.type, job.bpmnProcessId);
        if (!h) throw new Error(`no handler for ${job.type}`);
        const out = await runInProject(this.projectOf(String(job.instanceKey)), () => h(vjob));
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
    const r = await claude<unknown>(prompt, { ...claudeOpts, cwd: this.projectOf(String(job.instanceKey)) });
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
    const flowKey = inst?.processId ?? this.instanceMeta[t.instanceKey]?.flowKey;
    const flow = flowKey ? this.flows.get(flowKey) : undefined;
    const flowId = flow?.id ?? this.instanceMeta[t.instanceKey]?.flowId ?? flowKey;
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
      project: this.projectOf(String(t.instanceKey)),
      formId: human?.form,
      form: form ? { ...form, title: fill(form.title), description: fill(form.description) } : undefined,
      variables,
    };
  }

  /** Everything the clients show. Runs, tasks and incidents are listed for every project
   *  (each says which), so work is never hidden; `project` picks the flows offered. */
  state(project?: string) {
    const snap = this.snapshot();
    const pj = (instanceKey: unknown) => this.projectOf(String(instanceKey));
    const instances = (snap.instances ?? []).map((i: any) => ({
      ...this.instanceMeta[i.key],
      key: i.key,
      flowId: this.flows.get(i.processId)?.id ?? this.instanceMeta[i.key]?.flowId ?? i.processId,
      flowKey: i.processId,
      project: pj(i.key),
      state: i.state,
      completed: i.completed,
      activeElements: (i.activeElements ?? []).map((a: any) => a.elementId),
    }));
    return {
      project: project ? path.resolve(project) : undefined,
      home: this.home,
      globalDir: this.home,
      projects: this.projects.map((p) => ({ path: p, name: path.basename(p), slug: projectSlug(p) })),
      now: snap.now,
      eventCount: snap.eventCount,
      flows: this.flowsFor(project).map((f) => ({
        id: f.id,
        key: f.key,
        scope: f.scope,
        project: f.scope === "project" ? f.projectDir : undefined,
        file: f.scope === "project" ? path.relative(f.projectDir, f.file) : this.tilde(f.file),
        description: f.description,
        humans: f.humans,
        tasks: f.tasks.map((t) => ({ name: t.name, jobType: t.jobType, agent: t.agent })),
      })),
      problems: project ? this.problems.filter((p) => !p.project || p.project === path.resolve(project)) : this.problems,
      instances,
      userTasks: (snap.userTasks ?? []).filter((t: any) => t.state === "Created").map((t: any) => this.userTaskView(t, snap)),
      agentMode: this.agentMode,
      sessionJobs: (snap.jobs ?? [])
        .filter((j: any) => j.jobType === "session" || (this.agentMode === "session" && j.jobType === "claude"))
        .map((j: any) => ({ ...j, project: pj(j.instanceKey) })),
      jobs: snap.jobs ?? [],
      running: [...this.running.entries()].map(([key, r]) => ({ key, ...r, project: pj(r.instanceKey) })),
      incidents: (snap.incidents ?? []).map((i: any) => ({ ...i, project: pj(i.instanceKey) })),
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
      flowId: this.flows.get(inst.processId)?.id ?? this.instanceMeta[key]?.flowId ?? inst.processId,
      flowKey: inst.processId,
      project: this.projectOf(key),
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

  /** Claim jobs for the live Claude Code session (job type "session" or another the caller
   *  names). With `project`, only jobs of runs in that project: a session works on its repo. */
  claimJobs(type?: string, max = 1, project?: string) {
    const types = type ? [type] : this.agentMode === "session" ? ["session", "claude"] : ["session"];
    const where = project ? path.resolve(project) : undefined;
    const open = (this.snapshot().jobs ?? []).filter((j: any) => j.state === "Created");
    const jobs: any[] = [];
    for (const t of types) {
      const mine = open.filter((j: any) => j.jobType === t && (!where || this.projectOf(String(j.instanceKey)) === where));
      if (jobs.length >= max || !mine.length) continue;
      // activateJobs can't filter by instance: take what's there, keep ours, hand the rest back.
      const got = JSON.parse(this.engine.activateJobs(t, open.filter((j: any) => j.jobType === t).length, 60 * 60_000, "claude-session"));
      for (const j of got) {
        if (jobs.length < max && (!where || this.projectOf(String(j.instanceKey)) === where)) jobs.push(j);
        else this.engine.failJob(String(j.key), Math.max(1, j.retries ?? 1), "not for this session");
      }
    }
    this.touch();
    this.persist();
    return jobs.map((j: any) => {
      const flow = this.flows.get(j.bpmnProcessId);
      const task = flow?.tasks.find((t) => t.name === j.elementId);
      const promptFile = task?.prompt ? path.join(flow!.projectDir, "flows", "prompts", task.prompt.resourceId) : undefined;
      return {
        key: j.key,
        flowId: flow?.id ?? j.bpmnProcessId,
        project: this.projectOf(String(j.instanceKey)),
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

export async function serve(port = Number(process.env.AGE_PORT ?? 0)) {
  const running = await findDaemon();
  if (running) throw new Error(`the engine is already running (pid ${running.pid}, ${running.url})`);
  const host = new Host();
  await host.reload();
  host.run();

  // Recompile when any project's (or the library's) flows/ changes.
  let reloadTimer: NodeJS.Timeout | undefined;
  const watched = new Map<string, fs.FSWatcher>();
  const watch = () => {
    for (const root of [host.home, ...host.projects]) {
      const dir = flowsDir(root);
      if (watched.has(dir) || !fs.existsSync(dir)) continue;
      try {
        watched.set(
          dir,
          fs.watch(dir, { recursive: true }, () => {
            clearTimeout(reloadTimer);
            reloadTimer = setTimeout(() => host.reload().catch(() => {}), 300);
          }),
        );
      } catch {
        /* unwatchable; reload on demand */
      }
    }
  };
  watch();
  // flows/ may appear later (flow_write creates it).
  const rewatch = setInterval(watch, 5_000);
  rewatch.unref();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const p = url.pathname;
    const m = (re: RegExp) => p.match(re);
    let mm: RegExpMatchArray | null;
    try {
      if (req.method === "GET" && (p === "/" || p === "/index.html")) return send(res, 200, explorerHtml(), "text/html; charset=utf-8");
      if (req.method === "GET" && p === "/api/health") return send(res, 200, { ok: true, pid: process.pid });
      if (req.method === "GET" && p === "/api/state") return send(res, 200, host.state(url.searchParams.get("project") || undefined));
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
            project: q.get("project") || undefined,
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
      if (p === "/api/projects") {
        if (typeof b.path !== "string" || !path.isAbsolute(b.path)) return send(res, 400, { error: "path must be absolute" });
        if (host.addProject(b.path)) {
          await host.reload();
          watch();
        }
        return send(res, 200, { ok: true, projects: host.projects });
      }
      if (p === "/api/start") return send(res, 200, { instanceKey: host.start(b.flowId, b.variables ?? {}, b.title, b.project) });
      if ((mm = m(/^\/api\/user-tasks\/([^/]+)\/complete$/))) return send(res, 200, (host.completeUserTask(mm[1], b.variables ?? {}), { ok: true }));
      if (p === "/api/jobs/claim") return send(res, 200, host.claimJobs(b.type, b.max, b.project));
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
  // The address is http://localhost:<port> (the Desktop app only makes localhost links
  // clickable, and opens them in its Browser pane), so answer on IPv6 loopback too.
  const v6 = http.createServer();
  for (const l of server.listeners("request")) v6.on("request", l as any);
  v6.on("error", () => {}); // no IPv6 loopback: localhost resolves to 127.0.0.1
  v6.listen(addr.port, "::1");
  server.on("close", () => v6.close());
  const info: DaemonInfo = { pid: process.pid, port: addr.port, url: `http://localhost:${addr.port}`, project: host.home, startedAt: new Date().toISOString() };
  fs.writeFileSync(infoFile, JSON.stringify(info, null, 2));
  return { host, server, info };
}
