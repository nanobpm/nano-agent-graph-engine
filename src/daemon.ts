// The Agent Graph Engine daemon: one per user, serving every project. Hosts the WASM engine, keeps its
// event log on disk (replayed on start), runs job workers, ticks timers, and serves
// the HTTP API + web explorer on localhost. Jobs run through the Worker (src/worker.ts).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { checkProject, flowsDir, type CompiledFlow, type Problem } from "./compile.ts";
import { jobSignal, runInProject } from "./index.ts";
import { AUTO_ORDER, allProfiles, anyAgentInstalled, assignAgent, readAgentsFile, resolveAgent, which, commandOf, type RunAgents } from "./agents.ts";
import { parseJson, runAgentCli } from "./agent-run.ts";
import { TranscriptWriter, readTranscript, pruneTranscripts, linkAgentJob, jobForAgent } from "./transcript.ts";
import { AgentRecorder } from "./agent-record.ts";
import { Notifier, notify, notifyMode, revealPath, type Notice } from "./notify.ts";
import { newEngine, type TestEngine } from "./wasm.ts";
import { acquireEngineLock, defaultHome, engineDir, findDaemon, projectSlug, promptFile, type DaemonInfo } from "./paths.ts";
import { explorerHtml } from "./explorer-html.ts";
import * as explorer from "./explorer-api.ts";
import { StepPool } from "./step-pool.ts";
import { parseLimits, Worker, type ActivatedJob, type JobResult } from "./worker.ts";
import { checkInput, formatInputProblems, type InputProblem } from "./input.ts";

/** Start variables that don't match the flow's input. */
export class InputError extends Error {
  readonly problems: InputProblem[];
  constructor(message: string, problems: InputProblem[]) {
    super(message);
    this.problems = problems;
  }
}

const WORKER = "age-daemon";
const TICK_MS = 500;
const MAX_CONCURRENT = Number(process.env.AGE_MAX_CONCURRENT ?? 4);
const STEP_THREADS = process.env.AGE_STEP_THREADS !== "0";
const MIN = 60_000;
/** How long a step may run: agent steps 55 min, others 25 min (AGE_JOB_TIMEOUT_MS overrides both).
 *  The engine's lock is 5 minutes longer, so a step times out before the engine hands it out again. */
