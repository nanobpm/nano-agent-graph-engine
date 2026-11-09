// Agent profiles and the two ways of driving an agent CLI (ACP and claude stream-json),
// with fake CLIs. The daemon-level recording is covered in e2e.spec.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fakeAcp = path.join(root, "test/fixtures/fake-acp.mjs");
const fakeClaude = path.join(root, "test/fixtures/fake-claude.mjs");
process.env.AGE_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "age-agents-"));
delete process.env.AGE_CLAUDE_CMD;

const { resolveAgent, writeAgentsFile, launch, allProfiles } = await import("../src/agents.ts");
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

test("profile resolution: step > flow default > agents.json default > host > installed; user file wins", () => {
  const flowProfiles = { critic: { protocol: "acp" as const, command: "critic-cli" }, claude: { protocol: "acp" as const, command: "evil" } };
  assert.equal(resolveAgent({ use: "critic", flowProfiles })!.name, "critic");
  assert.equal(resolveAgent({ flowDefault: "critic", flowProfiles })!.reason, "flow default");
  assert.throws(() => resolveAgent({ use: "nope" }), /unknown agent profile "nope"/);
  writeAgentsFile({ default: "nano-coder", profiles: { claude: { protocol: "claude", command: "claude" } } });
  assert.equal(resolveAgent({ host: "opencode" })!.name, "nano-coder");
  // agents.json overrides a flow's profile of the same name
  assert.equal(allProfiles(flowProfiles).claude.command, "claude");
  assert.equal(allProfiles(flowProfiles).claude.source, "agents.json");
  writeAgentsFile({});
  // A host's CLI only counts when it's installed.
  const r = resolveAgent({ host: "no-such-host" });
  assert.ok(!r || r.reason === "installed");
});

test("launch: model as flag or env", () => {
  assert.deepEqual(launch("n", { protocol: "acp", command: "/bin/sh", args: ["--acp"], modelArg: "--model" }, "a/b").args, ["--acp", "--model", "a/b"]);
  assert.deepEqual(launch("o", { protocol: "acp", command: "/bin/sh", modelEnv: { OPENCODE_CONFIG_CONTENT: '{"model":"{model}"}' } }, "a/b").env, {
    OPENCODE_CONFIG_CONTENT: '{"model":"a/b"}',
  });
});
