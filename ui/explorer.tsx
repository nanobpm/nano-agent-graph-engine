// Agent Graph Engine — web explorer. Served by the daemon at "/" and, built a second
// time, as an MCP App (Claude Desktop / Claude Code), where the iframe reaches the
// engine through the server's ui_api tool instead of fetch.
//
// Instances use the nano console's Process Explorer (@nanobpm/process-explorer) over
// the daemon's /api/explorer/* routes. The inbox (user-task forms) and the flow list
// (start an instance) are this app's own.
import { StrictMode, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { App } from "@modelcontextprotocol/ext-apps";
import {
  Badge,
  BpmnViewer,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Explorer,
  ExplorerDataProvider,
  SectionLabel,
  inputClass,
  type ExplorerDataSource,
} from "@nanobpm/process-explorer";

declare const __APP__: boolean;
let app: App | undefined;

// ---------------- engine access ----------------

async function api(path: string, body?: unknown): Promise<any> {
  if (__APP__) {
    const r: any = await app!.callServerTool({ name: "ui_api", arguments: { path, ...(body === undefined ? {} : { body }) } });
    if (r.isError || r.structuredContent?.error) throw new Error(r.structuredContent?.error ?? r.content?.[0]?.text ?? "error");
    return r.structuredContent?.data;
  }
  const r = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ct = r.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await r.json() : await r.text();
  if (!r.ok) throw new Error(data?.error ?? r.statusText);
  return data;
}

const enc = encodeURIComponent;

// ---------------- project scope ----------------
// One engine serves every project. The explorer shows one project (the one it was
// opened from: ?project=… in the browser, or the tool result in an MCP App) or all.

let scope = __APP__ ? "" : (new URLSearchParams(location.search).get("project") ?? "");
const scopeListeners = new Set<() => void>();
function setScope(p: string) {
  scope = p;
  if (!__APP__) {
    const u = new URL(location.href);
    if (p) u.searchParams.set("project", p);
    else u.searchParams.delete("project");
    history.replaceState(null, "", u);
  }
  queryClient.invalidateQueries();
  for (const l of scopeListeners) l();
}
function useScope(): string {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    scopeListeners.add(l);
    return () => void scopeListeners.delete(l);
  }, []);
  return scope;
}
const baseName = (p?: string) => String(p ?? "").split("/").filter(Boolean).pop() ?? "";
const tilde = (p?: string) => String(p ?? "").replace(/^\/(Users|home)\/[^/]+/, "~");
/** Work in another project than the one shown is marked with its folder name. */
const inScope = (x: any) => !scope || !x?.project || x.project === scope;

/** Polls the engine and reports when anything moved (the daemon has no push feed). */
function pollChanges(onChange: () => void, everyMs: number): () => void {
  let last = "";
  let stopped = false;
  const tick = async () => {
    try {
      const s = await api("/api/state");
      const sig = `${s.eventCount}:${s.activity?.length}:${s.running?.length}`;
      if (last && sig !== last) onChange();
      last = sig;
    } catch {
      /* the connection dot shows it */
    }
    if (!stopped) setTimeout(tick, everyMs);
  };
  tick();
  return () => {
    stopped = true;
  };
}

const source: ExplorerDataSource = {
  listInstances: (q) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) qs.set(k, String(v));
    if (scope) qs.set("project", scope);
    return api(`/api/explorer/instances?${qs}`);
  },
  getInstance: (key) => api(`/api/explorer/instances/${enc(key)}`),
  getTrace: async (key) => {
    try {
      return await api(`/api/explorer/instances/${enc(key)}/trace`);
    } catch (e: any) {
      if (/no trace/.test(e?.message)) return undefined;
      throw e;
    }
  },
  // Agent Graph uses the flow id as the definition key (see src/explorer-api.ts).
  getProcessXml: (flowId) => api(`/api/flows/${enc(flowId)}/bpmn`).catch(() => null),
  cancelInstance: (key) => api(`/api/instances/${enc(key)}/cancel`, {}),
  resolveIncident: (_instanceKey, incidentKey) => api(`/api/incidents/${enc(incidentKey)}/resolve`, {}),
  setVariables: (key, req) => api(`/api/instances/${enc(key)}/variables`, req),
  subscribe: (onChange) => pollChanges(onChange, 1500),
  agents: {
    listAgentInstances: (key) => api(`/api/explorer/instances/${enc(key)}/agents`),
    getAgentHistory: (key) => api(`/api/explorer/agents/${enc(key)}/history`),
  },
};

