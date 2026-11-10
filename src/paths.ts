// Where a project's state lives and how clients find (or start) its daemon.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

export interface DaemonInfo {
  pid: number;
  port: number;
  url: string;
  /** The project this client acts on (the engine itself serves every project). */
  project: string;
  startedAt: string;
}

/** The engine's home: one engine per user, for every project (AGE_STATE_DIR moves it). */
export function engineDir(): string {
  return path.resolve(process.env.AGE_STATE_DIR ?? path.join(process.env.HOME ?? "/tmp", ".agent-graph"));
}

/** Before 0.5 each project had its own engine in <project>/.agent-graph. */
export function legacyStateDir(project: string): string {
  return path.join(path.resolve(project), ".agent-graph");
}

/** A short, stable, BPMN-id-safe name for a project: "<folder>-<hash>". It prefixes the
 *  process ids of the project's flows, so two repos can both have a "release" flow. */
export function projectSlug(project: string): string {
  const abs = path.resolve(project);
  let base = path.basename(abs).replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "project";
  if (!/^[A-Za-z]/.test(base)) base = `p-${base}`;
  return `${base}-${crypto.createHash("sha1").update(abs).digest("hex").slice(0, 4)}`;
}

/** Home for flows when there is no project (Claude Desktop chat starts servers in /). */
export function defaultHome(): string {
  return process.env.AGE_HOME ?? path.join(process.env.HOME ?? "/tmp", "AgentGraph");
}

/** The project a client acts on: AGE_PROJECT, else the nearest ancestor with flows/,
 *  else the git repo root, else cwd — or the library (~/AgentGraph) when cwd is / or
 *  the home dir itself. */
export function resolveProject(start = process.env.AGE_PROJECT ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd()): string {
  if (process.env.AGE_PROJECT && start === process.env.AGE_PROJECT) return path.resolve(start); // explicit wins
  const s = path.resolve(start);
  const home = path.resolve(process.env.HOME ?? "/");
  if (s === "/" || s === home) return defaultHome();
  let git: string | undefined;
  for (let dir = s; ; ) {
    if (dir === home) break; // ~/flows would make every folder one project
    if (fs.existsSync(path.join(dir, "flows"))) return dir;
    if (!git && fs.existsSync(path.join(dir, ".git"))) git = dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return git ?? s;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** The user's running engine, if any (never starts one). `project` is recorded on the
 *  returned info for the caller's convenience. */
export async function findDaemon(project = defaultHome()): Promise<DaemonInfo | undefined> {
  const f = path.join(engineDir(), "daemon.json");
  let info: DaemonInfo;
  try {
    info = JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return undefined;
  }
  if (!alive(info.pid)) return undefined;
  // A live engine can be slow to answer (a big journal write, a busy handler). Keep
  // asking rather than report it gone: a caller would start a second engine on the
  // same journal.
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${info.url}/api/health`, { signal: AbortSignal.timeout(1500 + i * 1000) });
      if (r.ok) return { ...info, project: path.resolve(project) };
    } catch {
      /* retry */
    }
    if (!alive(info.pid)) return undefined;
  }
  return undefined;
}

/** The engine's single-writer guarantee: one process owns ~/.agent-graph (its journal).
 *  Held for the process's life via engine.lock (pid). A lock left by a dead process is
 *  taken over. Throws if another live engine holds it. */
export function acquireEngineLock(dir = engineDir()): () => void {
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, "engine.lock");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
      return () => {
        try {
          if (fs.readFileSync(lock, "utf8").trim() === String(process.pid)) fs.rmSync(lock, { force: true });
        } catch {
          /* gone */
        }
      };
    } catch {
      const owner = Number(fs.readFileSync(lock, "utf8").trim());
      if (owner && owner !== process.pid && alive(owner)) {
        throw new Error(`another engine (pid ${owner}) owns ${dir}; one engine per state dir`);
      }
      fs.rmSync(lock, { force: true }); // stale: its owner died
    }
  }
  throw new Error(`could not take ${lock}`);
}

/** Find the user's engine or start it detached (it outlives the Claude session, so
 *  timers and long agent jobs keep running), and make sure it knows `project`. */
export async function ensureDaemon(project: string): Promise<DaemonInfo> {
  let info = await findDaemon(project);
  if (!info) info = await startDaemon(project);
  await api(info, "/api/projects", { path: path.resolve(project) });
  return info;
}

async function startDaemon(project: string): Promise<DaemonInfo> {
  const dir = engineDir();
  fs.mkdirSync(dir, { recursive: true });
  // Several clients may start at once (sessions, hooks, the mod): one spawns, the rest wait.
  const lock = path.join(dir, "starting.lock");
  let mine = false;
  try {
    fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
    mine = true;
  } catch {
    if (Date.now() - fs.statSync(lock).mtimeMs > 15_000) {
      fs.rmSync(lock, { force: true }); // stale
      return startDaemon(project);
    }
  }
  try {
    if (mine) spawnDaemon(dir);
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const info = await findDaemon(project);
      if (info) return info;
    }
  } finally {
    if (mine) fs.rmSync(lock, { force: true });
  }
  throw new Error(`engine did not start; see ${path.join(dir, "daemon.log")}`);
}

function spawnDaemon(dir: string) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cli = fs.existsSync(path.join(here, "cli.js")) ? path.join(here, "cli.js") : path.join(here, "cli.ts");
  const out = fs.openSync(path.join(dir, "daemon.log"), "a");
  const { AGE_PROJECT: _p, ...env } = process.env;
  const child = spawn(process.execPath, [cli, "daemon"], { detached: true, stdio: ["ignore", out, out], env, cwd: dir });
  child.unref();
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
