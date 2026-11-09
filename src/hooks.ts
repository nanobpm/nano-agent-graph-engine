// Claude Code hooks: tell the agent about work waiting in the engine (this project's in
// detail, other projects' as a count). Never starts the engine and stays silent when nothing is pending, so it costs nothing in projects
// without flows.
import fs from "node:fs";
import path from "node:path";
import { engineDir, projectSlug, resolveProject } from "./paths.ts";
import { EngineClient } from "./client.ts";

async function readStdin(): Promise<any> {
  if (process.stdin.isTTY) return {};
  let s = "";
  for await (const c of process.stdin) s += c;
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export async function runHook(projectArg: string, event = "UserPromptSubmit") {
  const input = await readStdin();
  const project = input.cwd ? resolveProject(input.cwd) : projectArg;
  const c = await EngineClient.find(project);
  if (!c) return;
  const s = await c.state();
  const here = (x: any) => !x.project || x.project === path.resolve(project);
  const tasks = (s.userTasks as any[]).filter(here);
  const sessionJobs = (s.sessionJobs as any[]).filter((j) => j.state === "Created" && here(j));
  const incidents = (s.incidents as any[]).filter(here);
  const elsewhere = [...(s.userTasks as any[]), ...(s.incidents as any[])].filter((x) => !here(x));
  const keys = [
    ...tasks.map((t) => `t${t.key}`),
    ...sessionJobs.map((j) => `j${j.key}`),
    ...incidents.map((i) => `i${i.key}`),
    ...(event === "SessionStart" ? elsewhere.map((x) => `e${x.key}`) : []),
  ].sort();
  if (!keys.length) return;

  // On each prompt, only speak up when something new is waiting.
  const seenFile = path.join(engineDir(), `hook-seen-${projectSlug(project)}.json`);
  if (event === "UserPromptSubmit") {
    let seen: string[] = [];
    try {
      seen = JSON.parse(fs.readFileSync(seenFile, "utf8"));
    } catch {
      /* first time */
    }
    if (keys.every((k) => seen.includes(k))) return;
  }
  fs.writeFileSync(seenFile, JSON.stringify(keys));

  const lines = ["Agent Graph Engine — work waiting in this project's flows:"];
  for (const t of tasks)
    lines.push(`- user task ${t.key}: ${t.flowId}/${t.elementId}${t.title ? ` "${t.title}"` : ""}${t.form?.title ? ` — ${t.form.title}` : ""} (${c.explorerUrl(`task=${t.key}`)})`);
  if (elsewhere.length) {
    const names = [...new Set(elsewhere.map((x) => path.basename(x.project)))];
    lines.push(`- ${elsewhere.length} task(s)/incident(s) waiting in other projects (${names.join(", ")}) — flow_status lists them`);
  }
  if (sessionJobs.length) lines.push(`- ${sessionJobs.length} job(s) assigned to this session (session_job_next)`);
  for (const i of incidents) lines.push(`- incident ${i.key} at ${i.elementId} (instance ${i.instanceKey}): ${String(i.reason).slice(0, 200)} (${c.explorerUrl(`instance=${i.instanceKey}`)})`);
  lines.push(
    `Mention these to the user when relevant. To answer a user task, call task_ask (it shows the form to the user) — never fill it in yourself. Explorer: ${c.explorerUrl()}`,
  );
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: lines.join("\n") } }));
}