// ---------------- routing ----------------
// Routes: /inbox[/<taskKey>], /flows[/<flowId>], /instances[?instance=<key>&…].
// The pre-React explorer's hashes (task=K, instance=K, flow=ID) still work: the MCP
// tools and the CLI print them.

function normalize(raw: string): string {
  const h = raw.replace(/^#/, "");
  const legacy = h.match(/^(task|instance|flow)=(.+)$/);
  if (legacy) {
    const [, kind, id] = legacy;
    if (kind === "task") return `/inbox/${id}`;
    if (kind === "flow") return `/flows/${id}`;
    return `/instances?instance=${id}`;
  }
  return h.startsWith("/") ? h : "/inbox";
}

let setRouteFromOutside: ((r: string) => void) | undefined;
/** A route the MCP host sent before React mounted. */
let pendingRoute = "";

function useRoute(): [string, (r: string, replace?: boolean) => void] {
  const [route, setRoute] = useState(() => normalize(__APP__ ? pendingRoute : location.hash));
  useEffect(() => {
    setRouteFromOutside = (r) => setRoute(normalize(r));
    if (__APP__) return;
    const on = () => setRoute(normalize(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((r: string, replace = false) => {
    setRoute(r);
    if (__APP__) return;
    if (replace) history.replaceState(null, "", `#${r}`);
    else location.hash = r;
  }, []);
  return [route, go];
}

// ---------------- app ----------------

function useEngineState() {
  const sc = useScope();
  return useQuery({ queryKey: ["state", sc], queryFn: () => api(`/api/state${sc ? `?project=${enc(sc)}` : ""}`), refetchInterval: 1500 });
}

function Shell() {
  const [route, go] = useRoute();
  const state = useEngineState();
  const s = state.data;
  const [path, query = ""] = route.split("?");
  const [, section = "inbox", id] = path.split("/").map(decodeURIComponent);
  const sc = useScope();
  const tasks: any[] = (s?.userTasks ?? []).filter(inScope);
  const openIncidents: number = (s?.incidents ?? []).filter(inScope).length;

  useEffect(() => {
    document.title = tasks.length ? `(${tasks.length}) Agent Graph` : "Agent Graph";
  }, [tasks.length]);

  const tab = (name: string, label: ReactNode) => (
    <button
      type="button"
      onClick={() => go(`/${name}`)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        section === name ? "bg-accent/15 text-fg" : "text-fg-muted hover:bg-hover hover:text-fg"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-edge bg-panel px-4 py-2">
        <b className="text-sm">◆ Agent Graph</b>
        <ProjectPicker state={s} value={sc} />
        <nav className="ml-4 flex gap-1">
          {tab(
            "inbox",
            <>
              Inbox {tasks.length > 0 && <Badge tone="accent">{tasks.length}</Badge>}
            </>,
          )}
          {tab("flows", "Flows")}
          {tab(
            "instances",
            <>
              Instances {openIncidents > 0 && <Badge tone="danger">{openIncidents}</Badge>}
            </>,
          )}
        </nav>
        <span
          title={state.isError ? "engine not reachable" : "connected"}
          className={`ml-auto h-2.5 w-2.5 rounded-full ${state.isError ? "bg-danger" : s ? "bg-ok" : "bg-fg-faint"}`}
        />
      </header>
      <main className="min-h-0 flex-1">
        {section === "instances" ? (
          <InstancesView query={query} go={go} />
        ) : section === "flows" ? (
          <FlowsView state={s} flowId={id} go={go} />
        ) : (
          <InboxView state={s} taskKey={id} go={go} />
        )}
      </main>
    </div>
  );
}

/** Which project the explorer shows: one, or all of them. The engine serves every
 *  project; runs started outside a project (Claude Desktop) belong to the library folder. */
function ProjectPicker({ state, value }: { state: any; value: string }) {
  const projects: { path: string; name: string }[] = state?.projects ?? [];
  const home: string | undefined = state?.home;
  const listed = [...projects.map((p) => p.path), ...(home ? [home] : [])];
  const extra = value && !listed.includes(value) ? [{ path: value, name: baseName(value) }] : [];
  const hint = !value
    ? "Showing runs and tasks from every project, and the global flows."
    : value === home
      ? `Runs started outside a project (e.g. in Claude Desktop). They work in ${home}.`
      : `Runs, tasks and flows of the project in ${value}, plus the global flows.`;
  return (
    <label className="flex items-center gap-2 text-xs text-fg-muted" title={hint}>
      Project
      <select
        aria-label="Project"
        value={value}
        onChange={(e) => setScope(e.target.value)}
        className="rounded-md border border-edge bg-panel px-2 py-1 text-xs text-fg"
      >
        <option value="">All projects</option>
        {(projects.length > 0 || extra.length > 0) && (
          <optgroup label="Projects">
            {[...extra, ...projects].map((p) => (
              <option key={p.path} value={p.path}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
        {home && (
          <optgroup label="Outside a project">
            <option value={home}>No project (Claude Desktop) · {baseName(home)}</option>
          </optgroup>
        )}
      </select>
    </label>
  );
}

function InstancesView({ query, go }: { query: string; go: (r: string, replace?: boolean) => void }) {
  const searchParams = useMemo(() => new URLSearchParams(query), [query]);
  const setSearchParams = useCallback(
    (update: (prev: URLSearchParams) => URLSearchParams, options?: { replace?: boolean }) => {
      const next = update(new URLSearchParams(query)).toString();
      go(`/instances${next ? `?${next}` : ""}`, options?.replace);
    },
    [query, go],
  );
  return <Explorer searchParams={searchParams} setSearchParams={setSearchParams} />;
}

function Sidebar({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <aside className="w-72 shrink-0 overflow-auto border-r border-edge bg-panel p-3">
      <SectionLabel>{title}</SectionLabel>
      <ul className="flex flex-col gap-1">{children}</ul>
    </aside>
  );
}

function Item({ selected, onClick, title, sub }: { selected: boolean; onClick: () => void; title: ReactNode; sub?: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-md px-2 py-1.5 text-left transition-colors ${selected ? "bg-accent/15" : "hover:bg-hover"}`}
      >
        <div className="text-sm font-medium text-fg">{title}</div>
        {sub && <div className="truncate text-xs text-fg-muted">{sub}</div>}
      </button>
    </li>
  );
}

// ---------------- inbox ----------------

function InboxView({ state, taskKey, go }: { state: any; taskKey?: string; go: (r: string, replace?: boolean) => void }) {
  const all: any[] = state?.userTasks ?? [];
  const tasks = all.filter(inScope);
  const away = all.length - tasks.length;
  const sessionJobs: any[] = (state?.sessionJobs ?? []).filter((j: any) => j.state === "Created" && inScope(j));
  // A linked task shows even when it belongs to another project.
  const task = all.find((t) => t.key === taskKey) ?? (taskKey ? undefined : tasks[0]);
  return (
    <div className="flex h-full">
      <Sidebar title={`Waiting for you · ${tasks.length}`}>
        {tasks.length === 0 && <li className="px-2 text-xs text-fg-faint">Nothing waiting.</li>}
        {tasks.map((t) => (
          <Item
            key={t.key}
            selected={t.key === task?.key}
            onClick={() => go(`/inbox/${t.key}`)}
            title={t.form?.title ?? t.elementId}
            sub={`${t.flowId} #${t.instanceKey}${t.title ? ` · ${t.title}` : ""}${scope ? "" : ` · ${baseName(t.project)}`}`}
          />
        ))}
        {away > 0 && (
          <li className="px-2 pt-2 text-xs text-fg-muted">
            <button type="button" className="underline" onClick={() => setScope("")}>
              {away} more in other projects
            </button>
          </li>
        )}
      </Sidebar>
      <section className="min-w-0 flex-1 overflow-auto p-6">
        {sessionJobs.length > 0 && (
          <Card className="mb-4 p-3 text-sm">
            🤖 {sessionJobs.length} agent step{sessionJobs.length > 1 ? "s" : ""} ({sessionJobs.map((j) => j.elementId).join(", ")}) waiting for
            Claude — say <b>“continue the flow”</b> in the chat.
          </Card>
        )}
        {task ? (
          <TaskForm key={task.key} task={task} onDone={() => go(`/instances?instance=${task.instanceKey}`)} />
        ) : taskKey ? (
          <EmptyState title={`Task ${taskKey} is no longer open.`} action={<Button onClick={() => go("/inbox")}>Back to the inbox</Button>} />
        ) : (
          <EmptyState title="No tasks are waiting for you." hint="When a flow reaches a human step, its form appears here." />
        )}
      </section>
    </div>
  );
}

function TaskForm({ task, onDone }: { task: any; onDone: () => void }) {
  const form = task.form ?? { fields: { response: { type: "string", title: "Your answer" } } };
  const required = new Set<string>(form.required ?? []);
  const fields = Object.entries<any>(form.fields);
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.map(([name, f]) => [name, f.default ?? (f.type === "boolean" ? false : "")])),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const vars: Record<string, unknown> = {};
    for (const [name, f] of fields) {
      const v = values[name];
      if (f.type === "boolean") vars[name] = !!v;
      else if (f.type === "number" || f.type === "integer") {
        if (v !== "") vars[name] = Number(v);
      } else if (v !== "" || required.has(name)) vars[name] = v;
    }
    const missing = [...required].find((r) => vars[r] === undefined || vars[r] === "");
    if (missing) return setError(`${form.fields[missing]?.title ?? missing} is required`);
    setBusy(true);
    try {
      await api(`/api/user-tasks/${enc(task.key)}/complete`, { variables: vars });
      await qc.invalidateQueries();
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl p-6">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold">{form.title ?? task.elementId}</h1>
          <div className="text-xs text-fg-muted">
            {task.flowId} · instance #{task.instanceKey}
            {task.title ? ` · ${task.title}` : ""}
          </div>
        </div>
        {form.description && <pre className="whitespace-pre-wrap rounded-md bg-inset p-3 text-sm">{form.description}</pre>}
        {fields.map(([name, f]) => (
          <label key={name} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {f.title ?? name}
              {required.has(name) ? " *" : ""}
            </span>
            {f.description && <span className="text-xs text-fg-muted">{f.description}</span>}
            {f.type === "boolean" ? (
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!values[name]}
                onChange={(e) => setValues({ ...values, [name]: e.target.checked })}
              />
            ) : f.enum ? (
              <select className={inputClass} value={String(values[name] ?? "")} onChange={(e) => setValues({ ...values, [name]: e.target.value })}>
                {!required.has(name) && <option value="" />}
                {f.enum.map((v: string, i: number) => (
                  <option key={v} value={v}>
                    {f.enumNames?.[i] ?? v}
                  </option>
                ))}
              </select>
            ) : f.type === "number" || f.type === "integer" ? (
              <input
                type="number"
                className={inputClass}
                value={String(values[name] ?? "")}
                onChange={(e) => setValues({ ...values, [name]: e.target.value })}
              />
            ) : (
              <textarea
                rows={3}
                className={inputClass}
                value={String(values[name] ?? "")}
                onChange={(e) => setValues({ ...values, [name]: e.target.value })}
              />
            )}
          </label>
        ))}
        {error && <ErrorText>{error}</ErrorText>}
        <div>
          <Button type="submit" variant="primary" disabled={busy}>
            Complete
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ---------------- flows ----------------

function FlowsView({ state, flowId, go }: { state: any; flowId?: string; go: (r: string, replace?: boolean) => void }) {
  const flows: any[] = state?.flows ?? [];
  const problems: any[] = state?.problems ?? [];
  // Routes name a flow by key (unique across projects); old links by id.
  const flow = flows.find((f) => f.key === flowId) ?? flows.find((f) => f.id === flowId) ?? (flowId ? undefined : flows[0]);
  const xml = useQuery({
    queryKey: ["flow-xml", flow?.key],
    queryFn: () => api(`/api/flows/${enc(flow!.key)}/bpmn`) as Promise<string>,
    enabled: !!flow,
  });
  const active = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of state?.instances ?? []) if (i.flowKey === flow?.key && inScope(i) && !i.completed) for (const a of i.activeElements) counts[a] = (counts[a] ?? 0) + 1;
    return counts;
  }, [state, flow?.key]);

  return (
    <div className="flex h-full">
      <Sidebar title="Flows">
        {segments(state).map(([label, list, empty]) => (
          <li key={label} className="mb-3">
            {segments(state).length > 1 && <div className="px-2 pb-1 text-xs font-medium text-fg-muted">{label}</div>}
            <ul className="flex flex-col gap-1">
              {list.length === 0 && <li className="px-2 text-xs text-fg-faint">{empty}</li>}
              {list.map((f) => (
                <Item key={f.key} selected={f.key === flow?.key} onClick={() => go(`/flows/${f.key}`)} title={f.id} sub={f.description ?? f.file} />
              ))}
            </ul>
          </li>
        ))}
        {problems.length > 0 && (
          <li className="mt-4">
            <SectionLabel>Problems</SectionLabel>
            {problems.flatMap((p) =>
              p.problems.map((q: any, i: number) => (
                <div key={`${p.file}-${i}`} className={`px-2 text-xs ${q.severity === "error" ? "text-danger" : "text-warn"}`}>
                  {p.file}: {q.message}
                </div>
              )),
            )}
          </li>
        )}
      </Sidebar>
      {flow ? (
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="h-1/2 min-h-64 border-b border-edge bg-white">
            <BpmnViewer
              xml={xml.data ?? null}
              activeElementIds={Object.keys(active)}
              badges={Object.entries(active).map(([elementId, n]) => ({
                elementId,
                label: String(n),
                title: `${n} active instance${n > 1 ? "s" : ""}`,
                tone: "active" as const,
              }))}
              onBadgeClick={() => go(`/instances?state=Active`)}
            />
          </div>
          <div className="flex-1 overflow-auto p-6">
            <StartForm key={flow.key} flow={flow} home={state?.home} go={go} />
          </div>
        </section>
      ) : (
        <section className="flex-1 p-6">
          <EmptyState title={flowId ? `No flow ${flowId}` : "No flows yet"} hint="Flows in flows/*.flow.ts deploy automatically." />
        </section>
      )}
    </div>
  );
}

/** The flows list in sections: the shown project's own flows/, then the global ones
 *  (~/AgentGraph/flows, offered in every project). With all projects shown: a section
 *  per project. */
function segments(state: any): [string, any[], ReactNode][] {
  const flows: any[] = state?.flows ?? [];
  const global: [string, any[], ReactNode] = [
    "Global flows",
    flows.filter((f) => f.scope === "global"),
    <>
      None in <code>{tilde(state?.globalDir)}/flows</code>.
    </>,
  ];
  const none = (name: string) => (
    <>
      None yet — add <code>flows/&lt;name&gt;.flow.ts</code> in {name}.
    </>
  );
  if (scope && scope === state?.home) return [global];
  if (scope) return [[`Project flows · ${baseName(scope)}`, flows.filter((f) => f.scope !== "global"), none(baseName(scope))], global];
  const byProject = new Map<string, any[]>();
  for (const p of state?.projects ?? []) byProject.set(p.path, []);
  for (const f of flows) if (f.scope !== "global") byProject.set(f.project, [...(byProject.get(f.project) ?? []), f]);
  return [...[...byProject].map(([p, list]) => [baseName(p), list, none(baseName(p))] as [string, any[], ReactNode]), global];
}

function StartForm({ flow, home, go }: { flow: any; home?: string; go: (r: string) => void }) {
  // Project flows run in their project; global ones in the project shown (else the library).
  const where: string = flow.project ?? (scope || home || "");
  const [title, setTitle] = useState("");
  const [vars, setVars] = useState("{}");
  const [error, setError] = useState("");
  async function start(e: FormEvent) {
    e.preventDefault();
    try {
      const variables = JSON.parse(vars || "{}");
      const r = await api("/api/start", { flowId: flow.key, variables, title: title || undefined, project: where || undefined });
      go(`/instances?instance=${r.instanceKey}`);
    } catch (err: any) {
      setError(err.message);
    }
  }
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <form onSubmit={start} className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          Start {flow.id}
          {flow.scope === "global" && (
            <span title={flow.file}>
              <Badge tone="info">global</Badge>
            </span>
          )}
        </h2>
        <p className="-mt-2 text-xs text-fg-muted">
          Runs in <code title={where}>{tilde(where)}</code>
          {flow.scope === "global" && !scope && " — pick a project above to run it there"}
        </p>
        <input className={inputClass} placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={`${inputClass} font-mono`} rows={4} value={vars} onChange={(e) => setVars(e.target.value)} aria-label="Variables (JSON)" />
        {error && <ErrorText>{error}</ErrorText>}
        <div>
          <Button type="submit" variant="primary">
            Start instance
          </Button>
        </div>
      </form>
      <div>
        <SectionLabel>Steps</SectionLabel>
        <ul className="flex flex-col gap-1 text-sm">
          {flow.tasks.map((t: any) => (
            <li key={t.name}>
              {t.agent ? "🤖" : "⚙️"} {t.name} <span className="text-xs text-fg-muted">{t.jobType}</span>
            </li>
          ))}
          {flow.humans.map((h: any) => (
            <li key={h.name}>
              🙋 {h.name} <span className="text-xs text-fg-muted">form {h.form}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------- boot ----------------

document.documentElement.dataset.appearance = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function mount() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ExplorerDataProvider source={source}>
          <Shell />
        </ExplorerDataProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

if (__APP__) {
  document.documentElement.classList.add("app");
  app = new App({ name: "Agent Graph explorer", version: "0.9.2" }, {}, { autoResize: true });
  app.ontoolresult = (r: any) => {
    const p = r?.structuredContent?.project;
    if (typeof p === "string" && p !== scope) setScope(p);
    const h = r?.structuredContent?.hash;
    if (typeof h !== "string" || !h) return;
    if (setRouteFromOutside) setRouteFromOutside(h);
    else pendingRoute = h;
  };
  app.connect().then(mount);
} else mount();
