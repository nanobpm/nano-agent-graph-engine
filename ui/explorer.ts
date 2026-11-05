// Agent Graph Engine — web explorer. Served by the daemon at "/". Polls /api/state.
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";

type State = any;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function api(path: string, body?: unknown) {
  const r = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ct = r.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await r.json() : await r.text();
  if (!r.ok) throw new Error((data as any)?.error ?? r.statusText);
  return data;
}

let state: State | undefined;
let sel: { kind: "flow" | "instance" | "task"; id: string } | undefined;
const viewer = new NavigatedViewer({ container: "#canvas" });
let shownXmlFor: string | undefined;
let markers: { id: string; cls: string }[] = [];
let overlayIds: string[] = [];

function parseHash() {
  const m = location.hash.match(/^#(flow|instance|task)=(.+)$/);
  sel = m ? { kind: m[1] as any, id: decodeURIComponent(m[2]) } : undefined;
}

function toast(msg: string, bad = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = bad ? "show bad" : "show";
  setTimeout(() => (t.className = ""), 3000);
}

async function showDiagram(flowId: string) {
  if (shownXmlFor === flowId) return;
  const xml = await api(`/api/flows/${encodeURIComponent(flowId)}/bpmn`);
  await viewer.importXML(xml);
  (viewer.get("canvas") as any).zoom("fit-viewport", "auto");
  shownXmlFor = flowId;
  markers = [];
  overlayIds = [];
}

function paint(next: { id: string; cls: string }[], badges: Record<string, string>) {
  const canvas: any = viewer.get("canvas");
  const reg: any = viewer.get("elementRegistry");
  const overlays: any = viewer.get("overlays");
  for (const m of markers) if (reg.get(m.id)) canvas.removeMarker(m.id, m.cls);
  for (const o of overlayIds) overlays.remove(o);
  markers = next.filter((m) => reg.get(m.id));
  overlayIds = [];
  for (const m of markers) canvas.addMarker(m.id, m.cls);
  for (const [id, text] of Object.entries(badges)) {
    if (!reg.get(id)) continue;
    overlayIds.push(overlays.add(id, { position: { top: -10, right: 10 }, html: `<div class="badge">${esc(text)}</div>` }));
  }
}

function renderSidebar() {
  const s = state!;
  const flows = s.flows
    .map(
      (f: any) => `<li class="${sel?.kind === "flow" && sel.id === f.id ? "sel" : ""}"><a href="#flow=${esc(f.id)}"><b>${esc(f.id)}</b></a>
      <div class="dim">${esc(f.description ?? f.file)}</div></li>`,
    )
    .join("");
  const problems = s.problems
    .flatMap((p: any) => p.problems.map((q: any) => `<li class="${q.severity}">${esc(p.file)}: ${esc(q.message)}</li>`))
    .join("");
  const inst = [...s.instances]
    .reverse()
    .slice(0, 50)
    .map((i: any) => {
      const inc = s.incidents.some((x: any) => x.instanceKey === i.key);
      const st = inc ? "incident" : i.completed ? "done" : i.state === "Active" ? "active" : String(i.state).toLowerCase();
      return `<li class="${sel?.kind === "instance" && sel.id === i.key ? "sel" : ""}"><a href="#instance=${i.key}">
        <span class="pill ${st}">${esc(st)}</span> ${esc(i.flowId)} <span class="dim">#${i.key}</span></a>
        <div class="dim">${esc(i.title ?? "")} ${i.completed ? "" : esc(i.activeElements.join(", "))}</div></li>`;
    })
    .join("");
  const tasks = s.userTasks
    .map(
      (t: any) => `<li class="${sel?.kind === "task" && sel.id === t.key ? "sel" : ""}"><a href="#task=${t.key}"><b>${esc(t.form?.title ?? t.elementId)}</b></a>
      <div class="dim">${esc(t.flowId)} #${t.instanceKey}${t.title ? ` · ${esc(t.title)}` : ""}</div></li>`,
    )
    .join("");
  $("#side").innerHTML = `
    <h2>Tasks <span class="count">${s.userTasks.length}</span></h2><ul>${tasks || '<li class="dim">nothing waiting</li>'}</ul>
    <h2>Flows</h2><ul>${flows || '<li class="dim">no flows — add flows/*.flow.ts</li>'}</ul>
    ${problems ? `<h2>Problems</h2><ul class="problems">${problems}</ul>` : ""}
    <h2>Instances</h2><ul>${inst || '<li class="dim">none yet</li>'}</ul>`;
  document.title = s.userTasks.length ? `(${s.userTasks.length}) Agent Graph` : "Agent Graph";
  $("#project").textContent = s.project;
}

function formHtml(t: any) {
  const form = t.form ?? { fields: { response: { type: "string", title: "Your answer" } } };
  const req = new Set<string>(form.required ?? []);
  const fields = Object.entries<any>(form.fields)
    .map(([name, f]) => {
      const label = `<label for="f_${name}">${esc(f.title ?? name)}${req.has(name) ? " *" : ""}</label>`;
      const help = f.description ? `<div class="dim">${esc(f.description)}</div>` : "";
      let input: string;
      if (f.type === "boolean") input = `<input type="checkbox" id="f_${name}" name="${name}" ${f.default ? "checked" : ""}>`;
      else if (f.enum)
        input = `<select id="f_${name}" name="${name}">${req.has(name) ? "" : '<option value=""></option>'}${f.enum
          .map((v: string, i: number) => `<option value="${esc(v)}" ${f.default === v ? "selected" : ""}>${esc(f.enumNames?.[i] ?? v)}</option>`)
          .join("")}</select>`;
      else if (f.type === "number" || f.type === "integer") input = `<input type="number" id="f_${name}" name="${name}" value="${esc(f.default ?? "")}">`;
      else input = `<textarea id="f_${name}" name="${name}" rows="3">${esc(f.default ?? "")}</textarea>`;
      return `<div class="field">${label}${help}${input}</div>`;
    })
    .join("");
  return `<form id="taskform"><h3>${esc(form.title ?? t.elementId)}</h3>
    ${form.description ? `<pre class="desc">${esc(form.description)}</pre>` : ""}
    ${fields}<button type="submit">Complete</button></form>`;
}

async function submitTask(t: any) {
  const form = t.form ?? { fields: { response: { type: "string" } } };
  const vars: Record<string, unknown> = {};
  for (const [name, f] of Object.entries<any>(form.fields)) {
    const el = document.getElementById(`f_${name}`) as HTMLInputElement;
    if (f.type === "boolean") vars[name] = el.checked;
    else if (f.type === "number" || f.type === "integer") {
      if (el.value !== "") vars[name] = Number(el.value);
    } else if (el.value !== "" || (form.required ?? []).includes(name)) vars[name] = el.value;
  }
  for (const r of form.required ?? []) if (vars[r] === undefined || vars[r] === "") return toast(`${r} is required`, true);
  await api(`/api/user-tasks/${t.key}/complete`, { variables: vars });
  toast("Task completed");
  location.hash = `#instance=${t.instanceKey}`;
}

function startHtml(f: any) {
  return `<form id="startform"><h3>Start ${esc(f.id)}</h3>
    <div class="field"><label>Title</label><input id="st_title" placeholder="optional label"></div>
    <div class="field"><label>Variables (JSON)</label><textarea id="st_vars" rows="4">{}</textarea></div>
    <button type="submit">Start instance</button></form>
    <h3>Steps</h3><ul class="steps">
      ${f.tasks.map((t: any) => `<li>${t.agent ? "🤖" : "⚙️"} ${esc(t.name)} <span class="dim">${esc(t.jobType)}</span></li>`).join("")}
      ${f.humans.map((h: any) => `<li>🙋 ${esc(h.name)} <span class="dim">form ${esc(h.form)}</span></li>`).join("")}
    </ul>`;
}

let detailKey = "";
async function renderMain() {
  const s = state!;
  const panel = $("#panel");
  if (!sel) {
    const first = s.userTasks[0] ? `task=${s.userTasks[0].key}` : s.flows[0] ? `flow=${s.flows[0].id}` : "";
    if (first) location.hash = first;
    else panel.innerHTML = `<p class="dim">Add a flow in <code>flows/&lt;name&gt;.flow.ts</code> — it deploys automatically.</p>`;
    return;
  }
  if (sel.kind === "flow") {
    const f = s.flows.find((x: any) => x.id === sel!.id);
    if (!f) return void (panel.innerHTML = `<p>No flow ${esc(sel.id)}</p>`);
    await showDiagram(f.id);
    const counts: Record<string, string> = {};
    for (const i of s.instances) if (i.flowId === f.id && !i.completed) for (const a of i.activeElements) counts[a] = String(Number(counts[a] ?? 0) + 1);
    paint(Object.keys(counts).map((id) => ({ id, cls: "active" })), counts);
    if (detailKey !== `flow:${f.id}`) {
      detailKey = `flow:${f.id}`;
      panel.innerHTML = startHtml(f);
      $("#startform").onsubmit = async (e) => {
        e.preventDefault();
        try {
          const vars = JSON.parse(($("#st_vars") as HTMLTextAreaElement).value || "{}");
          const r = await api("/api/start", { flowId: f.id, variables: vars, title: ($("#st_title") as HTMLInputElement).value || undefined });
          location.hash = `#instance=${r.instanceKey}`;
        } catch (err: any) {
          toast(err.message, true);
        }
      };
    }
    return;
  }
  const key = sel.kind === "task" ? s.userTasks.find((t: any) => t.key === sel!.id)?.instanceKey : sel.id;
  if (!key) return void (panel.innerHTML = `<p class="dim">Task ${esc(sel.id)} is no longer open.</p>`);
  const d = await api(`/api/instances/${key}`);
  if (d.processId) await showDiagram(d.processId);
  const reg: any = viewer.get("elementRegistry");
  const flowIds = d.history.flows
    .map(([a, b]: [string, string]) => reg.filter((e: any) => e.type === "bpmn:SequenceFlow" && e.source?.id === a && e.target?.id === b)[0]?.id)
    .filter(Boolean);
  const active = (d.activeElements ?? []).map((a: any) => a.elementId);
  const incident = d.incidents.map((i: any) => i.elementId);
  const badges: Record<string, string> = {};
  for (const [id, n] of Object.entries<number>(d.history.completed)) if (n > 1) badges[id] = `×${n}`;
  paint(
    [
      ...Object.keys(d.history.completed).map((id) => ({ id, cls: "done" })),
      ...flowIds.map((id: string) => ({ id, cls: "taken" })),
      ...active.map((id: string) => ({ id, cls: "active" })),
      ...incident.map((id: string) => ({ id, cls: "incident" })),
    ],
    badges,
  );
  const task = sel.kind === "task" ? d.userTasks.find((t: any) => t.key === sel!.id) : d.userTasks[0];
  const sig = JSON.stringify([sel, d.state, active, d.incidents.length, d.activity.length, task?.key]);
  if (detailKey === sig) return;
  // Don't wipe a form the user is typing in.
  if (task && document.getElementById("taskform") && panel.contains(document.activeElement)) return;
  detailKey = sig;
  panel.innerHTML = `
    <div class="head"><b>${esc(d.processId)}</b> #${esc(d.key)} ${d.title ? `· ${esc(d.title)}` : ""}
      <span class="pill ${d.completed ? "done" : d.incidents.length ? "incident" : "active"}">${d.completed ? "completed" : d.incidents.length ? "incident" : esc(d.state)}</span>
      ${d.completed ? "" : `<button id="cancel" class="ghost">Cancel</button>`}</div>
    ${task ? formHtml(task) : ""}
    ${d.incidents
      .map(
        (i: any) =>
          `<div class="incident-box"><b>Incident at ${esc(i.elementId)}</b><pre>${esc(i.reason)}</pre><button data-inc="${i.key}">Retry</button></div>`,
      )
      .join("")}
    <h3>Variables</h3><pre class="vars">${esc(JSON.stringify(Object.keys(d.variables ?? {}).length ? d.variables : d.history.variables, null, 2))}</pre>
    <h3>Activity</h3><ul class="activity">${[...d.activity]
      .reverse()
      .map((a: any) => `<li><span class="dim">${esc(a.at.slice(11, 19))}</span> ${esc(a.message)}${a.costUsd ? ` <span class="dim">$${a.costUsd.toFixed(3)}</span>` : ""}</li>`)
      .join("")}</ul>`;
  if (task) $("#taskform").onsubmit = (e) => (e.preventDefault(), submitTask(task).catch((err) => toast(err.message, true)));
  const c = document.getElementById("cancel");
  if (c) c.onclick = () => confirm("Cancel this instance?") && api(`/api/instances/${d.key}/cancel`, {}).then(refresh);
  panel.querySelectorAll<HTMLButtonElement>("[data-inc]").forEach((b) => (b.onclick = () => api(`/api/incidents/${b.dataset.inc}/resolve`, {}).then(refresh)));
}

let busy = false;
async function refresh() {
  if (busy) return;
  busy = true;
  try {
    state = await api("/api/state");
    $("#conn").className = "ok";
    renderSidebar();
    await renderMain();
  } catch (e: any) {
    $("#conn").className = "bad";
  } finally {
    busy = false;
  }
}

window.addEventListener("hashchange", () => {
  parseHash();
  detailKey = "";
  refresh();
});
parseHash();
refresh();
setInterval(refresh, 1500);
