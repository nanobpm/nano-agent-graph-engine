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
process.env.AGE_NOTIFY ??= "off"; // engines started by tests: no desktop notifications

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

/** An empty global flow library, so the user's ~/AgentGraph flows stay out of tests. */
const emptyHome = () => fs.mkdtempSync(path.join(os.tmpdir(), "age-lib-"));
/** A private engine (state dir), so tests never touch the user's ~/.agent-graph. */
const engineHome = () => fs.mkdtempSync(path.join(os.tmpdir(), "age-engine-"));

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
  const env = { ...process.env, AGE_CLAUDE_CMD: fake, AGE_PROJECT: project, AGE_HOME: emptyHome(), AGE_STATE_DIR: engineHome() } as Record<string, string>;
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

    // each agent run is an AgentInstance with its transcript, kept across the restart
    const url = JSON.parse(fs.readFileSync(path.join(env.AGE_STATE_DIR, "daemon.json"), "utf8")).url;
    const runKey = started.text.match(/instance (\d+)/)![1];
    const agents: any[] = await (await fetch(`${url}/api/explorer/instances/${runKey}/agents`)).json();
    assert.equal(agents.length, 2, JSON.stringify(agents));
    assert.ok(agents.every((a) => a.status === "COMPLETED" && a.elementId === "draft" && a.definition.provider === "claude"));
    assert.equal(agents[0].metrics.toolCalls, 1);
    const history: any[] = await (await fetch(`${url}/api/explorer/agents/${agents[0].agentInstanceKey}/history`)).json();
    assert.deepEqual(history.map((h) => h.role), ["CONFIGURATION", "USER", "ASSISTANT", "TOOL_RESULT", "ASSISTANT"]);
    assert.equal(history[2].toolCalls[0].toolName, "Bash");
    assert.match(history[1].content[0].text, /Context \(process variables\)/);

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
  const env = { ...process.env, AGE_CLAUDE_CMD: fake, AGE_PROJECT: project, AGE_HOME: emptyHome(), AGE_STATE_DIR: engineHome() } as Record<string, string>;
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

test("Claude Desktop chat: no project, no claude CLI, author + run through MCP only", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "age-home-"));
  const env = { PATH: "/usr/bin:/bin", HOME: home, AGE_AGENT_MODE: "session", AGE_NOTIFY: "off" } as Record<string, string>;
  const client = new Client({ name: "desktop-like", version: "0" }, { capabilities: {} });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, "mcp"], env, cwd: "/" }));
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r: any = await client.callTool({ name, arguments: args });
    return { text: r.content.map((c: any) => c.text).join("\n"), isError: !!r.isError, sc: r.structuredContent };
  };
  try {
    assert.match(client.getInstructions() ?? "", /flow_guide/);
    const guide = await call("flow_guide");
    assert.match(guide.text, new RegExp(`Project folder: ${path.join(home, "AgentGraph")}`));
    assert.match(guide.text, /defineFlow/);

    // a broken flow reports problems
    const bad = await call("flow_write", { name: "bad", source: 'import { defineFlow } from "agent-graph-engine";\nexport const f = defineFlow("bad", (w) => { w.run("x"); });' });
    assert.equal(bad.isError, true);
    fs.rmSync(path.join(home, "AgentGraph/flows/bad.flow.ts"));

    const source = `import { defineFlow, defineForms, defineAgents } from "agent-graph-engine";
export const forms = defineForms({ ok: { title: "Approve {{topic}}?", description: "{{summary}}", fields: { approve: { type: "boolean" } }, required: ["approve"] } });
export const agents = defineAgents({ summarize: { schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] } } });
export const pitch = defineFlow("pitch", (w) => {
  w.task("summarize", { jobType: "senior:summarize", prompt: { resourceId: "summarize.md" } });
  w.human("approve", { form: "ok" });
  w.run("record", async (job) => ({ recorded: job.variables.approve === true }));
});`;
    const wr = await call("flow_write", { name: "pitch", source, prompts: { "summarize.md": "Summarize the topic in one line." } });
    assert.equal(wr.isError, false, wr.text);
    assert.match(wr.text, /Deployed: pitch/);
    assert.match((await call("flow_read", { name: "pitch" })).text, /Summarize the topic/);

    const st = await call("flow_start", { flowId: "pitch", variables: { topic: "WASM" } });
    const instanceKey = st.text.match(/instance (\d+)/)![1];

    // the agent step comes to the chat assistant (no CLI)
    const job = await until(async () => {
      const t = (await call("session_job_next")).text;
      return t.includes("summarize") ? t : undefined;
    });
    assert.match(job, /Summarize the topic/);
    assert.match(job, /"summary"/); // outputSchema
    const jobKey = job.match(/"key":\s*"(\d+)"/)![1];
    assert.equal((await call("session_job_complete", { jobKey, variables: { summary: "fast engine" } })).isError, false);

    // the explorer MCP App: tool result + resource + proxied API
    const ex = await call("show_explorer", { instanceKey });
    assert.equal(ex.sc.hash, `instance=${instanceKey}`);
    const tools = await client.listTools();
    const showTool: any = tools.tools.find((t) => t.name === "show_explorer");
    const uri = showTool._meta.ui.resourceUri;
    const res: any = await client.readResource({ uri });
    assert.match(res.contents[0].mimeType, /mcp-app/);
    assert.match(res.contents[0].text, /ui_api/);

    const task = await until(async () => {
      const r = await call("ui_api", { path: "/api/state" });
      return r.sc.data.userTasks?.find((t: any) => t.instanceKey === instanceKey);
    });
    assert.equal(task.form.title, "Approve WASM?");
    // the user answers in the view
    await call("ui_api", { path: `/api/user-tasks/${task.key}/complete`, body: { variables: { approve: true } } });
    assert.equal((await call("ui_api", { path: "/api/shutdown" })).isError, true);

    const done = await until(async () => {
      const r = await call("ui_api", { path: `/api/instances/${instanceKey}` });
      return r.sc.data.state === "Completed" ? r.sc.data : undefined;
    });
    assert.equal(done.history.variables.recorded, true);
  } finally {
    await client.close();
    execFileSync(process.execPath, [cli, "down"], { env: { ...env, AGE_PROJECT: path.join(home, "AgentGraph") } });
  }
});

