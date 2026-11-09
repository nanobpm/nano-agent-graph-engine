// The control side: one typed client for everything that talks to the user's engine
// (MCP server, CLI, hooks). It finds or starts the engine, scopes calls to a project, and
// builds explorer links. The mod (hooks/mod.js) runs sandboxed and can't import this; it
// keeps a few direct calls to the same routes.
import { api, ensureDaemon, findDaemon, type DaemonInfo } from "./paths.ts";

export interface StartResult {
  instanceKey: string;
  processId?: string;
  [k: string]: unknown;
}

export class EngineClient {
  readonly project: string;
  readonly info: DaemonInfo;

  constructor(project: string, info: DaemonInfo) {
    this.project = project;
    this.info = info;
  }

  /** Find the engine or start it, and register the project with it. */
  static async connect(project: string): Promise<EngineClient> {
    return new EngineClient(project, await ensureDaemon(project));
  }

  /** The running engine, or undefined (never starts one). */
  static async find(project: string): Promise<EngineClient | undefined> {
    const info = await findDaemon(project);
    return info && new EngineClient(project, info);
  }

  get url(): string {
    // the Desktop app only makes http://localhost links clickable (engines before 0.5.2 wrote 127.0.0.1)
    return this.info.url.replace("//127.0.0.1:", "//localhost:");
  }

  /** The web explorer, filtered to this project; `hash` like "instance=7" or "task=9". */
  explorerUrl(hash = ""): string {
    return `${this.url}/?project=${encodeURIComponent(this.project)}${hash ? `#${hash}` : ""}`;
  }

  /** Any engine route (the MCP App's ui_api proxy). */
  call<T = any>(path: string, body?: unknown): Promise<T> {
    return api<T>(this.info, path, body);
  }

  /** Engine state: this project's flows and work (work elsewhere is marked); `all` for everything. */
  state<T = any>(all = false): Promise<T> {
    return this.call(all ? "/api/state" : `/api/state?project=${encodeURIComponent(this.project)}`);
  }

  instance<T = any>(key: string): Promise<T> {
    return this.call(`/api/instances/${encodeURIComponent(key)}`);
  }

  /** Recompile and redeploy flows from every registered project. */
  reload<T = any>(): Promise<T> {
    return this.call("/api/reload", {});
  }

  start(flowId: string, variables: Record<string, unknown> = {}, title?: string): Promise<StartResult> {
    return this.call("/api/start", { flowId, variables, title, project: this.project });
  }

  completeTask(key: string, variables: Record<string, unknown> = {}): Promise<unknown> {
    return this.call(`/api/user-tasks/${encodeURIComponent(key)}/complete`, { variables });
  }

  /** Take agent steps for this session (only this project's runs). */
  claimJobs<T = any>(type: string | undefined, max = 1): Promise<T[]> {
    return this.call("/api/jobs/claim", { type, max, project: this.project });
  }

  completeJob(key: string, variables: Record<string, unknown> = {}): Promise<unknown> {
    return this.call(`/api/jobs/${encodeURIComponent(key)}/complete`, { variables });
  }

  failJob(key: string, message: string, retries?: number): Promise<unknown> {
    return this.call(`/api/jobs/${encodeURIComponent(key)}/fail`, { message, retries });
  }

  resolveIncident(key: string): Promise<unknown> {
    return this.call(`/api/incidents/${encodeURIComponent(key)}/resolve`, {});
  }

  cancel(instanceKey: string): Promise<unknown> {
    return this.call(`/api/instances/${encodeURIComponent(instanceKey)}/cancel`, {});
  }

  message(name: string, correlationKey = "", variables: Record<string, unknown> = {}): Promise<unknown> {
    return this.call("/api/messages", { name, correlationKey, variables });
  }

  shutdown(): Promise<unknown> {
    return this.call("/api/shutdown", {});
  }
}
