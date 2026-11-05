// One-screen text summary of the daemon state (CLI, MCP, hooks).
export function summarize(state: any): string {
  const lines: string[] = [];
  lines.push(`project: ${state.project}`);
  lines.push(`flows: ${state.flows.map((f: any) => f.id).join(", ") || "(none — add flows/*.flow.ts)"}`);
  for (const p of state.problems) for (const q of p.problems) lines.push(`  ${q.severity} ${p.file}: ${q.message}`);
  const active = state.instances.filter((i: any) => !i.completed);
  lines.push(`instances: ${active.length} active, ${state.instances.length - active.length} finished`);
  for (const i of active) lines.push(`  ${i.key} ${i.flowId}${i.title ? ` "${i.title}"` : ""} @ ${i.activeElements.join(", ") || "-"}`);
  if (state.userTasks.length) lines.push(`user tasks waiting: ${state.userTasks.length}`);
  for (const t of state.userTasks) lines.push(`  task ${t.key}: ${t.flowId}/${t.elementId} (instance ${t.instanceKey})${t.form?.title ? ` — ${t.form.title}` : ""}`);
  if (state.sessionJobs.length) lines.push(`session jobs waiting for this Claude session: ${state.sessionJobs.filter((j: any) => j.state === "Created").length}`);
  for (const i of state.incidents) lines.push(`  INCIDENT ${i.key} at ${i.elementId} (instance ${i.instanceKey}): ${i.reason}`);
  for (const r of state.running) lines.push(`  running ${r.elementId} (${r.type}) for ${Math.round((Date.now() - r.since) / 1000)}s`);
  return lines.join("\n");
}