test("flow_list shows project + library; flow_import copies a library flow with its prompts", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "age-home-"));
  fs.cpSync(path.join(root, "examples/demo/flows"), path.join(home, "AgentGraph/flows"), { recursive: true });
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "age-proj-"));
  fs.mkdirSync(path.join(project, "flows"));
  const env = { PATH: process.env.PATH!, HOME: home, AGE_PROJECT: project, AGE_AGENT_MODE: "session", AGE_NOTIFY: "off" } as Record<string, string>;
  const client = new Client({ name: "t", version: "0" }, { capabilities: {} });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, "mcp"], env, cwd: project }));
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r: any = await client.callTool({ name, arguments: args });
    return { text: r.content.map((c: any) => c.text).join("\n"), isError: !!r.isError };
  };
  try {
    const l = await call("flow_list");
    assert.match(l.text, /## this project[\s\S]*\(none\)[\s\S]*## global \(library\)[\s\S]*changelog: flow "changelog" — Draft release notes/);
    assert.match(l.text, /draft\(senior:draft\)/);
    // Library flows are offered in every project: "global", until a project copy shadows them.
    // one engine per user: its address is in ~/.agent-graph, not in the project
    const daemonUrl = () => JSON.parse(fs.readFileSync(path.join(home, ".agent-graph/daemon.json"), "utf8")).url;
    const scopeOf = async () => {
      const st: any = await (await fetch(`${daemonUrl()}/api/state?project=${encodeURIComponent(project)}`)).json();
      return st.flows.find((f: any) => f.id === "changelog")?.scope;
    };
    await call("flow_status");
    assert.equal(await scopeOf(), "global");
    assert.equal(fs.existsSync(path.join(project, ".agent-graph")), false); // nothing written into the repo
    const im = await call("flow_import", { name: "changelog" });
    assert.equal(im.isError, false, im.text);
    assert.ok(fs.existsSync(path.join(project, "flows/prompts/changelog.md")));
    assert.match(im.text, /Deployed here: changelog/);
    assert.equal((await call("flow_import", { name: "changelog" })).isError, true); // no silent overwrite
    assert.equal(await until(async () => ((await scopeOf()) === "project" ? "project" : undefined)), "project");
    // the imported flow shows up as a "start" prompt (slash command / prompt menu)
    const names = await until(async () => {
      const ps = (await client.listPrompts()).prompts.map((p) => p.name);
      return ps.includes("start-changelog") ? ps : undefined;
    });
    assert.ok(names.includes("flows"));
    const gp = await client.getPrompt({ name: "start-changelog", arguments: { inputs: "since v1.0" } });
    assert.match((gp.messages[0].content as any).text, /Start the Agent Graph flow "changelog"[\s\S]*since v1.0[\s\S]*flow_start/);
  } finally {
    await client.close();
    execFileSync(process.execPath, [cli, "down"], { env });
  }
});

