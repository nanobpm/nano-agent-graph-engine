// Where a project's state lives and how clients find (or start) its daemon.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface DaemonInfo {
  pid: number;
  port: number;
  url: string;
  project: string;
  startedAt: string;
}

export function stateDir(project: string): string {
  return path.join(path.resolve(project), ".agent-graph");
}

/** Home for flows when there is no project (Claude Desktop chat starts servers in /). */
export function defaultHome(): string {
  return process.env.AGE_HOME ?? path.join(process.env.HOME ?? "/tmp", "AgentGraph");
}

/** The project a client acts on: AGE_PROJECT, else the nearest ancestor with flows/ or
 *  .agent-graph/, else cwd — or ~/AgentGraph when cwd is / or the home dir itself. */
export function resolveProject(start = process.env.AGE_PROJECT ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd()): string {
  if (process.env.AGE_PROJECT && start === process.env.AGE_PROJECT) return path.resolve(start); // explicit wins
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, "flows")) || fs.existsSync(path.join(dir, ".agent-graph"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  const s = path.resolve(start);
  if (s === "/" || s === path.resolve(process.env.HOME ?? "/")) return defaultHome();
  return s;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** The running daemon for a project, if any (never starts one). */
export async function findDaemon(project: string): Promise<DaemonInfo | undefined> {
  const f = path.join(stateDir(project), "daemon.json");
  let info: DaemonInfo;
  try {
    info = JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return undefined;
  }
  if (!alive(info.pid)) return undefined;
  try {
    const r = await fetch(`${info.url}/api/state`, { signal: AbortSignal.timeout(1500) });
    return r.ok ? info : undefined;
  } catch {
    return undefined;
  }
}

/** Find the project's daemon or start one detached (it outlives the Claude session, so
 *  timers and long agent jobs keep running). */
export async function ensureDaemon(project: string): Promise<DaemonInfo> {
  const found = await findDaemon(project);
  if (found) return found;
  fs.mkdirSync(stateDir(project), { recursive: true });
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cli = fs.existsSync(path.join(here, "cli.js")) ? path.join(here, "cli.js") : path.join(here, "cli.ts");
  const out = fs.openSync(path.join(stateDir(project), "daemon.log"), "a");
  const child = spawn(process.execPath, [cli, "daemon", "--project", project], {
    detached: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, AGE_PROJECT: project },
    cwd: project,
  });
  child.unref();
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const info = await findDaemon(project);
    if (info) return info;
  }
  throw new Error(`daemon did not start; see ${path.join(stateDir(project), "daemon.log")}`);
}

export async function api<T = any>(info: DaemonInfo, p: string, body?: unknown): Promise<T> {
  const r = await fetch(`${info.url}${p}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  const data = r.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text;
  if (!r.ok) throw new Error((data as any)?.error ?? `HTTP ${r.status}`);
  return data as T;
}
