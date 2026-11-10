// Run one agent step with a profile's CLI, reporting each turn as it happens. Two ways
// to drive a CLI: ACP (JSON-RPC over stdio, via @nanobpm/agentic — the same client and
// event normalizer c8ctl-plugin-nano uses) and `claude -p --output-format stream-json`.
import { spawn } from "node:child_process";
import { openAcpSession, spawnAcpTransport } from "@nanobpm/agentic/session/acp";
import { launch, type AgentProfile } from "./agents.ts";

/** One turn of an agent's transcript, in AgentInstance history terms. */
export interface Turn {
  role: "USER" | "ASSISTANT" | "TOOL_RESULT";
  text?: string;
  toolCalls?: { id: string; name: string; args: unknown }[];
  /** TOOL_RESULT: which call, and its output. */
  toolCallId?: string;
  result?: unknown;
  ok?: boolean;
  metrics?: { inputTokens?: number; outputTokens?: number; cacheReadTokenCount?: number; cacheCreationTokenCount?: number; durationMs?: number };
  model?: string;
}

export interface AgentRun {
  name: string;
  profile: AgentProfile;
  prompt: string;
  /** Extra system instructions (claude: --append-system-prompt; ACP: prefixed to the prompt). */
  system?: string;
  model?: string;
  cwd: string;
  /** Extra environment for the agent process (on top of the profile's). */
  env?: Record<string, string>;
  schema?: Record<string, unknown>;
  allowedTools?: string[];
  permissionMode?: string;
  signal?: AbortSignal;
  onTurn: (t: Turn) => void;
}

export interface AgentOutcome {
  /** Structured output (schema) or the final text. */
  result: unknown;
  costUsd?: number;
  model?: string;
}

export function runAgentCli(r: AgentRun): Promise<AgentOutcome> {
  return r.profile.protocol === "claude" ? runClaude(r) : runAcp(r);
}

function schemaNote(schema?: Record<string, unknown>): string {
  return schema ? `\n\nFinish with only a JSON object matching this JSON schema (no prose around it):\n\`\`\`json\n${JSON.stringify(schema)}\n\`\`\`\n` : "";
}

// ── ACP ──────────────────────────────────────────────────────────────────────────

async function runAcp(r: AgentRun): Promise<AgentOutcome> {
  const { command, args, env } = launch(r.name, r.profile, r.model);
  let stderr = "";
  const t = spawnAcpTransport({
    command,
    args,
    cwd: r.cwd,
    env: { ...(process.env as Record<string, string>), ...env, ...r.env },
    onStderr: (c) => (stderr = (stderr + c).slice(-4000)),
  });
  const exited = new Promise<never>((_, reject) => {
    t.child.on("error", (e) => reject(new Error(`${command}: ${e.message}`)));
    t.child.on("exit", (code, sig) => reject(new Error(`${command} exited (${sig ?? code}) before finishing: ${stderr.trim().slice(-1500)}`)));
  });
  exited.catch(() => {});
  // Turns stream to the transcript as they arrive; text chunks of one message are merged.
  let pending: Turn | undefined;
  let last = Date.now();
  const flush = () => {
    if (pending) r.onTurn(pending);
    pending = undefined;
  };
  let finalText = "";
  const session = openAcpSession(
    t,
    {
      emit: (e) => {
        const now = Date.now();
        if (e.type === "assistant") {
          if (pending?.role !== "ASSISTANT" || pending.toolCalls) {
            flush();
            pending = { role: "ASSISTANT", text: "", metrics: { durationMs: now - last } };
            finalText = "";
          }
          pending.text += e.text;
          finalText += e.text;
        } else if (e.type === "tool-call") {
          if (pending?.role !== "ASSISTANT") {
            flush();
            pending = { role: "ASSISTANT", metrics: { durationMs: now - last } };
          }
          (pending.toolCalls ??= []).push({ id: e.callId, name: e.name, args: e.args });
        } else if (e.type === "tool-result") {
          flush();
          r.onTurn({ role: "TOOL_RESULT", toolCallId: e.callId, result: e.result, ok: e.ok });
        } else if (e.type === "usage") {
          if (pending) pending.metrics = { ...pending.metrics, inputTokens: e.inputTokens, outputTokens: e.outputTokens };
        } else return;
        last = now;
      },
    },
    { clientInfo: { name: "agent-graph-engine", version: "1" } },
  );
  const stop = () => {
    session.cancel();
    t.child.kill();
  };
  r.signal?.addEventListener("abort", stop, { once: true });
  try {
    await Promise.race([session.initialize(), exited]);
    await Promise.race([session.newSession({ cwd: r.cwd }), exited]);
    const text = `${r.system ? `${r.system}\n\n` : ""}${r.prompt}${schemaNote(r.schema)}`;
    r.onTurn({ role: "USER", text });
    const res = await Promise.race([session.prompt(text), exited]);
    // The turn's token total (the usage event already set input/output on the last
    // assistant turn); add the cache/reasoning detail.
    if (res.usage && pending?.metrics) {
      if (res.usage.cachedReadTokens !== undefined) pending.metrics.cacheReadTokenCount = res.usage.cachedReadTokens;
      if (res.usage.cachedWriteTokens !== undefined) pending.metrics.cacheCreationTokenCount = res.usage.cachedWriteTokens;
    }
    flush();
    const cost = res.context?.cost;
    if (res.stopReason && !/end_turn|max_tokens/.test(res.stopReason)) throw new Error(`${r.name} stopped: ${res.stopReason}`);
    return {
      result: r.schema ? parseJson(finalText) ?? finalText : finalText,
      model: r.model ?? r.profile.model,
      // Cumulative for the session, which is this step's alone.
      costUsd: cost?.currency === "USD" && cost.amount > 0 ? cost.amount : undefined,
    };
  } finally {
    flush();
    r.signal?.removeEventListener("abort", stop);
    session.close();
    t.child.kill();
  }
}