test("edit loop: a bug raises an incident, flow_write fixes the code, retry continues the same run", async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "age-fix-"));
  const env = { PATH: process.env.PATH!, HOME: project, AGE_PROJECT: project, AGE_AGENT_MODE: "session", AGE_NOTIFY: "off", AGE_BACKOFF_MS: "50" } as Record<string, string>;
  const client = new Client({ name: "t", version: "0" }, { capabilities: {} });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, "mcp"], env, cwd: project }));
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r: any = await client.callTool({ name, arguments: args });
    return { text: r.content.map((c: any) => c.text).join("\n"), isError: !!r.isError };
  };
  const src = (body: string) => `import { defineFlow } from "agent-graph-engine";
export const f = defineFlow("fixme", (w) => {
  w.run("step", async (job) => { ${body} });
  w.run("after", async () => ({ ok: true }));
});`;
  try {
    assert.equal((await call("flow_write", { name: "fixme", source: src('throw new Error("bug v1");') })).isError, false);
    const key = (await call("flow_start", { flowId: "fixme" })).text.match(/instance (\d+)/)![1];
    const incident = await until(async () => (await call("flow_status")).text.match(/INCIDENT (\d+).*bug v1/)?.[1]);
    assert.equal((await call("flow_write", { name: "fixme", source: src("return { fixed: true };") })).isError, false);
    const r = await call("flow_operate", { action: "retry", incidentKey: incident });
    assert.equal(r.isError, false, r.text);
    const done = await until(async () => {
      const t = (await call("flow_status", { instanceKey: key })).text;
      return /"state":\s*"Completed"/.test(t) ? t : undefined;
    });
    assert.match(done, /"fixed":\s*true/);
  } finally {
    await client.close();
    execFileSync(process.execPath, [cli, "down"], { env });
  }
});

