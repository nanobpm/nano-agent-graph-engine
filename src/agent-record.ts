// Records an agent step as an engine-native AgentInstance: a CONFIGURATION turn (model,
// provider, system prompt), then every turn as it happens. History stays PENDING until
// the job completes (committed) — the engine owns that, fenced by the job's lease.
// Best-effort: a recording failure is logged once and never fails the step.
import type { TestEngine } from "./wasm.ts";
import type { Turn } from "./agent-run.ts";

const MAX_TEXT = 20_000;

export interface RecordedJob {
  key: string;
  elementInstanceKey: string;
  jobLeaseToken: string;
}

export class AgentRecorder {
  private engine: TestEngine;
  private job: RecordedJob;
  private config: { model: string; provider: string; systemPrompt: string };
  private onError: (message: string) => void;
  private onChange: () => void;
  agentInstanceKey?: string;
  private n = 0;
  private failed = false;

  constructor(
    engine: TestEngine,
    job: RecordedJob,
    config: { model: string; provider: string; systemPrompt: string },
    onError: (message: string) => void,
    onChange: () => void,
  ) {
    this.engine = engine;
    this.job = job;
    this.config = config;
    this.onError = onError;
    this.onChange = onChange;
  }

  private item(role: string, extra: Record<string, unknown>) {
    return { historyItemId: `${this.job.key}-${++this.n}`, loopIteration: 1, producedAt: new Date().toISOString(), role, content: [], ...extra };
  }

  private attribution() {
    return { elementInstanceKey: this.job.elementInstanceKey, jobKey: this.job.key, jobLeaseToken: this.job.jobLeaseToken };
  }

  /** Create (or, on a retry of the same step, adopt) the AgentInstance. */
  private ensure(): boolean {
    if (this.failed) return false;
    if (this.agentInstanceKey) return true;
    const configuration = this.item("CONFIGURATION", {
      model: this.config.model,
      provider: this.config.provider,
      systemPrompt: [{ contentType: "TEXT", text: clip(this.config.systemPrompt) || "(none)" }],
    });
    try {
      const r = JSON.parse(this.engine.createAgentInstance(JSON.stringify({ ...this.attribution(), history: [configuration] })));
      this.agentInstanceKey = String(r.agentInstanceKey);
    } catch (e: any) {
      const adopt = /associated with agent instance (\d+)/.exec(String(e?.message ?? e));
      if (adopt) {
        this.agentInstanceKey = adopt[1];
        this.update({ history: [configuration] });
      } else return this.fail(e);
    }
    this.onChange();
    return !this.failed;
  }

  private update(body: Record<string, unknown>) {
    try {
      this.engine.updateAgentInstance(this.agentInstanceKey!, JSON.stringify({ ...this.attribution(), ...body }));
      this.onChange();
    } catch (e: any) {
      this.fail(e);
    }
  }

  private fail(e: any): false {
    this.failed = true;
    this.onError(`agent transcript not recorded: ${String(e?.message ?? e).slice(0, 300)}`);
    return false;
  }

  start() {
    this.ensure();
  }

  /** The agent answered. COMPLETED is the engine's to set (when the run ends); until
   *  then an agent that has finished its turn is IDLE. */
  done() {
    if (this.agentInstanceKey && !this.failed) this.update({ status: "IDLE", history: [] });
  }

  turn(t: Turn) {
    if (!this.ensure()) return;
    const content: unknown[] = [];
    if (t.role === "TOOL_RESULT") content.push(contentFor(t.result));
    else if (t.text) content.push({ contentType: "TEXT", text: clip(t.text) });
    const extra: Record<string, unknown> = { content };
    if (t.toolCalls?.length)
      extra.toolCalls = t.toolCalls.map((c) => ({ toolCallId: c.id, toolName: c.name, elementId: null, arguments: c.args && typeof c.args === "object" ? c.args : { value: c.args } }));
    if (t.toolCallId) extra.toolCallId = t.toolCallId;
    if (t.metrics) extra.metrics = Object.fromEntries(Object.entries(t.metrics).filter(([, v]) => typeof v === "number"));
    const status = t.role === "ASSISTANT" ? (t.toolCalls?.length ? "TOOL_CALLING" : "THINKING") : "THINKING";
    this.update({ status, history: [this.item(t.role, extra)] });
  }
}

function clip(s: string): string {
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}\n… (${s.length - MAX_TEXT} more characters)` : s;
}

function contentFor(v: unknown): Record<string, unknown> {
  if (typeof v === "string") return { contentType: "TEXT", text: clip(v) };
  // Claude's tool_result content is a list of blocks; keep the text.
  if (Array.isArray(v) && v.every((b) => b && typeof b === "object" && "text" in b)) return { contentType: "TEXT", text: clip(v.map((b: any) => b.text).join("\n")) };
  const json = JSON.stringify(v ?? null);
  return json.length > MAX_TEXT ? { contentType: "TEXT", text: clip(json) } : { contentType: "OBJECT", object: v ?? null };
}
