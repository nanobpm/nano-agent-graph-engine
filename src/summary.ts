// One-screen text summary of the engine state (CLI, MCP, hooks). The engine serves every
// project: flows are the ones `project` can start; runs, tasks and incidents are listed
// for all projects, with work elsewhere marked by its project's folder name.
import path from "node:path";

export function summarize(state: any, project?: string): string {
  const here = project ? path.resolve(project) : state.project;
  const where = (p?: string) => (p && p !== here ? ` [${path.basename(p)}]` : "");
  const lines: string[] = [];
  lines.push(`project: ${here ?? "(all)"}`);
  // A flow with an input shows it: review(pr: integer, note?: string)
  const sig = (f: any) => (f.input ? `${f.id}(${f.input.fields.map((x: any) => `${x.name}${x.optional ? "?" : ""}: ${x.type}${x.list ? "[]" : ""}`).join(", ")})` : f.id);
  const own = state.flows.filter((f: any) => f.scope !== "global").map(sig);
  const global = state.flows.filter((f: any) => f.scope === "global").map(sig);
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

/** A flow's agent steps as text: who runs each and why, plus how to change it. */
export function formatAgentPlan(plan: any): string {
  const lines = [`Agent steps of ${plan.flowId}:`];
  if (!plan.steps.length) lines.push("  (none)");
  for (const s of plan.steps) {
    const r = s.resolved;
    const runs = r.error ? `ERROR ${r.error}` : r.use ? `${r.use}${r.model ? ` (${r.model})` : ""}` : "chat assistant";
    const why = r.error ? "" : ` — ${r.reason}${r.skipped ? `; flow suggests ${r.skipped}` : ""}`;
    lines.push(`  ${s.step.padEnd(18)} ${s.jobType.padEnd(24)} → ${runs}${why}`);
  }
  const mine: string[] = [];
  if (plan.flow.use || plan.flow.model) mine.push(`flow: ${[plan.flow.use, plan.flow.model && `model ${plan.flow.model}`].filter(Boolean).join(", ")}`);
  for (const [rank, use] of Object.entries(plan.ranks ?? {})) mine.push(`rank ${rank}: ${use}`);
  if (plan.default) mine.push(`default: ${plan.default}`);
  if (mine.length) lines.push(`Your settings: ${mine.join("; ")}`);
  const inst = plan.profiles.filter((p: any) => p.installed).map((p: any) => p.name);
  lines.push(`Installed agent CLIs: ${inst.join(", ") || "none"}`);
  return lines.join("\n");
}
