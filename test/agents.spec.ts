// Agent profiles and the two ways of driving an agent CLI (ACP and claude stream-json),
// with fake CLIs. The daemon-level recording is covered in e2e.spec.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
process.env.AGE_NOTIFY ??= "off"; // engines started by tests: no desktop notifications

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fakeAcp = path.join(root, "test/fixtures/fake-acp.mjs");
const fakeClaude = path.join(root, "test/fixtures/fake-claude.mjs");
process.env.AGE_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "age-agents-"));
delete process.env.AGE_CLAUDE_CMD;

const { resolveAgent, writeAgentsFile, readAgentsFile, assignAgent, takeRunAgents, rankOf, launch, allProfiles } = await import("../src/agents.ts");
const { runAgentCli } = await import("../src/agent-run.ts");

test("ACP: streams turns (merged chunks, tool call + result) and returns the answer", async () => {
  const log = path.join(process.env.AGE_STATE_DIR!, "acp.log");
  process.env.FAKE_ACP_LOG = log;
  const turns: any[] = [];
  const r = await runAgentCli({
    name: "fake",
    profile: { protocol: "acp", command: process.execPath, args: [fakeAcp], modelArg: "--model" },
    prompt: "do it",
    system: "be brief",
    model: "openrouter/x",
    cwd: os.tmpdir(),
    schema: { type: "object" },
    onTurn: (t) => turns.push(t),
  });
  assert.deepEqual(r.result, { notes: "## Features\n- drafted by fake acp" });
  assert.deepEqual(
    turns.map((t) => t.role),
    ["USER", "ASSISTANT", "TOOL_RESULT", "ASSISTANT"],
  );
  assert.deepEqual(turns[1].toolCalls, [{ id: "c1", name: "bash", args: { command: "ls" } }]);
  assert.deepEqual(turns[2].result, { output: "a\nb" });
  // usage from the prompt response lands on the final assistant turn; cost from usage_update
  assert.equal(turns[3].metrics.inputTokens, 800);
  assert.equal(turns[3].metrics.outputTokens, 60);
  assert.equal(turns[3].metrics.cacheReadTokenCount, 500);
  assert.equal(r.costUsd, 0.0042);
  const seen = JSON.parse(fs.readFileSync(log, "utf8").trim());
  assert.deepEqual(seen.argv.slice(-2), ["--model", "openrouter/x"]);
  assert.match(seen.prompt, /^be brief\n\ndo it/);
  assert.match(seen.prompt, /JSON schema/);
});

test("ACP: a CLI that dies fails the step with its stderr", async () => {
  await assert.rejects(
    runAgentCli({ name: "x", profile: { protocol: "acp", command: "bash", args: ["-c", "echo no auth >&2; exit 3"] }, prompt: "p", cwd: os.tmpdir(), onTurn: () => {} }),
    /exited \(3\).*no auth/s,
  );
});

test("ACP: abort kills the CLI", async () => {
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 100);
  await assert.rejects(
    runAgentCli({ name: "x", profile: { protocol: "acp", command: "bash", args: ["-c", "sleep 30"] }, prompt: "p", cwd: os.tmpdir(), signal: ac.signal, onTurn: () => {} }),
    /exited/,
  );
});

test("claude stream-json: turns with usage, model and cost", async () => {
  const turns: any[] = [];
  const r = await runAgentCli({ name: "claude", profile: { protocol: "claude", command: fakeClaude }, prompt: "p", cwd: os.tmpdir(), onTurn: (t) => turns.push(t) });
  assert.equal(r.costUsd, 0.0123);
  assert.equal(r.model, "fake-model");
  assert.deepEqual(turns.map((t) => t.role), ["USER", "ASSISTANT", "TOOL_RESULT", "ASSISTANT"]);
  assert.equal(turns[1].metrics.inputTokens, 100);
});

