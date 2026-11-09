// Step threads: flow code runs off the engine's thread. A busy loop doesn't block it, a
// hung step is terminated, process.exit() only ends its thread, and sh() runs in the
// run's project.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { StepPool } from "../src/step-pool.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "age-steps-"));
const file = path.join(dir, "flows", "t.flow.ts");
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(
  file,
  `import { defineFlow, sh, projectPath } from "agent-graph-engine";
export const t = defineFlow("t", (w) => {
  w.run("add", async (job) => ({ sum: job.variables.a + job.variables.b }));
  w.run("spin", async (job) => { const end = Date.now() + job.variables.ms; while (Date.now() < end); return { spun: true }; });
  w.run("hang", () => { for (;;); });
  w.run("exit", () => process.exit(3));
  w.run("throw", () => { throw new Error("nope"); });
  w.run("where", async () => ({ pwd: (await sh("pwd")).stdout.trim(), file: projectPath("x") }));
});
export const workers = { "custom-type": async () => ({ custom: 1 }) };
`,
);
const stamp = fs.statSync(file).mtimeMs;
const req = (step: string, variables: Record<string, unknown> = {}) => ({
  file,
  stamp,
  flowId: "t",
  flowKey: "k.t",
  type: step.includes("-") ? step : `k.t:${step}`,
  project: dir,
  job: { jobKey: "1", processInstanceKey: "2", elementId: step, type: step, variables },
});
const never = new AbortController().signal;

test("step threads", async (t) => {
  const pool = new StepPool(2);
  t.after(() => pool.close());

  await t.test("runs a run-step handler and a custom worker", async () => {
    assert.deepEqual(await pool.run(req("add", { a: 2, b: 3 }), never), { sum: 5 });
    assert.deepEqual(await pool.run(req("custom-type"), never), { custom: 1 });
  });

  await t.test("a computing step doesn't block this thread", async () => {
    let ticks = 0;
    const iv = setInterval(() => ticks++, 10);
    await pool.run(req("spin", { ms: 300 }), never);
    clearInterval(iv);
    assert.ok(ticks >= 10, `only ${ticks} ticks while the step computed`);
  });

  await t.test("two computing steps run in parallel", async () => {
    const t0 = Date.now();
    await Promise.all([pool.run(req("spin", { ms: 400 }), never), pool.run(req("spin", { ms: 400 }), never)]);
    assert.ok(Date.now() - t0 < 750, `took ${Date.now() - t0} ms`);
  });

  await t.test("a step stuck in a synchronous loop is terminated after abort", async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(new Error("timed out")), 50);
    await assert.rejects(pool.run(req("hang"), ac.signal), /timed out/);
    assert.deepEqual(await pool.run(req("add", { a: 1, b: 1 }), never), { sum: 2 });
  });

  await t.test("process.exit ends only the step's thread; throws fail the step", async () => {
    await assert.rejects(pool.run(req("exit"), never), /exited \(code 3\)/);
    await assert.rejects(pool.run(req("throw"), never), /nope/);
  });

  await t.test("sh() and projectPath() use the run's project", async () => {
    const r = await pool.run(req("where"), never);
    assert.equal(fs.realpathSync(String(r.pwd)), fs.realpathSync(dir));
    assert.equal(r.file, path.join(dir, "x"));
  });

  await t.test("at most `size` threads", () => assert.ok(pool.threads <= 2));
});