// ── claude -p (stream-json) ──────────────────────────────────────────────────────

async function runClaude(r: AgentRun): Promise<AgentOutcome> {
  const { command, env } = launch(r.name, r.profile);
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", r.permissionMode ?? "dontAsk", ...(r.profile.args ?? [])];
  if (r.allowedTools?.length) args.push("--allowedTools", r.allowedTools.join(","));
  const model = r.model ?? r.profile.model;
  if (model) args.push(r.profile.modelArg ?? "--model", model);
  if (r.system) args.push("--append-system-prompt", r.system);
  if (r.schema) args.push("--json-schema", JSON.stringify(r.schema));
  r.onTurn({ role: "USER", text: r.prompt });
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: r.cwd, env: { ...process.env, ...env, ...r.env }, stdio: ["pipe", "pipe", "pipe"], signal: r.signal });
    let buf = "";
    let stderr = "";
    let final: any;
    let usedModel: string | undefined;
    let last = Date.now();
    const line = (l: string) => {
      if (!l.trim()) return;
      let m: any;
      try {
        m = JSON.parse(l);
      } catch {
        return;
      }
      if (m.type === "system" && m.model) usedModel = m.model;
      else if (m.type === "assistant") {
        const content: any[] = m.message?.content ?? [];
        const text = content.filter((c) => c.type === "text").map((c) => c.text).join("");
        const calls = content.filter((c) => c.type === "tool_use").map((c) => ({ id: c.id, name: c.name, args: c.input }));
        const u = m.message?.usage;
        const now = Date.now();
        if (text || calls.length)
          r.onTurn({
            role: "ASSISTANT",
            text: text || undefined,
            toolCalls: calls.length ? calls : undefined,
            model: m.message?.model,
            metrics: { inputTokens: u?.input_tokens, outputTokens: u?.output_tokens, cacheReadTokenCount: u?.cache_read_input_tokens, cacheCreationTokenCount: u?.cache_creation_input_tokens, durationMs: now - last },
          });
        last = now;
      } else if (m.type === "user") {
        for (const c of m.message?.content ?? [])
          if (c.type === "tool_result") r.onTurn({ role: "TOOL_RESULT", toolCallId: c.tool_use_id, result: c.content, ok: !c.is_error });
        last = Date.now();
      } else if (m.type === "result") final = m;
    };
    child.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        line(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));
    child.on("error", (e) => reject(new Error(`${command}: ${e.message}`)));
    child.on("close", (code) => {
      line(buf);
      if (!final) return reject(new Error(`${command} exited ${code}: ${stderr.slice(-2000)}`));
      if (final.is_error) return reject(new Error(`claude: ${final.subtype ?? "error"}: ${String(final.result ?? "").slice(0, 2000)}`));
      let result: unknown = final.structured_output ?? final.result;
      if (r.schema && typeof result === "string") result = parseJson(result) ?? result;
      resolve({ result, costUsd: final.total_cost_usd, model: usedModel ?? model });
    });
    child.stdin.end(r.prompt);
  });
}

/** A JSON object in an answer: the whole text, or a fenced block. */
export function parseJson(text: string): Record<string, unknown> | undefined {
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  };
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenced) return tryParse(fenced[1]);
  // Else the first {...} that parses (agents often add a remark after the JSON).
  const start = text.indexOf("{");
  if (start < 0) return undefined;
  for (let end = text.lastIndexOf("}"); end > start; end = text.lastIndexOf("}", end - 1)) {
    const v = tryParse(text.slice(start, end + 1));
    if (v) return v;
  }
  return undefined;
}
