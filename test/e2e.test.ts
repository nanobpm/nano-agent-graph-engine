// End-to-end: MCP client (with elicitation) → MCP server → daemon → engine, on a temp
// copy of examples/demo with a fake `claude`. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const built = fs.existsSync(path.join(root, "dist/cli.js"));
const cli = built && !process.env.AGE_TEST_SRC ? path.join(root, "dist/cli.js") : path.join(root, "src/cli.ts");
const fake = path.join(root, "test/fixtures/fake-claude.mjs");

function tempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "age-"));
  fs.cpSync(path.join(root, "examples/demo/flows"), path.join(dir, "flows"), { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "feat: first"], { cwd: dir });
  return dir;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(fn: () => Promise<T | undefined>, ms = 15000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error("timed out");
    await sleep(200);
  }
}

test("changelog flow over MCP with elicitation, durable across daemon restart", async () => {
  const project = tempProject();
  const env = { ...process.env, AGE_CLAUDE_CMD: fake, AGE_PROJECT: project } as Record<string, string>;
  const answers = [{ decision: "redo", feedback: "shorter" }, { decision: "publish" }];
  const asked: any[] = [];

  const client = new Client({ name: "t", version: "0" }, { capabilities: { elicitation: { form: {} } } });
  client.setRequestHandler(ElicitRequestSchema, async (req) => {
    asked.push(req.params);
    return { action: "accept", content: answers.shift()! };
  });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, "mcp"], env, cwd: project }));
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r: any = await client.callTool({ name, arguments: args });
    return { text: r.content.map((c: any) => c.text).join("\n"), isError: !!r.isError };
  };

  try {
    const check = await call("flow_check");
    assert.equal(check.isError, false, check.text);
    assert.match(check.text, /live: changelog/);

    const started = await call("flow_start", { flowId: "changelog", variables: { commits: 5 }, title: "v1" });
    assert.match(started.text, /instance \d+/);

    const firstTask = await until(async () => {
      const r = JSON.parse((await call("task_list")).text.startsWith("[") ? (await call("task_list")).text : "[]");
      return r[0];
    });
    assert.equal(firstTask.formId, "changelog-review");

    // redo → agent runs again with feedback → new task
    let r = await call("task_ask", { taskKey: firstTask.key });
    assert.match(r.text, /completed/);
    assert.match(asked[0].message, /drafted by fake claude/);
    assert.deepEqual(asked[0].requestedSchema.required, ["decision"]);

    const second = await until(async () => {
      const t = (await call("task_list")).text;
      if (!t.startsWith("[")) return undefined;
      const x = JSON.parse(t)[0];
      return x && x.key !== firstTask.key ? x : undefined;
    });
    assert.match(second.form.description, /applied: shorter/);

    // restart the daemon: state must come back from the event log
    execFileSync(process.execPath, [cli, "down"], { env, cwd: project });
    await sleep(300);
    r = await call("task_ask", { taskKey: second.key });
    assert.match(r.text, /completed/, r.text);

    await until(async () => (fs.existsSync(path.join(project, "CHANGELOG-draft.md")) ? true : undefined));
    const status = await call("flow_status");
    assert.match(status.text, /0 active, 1 finished/, status.text);

    // hooks stay silent with nothing pending
    const hook = execFileSync(process.execPath, [cli, "hook", "SessionStart"], { env, cwd: project, input: JSON.stringify({ cwd: project }) }).toString();
    assert.equal(hook, "");
  } finally {
    await client.close();
    try {
      execFileSync(process.execPath, [cli, "down"], { env, cwd: project });
    } catch {
      /* already down */
    }
  }
});

test("hook reports a waiting user task; check reports lint problems", async () => {
  const project = tempProject();
  const env = { ...process.env, AGE_CLAUDE_CMD: fake, AGE_PROJECT: project } as Record<string, string>;
  try {
    execFileSync(process.execPath, [cli, "start", "changelog"], { env, cwd: project });
    let out = "";
    await until(async () => {
      out = execFileSync(process.execPath, [cli, "hook", "UserPromptSubmit"], { env, cwd: project, input: JSON.stringify({ cwd: project }) }).toString();
      return out || undefined;
    });
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(ctx, /user task \d+: changelog\/review/);
    // second prompt: nothing new → silent
    const again = execFileSync(process.execPath, [cli, "hook", "UserPromptSubmit"], { env, cwd: project, input: JSON.stringify({ cwd: project }) }).toString();
    assert.equal(again, "");

    fs.writeFileSync(
      path.join(project, "flows/bad.flow.ts"),
      `import { defineFlow } from "agent-graph-engine";
export const bad = defineFlow("bad", (w) => {
  w.human("approve", { form: "nope" });
  w.task("think", { jobType: "claude", prompt: { resourceId: "missing.md" } });
  w.task("other", { jobType: "mystery" });
});`,
    );
    let code = 0;
    let txt = "";
    try {
      execFileSync(process.execPath, [cli, "check"], { env, cwd: project });
    } catch (e: any) {
      code = e.status;
      txt = e.stdout.toString();
    }
    assert.equal(code, 1);
    assert.match(txt, /form "nope"/);
    assert.match(txt, /missing\.md not found/);
    assert.match(txt, /"mystery" that no worker serves/);
  } finally {
    execFileSync(process.execPath, [cli, "down"], { env, cwd: project });
  }
});
