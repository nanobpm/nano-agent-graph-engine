#!/usr/bin/env node
// Stand-in for `claude -p --output-format json` in tests: echoes a canned result and
// records the prompt it got.
import fs from "node:fs";
let prompt = "";
for await (const c of process.stdin) prompt += c;
if (process.env.FAKE_CLAUDE_LOG) fs.appendFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify({ argv: process.argv.slice(2), prompt }) + "\n");
const t0 = Date.now();
if (process.env.FAKE_CLAUDE_SLEEP_MS) await new Promise((r) => setTimeout(r, Number(process.env.FAKE_CLAUDE_SLEEP_MS)));
if (process.env.FAKE_CLAUDE_SPANS) fs.appendFileSync(process.env.FAKE_CLAUDE_SPANS, JSON.stringify({ t0, t1: Date.now() }) + "\n");
const fb = /"feedback": "([^"]+)"/.exec(prompt)?.[1];
const notes = `## Features\n- drafted by fake claude${fb ? ` (applied: ${fb})` : ""}`;
const hasSchema = process.argv.includes("--json-schema");
const result = {
  type: "result",
  subtype: "success",
  is_error: false,
  result: hasSchema ? "" : "```json\n" + JSON.stringify({ notes }) + "\n```",
  structured_output: hasSchema ? { notes } : undefined,
  total_cost_usd: 0.0123,
  num_turns: 1,
  session_id: "fake",
};
if (process.argv.includes("stream-json")) {
  // What `claude -p --output-format stream-json --verbose` prints: one JSON event per line.
  const lines = [
    { type: "system", subtype: "init", model: "fake-model" },
    { type: "assistant", message: { model: "fake-model", content: [{ type: "tool_use", id: "tu1", name: "Bash", input: { command: "git log" } }], usage: { input_tokens: 100, output_tokens: 20 } } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "tu1", content: "abc123 a commit" }] } },
    { type: "assistant", message: { model: "fake-model", content: [{ type: "text", text: result.result || JSON.stringify({ notes }) }], usage: { input_tokens: 150, output_tokens: 40 } } },
    result,
  ];
  process.stdout.write(lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
} else process.stdout.write(JSON.stringify(result));
