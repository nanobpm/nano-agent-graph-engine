// Portable flows (the nano-workforce convention): agent steps are typed <rank>:<task>, an
// author's CLI choice is only a suggestion, and the person running a flow picks the CLI and
// model — for every run (age agent assign) or one run (age start --agent/--model).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = fs.existsSync(path.join(root, "dist/cli.js")) && !process.env.AGE_TEST_SRC ? path.join(root, "dist/cli.js") : path.join(root, "src/cli.ts");
const fake = path.join(root, "test/fixtures/fake-claude.mjs");
const tmp = (p: string) => fs.mkdtempSync(path.join(os.tmpdir(), p));

// From an author who uses a CLI ("gpt-cli") this machine doesn't have.
const FLOW = `import { defineFlow, defineAgents } from "agent-graph-engine";
export const agents = defineAgents({ draft: { use: "gpt-cli", model: "gpt-9" } });
export const review = defineFlow("review", (w) => {
  w.task("draft", { jobType: "senior:draft", prompt: { resourceId: "p.md" } });
  w.task("critic", { jobType: "senior:critic", prompt: { resourceId: "p.md" } });
});
`;

function run(args: string[], env: Record<string, string>, cwd: string): { code: number; out: string } {
  try {
    return { code: 0, out: execFileSync(process.execPath, [cli, ...args], { env, cwd, stdio: ["ignore", "pipe", "pipe"] }).toString() };
  } catch (e: any) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}

async function until<T>(f: () => Promise<T | undefined>, ms = 20000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await f().catch(() => undefined);
    if (v !== undefined) return v;
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 100));
  }
}

