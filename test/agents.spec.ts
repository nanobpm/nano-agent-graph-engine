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

const { resolveAgent, writeAgentsFile, readAgentsFile, assignAgent, takeRunAgents, rankOf, launch, allProfiles, parseAgentAdd, addProfile, removeProfile, which } = await import("../src/agents.ts");
const { runAgentCli } = await import("../src/agent-run.ts");
type AgentsFile = import("../src/agents.ts").AgentsFile;

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

test("ACP: a CLI that isn't installed keeps its ENOENT (the daemon falls back on it)", async () => {
  await assert.rejects(
    runAgentCli({ name: "x", profile: { protocol: "acp", command: "no-such-cli-xyz" }, prompt: "p", cwd: os.tmpdir(), onTurn: () => {} }),
    /ENOENT/,
  );
});

test("ACP: an error response says why (its data), not just \"Internal error\"", async () => {
  await assert.rejects(
    runAgentCli({ name: "qwenish", profile: { protocol: "acp", command: process.execPath, args: [fakeAcp, "--fail-prompt"] }, prompt: "p", cwd: os.tmpdir(), onTurn: () => {} }),
    /^Error: qwenish: Internal error: 403 Access to model denied\.$/,
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

test("env: extra environment reaches the agent process", async () => {
  const log = path.join(process.env.AGE_STATE_DIR!, "claude-env.log");
  process.env.FAKE_CLAUDE_LOG = log;
  await runAgentCli({ name: "claude", profile: { protocol: "claude", command: fakeClaude }, prompt: "p", cwd: os.tmpdir(), env: { AGENT_WORKSPACE: "/tmp/ws-1" }, onTurn: () => {} });
  delete process.env.FAKE_CLAUDE_LOG;
  assert.equal(JSON.parse(fs.readFileSync(log, "utf8").trim()).workspace, "/tmp/ws-1");
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
  // Your own choice of a CLI that isn't installed stops the step (it's not swapped for another
  // CLI), and the message doesn't say ENOENT (that hands every agent step to the chat assistant).
  const gone = { ...file, profiles: { ...file.profiles, gone: { protocol: "acp" as const, command: "no-such-cli-xyz" } } };
  const missingFiles: AgentsFile[] = [{ ...gone, ranks: { senior: "gone" }, flows: {} }, { ...gone, flows: { review: { use: "gone" } } }];
  for (const f of missingFiles)
    assert.throws(
      () => resolveAgent({ ...base, file: f, step: "w" }),
      (e: Error) => /"no-such-cli-xyz" isn't installed here \(gone, from your (rank senior|flow assignment)\)/.test(e.message) && !/ENOENT/.test(e.message),
    );
  // A job type that isn't <rank>:<task> has no rank.
  assert.equal(rankOf("senior:feature"), "senior");
  assert.equal(rankOf("claude"), undefined);
  assert.equal(rankOf("senior:a:b"), undefined);
});

test("agents.json: user profiles win over a flow's; host CLI only when installed", () => {
  const flowProfiles = { claude: { protocol: "acp" as const, command: "evil" } };
  // (nano-coder pointed at node, so this doesn't depend on which agent CLIs this machine has)
  writeAgentsFile({ default: "nano-coder", profiles: { claude: { protocol: "claude", command: "claude" }, "nano-coder": { protocol: "acp", command: process.execPath } } });
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

test("promptFile: flows/prompts/<id>, or flows/<id> for ids that carry their folder (nano-workforce style)", async () => {
  const { promptFile } = await import("../src/paths.ts");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "age-prompts-"));
  fs.mkdirSync(path.join(dir, "flows", "prompts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "flows", "prompts", "fix-ci.md"), "x");
  assert.equal(promptFile(dir, "fix-ci.md"), path.join(dir, "flows", "prompts", "fix-ci.md"));
  assert.equal(promptFile(dir, "prompts/fix-ci.md"), path.join(dir, "flows", "prompts", "fix-ci.md"));
  assert.equal(promptFile(dir, "missing.md"), path.join(dir, "flows", "prompts", "missing.md"));
});

test("presets: qwen, kimi and copilot over ACP; kimi's model flag goes before its subcommand", () => {
  const all = allProfiles({}, {});
  assert.deepEqual(launch("qwen", all.qwen, "qwen3-coder").args, ["--acp", "--model", "qwen3-coder"]);
  assert.deepEqual(launch("kimi", all.kimi, "kimi-k2").args, ["--model", "kimi-k2", "acp"]);
  assert.deepEqual(launch("copilot", all.copilot, "gpt-5").args, ["--acp", "--model", "gpt-5"]);
  assert.deepEqual(launch("kimi", all.kimi).args, ["acp"]);
});

test("exec: any CLI — prompt in {prompt} or on stdin, stdout is the answer, streamed", async () => {
  // {prompt} in args (stdin closed), with a model flag.
  const echoArgs = { protocol: "exec" as const, command: process.execPath, args: ["-e", "console.log(JSON.stringify(process.argv.slice(1)))", "{prompt}"], modelArg: "--model" };
  const turns: any[] = [];
  const events: any[] = [];
  const r1 = await runAgentCli({ name: "x", profile: echoArgs, prompt: "hello", model: "m1", cwd: os.tmpdir(), onTurn: (t) => turns.push(t), onEvent: (e) => events.push(e) });
  assert.deepEqual(JSON.parse(r1.result as string), ["hello", "--model", "m1"]);
  assert.equal(r1.model, "m1");
  assert.deepEqual(turns.map((t) => t.role), ["USER", "ASSISTANT"]);
  assert.ok(events.some((e) => e.kind === "message" && e.role === "assistant" && !e.final), "stdout streamed to the live transcript");
  // No {prompt}: the prompt goes to stdin.
  const upper = { protocol: "exec" as const, command: "sh", args: ["-c", "tr a-z A-Z"] };
  assert.equal((await runAgentCli({ name: "x", profile: upper, prompt: "shout", cwd: os.tmpdir(), onTurn: () => {} })).result, "SHOUT");
  // With a schema: the JSON in the output is the result.
  const json = { protocol: "exec" as const, command: "sh", args: ["-c", 'cat >/dev/null; echo "Done. {\\"ok\\": true}"'] };
  assert.deepEqual((await runAgentCli({ name: "x", profile: json, prompt: "p", schema: { type: "object" }, cwd: os.tmpdir(), onTurn: () => {} })).result, { ok: true });
  // A non-zero exit fails the step with stderr.
  const fail = { protocol: "exec" as const, command: "sh", args: ["-c", "echo quota exceeded >&2; exit 2"] };
  await assert.rejects(runAgentCli({ name: "x", profile: fail, prompt: "p", cwd: os.tmpdir(), onTurn: () => {} }), /exited \(2\): quota exceeded/);
});

test("exec: cancelling a step stops the CLI and what it started", { skip: process.platform === "win32" }, async () => {
  const pidFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "age-kill-")), "pid");
  // A wrapper that starts a long-lived child and waits on it.
  const wrapper = { protocol: "exec" as const, command: "sh", args: ["-c", `sleep 30 & echo $! > ${pidFile}; wait`] };
  const ac = new AbortController();
  const run = runAgentCli({ name: "w", profile: wrapper, prompt: "p", cwd: os.tmpdir(), signal: ac.signal, onTurn: () => {} });
  while (!fs.existsSync(pidFile) || !fs.readFileSync(pidFile, "utf8").trim()) await new Promise((res) => setTimeout(res, 20));
  const pid = Number(fs.readFileSync(pidFile, "utf8"));
  ac.abort(new Error("cancelled"));
  await assert.rejects(run, /cancelled/);
  await new Promise((res) => setTimeout(res, 200));
  assert.throws(() => process.kill(pid, 0), /ESRCH/, "the wrapper's child was killed too");
});

test("exec: a prompt with $& or $$ reaches the CLI as written", async () => {
  const echo = { protocol: "exec" as const, command: process.execPath, args: ["-e", "console.log(process.argv[1])", "{prompt}"] };
  assert.equal((await runAgentCli({ name: "x", profile: echo, prompt: "regex $& and shell $$ and $'", cwd: os.tmpdir(), onTurn: () => {} })).result, "regex $& and shell $$ and $'");
});

test("a relative command runs from the step's directory; a CLI installed after a miss is found", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "age-relcmd-"));
  const script = path.join(dir, "ask.sh");
  fs.writeFileSync(script, "#!/bin/sh\ncat | tail -n 0\necho from-script\n", { mode: 0o755 });
  const mine = { protocol: "exec" as const, command: "./ask.sh" };
  writeAgentsFile({ profiles: { mine } });
  assert.equal(resolveAgent({ run: { "*": { use: "mine" } }, cwd: dir })!.name, "mine");
  assert.throws(() => resolveAgent({ run: { "*": { use: "mine" } }, cwd: os.tmpdir() }), /isn't installed here/);
  assert.equal((await runAgentCli({ name: "mine", profile: mine, prompt: "p", cwd: dir, onTurn: () => {} })).result, "from-script");
  // Misses aren't cached: installing the CLI and retrying the step works without a restart.
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "age-bin-"));
  const PATH = process.env.PATH;
  process.env.PATH = `${bin}:${PATH}`;
  try {
    assert.equal(which("age-late-cli"), undefined);
    fs.copyFileSync(script, path.join(bin, "age-late-cli"));
    assert.equal(which("age-late-cli"), path.join(bin, "age-late-cli"));
  } finally {
    process.env.PATH = PATH;
  }
  writeAgentsFile({});
});