const jobTimeoutMs = (agent: boolean) => Number(process.env.AGE_JOB_TIMEOUT_MS ?? (agent ? 55 : 25) * MIN);

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
  /** Runs activated jobs: timeouts, concurrency limits, failures → retries/incidents. */
  readonly worker: Worker;
  get running() {
    return this.worker.running;
  }
  activity: Activity[] = [];
  instanceMeta: Record<string, { flowId: string; flowKey?: string; project?: string; startedAt: string; title?: string; host?: string; agents?: RunAgents }> = {};
  deployed: Record<string, string> = {};
  /** Who runs agent tasks: a headless `claude -p` ("cli"), or the
   *  chat/session agent through session_job_next ("session"). */
  agentMode: "cli" | "session" = agentMode();
  private dirty = false;
  private timer?: NodeJS.Timeout;
  /** Lease tokens of agent jobs this engine activated (job key → token). Agent jobs are
   *  activated with a lease so their AgentInstance writes are fenced to the activation;
   *  completing or failing them needs the token, so it survives a restart. */
  private leases: Record<string, string> = {};
  /** Threads that run flow code (`run` steps and custom workers). */
  private steps = STEP_THREADS ? new StepPool(MAX_CONCURRENT, (m) => this.log({ kind: "daemon", message: m })) : undefined;

  /** The engine's URL, for explorer links in notifications (set once listening). */
  baseUrl = "";
  private notifier = new Notifier(notifyMode(), (n) => {
    this.log({ kind: "daemon", message: `notify: ${n.title}` });
    notify(n, (m) => this.log({ kind: "daemon", message: m }));
  });

  constructor(dir = engineDir()) {
    this.dir = dir;
    fs.mkdirSync(path.join(this.dir, "compiled"), { recursive: true });
    this.engine = newEngine();
    this.worker = new Worker(
      {
        complete: (key, vars) => {
          this.engine.completeJob(key, JSON.stringify(vars), this.leases[key] ?? null);
          delete this.leases[key];
        },
        fail: (key, retries, msg) => {
          this.engine.failJob(key, retries, msg, this.leases[key] ?? null);
          delete this.leases[key];
        },
      },
      {
        maxConcurrent: MAX_CONCURRENT,
        perType: parseLimits(process.env.AGE_CONCURRENCY),
        timeoutMs: (type) => jobTimeoutMs(this.isAgentType(type)),
        classOf: (type) => (this.isAgentType(type) ? "claude" : undefined),
        backoffMs: Number(process.env.AGE_BACKOFF_MS ?? 5_000),
        log: (e) => this.log(e),
        settled: () => this.persist(),
        onError: (job, err) => this.agentUnavailable(job, err),
      },
    )
    const journal = path.join(this.dir, "journal.json");
    if (fs.existsSync(journal)) {
      this.engine.replayEvents(fs.readFileSync(journal, "utf8"));
      this.log({ kind: "daemon", message: `replayed event log (${this.snapshot().eventCount} events)` });
    }
    this.deployed = this.readJson("deployed.json", {});
    this.projects = this.readJson<string[]>("projects.json", []).filter((p) => fs.existsSync(p));
    this.instanceMeta = this.readJson("instances.json", {});
    this.announce(); // primes: what already exists isn't news
    this.activity = this.readJson("activity.json", []);
    this.leases = this.readJson("leases.json", {});
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

  /** Desktop notification for each new incident or waiting user task. */
  announce() {
    try {
      const snap = this.snapshot();
      const link = (instanceKey: string, hash: string) =>
        this.baseUrl ? `${this.baseUrl}/?project=${encodeURIComponent(this.projectOf(instanceKey))}#${hash}` : undefined;
      const where = (instanceKey: string) => path.basename(this.projectOf(instanceKey));
      const notices: Notice[] = [
        ...(snap.incidents ?? []).map((i: any) => ({
          key: `incident:${i.key}`,
          title: `Incident in ${this.instanceMeta[i.instanceKey]?.flowId ?? "a flow"} (${where(i.instanceKey)})`,
          body: `${i.elementId}: ${String(i.reason ?? "").split("\n")[0]}`,
          url: link(i.instanceKey, `instance=${i.instanceKey}`),
        })),
        ...(snap.userTasks ?? [])
          .filter((t: any) => t.state === "Created")
          .map((t: any) => {
            const v = this.userTaskView(t, snap) as any;
            return {
              key: `task:${t.key}`,
              title: `${v.flowId ?? "A flow"} is waiting for you (${where(t.instanceKey)})`,
              body: v.form?.title ?? v.title ?? t.elementId,
              url: link(t.instanceKey, `task=${t.key}`),
            };
          }),
      ];
      this.notifier.update(notices);
    } catch (e: any) {
      this.log({ kind: "error", message: `notify: ${e?.message ?? e}` });
    }
  }

  /** Write the event log and side tables. The journal is the source of truth. */
  persist() {
    if (!this.dirty) return;
    this.dirty = false;
    this.announce();
    this.writeAtomic("journal.json", this.engine.events());
    this.writeAtomic("deployed.json", JSON.stringify(this.deployed));
    this.writeAtomic("instances.json", JSON.stringify(this.instanceMeta));
    this.writeAtomic("projects.json", JSON.stringify(this.projects));
    this.writeAtomic("activity.json", JSON.stringify(this.activity.slice(-500)));
    this.writeAtomic("leases.json", JSON.stringify(this.leases));
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
      if (j.state === "Activated" && j.jobType !== "session" && !(this.agentMode === "session" && this.isAgentType(j.jobType))) {
        try {
          this.engine.failJob(j.key, j.retries, "daemon restarted while the job ran; retrying", this.leases[String(j.key)] ?? null);
          delete this.leases[String(j.key)];
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
    // A deleted file's flow is retired: hidden and not startable, but its running instances
    // keep their handlers.
    for (const [key, f] of this.flows) if (!flows.has(key) && this.deployed[key]) flows.set(key, fs.existsSync(f.file) ? f : { ...f, retired: true });
    this.flows = flows;
    // Step threads cached the old modules; new steps get fresh threads.
    this.steps?.recycle();
    this.touch();
    this.persist();
    return { deployed, problems: this.problems };
  }

  /** The flow a name means in a project: the project's own, else the global one with
   *  that id. An exact key (e.g. "nanobpmn-1a2b.release") also works. */
  resolveFlow(ref: string, project?: string): CompiledFlow | undefined {
    if (project && path.resolve(project) !== this.home) {
      const own = this.flows.get(`${projectSlug(project)}.${ref}`);
      if (own && !own.retired) return own;
    }
    const g = this.flows.get(ref);
    if (g?.retired) return undefined;
    return g && (g.scope === "global" || !project || path.resolve(g.projectDir) === path.resolve(project)) ? g : undefined;
  }

  /** The flows a project can start: its own, plus the global ones it doesn't shadow. */
  flowsFor(project?: string): CompiledFlow[] {
    const all = [...this.flows.values()].filter((f) => !f.retired);
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
  start(flowRef: string, variables: Record<string, unknown> = {}, title?: string, project?: string, host?: string, agents?: RunAgents): string {
    const where = path.resolve(project ?? this.home);
    if (where !== this.home) this.addProject(where);
    const flow = this.resolveFlow(flowRef, where);
    if (!flow) throw new Error(`unknown flow "${flowRef}" in ${this.tilde(where)}`);
    if (flow.input) {
      // Text from forms, CLI flags and prompt arguments becomes the declared types.
      const checked = checkInput(flow.input, variables);
      if (checked.problems.length) throw new InputError(formatInputProblems(flow.id, checked.problems), checked.problems);
      variables = checked.variables;
    }
    if (agents) this.checkRunAgents(flow, agents);
    const s = JSON.parse(this.engine.createInstance(flow.key, JSON.stringify(variables)));
    const key = String(s.created);
    this.instanceMeta[key] = { flowId: flow.id, flowKey: flow.key, project: where, startedAt: new Date().toISOString(), title, host, ...(agents && Object.keys(agents).length ? { agents } : {}) };
    this.log({ kind: "start", instanceKey: key, message: `started ${flow.id} in ${path.basename(where)}${title ? ` — ${title}` : ""}` });
    this.persist();
    return key;
  }

  /** A run's per-step overrides must name agent steps of the flow and known profiles. */
  private checkRunAgents(flow: CompiledFlow, agents: RunAgents) {
    const steps = flow.tasks.filter((t) => t.agent).map((t) => t.name);
    const known = allProfiles(flow.agentProfiles);
    const problems: { field: string; message: string }[] = [];
    for (const [step, c] of Object.entries(agents)) {
      if (step !== "*" && !steps.includes(step)) problems.push({ field: `agents.${step}`, message: `is not an agent step of ${flow.id} (agent steps: ${steps.join(", ") || "none"})` });
      if (c?.use && !known[c.use]) problems.push({ field: `agents.${step}`, message: `unknown agent profile "${c.use}" (known: ${Object.keys(known).join(", ")})` });
    }
    if (problems.length) throw new InputError(`invalid agents for ${flow.id}: ${problems.map((p) => `${p.field} ${p.message}`).join("; ")}`, problems);
  }

  /** Job types of agent steps (the nano-workforce AgentTask marker), plus the legacy "claude". */
  private agentTypeSet(): Set<string> {
    const types = new Set<string>(["claude"]);
    for (const f of this.flows.values()) for (const t of f.tasks) if (t.agent) types.add(t.jobType);
    return types;
  }

  isAgentType(type: string): boolean {
    return this.agentTypeSet().has(type);
  }

  /** Every job type this daemon serves itself. */
  private servedTypes(): string[] {
    const types = new Set<string>(this.agentMode === "cli" ? this.agentTypeSet() : []);
    for (const f of this.flows.values()) for (const t of Object.keys(f.handlers)) types.add(t);
    return [...types];
  }

  /** Each agent step of a flow, what the author suggested, what you assigned, and what
   *  would run it now (for a run started from `host`, with `run` overrides). */
  agentPlan(flowRef: string, project?: string, host?: string, run?: RunAgents) {
    const flow = this.resolveFlow(flowRef, path.resolve(project ?? this.home));
    if (!flow) throw new Error(`unknown flow "${flowRef}"`);
    const file = readAgentsFile();
    const profiles = allProfiles(flow.agentProfiles, file);
    const fa = file.flows?.[flow.id] ?? {};
    const steps = flow.tasks
      .filter((t) => t.agent)
      .map((t) => {
        const opts = flow.agents[t.name] ?? {};
        let resolved: any;
        try {
          const r = resolveAgent({ flowId: flow.id, step: t.name, jobType: t.jobType, use: opts.use, model: opts.model, flowDefault: flow.defaultAgent, flowProfiles: flow.agentProfiles, run, host, file });
          resolved = r ? { use: r.name, model: r.model ?? null, reason: r.reason, skipped: r.skipped } : { use: null, reason: "no agent CLI installed — goes to the chat assistant" };
        } catch (e: any) {
          resolved = { use: null, error: e?.message ?? String(e) };
        }
        return {
          step: t.name,
          jobType: t.jobType,
          rank: t.rank ?? null,
          prompt: t.prompt?.resourceId,
          author: { use: opts.use ?? flow.defaultAgent ?? null, model: opts.model ?? null },
          assigned: fa.steps?.[t.name] ?? {},
          resolved,
        };
      });
    return {
      flowId: flow.id,
      flow: { use: fa.use ?? null, model: fa.model ?? null },
      ranks: file.ranks ?? {},
      default: file.default ?? null,
      steps,
      profiles: Object.entries(profiles).map(([name, p]) => ({ name, protocol: p.protocol, source: p.source, description: p.description, model: p.model, installed: !!which(commandOf(name, p)) })),
    };
  }

  /** The flow whose handler serves a job type: the job's own flow first. */
  private flowFor(type: string, processId?: string): CompiledFlow | undefined {
    const own = processId ? this.flows.get(processId) : undefined;
    if (own?.handlers[type]) return own;
    for (const f of this.flows.values()) if (f.handlers[type]) return f;
    return undefined;
  }

  tick() {
    try {
      const before = this.snapshot();
      this.engine.tickNow(Date.now());
      const after = this.snapshot();
      if (after.eventCount !== before.eventCount) this.touch();
      this.worker.reap(new Set((after.jobs ?? []).filter((j: any) => j.state === "Created" || j.state === "Activated").map((j: any) => String(j.key))));
      for (const type of this.servedTypes()) {
        const free = this.worker.free(type);
        if (free <= 0) continue;
        const now = Date.now();
        const waiting = (after.jobs ?? []).some((j: any) => j.jobType === type && j.state === "Created" && !this.worker.backingOff(String(j.key), now));
        if (!waiting) continue;
        const jobs = JSON.parse(this.engine.activateJobs(type, free, jobTimeoutMs(this.isAgentType(type)) + 5 * MIN, WORKER, this.isAgentType(type)));
        for (const job of jobs) if (job.jobLeaseToken) this.leases[String(job.key)] = job.jobLeaseToken;
        if (jobs.length) this.touch();
        for (const job of jobs) {
          if (this.worker.backingOff(String(job.key), now)) {
            this.engine.failJob(job.key, job.retries, "backing off", this.leases[String(job.key)] ?? null);
            delete this.leases[String(job.key)];
            continue;
          }
          const j: ActivatedJob = { ...job, key: String(job.key), instanceKey: String(job.instanceKey) };
          void this.worker.run(j, (aj, signal) => this.handle(aj, signal));
        }
      }
    } catch (e: any) {
      this.log({ kind: "error", message: `tick: ${e?.message ?? e}` });
    }
    this.persist();
  }

  /** Which code runs a job: the built-in agent step, or the flow's handler, in its project. */
  private async handle(job: ActivatedJob, signal: AbortSignal): Promise<JobResult> {
    if (this.isAgentType(job.type) && !this.flowFor(job.type, job.bpmnProcessId)) {
      const r = await runInProject(this.projectOf(job.instanceKey), () => this.runAgent(job), signal);
      return { variables: r.vars, costUsd: r.costUsd };
    }
    const flow = this.flowFor(job.type, job.bpmnProcessId);
    if (!flow) throw new Error(`no handler for ${job.type}`);
    const vjob = { jobKey: job.key, processInstanceKey: job.instanceKey, elementId: job.elementId, type: job.type, variables: job.variables ?? {} };
    const project = this.projectOf(job.instanceKey);
    // Flow code runs on a step thread, so it can't block the engine; AGE_STEP_THREADS=0 runs it here.
    const out = this.steps
      ? await this.steps.run({ file: flow.file, stamp: flow.stamp, flowId: flow.id, flowKey: flow.key, type: job.type, project, job: vjob }, signal)
      : await runInProject(project, () => flow.handlers[job.type](vjob), signal);
    return { variables: out && typeof out === "object" ? (out as Record<string, unknown>) : {} };
  }

  /** The Claude Code CLI can't run here (missing or logged out): hand agent steps to the
   *  chat/session assistant instead of burning retries. */
  private agentUnavailable(job: ActivatedJob, err: Error): boolean {
    const msg = err.message;
    if (!this.isAgentType(job.type) || process.env.AGE_AGENT_MODE === "cli" || !/401|authenticat|not logged in|ENOENT/i.test(msg)) return false;
    this.agentMode = "session";
    try {
      this.engine.failJob(job.key, job.retries ?? 3, "handed to the session assistant", this.leases[job.key] ?? null);
      delete this.leases[job.key];
    } catch {
      /* gone */
    }
    this.log({ kind: "retry", instanceKey: job.instanceKey, elementId: job.elementId, message: `claude CLI unavailable (${msg.slice(0, 160)}); agent steps now go to the chat assistant (session_job_next)` });
    return true;
  }

  /** This daemon's base URL, once listening. */
  url?: string;

  /** Built-in agent worker: prompt file + variables → the step's agent CLI (a profile:
   *  claude -p, or any ACP harness), recorded as an AgentInstance. */
  private async runAgent(job: any): Promise<{ vars: Record<string, unknown>; costUsd?: number }> {
    const flow = this.flows.get(job.bpmnProcessId);
    const task = flow?.tasks.find((t) => t.name === job.elementId);
    if (!flow || !task?.prompt) throw new Error(`no prompt bound to ${job.bpmnProcessId}/${job.elementId}`);
    const promptPath = promptFile(flow.projectDir, task.prompt.resourceId);
    const opts = flow.agents[task.name] ?? {};
    const instanceKey = String(job.instanceKey);
    const meta = this.instanceMeta[instanceKey];
    const agent = resolveAgent({ flowId: flow.id, step: task.name, jobType: task.jobType, use: opts.use, model: opts.model, flowDefault: flow.defaultAgent, flowProfiles: flow.agentProfiles, run: meta?.agents, host: meta?.host });
    if (!agent) throw new Error(`ENOENT: no agent CLI installed (${AUTO_ORDER.join(", ")}) and no default in ~/.agent-graph/agents.json`);
    const vars = job.variables ?? {};
    const ctx = opts.context ? Object.fromEntries(opts.context.map((k) => [k, vars[k]])) : vars;
    // {{name}} in the prompt file is replaced by that variable (text as is, else JSON).
    const instructions = fillVars(fs.readFileSync(promptPath, "utf8").trim(), vars);
    const prompt =
      instructions +
      // `context: []`: the prompt carries everything it needs; no variables appended.
      (Object.keys(ctx).length || !opts.context ? `\n\n## Context (process variables)\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n` : "\n") +
      (vars.appendPrompt ? `\n${vars.appendPrompt}\n` : "");
    const jobKey = String(job.key);
    const statusUrl = this.url ? `${this.url}/api/jobs/${jobKey}/alive` : undefined;
    const fullPrompt = opts.abortCheck && statusUrl ? prompt + abortBrief(statusUrl) : prompt;
    // Harness-style result channel (nwf prompts): the agent may write its JSON result here.
    const resultFile = path.join(os.tmpdir(), `age-result-${jobKey}-${process.pid}.json`);
    fs.rmSync(resultFile, { force: true });
    const cwd = opts.cwd ? path.resolve(this.projectOf(instanceKey), fillVars(opts.cwd, vars)) : this.projectOf(instanceKey);
    const model = agent.model;
    const lease = this.leases[String(job.key)];
    const rec = lease
      ? new AgentRecorder(
          this.engine,
          { key: String(job.key), elementInstanceKey: String(job.elementInstanceKey), jobLeaseToken: lease },
          { model: model ?? "default", provider: agent.name, systemPrompt: [opts.system, `${path.relative(flow.projectDir, promptPath)}:\n${instructions}`].filter(Boolean).join("\n\n") },
          (message) => this.log({ kind: "error", instanceKey, elementId: job.elementId, message }),
          () => this.touch(),
        )
      : undefined;
    rec?.start();
    this.log({ kind: "job", instanceKey, elementId: job.elementId, message: `agent ${agent.name}${model ? ` (${model})` : ""} — ${agent.reason}${agent.skipped ? `; the flow suggests ${agent.skipped}` : ""}` });
    const transcript = new TranscriptWriter(jobKey);
    transcript.write({ kind: "lifecycle", phase: "open" });
    const r = await runAgentCli({
      name: agent.name,
      profile: agent.profile,
      prompt: fullPrompt,
      system: opts.system,
      model,
      cwd,
      // {{name}} placeholders in values are filled from the instance variables.
      env: {
        AGENT_RESULT_FILE: resultFile,
        ...(opts.abortCheck && statusUrl ? { AGE_JOB_STATUS_URL: statusUrl } : {}),
        ...(opts.env ? Object.fromEntries(Object.entries(opts.env).map(([k, v]) => [k, fillVars(String(v), vars)])) : {}),
      },
      schema: opts.schema,
      allowedTools: opts.allowedTools,
      permissionMode: opts.permissionMode,
      signal: jobSignal(),
      onTurn: (t) => {
        rec?.turn(t);
        linkAgentJob(rec?.agentInstanceKey, String(jobKey));
      },
      onEvent: (e) => transcript.write(e),
    }).catch((e) => {
      transcript.close("exited");
      throw e;
    });
    transcript.close("completed");
    rec?.done();
    let out: unknown = r.result;
    if (typeof out === "string") out = parseJson(out) ?? out;
    // A JSON object written to $AGENT_RESULT_FILE wins over the final message.
    if (fs.existsSync(resultFile)) {
      const fromFile = parseJson(fs.readFileSync(resultFile, "utf8"));
      fs.rmSync(resultFile, { force: true });
      if (fromFile) out = fromFile;
      else this.log({ kind: "error", instanceKey, elementId: job.elementId, message: "AGENT_RESULT_FILE was not a JSON object; using the agent's final message" });
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
        input: f.input,
        startForm: f.startForm,
      })),
      problems: project ? this.problems.filter((p) => !p.project || p.project === path.resolve(project)) : this.problems,
      instances,
      userTasks: (snap.userTasks ?? []).filter((t: any) => t.state === "Created").map((t: any) => this.userTaskView(t, snap)),
      agentMode: this.agentMode,
      sessionJobs: (snap.jobs ?? [])
        .filter((j: any) => j.jobType === "session" || (this.agentMode === "session" && this.isAgentType(j.jobType)))
        .map((j: any) => ({ ...j, project: pj(j.instanceKey) })),
      jobs: snap.jobs ?? [],
      running: [...this.running.entries()].map(([key, { abort: _a, ...r }]) => ({ key, ...r, project: pj(r.instanceKey) })),
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
    const types = type ? [type] : this.agentMode === "session" ? ["session", ...this.agentTypeSet()] : ["session"];
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
      const promptPath = task?.prompt ? promptFile(flow!.projectDir, task.prompt.resourceId) : undefined;
      return {
        key: j.key,
        flowId: flow?.id ?? j.bpmnProcessId,
        project: this.projectOf(String(j.instanceKey)),
        elementId: j.elementId,
        instanceKey: j.instanceKey,
        variables: j.variables,
        prompt: promptPath && fs.existsSync(promptPath) ? fillVars(fs.readFileSync(promptPath, "utf8"), j.variables ?? {}) : undefined,
        cwd: flow?.agents[j.elementId]?.cwd ? path.resolve(this.projectOf(String(j.instanceKey)), fillVars(flow.agents[j.elementId].cwd!, j.variables ?? {})) : undefined,
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
      this.worker.backoff.delete(String(jobKey));
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
    this.worker.stop();
    void this.steps?.close();
    this.dirty = true;
    this.persist();
  }
}

/** AGE_AGENT_MODE=cli|session|auto (default auto: cli when an agent CLI is installed —
 *  one of AUTO_ORDER — or ~/.agent-graph/agents.json names a default). */
function agentMode(): "cli" | "session" {
  const m = process.env.AGE_AGENT_MODE ?? "auto";
  if (m === "cli" || m === "session") return m;
  if (process.env.AGE_CLAUDE_CMD) return "cli";
  return anyAgentInstalled() ? "cli" : "session";
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
  // Single writer: take the state dir before reading or writing the journal.
  const releaseLock = acquireEngineLock();
  process.on("exit", releaseLock);
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
      if (req.method === "GET" && (mm = m(/^\/api\/flows\/([^/]+)\/agents$/))) {
        const q = url.searchParams;
        return send(res, 200, host.agentPlan(decodeURIComponent(mm[1]), q.get("project") || undefined, q.get("host") || undefined));
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
      // Agent sessions: the engine's AgentInstance read model (committed history only).
      if (req.method === "GET" && (mm = m(/^\/api\/explorer\/instances\/([^/]+)\/agents$/)))
        return send(res, 200, JSON.parse(host.engine.searchAgentInstances(JSON.stringify({ processInstanceKey: mm[1] }))).items);
      if (req.method === "GET" && (mm = m(/^\/api\/explorer\/agents\/([^/]+)\/history$/)))
        return send(res, 200, JSON.parse(host.engine.searchAgentInstanceHistory(mm[1], "{}")).items);
      // The same, by AgentInstance (what the explorer's agent panel knows): its job's stream.
      if (req.method === "GET" && (mm = m(/^\/api\/explorer\/agents\/([^/]+)\/transcript$/))) {
        const jobKey =
          jobForAgent(mm[1]) ??
          (JSON.parse(host.engine.searchAgentInstanceHistory(mm[1], "{}")).items as { jobKey?: string }[]).find((i) => i.jobKey)?.jobKey;
        const t = jobKey ? readTranscript(String(jobKey), Number(url.searchParams.get("from") ?? 0) || 0, host.running.has(String(jobKey))) : null;
        return t ? send(res, 200, t) : send(res, 404, { error: "no transcript for this agent run" });
      }
      // Live transcript of an agent step (nwf's transcript read shape; offsets are bytes).
      if (req.method === "GET" && (mm = m(/^\/api\/jobs\/([\w-]+)\/transcript$/))) {
        const t = readTranscript(mm[1], Number(url.searchParams.get("from") ?? 0) || 0, host.running.has(mm[1]));
        return t ? send(res, 200, t) : send(res, 404, { error: "no transcript for this job" });
      }
      // Liveness for agents with abortCheck: 404 once the step is cancelled or finished.
      if (req.method === "GET" && (mm = m(/^\/api\/jobs\/([^/]+)\/alive$/))) {
        const r = host.running.get(mm[1]);
        return r ? send(res, 200, { jobKey: mm[1], instanceKey: r.instanceKey, status: "running", abandoned: false }) : send(res, 404, { error: "job is no longer running", abandoned: true });
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
      if (p === "/api/start") return send(res, 200, { instanceKey: host.start(b.flowId, b.variables ?? {}, b.title, b.project, b.host, b.agents) });
      if (p === "/api/agents/assign") return send(res, 200, assignAgent(b));
      // Only a deployed flow's own file, never a path from the request.
      if ((mm = m(/^\/api\/flows\/([^/]+)\/reveal$/))) {
        const f = host.flows.get(decodeURIComponent(mm[1]));
        if (!f) return send(res, 404, { error: "no such flow" });
        revealPath(f.file);
        return send(res, 200, { file: f.file });
      }
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
      if (e instanceof InputError) return send(res, 400, { error: e.message, problems: e.problems });
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
  pruneTranscripts();
  // A flow handler's stray promise or callback must not take every project's runs down
  // with it: log it and keep serving (the event log is the source of truth).
  process.on("unhandledRejection", (e: any) => host.log({ kind: "error", message: `unhandled rejection (a flow handler?): ${e?.stack ?? e}`.slice(0, 2000) }));
  process.on("uncaughtException", (e: any) => host.log({ kind: "error", message: `uncaught exception (a flow handler?): ${e?.stack ?? e}`.slice(0, 2000) }));

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
  host.url = info.url;
  host.baseUrl = info.url;
  fs.writeFileSync(infoFile, JSON.stringify(info, null, 2));
  return { host, server, info };
}

/** Replace {{name}} with the variable: strings as is, other values as JSON, missing ones empty. */
export function fillVars(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : typeof v === "string" ? v : JSON.stringify(v, null, 2);
  });
}

/** Appended to agent prompts with `abortCheck: true` (same contract as Nano Workforce's). */
export function abortBrief(url: string): string {
  return `

---

## Abort if this run was cancelled

A human can cancel this run while you work. Then nobody is waiting for your result, and any commit,
push, PR update, review request or merge you make is an orphaned side effect.

Before every irreversible action (git push, opening or updating a PR, requesting a review, merging),
check that the run is still wanted:

    curl -fsS "${url}"

- Abort (push nothing, change nothing on GitHub, exit) if the command fails (a 404 means the step was
  cancelled) or the JSON says \`"abandoned": true\`.
- Proceed only when it succeeds with \`"abandoned": false\`, and check again right before the push.

Run this check yourself with your own shell tool; don't delegate it to a sub-agent.
`;
}
