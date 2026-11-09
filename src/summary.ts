// One-screen text summary of the engine state (CLI, MCP, hooks). The engine serves every
// project: flows are the ones `project` can start; runs, tasks and incidents are listed
// for all projects, with work elsewhere marked by its project's folder name.
import path from "node:path";

export function summarize(state: any, project?: string): string {
  const here = project ? path.resolve(project) : state.project;
  const where = (p?: string) => (p && p !== here ? ` [${path.basename(p)}]` : "");
  const lines: string[] = [];
  lines.push(`project: ${here ?? "(all)"}`);
  const own = state.flows.filter((f: any) => f.scope !== "global").map((f: any) => f.id);
  const global = state.flows.filter((f: any) => f.scope === "global").map((f: any) => f.id);
  lines.push(`project flows: ${own.join(", ") || "(none — add flows/*.flow.ts)"}`);
  if (global.length) lines.push(`global flows (${tilde(state.globalDir)}/flows): ${global.join(", ")}`);
  for (const p of state.problems) for (const q of p.problems) lines.push(`  ${q.severity} ${p.file}: ${q.message}`);
  const active = state.instances.filter((i: any) => !i.completed);
  const elsewhere = active.filter((i: any) => i.project && i.project !== here).length;
  lines.push(`instances: ${active.length} active${elsewhere ? ` (${elsewhere} in other projects)` : ""}, ${state.instances.length - active.length} finished`);
  for (const i of active) lines.push(`  ${i.key} ${i.flowId}${where(i.project)}${i.title ? ` "${i.title}"` : ""} @ ${i.activeElements.join(", ") || "-"}`);
  if (state.userTasks.length) lines.push(`user tasks waiting: ${state.userTasks.length}`);
  for (const t of state.userTasks)
    lines.push(`  task ${t.key}: ${t.flowId}/${t.elementId}${where(t.project)} (instance ${t.instanceKey})${t.form?.title ? ` — ${t.form.title}` : ""}`);
  const mine = state.sessionJobs.filter((j: any) => j.state === "Created" && (!here || !j.project || j.project === here)).length;
  if (mine) lines.push(`session jobs waiting for this Claude session: ${mine}`);
  for (const i of state.incidents) lines.push(`  INCIDENT ${i.key} at ${i.elementId}${where(i.project)} (instance ${i.instanceKey}): ${i.reason}`);
  for (const r of state.running) lines.push(`  running ${r.elementId} (${r.type})${where(r.project)} for ${Math.round((Date.now() - r.since) / 1000)}s`);
  return lines.join("\n");
}

function tilde(p = ""): string {
  const h = process.env.HOME;
  return h && p.startsWith(h) ? `~${p.slice(h.length)}` : p;
}
