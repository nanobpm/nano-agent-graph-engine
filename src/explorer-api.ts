// The daemon's side of the shared Process Explorer (@nanobpm/process-explorer, from
// nanobpm/nano-bpm): maps the engine's snapshot and event log onto the nano console's
// wire model (InstancePage / InstanceDetail / InstanceTrace), so the explorer's
// ExplorerDataSource is a thin fetch (or ui_api) client. Field names follow that
// model, including its mix of snake_case and camelCase.
import path from "node:path";
import type { Host } from "./daemon.ts";

type Ev = Record<string, any>;

/** What the event log knows about one process instance. */
interface Facts {
  key: string;
  processId: string;
  startedAt: number;
  endedAt: number | null;
  outcome: "active" | "completed" | "terminated";
  parentKey: string | null;
  parentElementKey: string | null;
  businessId: string | null;
  elements: Map<string, TraceElement>;
  incidents: Map<string, TraceIncident>;
  path: string[];
}

interface TraceJob {
  type: string;
  worker: string | null;
  createdAt: number;
  activatedAt: number | null;
  completedAt: number | null;
  waitMs: number | null;
  queueMs: number | null;
  serviceMs: number | null;
  attempts: number;
  failures: number;
}

interface TraceElement {
  elementId: string;
  elementInstanceKey: string;
  scope: string;
  enteredAt: number;
  exitedAt: number | null;
  durationMs: number | null;
  incidents: number;
  job: TraceJob | null;
}

interface TraceIncident {
  elementId: string;
  elementInstanceKey: string;
  kind: string;
  reason: string;
  raisedAt: number;
  resolvedAt: number | null;
}

const str = (v: unknown) => (v == null ? null : String(v));

/** One pass over the event log → per-instance facts. */
export function instanceFacts(events: Ev[]): Map<string, Facts> {
  const out = new Map<string, Facts>();
  const jobs = new Map<string, { el: TraceElement }>();
  const elementByKey = new Map<string, TraceElement>();
  for (const e of events) {
    const ik = str(e.instance_key);
    if (!ik) continue;
    if (e.type === "ProcessInstanceCreated") {
      out.set(ik, {
        key: ik,
        processId: e.process_id,
        startedAt: e.created_at ?? e.now,
        endedAt: null,
        outcome: "active",
        parentKey: str(e.parent_process_instance_key),
        parentElementKey: str(e.parent_element_instance_key),
        businessId: str(e.business_id),
        elements: new Map(),
        incidents: new Map(),
        path: [],
      });
      continue;
    }
    const f = out.get(ik);
    if (!f) continue;
    switch (e.type) {
      case "ElementActivated": {
        const el: TraceElement = {
          elementId: e.element_id,
          elementInstanceKey: String(e.element_instance_key),
          scope: String(e.scope ?? 0),
          enteredAt: e.now,
          exitedAt: null,
          durationMs: null,
          incidents: 0,
          job: null,
        };
        f.elements.set(el.elementInstanceKey, el);
        elementByKey.set(el.elementInstanceKey, el);
        f.path.push(e.element_id);
        break;
      }
      case "ElementCompleted":
      case "ElementTerminated": {
        const el = f.elements.get(String(e.element_instance_key));
        if (el) {
          el.exitedAt = e.now;
          el.durationMs = e.now - el.enteredAt;
        }
        break;
      }
      case "JobCreated": {
        const el = elementByKey.get(String(e.element_instance_key));
        if (!el) break;
        el.job = {
          type: e.job_type,
          worker: null,
          createdAt: e.created_at ?? e.now,
          activatedAt: null,
          completedAt: null,
          waitMs: null,
          queueMs: null,
          serviceMs: null,
          attempts: 0,
          failures: 0,
        };
        jobs.set(String(e.job_key), { el });
        break;
      }
      case "JobActivated": {
        const job = jobs.get(String(e.job_key))?.el.job;
        if (!job) break;
        job.attempts++;
        job.worker = e.worker ?? job.worker;
        job.activatedAt = e.activated_at ?? e.now;
        job.queueMs ??= job.activatedAt! - job.createdAt;
        break;
      }
      case "JobFailed": {
        const job = jobs.get(String(e.job_key))?.el.job;
        if (job) job.failures++;
        break;
      }
      case "JobCompleted": {
        const job = jobs.get(String(e.job_key))?.el.job;
        if (!job) break;
        job.completedAt = e.now;
        job.waitMs = e.now - job.createdAt;
        if (job.activatedAt != null) job.serviceMs = e.now - job.activatedAt;
        break;
      }
      case "IncidentRaised": {
        const elementKey = str(e.element_instance_key) ?? "";
        f.incidents.set(String(e.incident_key), {
          elementId: e.element_id ?? "",
          elementInstanceKey: elementKey,
          kind: String(e.kind ?? e.error_type ?? "incident"),
          reason: String(e.reason ?? e.message ?? e.error_message ?? ""),
          raisedAt: e.now,
          resolvedAt: null,
        });
        const el = f.elements.get(elementKey);
        if (el) el.incidents++;
        break;
      }
      case "IncidentResolved": {
        const inc = f.incidents.get(String(e.incident_key));
        if (inc) inc.resolvedAt = e.now;
        break;
      }
      case "ProcessInstanceCompleted":
        f.outcome = "completed";
        f.endedAt = e.now;
        break;
      default:
        if (/^ProcessInstance(Terminated|Cancel)/.test(e.type)) {
          f.outcome = "terminated";
          f.endedAt = e.now;
        }
    }
  }
  return out;
}

/** The engine's variable values arrive tagged ({"String": …}); show them as JSON text. */
function json(v: unknown) {
  return JSON.stringify(v ?? null);
}

