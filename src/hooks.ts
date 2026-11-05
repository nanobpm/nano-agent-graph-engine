// Claude Code hooks: tell the agent about work waiting in the engine. Never starts the
// daemon and stays silent when nothing is pending, so it costs nothing in projects
// without flows.
import fs from "node:fs";
import path from "node:path";
import { api, findDaemon, resolveProject, stateDir } from "./paths.ts";

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
  const info = await findDaemon(project);
  if (!info) return;
  const s = await api(info, "/api/state");
  const tasks = s.userTasks as any[];
  const sessionJobs = (s.sessionJobs as any[]).filter((j) => j.state === "Created");
  const incidents = s.incidents as any[];
  const keys = [...tasks.map((t) => `t${t.key}`), ...sessionJobs.map((j) => `j${j.key}`), ...incidents.map((i) => `i${i.key}`)].sort();
  if (!keys.length) return;

  // On each prompt, only speak up when something new is waiting.
  const seenFile = path.join(stateDir(project), "hook-seen.json");
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
    lines.push(`- user task ${t.key}: ${t.flowId}/${t.elementId}${t.title ? ` "${t.title}"` : ""}${t.form?.title ? ` — ${t.form.title}` : ""}`);
  if (sessionJobs.length) lines.push(`- ${sessionJobs.length} job(s) assigned to this session (session_job_next)`);
  for (const i of incidents) lines.push(`- incident ${i.key} at ${i.elementId} (instance ${i.instanceKey}): ${String(i.reason).slice(0, 200)}`);
  lines.push(
    `Mention these to the user when relevant. To answer a user task, call task_ask (it shows the form to the user) — never fill it in yourself. Explorer: ${info.url}`,
  );
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: lines.join("\n") } }));
}
