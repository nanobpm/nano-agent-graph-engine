// Run one agent step with a profile's CLI, reporting each turn as it happens. Two ways
// to drive a CLI: ACP (JSON-RPC over stdio, via @nanobpm/agentic — the same client and
// event normalizer c8ctl-plugin-nano uses) and `claude -p --output-format stream-json`.
import { spawn } from "node:child_process";
import { openAcpSession, spawnAcpTransport } from "@nanobpm/agentic/session/acp";
import { launch, type AgentProfile } from "./agents.ts";
import type { TranscriptInput } from "./transcript.ts";

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
  /** Live transcript events (text as it streams, tool calls and results). */
  onEvent?: (e: TranscriptInput) => void;
}

const asText = (v: unknown): string => (typeof v === "string" ? v : Array.isArray(v) ? v.map((c: any) => (typeof c?.text === "string" ? c.text : JSON.stringify(c))).join("\n") : JSON.stringify(v ?? ""));

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
  // "close", not "exit": by then stderr is drained, so the error carries the CLI's last words.
  const closed = new Promise<void>((resolve) => t.child.on("close", () => resolve()));
  const diedError = () => new Error(`${command} exited (${t.child.signalCode ?? t.child.exitCode}) before finishing: ${stderr.trim().slice(-1500)}`);
  const exited = new Promise<never>((_, reject) => {
    t.child.on("error", (e) => reject(new Error(`${command}: ${e.message}`)));
    closed.then(() => reject(diedError()));
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
          r.onEvent?.({ kind: "message", role: "assistant", text: e.text });
        } else if (e.type === "tool-call") {
          if (pending?.role !== "ASSISTANT") {
            flush();
            pending = { role: "ASSISTANT", metrics: { durationMs: now - last } };
          }
          (pending.toolCalls ??= []).push({ id: e.callId, name: e.name, args: e.args });
          r.onEvent?.({ kind: "tool-call", name: e.name, callId: e.callId, args: e.args });
        } else if (e.type === "tool-result") {
          flush();
          r.onTurn({ role: "TOOL_RESULT", toolCallId: e.callId, result: e.result, ok: e.ok });
          r.onEvent?.({ kind: "tool-result", callId: e.callId, ok: e.ok, content: asText(e.result).slice(0, 4000) });
        } else if (e.type === "usage") {
          if (pending) pending.metrics = { ...pending.metrics, inputTokens: e.inputTokens, outputTokens: e.outputTokens };
        } else return;
        last = now;
      },
    },
    { clientInfo: { name: "nano-agent-graph-engine", version: "1" } },
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
    r.onEvent?.({ kind: "message", role: "user", text, mode: "snapshot", final: true });
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
  } catch (e) {
    // When the CLI dies, the first error is often a symptom (EPIPE writing to it, the ACP
    // client's "… exited") and can come before Node sees the exit. Give it a moment to
    // close; if it did die, report that with its stderr.
    // A CLI that never started (ENOENT: not installed, bad cwd) keeps its spawn error, which
    // the daemon's agentUnavailable() fallback looks for.
    if (!r.signal?.aborted && t.child.pid !== undefined) {
      await Promise.race([closed, new Promise((res) => setTimeout(res, 1000))]);
      if (t.child.exitCode !== null || t.child.signalCode !== null) throw diedError();
    }
    throw e;
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
  // --include-partial-messages: text deltas as they're generated, for the live transcript.
  const args = ["-p", "--output-format", "stream-json", "--verbose", ...(r.onEvent ? ["--include-partial-messages"] : []), "--permission-mode", r.permissionMode ?? "dontAsk", ...(r.profile.args ?? [])];
  if (r.allowedTools?.length) args.push("--allowedTools", r.allowedTools.join(","));
  const model = r.model ?? r.profile.model;
  if (model) args.push(r.profile.modelArg ?? "--model", model);
  if (r.system) args.push("--append-system-prompt", r.system);
  if (r.schema) args.push("--json-schema", JSON.stringify(r.schema));
  r.onTurn({ role: "USER", text: r.prompt });
  r.onEvent?.({ kind: "message", role: "user", text: r.prompt, mode: "snapshot", final: true });
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: r.cwd, env: { ...process.env, ...env, ...r.env }, stdio: ["pipe", "pipe", "pipe"], signal: r.signal });
    let buf = "";
    let stderr = "";
    let final: any;
    let usedModel: string | undefined;
    let streamId: string | undefined;
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
      else if (m.type === "stream_event") {
        const ev = m.event;
        if (ev?.type === "message_start") streamId = ev.message?.id;
        else if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text)
          r.onEvent?.({ kind: "message", role: "assistant", text: ev.delta.text, messageId: streamId });
      } else if (m.type === "assistant") {
        const content: any[] = m.message?.content ?? [];
        const text = content.filter((c) => c.type === "text").map((c) => c.text).join("");
        const calls = content.filter((c) => c.type === "tool_use").map((c) => ({ id: c.id, name: c.name, args: c.input }));
        const u = m.message?.usage;
        const now = Date.now();
        // The whole block replaces the streamed deltas (same messageId), then its tool calls.
        if (text) r.onEvent?.({ kind: "message", role: "assistant", text, mode: "snapshot", messageId: m.message?.id, final: true });
        for (const c of calls) r.onEvent?.({ kind: "tool-call", name: c.name, callId: c.id, args: c.args });
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
          if (c.type === "tool_result") {
            r.onTurn({ role: "TOOL_RESULT", toolCallId: c.tool_use_id, result: c.content, ok: !c.is_error });
            r.onEvent?.({ kind: "tool-result", callId: c.tool_use_id, ok: !c.is_error, content: asText(c.content).slice(0, 4000) });
          }
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
    child.stdin.on("error", () => {}); // a CLI that dies early: its exit code and stderr report it
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