test("nage agent add/remove: any CLI as a profile", () => {
  writeAgentsFile({});
  // ACP, with the model flag before its subcommand and env.
  assert.deepEqual(parseAgentAdd(["mykimi", "--acp", "--model-arg", "-m", "--model-first", "--env", "A=1=2", "--", "kimi", "acp"]), {
    name: "mykimi",
    profile: { protocol: "acp", command: "kimi", args: ["acp"], modelArg: "-m", modelArgFirst: true, env: { A: "1=2" } },
  });
  // exec: options after -- belong to the agent's command (even --model).
  const aider = parseAgentAdd(["aider", "--exec", "--description", "Aider", "--", "aider", "--yes", "--model", "x", "--message", "{prompt}"]);
  assert.deepEqual(aider.profile, { protocol: "exec", command: "aider", args: ["--yes", "--model", "x", "--message", "{prompt}"], description: "Aider" });
  for (const [bad, msg] of [
    [["x", "--acp"], /goes after --/],
    [["x", "--", "cmd"], /--acp.*--exec/],
    [["x", "--acp", "--exec", "--", "c"], /--acp.*--exec/],
    [["x", "--acp", "--bogus", "1", "--", "c"], /unknown option --bogus/],
    [["-x", "--acp", "--", "c"], /a name/],
  ] as const)
    assert.throws(() => parseAgentAdd([...bad]), msg);
  // Added profiles can be assigned and resolve; removing one says what still points at it.
  addProfile("aider", { ...aider.profile, command: "/bin/sh" });
  assignAgent({ rank: "junior", use: "aider" });
  assert.equal(resolveAgent({ jobType: "junior:x" })!.name, "aider");
  assert.match(removeProfile("aider"), /still assigned to rank junior/);
  assert.throws(() => removeProfile("aider"), /no profile "aider"/);
  // Shadowing a preset is allowed (your file wins) and removing it restores the preset.
  assert.match(addProfile("qwen", { protocol: "exec", command: "qwen", args: ["-p", "{prompt}"] })!, /replaces the built-in "qwen"/);
  assert.equal(allProfiles().qwen.protocol, "exec");
  assert.match(removeProfile("qwen"), /built-in preset applies again/);
  assert.equal(allProfiles().qwen.protocol, "acp");
  writeAgentsFile({});
});
