export interface DaemonInfo {
    pid: number;
    port: number;
    url: string;
    /** The project this client acts on (the engine itself serves every project). */
    project: string;
    startedAt: string;
}
/** The engine's home: one engine per user, for every project (AGE_STATE_DIR moves it). */
export declare function engineDir(): string;
/** Before 0.5 each project had its own engine in <project>/.agent-graph. */
export declare function legacyStateDir(project: string): string;
/** A short, stable, BPMN-id-safe name for a project: "<folder>-<hash>". It prefixes the
 *  process ids of the project's flows, so two repos can both have a "release" flow. */
export declare function projectSlug(project: string): string;
/** Home for flows when there is no project (Claude Desktop chat starts servers in /). */
export declare function defaultHome(): string;
/** The project a client acts on: AGE_PROJECT, else the nearest ancestor with flows/,
 *  else the git repo root, else cwd — or the library (~/AgentGraph) when cwd is / or
 *  the home dir itself. */
export declare function resolveProject(start?: string): string;
/** The user's running engine, if any (never starts one). `project` is recorded on the
 *  returned info for the caller's convenience. */
export declare function findDaemon(project?: string): Promise<DaemonInfo | undefined>;
/** The engine's single-writer guarantee: one process owns ~/.agent-graph (its journal).
 *  Held for the process's life via engine.lock (pid). A lock left by a dead process is
 *  taken over. Throws if another live engine holds it. */
export declare function acquireEngineLock(dir?: string): () => void;
/** Find the user's engine or start it detached (it outlives the Claude session, so
 *  timers and long agent jobs keep running), and make sure it knows `project`. */
export declare function ensureDaemon(project: string): Promise<DaemonInfo>;
export declare function api<T = any>(info: DaemonInfo, p: string, body?: unknown): Promise<T>;
/** A prompt's file for a `prompt: { resourceId }` binding: flows/prompts/<id>, or, for ids
 *  that carry their folder as nano-workforce's do ("prompts/fix-ci.md"), flows/<id>. */
export declare function promptFile(projectDir: string, resourceId: string): string;
