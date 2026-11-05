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
process.stdout.write(
  JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    result: hasSchema ? "" : "```json\n" + JSON.stringify({ notes }) + "\n```",
    structured_output: hasSchema ? { notes } : undefined,
    total_cost_usd: 0.0123,
    num_turns: 1,
    session_id: "fake",
  }),
);