test("profile resolution: run > your step > your flow > your rank > author (if installed) > your default > host > installed", () => {
  const sh = { protocol: "acp" as const, command: "/bin/sh" }; // "installed"
  const file = {
    profiles: { mine: sh, other: sh, ranked: sh, fallback: sh },
    ranks: { senior: "ranked" },
    flows: { review: { use: "other", model: "m-flow", steps: { critic: { use: "mine", model: "m-step" } } } },
    default: "fallback",
  };
  const flowProfiles = { authors: sh, missing: { protocol: "acp" as const, command: "no-such-cli-xyz" } };
  const base = { flowId: "review", jobType: "senior:x", flowProfiles, file };
  const r = (o: object) => resolveAgent({ ...base, ...o } as any)!;
  // Run override beats everything, and its model goes with it.
  assert.deepEqual(pick(r({ step: "critic", run: { critic: { use: "authors", model: "m-run" } } })), ["authors", "m-run", "run override"]);
  // "*" covers every step; a model-only override keeps the chosen CLI.
  assert.deepEqual(pick(r({ step: "critic", run: { "*": { model: "m-all" } } })), ["mine", "m-all", "your step assignment"]);
  assert.deepEqual(pick(r({ step: "critic" })), ["mine", "m-step", "your step assignment"]);
  assert.deepEqual(pick(r({ step: "writer" })), ["other", "m-flow", "your flow assignment"]);
  const noFlow = { ...file, flows: {} };
  assert.deepEqual(pick(resolveAgent({ ...base, file: noFlow, step: "writer", use: "authors" })!), ["ranked", undefined, "your rank senior"]);
  // The author's suggestion: used when installed here (with the author's model) ...
  const noRank = { ...noFlow, ranks: {} };
  assert.deepEqual(pick(resolveAgent({ ...base, file: noRank, step: "w", use: "authors", model: "m-a" })!), ["authors", "m-a", "author (step)"]);
  // ... skipped when that CLI isn't installed or isn't known here (a flow from someone else).
  const skip = resolveAgent({ ...base, file: noRank, step: "w", use: "missing", model: "m-a" })!;
  assert.deepEqual(pick(skip), ["fallback", undefined, "your default"]);
  assert.equal(skip.skipped, "missing (not installed)");
  assert.equal(resolveAgent({ ...base, file: noRank, step: "w", use: "gpt-cli" })!.skipped, "gpt-cli (unknown here)");
  // A user's own typo is an error, not a silent fallback.
  assert.throws(() => resolveAgent({ ...base, step: "w", run: { "*": { use: "nope" } } }), /unknown agent profile "nope" \(run override/);
  // A job type that isn't <rank>:<task> has no rank.
  assert.equal(rankOf("senior:feature"), "senior");
  assert.equal(rankOf("claude"), undefined);
  assert.equal(rankOf("senior:a:b"), undefined);
});

test("agents.json: user profiles win over a flow's; host CLI only when installed", () => {
  const flowProfiles = { claude: { protocol: "acp" as const, command: "evil" } };
  writeAgentsFile({ default: "nano-coder", profiles: { claude: { protocol: "claude", command: "claude" } } });
  assert.equal(resolveAgent({ host: "opencode" })!.name, "nano-coder");
  assert.equal(allProfiles(flowProfiles).claude.command, "claude");
  assert.equal(allProfiles(flowProfiles).claude.source, "agents.json");
  writeAgentsFile({});
  const r = resolveAgent({ host: "no-such-host" });
  assert.ok(!r || r.reason === "installed");
});

test("assignAgent writes and clears flow, step and rank assignments; takeRunAgents parses CLI overrides", () => {
  writeAgentsFile({});
  assignAgent({ flowId: "review", step: "critic", use: "opencode", model: "openai/gpt-5" });
  assignAgent({ flowId: "review", model: "sonnet" });
  assignAgent({ rank: "senior", use: "claude" });
  assert.deepEqual(readAgentsFile(), { flows: { review: { model: "sonnet", steps: { critic: { use: "opencode", model: "openai/gpt-5" } } } }, ranks: { senior: "claude" } });
  assert.throws(() => assignAgent({ flowId: "review", use: "nope" }), /unknown agent profile/);
  assignAgent({ flowId: "review", step: "critic", use: null, model: null });
  assignAgent({ flowId: "review", model: null });
  assignAgent({ rank: "senior", use: null });
  assert.deepEqual(readAgentsFile(), { flows: {}, ranks: {} });
  writeAgentsFile({});
  assert.deepEqual(takeRunAgents(["--pr", "1", "--agent", "opencode", "--model=critic=gpt-5", "x=1"]), {
    agents: { "*": { use: "opencode" }, critic: { model: "gpt-5" } },
    rest: ["--pr", "1", "x=1"],
  });
});

const pick = (r: { name: string; model?: string; reason: string }) => [r.name, r.model, r.reason];

test("launch: model as flag or env", () => {
  assert.deepEqual(launch("n", { protocol: "acp", command: "/bin/sh", args: ["--acp"], modelArg: "--model" }, "a/b").args, ["--acp", "--model", "a/b"]);
  assert.deepEqual(launch("o", { protocol: "acp", command: "/bin/sh", modelEnv: { OPENCODE_CONFIG_CONTENT: '{"model":"{model}"}' } }, "a/b").env, {
    OPENCODE_CONFIG_CONTENT: '{"model":"a/b"}',
  });
});
