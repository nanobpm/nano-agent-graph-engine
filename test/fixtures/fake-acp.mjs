#!/usr/bin/env node
// A minimal ACP agent for tests (JSON-RPC 2.0, one message per line on stdio): answers
// initialize / session/new, and on session/prompt streams a tool call, its result and
// an answer, then ends the turn. FAKE_ACP_LOG records argv, env model and the prompt.
import fs from "node:fs";
import readline from "node:readline";

const send = (m) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
const update = (sessionId, u) => send({ method: "session/update", params: { sessionId, update: u } });

for await (const line of readline.createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  const m = JSON.parse(line);
  if (m.method === "initialize") send({ id: m.id, result: { protocolVersion: 1, agentCapabilities: { loadSession: false } } });
  else if (m.method === "session/new") send({ id: m.id, result: { sessionId: "s1" } });
  else if (m.method === "session/prompt") {
    const text = m.params.prompt.map((b) => b.text).join("");
    if (process.env.FAKE_ACP_LOG) fs.appendFileSync(process.env.FAKE_ACP_LOG, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), prompt: text }) + "\n");
    const sid = m.params.sessionId;
    update(sid, { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "thinking" } });
    update(sid, { sessionUpdate: "tool_call", toolCallId: "c1", title: "bash", kind: "execute", status: "pending", rawInput: { command: "ls" } });
    update(sid, { sessionUpdate: "tool_call_update", toolCallId: "c1", status: "completed", rawOutput: { output: "a\nb" } });
    const fb = /"feedback": "([^"]+)"/.exec(text)?.[1];
    const answer = JSON.stringify({ notes: `## Features\n- drafted by fake acp${fb ? ` (applied: ${fb})` : ""}` });
    // Streamed in two chunks, as real agents do.
    update(sid, { sessionUpdate: "agent_message_chunk", content: { type: "text", text: answer.slice(0, 10) } });
    update(sid, { sessionUpdate: "agent_message_chunk", content: { type: "text", text: answer.slice(10) } });
    send({ id: m.id, result: { stopReason: "end_turn" } });
  } else if (m.id !== undefined && m.method) send({ id: m.id, error: { code: -32601, message: `no ${m.method}` } });
}