test("one engine for every project: same flow id in two repos, global flows run where started, session jobs stay in their project", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "age-home-"));
  const lib = path.join(home, "AgentGraph/flows");
  const flow = (id: string, tag: string) => `import { defineFlow, sh } from "agent-graph-engine";
export const f = defineFlow("${id}", (w) => {
  w.run("where", async () => ({ cwd: (await sh("pwd")).stdout.trim(), tag: "${tag}" }));
  w.task("think", { jobType: "session" });
});`;
  fs.mkdirSync(lib, { recursive: true });
  fs.writeFileSync(path.join(lib, "shared.flow.ts"), flow("shared", "global"));
  const repos = ["alpha", "beta"].map((n) => {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `age-${n}-`)));
    fs.mkdirSync(path.join(dir, "flows"));
    fs.writeFileSync(path.join(dir, "flows/build.flow.ts"), flow("build", n));
    return dir;
  });
  const connect = async (project: string) => {
    const env = { PATH: process.env.PATH!, HOME: home, AGE_PROJECT: project, AGE_AGENT_MODE: "session", AGE_NOTIFY: "off" } as Record<string, string>;
    const client = new Client({ name: "t", version: "0" }, { capabilities: {} });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, "mcp"], env, cwd: project }));
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const r: any = await client.callTool({ name, arguments: args });
      return { text: r.content.map((c: any) => c.text).join("\n"), isError: !!r.isError };
    };
    return { client, call, env };
  };
  const [a, b] = await Promise.all(repos.map(connect));
  try {
    const keyOf = (t: string) => t.match(/instance (\d+)/)![1];
    const ka = keyOf((await a.call("flow_start", { flowId: "build" })).text);
    const kb = keyOf((await b.call("flow_start", { flowId: "build" })).text);
    const kg = keyOf((await b.call("flow_start", { flowId: "shared" })).text);
    // one engine: both sessions see the same pid
    const info = JSON.parse(fs.readFileSync(path.join(home, ".agent-graph/daemon.json"), "utf8"));
    const vars = async (k: string) =>
      until(async () => {
        const i: any = await (await fetch(`${info.url}/api/instances/${k}`)).json();
        return i.history?.variables?.cwd ? i : undefined;
      });
    const [ia, ib, ig] = [await vars(ka), await vars(kb), await vars(kg)];
    assert.deepEqual([ia.history.variables.tag, ia.history.variables.cwd, ia.project], ["alpha", repos[0], repos[0]]);
    assert.deepEqual([ib.history.variables.tag, ib.history.variables.cwd], ["beta", repos[1]]);
    assert.deepEqual([ig.history.variables.tag, ig.history.variables.cwd, ig.flowId], ["global", repos[1], "shared"]); // global flow, run in beta
    // alpha's status lists beta's runs too, marked
    const st = (await a.call("flow_status")).text;
    assert.match(st, /project flows: build/);
    assert.match(st, /global flows .*: shared/);
    assert.match(st, new RegExp(`${kb} build \\[${path.basename(repos[1])}\\]`));
    // session jobs: alpha's session only gets alpha's agent step
    const ja = JSON.parse((await a.call("session_job_next", { max: 5 })).text);
    assert.deepEqual(ja.map((j: any) => j.instanceKey), [ka]);
    const jb = JSON.parse((await b.call("session_job_next", { max: 5 })).text);
    assert.deepEqual(jb.map((j: any) => j.instanceKey).sort(), [kb, kg].sort());
  } finally {
    await a.client.close();
    await b.client.close();
    execFileSync(process.execPath, [cli, "down"], { env: a.env });
  }
});

test("task_ask: a client that declares elicitation but never shows it gets the question in chat", async () => {
  const project = tempProject();
  const env = { ...process.env, AGE_CLAUDE_CMD: fake, AGE_PROJECT: project, AGE_HOME: emptyHome(), AGE_STATE_DIR: engineHome() } as Record<string, string>;
  const dial = async (name: string, extra: Record<string, string>, onElicit: () => Promise<any>) => {
    const client = new Client({ name, version: "2.2.6" }, { capabilities: { elicitation: { form: {} } } });
    let asked = 0;
    client.setRequestHandler(ElicitRequestSchema, async () => {
      asked++;
      return onElicit();
    });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, "mcp"], env: { ...env, ...extra }, cwd: project }));
    const call = async (tool: string, args: Record<string, unknown> = {}) => {
      const r: any = await client.callTool({ name: tool, arguments: args });
      return r.content.map((c: any) => c.text).join("\n") as string;
    };
    return { client, call, asked: () => asked };
  };
  // Start from a neutral client: a run started from "opencode" would run its agent step
  // with the real opencode CLI (the host's agent) instead of the fake one.
  const starter = await dial("tester", {}, async () => ({ action: "decline" }));
  const a = await dial("opencode", {}, async () => ({ action: "accept", content: {} }));
  try {
    await starter.call("flow_start", { flowId: "changelog", variables: { commits: 5 } });
    await starter.client.close();
    const task = await until(async () => {
      const t = await a.call("task_list");
      return t.startsWith("[") ? JSON.parse(t)[0] : undefined;
    });
    // OpenCode: known not to render forms → straight to chat, no elicitation sent.
    assert.match(await a.call("task_ask", { taskKey: task.key }), /can't show a form dialog/);
    assert.equal(a.asked(), 0);
    // A client that never answers: times out, then falls back to chat.
    const b = await dial("silent", { AGE_ELICIT_TIMEOUT_MS: "500" }, () => new Promise(() => {}));
    try {
      assert.match(await b.call("task_ask", { taskKey: task.key }), /got no answer[\s\S]*task_complete/);
      assert.equal(b.asked(), 1);
    } finally {
      await b.client.close();
    }
  } finally {
    await a.client.close();
    try {
      execFileSync(process.execPath, [cli, "down"], { env, cwd: project });
    } catch {}
  }
});