function instanceView(host: Host, f: Facts, live: any, incidentOpen: boolean) {
  const state = live?.state ?? (f.outcome === "completed" ? "Completed" : f.outcome === "terminated" ? "Terminated" : "Active");
  const meta = host.instanceMeta[f.key];
  const project = host.projectOf(f.key);
  return {
    key: f.key,
    // The flow's own id; project flows deploy as "<projectSlug>.<id>".
    process_id: host.flows.get(f.processId)?.id ?? meta?.flowId ?? f.processId,
    // One definition per deployed process id, which doubles as its key so
    // getProcessXml can fetch the flow's current BPMN.
    process_definition_key: f.processId,
    project,
    version: 1,
    state: state === "Canceled" || state === "Cancelled" ? "Terminated" : state,
    start_date_ms: f.startedAt,
    has_incident: incidentOpen,
    business_id: f.businessId ?? meta?.title ?? null,
    suspendedDate: null,
    tags: [path.basename(project), ...(meta?.title ? [meta.title] : [])],
    parent_process_instance_key: f.parentKey,
    parent_element_instance_key: f.parentElementKey,
  };
}

function load(host: Host) {
  const snap = host.snapshot();
  const facts = instanceFacts(JSON.parse(host.engine.events()));
  const live = new Map<string, any>((snap.instances ?? []).map((i: any) => [String(i.key), i]));
  const openIncidents = new Set<string>((snap.incidents ?? []).map((i: any) => String(i.instanceKey)));
  return { snap, facts, live, openIncidents };
}

export function listInstances(host: Host, q: { page?: number; pageSize?: number; state?: string; hasIncident?: boolean; project?: string }) {
  const { facts, live, openIncidents } = load(host);
  // Zero-based, like the console API the explorer was written against.
  const page = Math.max(0, Number(q.page ?? 0) || 0);
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize ?? 50)));
  const all = [...facts.values()]
    .map((f) => instanceView(host, f, live.get(f.key), openIncidents.has(f.key)))
    .filter(
      (i) =>
        (!q.state || i.state === q.state) &&
        (q.hasIncident === undefined || i.has_incident === q.hasIncident) &&
        (!q.project || i.project === path.resolve(q.project)),
    )
    .sort((a, b) => b.start_date_ms - a.start_date_ms || Number(b.key) - Number(a.key));
  return { items: all.slice(page * pageSize, (page + 1) * pageSize), total: all.length, page, pageSize };
}

export function getInstance(host: Host, key: string) {
  const { snap, facts, live, openIncidents } = load(host);
  const f = facts.get(key);
  if (!f) throw new Error(`no instance ${key}`);
  const l = live.get(key);
  const flow = host.flows.get(f.processId);
  const variables = Object.entries<unknown>({ ...host.history(key).variables, ...l?.variables }).map(([name, value]) => ({
    name,
    value: json(value),
    scope_key: key,
  }));
  const elementName = (id: string) => flow?.tasks.find((t) => t.name === id)?.name ?? null;
  return {
    instance: instanceView(host, f, l, openIncidents.has(key)),
    variables,
    jobs: (snap.jobs ?? [])
      .filter((j: any) => String(j.instanceKey) === key)
      .map((j: any) => ({
        key: String(j.key),
        element_id: j.elementId,
        job_type: j.jobType,
        state: j.state ?? (host.running.has(String(j.key)) ? "Activated" : "Created"),
        retries: j.retries ?? 0,
        worker: j.worker ?? (host.running.has(String(j.key)) ? "age-daemon" : null),
        deadline_ms: j.deadline ?? null,
        activated_at_ms: host.running.get(String(j.key))?.since ?? null,
        timeout_ms: null,
      })),
    incidents: (snap.incidents ?? [])
      .filter((i: any) => String(i.instanceKey) === key)
      .map((i: any) => ({
        key: String(i.key),
        element_id: i.elementId,
        kind: String(i.kind ?? i.errorType ?? "JobNoRetries"),
        state: "Active",
        reason: String(i.reason ?? i.message ?? ""),
        created_at_ms: f.incidents.get(String(i.key))?.raisedAt ?? 0,
      })),
    active_elements: (l?.activeElements ?? []).map((a: any) => ({
      element_id: a.elementId,
      element_type: a.elementType ?? "",
      element_name: elementName(a.elementId),
    })),
    called_instances: [...facts.values()]
      .filter((c) => c.parentKey === key)
      .map((c) => ({
        key: c.key,
        process_id: host.flows.get(c.processId)?.id ?? c.processId,
        version: 1,
        state: instanceView(host, c, live.get(c.key), openIncidents.has(c.key)).state,
        has_incident: openIncidents.has(c.key),
        start_date_ms: c.startedAt,
        calling_element_id: (c.parentElementKey && f.elements.get(c.parentElementKey)?.elementId) ?? null,
        calling_element_name: null,
      })),
  };
}

export function getTrace(host: Host, key: string) {
  const f = instanceFacts(JSON.parse(host.engine.events())).get(key);
  if (!f) return null;
  return {
    instanceKey: f.key,
    processId: host.flows.get(f.processId)?.id ?? f.processId,
    version: 1,
    businessId: f.businessId ?? host.instanceMeta[key]?.title ?? null,
    tags: [],
    startedAt: f.startedAt,
    endedAt: f.endedAt,
    durationMs: f.endedAt == null ? null : f.endedAt - f.startedAt,
    outcome: f.outcome,
    elements: [...f.elements.values()],
    incidents: [...f.incidents.values()],
    path: f.path,
  };
}