test("a flow from another author runs on my CLIs: assign per flow/step, override per run", async () => {
  const project = tmp("age-port-");
  const state = tmp("age-engine-");
  fs.mkdirSync(path.join(project, "flows/prompts"), { recursive: true });
  fs.writeFileSync(path.join(project, "flows/review.flow.ts"), FLOW);
  fs.writeFileSync(path.join(project, "flows/prompts/p.md"), "Write release notes.");
  // My CLIs: two profiles (both the fake claude here).
  fs.writeFileSync(path.join(state, "agents.json"), JSON.stringify({ profiles: { writer: { protocol: "claude", command: fake }, judge: { protocol: "claude", command: fake } }, default: "writer" }));
  const log = path.join(state, "fake.log");
  const env = { ...process.env, AGE_PROJECT: project, AGE_HOME: tmp("age-lib-"), AGE_STATE_DIR: state, AGE_NOTIFY: "off", FAKE_CLAUDE_LOG: log } as Record<string, string>;
  try {
    // The author's CLI isn't here: a warning, not an error.
    let r = run(["check", "--no-types"], env, project);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /suggests agent profile "gpt-cli"/);

    run(["up"], env, project);
    const { url } = JSON.parse(fs.readFileSync(path.join(state, "daemon.json"), "utf8"));
    // The deployed model carries the NWF marker and job types.
    const st: any = await (await fetch(`${url}/api/state?project=${encodeURIComponent(project)}`)).json();
    const key = st.flows.find((f: any) => f.id === "review").key;
    const xml = await (await fetch(`${url}/api/flows/${encodeURIComponent(key)}/bpmn`)).text();
    assert.match(xml, /type="senior:draft"/);
    assert.match(xml, /agentDefinition agentType="external"/);

    r = run(["agent", "show", "review"], env, project);
    assert.match(r.out, /draft\s+senior:draft\s+→ writer — your default; flow suggests gpt-cli \(unknown here\)/, r.out);

    // Between runs: the whole flow on judge, the critic on writer with a model.
    run(["agent", "assign", "review", "judge"], env, project);
    r = run(["agent", "assign", "review/critic", "writer", "--model", "m-critic"], env, project);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /draft\s+senior:draft\s+→ judge — your flow assignment/);
    assert.match(r.out, /critic\s+senior:critic\s+→ writer \(m-critic\) — your step assignment/);

    const agentsOf = async (key: string) =>
      until(async () => {
        const a: any[] = await (await fetch(`${url}/api/explorer/instances/${key}/agents`)).json();
        return a.length === 2 && a.every((x) => x.status === "COMPLETED") ? Object.fromEntries(a.map((x) => [x.elementId, x.definition.provider])) : undefined;
      });
    const startKey = (out: string) => out.match(/instance (\d+)/)![1];
    const models = () => fs.readFileSync(log, "utf8").trim().split("\n").map((l) => { const a: string[] = JSON.parse(l).argv; const i = a.indexOf("--model"); return i < 0 ? undefined : a[i + 1]; });

    r = run(["start", "review"], env, project);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(await agentsOf(startKey(r.out)), { draft: "judge", critic: "writer" });
    assert.deepEqual(models().sort(), ["m-critic", undefined].sort());

    // One run on something else, without touching the assignments.
    fs.rmSync(log);
    r = run(["start", "review", "--agent", "draft=writer", "--model", "m-run"], env, project);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(await agentsOf(startKey(r.out)), { draft: "writer", critic: "writer" });
    assert.deepEqual(models(), ["m-run", "m-run"]);
    assert.match(run(["agent", "show", "review"], env, project).out, /draft\s+senior:draft\s+→ judge/);

    // A bad override is refused up front, naming the problem.
    r = run(["start", "review", "--agent", "nope"], env, project);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /unknown agent profile "nope"/);
    const res = await fetch(`${url}/api/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ flowId: "review", project, agents: { drafty: { use: "writer" } } }) });
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as any).error, /drafty/);

    // Unassign: back to the default.
    run(["agent", "unassign", "review"], env, project);
    run(["agent", "unassign", "review/critic"], env, project);
    assert.match(run(["agent", "show", "review"], env, project).out, /critic\s+senior:critic\s+→ writer — your default/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(state, "agents.json"), "utf8")).flows, {});
  } finally {
    run(["down"], env, project);
  }
});

test("agent options: {{var}} placeholders in the prompt, context: [] sends no variables, cwd from a variable", async () => {
  const project = tmp("age-tpl-");
  const state = tmp("age-engine-");
  const work = tmp("age-work-");
  fs.mkdirSync(path.join(project, "flows/prompts"), { recursive: true });
  fs.writeFileSync(
    path.join(project, "flows/tpl.flow.ts"),
    `import { defineFlow, defineAgents } from "agent-graph-engine";
export const agents = defineAgents({ write: { context: [], cwd: "{{dir}}" } });
export const tpl = defineFlow("tpl", (w) => {
  w.run("prep", async () => ({ built: "Write the notes for v2.", dir: ${JSON.stringify(work)}, secret: "do-not-send" }));
  w.task("write", { jobType: "senior:write", prompt: { resourceId: "w.md" } });
});
`,
  );
  fs.writeFileSync(path.join(project, "flows/prompts/w.md"), "{{built}}\nList: {{list}}");
  fs.writeFileSync(path.join(state, "agents.json"), JSON.stringify({ profiles: { writer: { protocol: "claude", command: fake } }, default: "writer" }));
  const log = path.join(state, "fake.log");
  const env = { ...process.env, AGE_PROJECT: project, AGE_HOME: tmp("age-lib-"), AGE_STATE_DIR: state, AGE_NOTIFY: "off", FAKE_CLAUDE_LOG: log } as Record<string, string>;
  try {
    const r = run(["start", "tpl"], env, project);
    assert.equal(r.code, 0, r.out);
    const entry = await until(async () => (fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, "utf8").trim().split("\n")[0]) : undefined));
    assert.match(entry.prompt, /^Write the notes for v2\.\nList: \n/);
    assert.doesNotMatch(entry.prompt, /do-not-send|Context \(process variables\)/);
    assert.equal(fs.realpathSync(entry.cwd), fs.realpathSync(work));
  } finally {
    run(["down"], env, project);
  }
});

test("a deleted flow file disappears from the engine; reveal only takes deployed flows", async () => {
  const project = tmp("age-del-");
  const state = tmp("age-engine-");
  fs.mkdirSync(path.join(project, "flows"));
  const file = path.join(project, "flows/gone.flow.ts");
  fs.writeFileSync(file, `import { defineFlow } from "agent-graph-engine";\nexport const f = defineFlow("gone", (w) => { w.run("x", async () => ({})); });\n`);
  const env = { ...process.env, AGE_PROJECT: project, AGE_HOME: tmp("age-lib-"), AGE_STATE_DIR: state, AGE_NOTIFY: "off" } as Record<string, string>;
  try {
    run(["up"], env, project);
    const { url } = JSON.parse(fs.readFileSync(path.join(state, "daemon.json"), "utf8"));
    const ids = async () => ((await (await fetch(`${url}/api/state?project=${encodeURIComponent(project)}`)).json()) as any).flows.map((f: any) => f.id);
    assert.deepEqual(await ids(), ["gone"]);
    const bad = await fetch(`${url}/api/flows/${encodeURIComponent("../../etc")}/reveal`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(bad.status, 404);
    fs.rmSync(file);
    await fetch(`${url}/api/reload`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.deepEqual(await ids(), []);
    const r = run(["start", "gone"], env, project);
    assert.notEqual(r.code, 0);
  } finally {
    run(["down"], env, project);
  }
});
