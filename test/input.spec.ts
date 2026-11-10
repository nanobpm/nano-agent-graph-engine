// Flow inputs (the `Start` contract): the derived start form, converting text to the
// declared types, the check at start, hint checks, CLI args — and end to end through
// the CLI and the daemon, with the type-checking authoring loop (`nage check`).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkInput, coerceInput, describeInput, hintProblems, inputForm, parseStartArgs, type FlowInput } from "../src/input.ts";
process.env.AGE_NOTIFY ??= "off";

const input: FlowInput = {
  name: "ReviewInput",
  fields: [
    { name: "pr", type: "integer", optional: false, list: false },
    { name: "repo", type: "string", optional: false, list: false },
    { name: "draft", type: "boolean", optional: true, list: false },
    { name: "labels", type: "string", optional: true, list: true },
    { name: "due", type: "datetime", optional: true, list: false },
  ],
};

test("inputForm: one field per input field, required from optional, hints decorate", () => {
  const form = inputForm(input, { title: "Review a PR", fields: { pr: { title: "PR number", minimum: 1 }, repo: { enum: ["a/b", "c/d"], default: "a/b" } } });
  assert.equal(form.title, "Review a PR");
  assert.deepEqual(form.required, ["pr", "repo"]);
  assert.deepEqual(form.fields.pr, { type: "integer", title: "PR number", minimum: 1 });
  assert.deepEqual(form.fields.repo, { type: "string", title: "repo", enum: ["a/b", "c/d"], default: "a/b" });
  assert.deepEqual(form.fields.draft, { type: "boolean", title: "draft" });
  assert.equal(form.fields.labels.type, "string");
  assert.match(String(form.fields.labels.description), /separated by commas/);
  assert.deepEqual(form.fields.due, { type: "string", title: "due", format: "date-time" });
});

test("coerceInput / checkInput: text becomes the declared types; problems name the field", () => {
  assert.deepEqual(coerceInput(input, { pr: "42", repo: "a/b", draft: "yes", labels: "x, y\nz", due: "", extra: "kept" }), {
    pr: 42,
    repo: "a/b",
    draft: true,
    labels: ["x", "y", "z"],
    extra: "kept",
  });
  const ok = checkInput(input, { pr: 7, repo: "a/b" });
  assert.deepEqual(ok.problems, []);
  const bad = checkInput(input, { pr: "seven", draft: "maybe", due: "tomorrow" });
  assert.deepEqual(bad.problems, [
    { field: "pr", message: "must be a whole number" },
    { field: "repo", message: "is required" },
    { field: "draft", message: "must be true or false" },
    { field: "due", message: "must be an ISO 8601 date or date-time" },
  ]);
  assert.equal(describeInput(input), "pr: integer, repo: string, draft?: boolean, labels?: string[], due?: datetime");
});

test("hintProblems: unknown fields, enum on a non-string, wrong default type, hints without input", () => {
  assert.deepEqual(hintProblems(input, { fields: { pr: { title: "ok" } } }), []);
  const p = hintProblems(input, { fields: { prr: {}, pr: { enum: ["1"] }, draft: { default: "no" } } as any });
  assert.equal(p.length, 3);
  assert.match(p[0], /"prr" is not in the input ReviewInput/);
  assert.match(p[1], /enum needs a single string field/);
  assert.match(p[2], /default "no" must be true or false/);
  assert.match(hintProblems(undefined, { title: "x" })[0], /declares no input/);
});

test("parseStartArgs: --f v, --f=v, f=v, bare flags, JSON, --title", () => {
  assert.deepEqual(parseStartArgs(["--pr", "42", "--repo=a/b", "note=two words", '{"extra":1}', "--title", "run 1", "--draft"]), {
    variables: { pr: "42", repo: "a/b", note: "two words", draft: true, extra: 1 },
    title: "run 1",
  });
  assert.throws(() => parseStartArgs(["oops"]), /don't know what to do with "oops"/);
});

// ---------- end to end ----------

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = fs.existsSync(path.join(root, "dist/cli.js")) && !process.env.AGE_TEST_SRC ? path.join(root, "dist/cli.js") : path.join(root, "src/cli.ts");
const tmp = (p: string) => fs.mkdtempSync(path.join(os.tmpdir(), p));

const FLOW = `import { defineFlow, defineStartForm, envelope } from "agent-graph-engine";
const Input = envelope("ReviewInput", { pr: "integer", repo: "string", labels: { type: "string", list: true, optional: true } });
export const startForm = defineStartForm(Input, { title: "Review a PR", fields: { pr: { title: "PR number" } } });
export const review = defineFlow("review", { Start: { in: Input }, look: { in: Input } }, (w) => {
  w.run("look", async (job) => ({ seen: job.variables.pr + 1 }));
  w.human("ok", { form: "ok" });
});
export const forms = { ok: { fields: { fine: { type: "boolean" as const } } } };
`;

function run(args: string[], env: Record<string, string>, cwd: string): { code: number; out: string } {
  try {
    return { code: 0, out: execFileSync(process.execPath, [cli, ...args], { env, cwd, stdio: ["ignore", "pipe", "pipe"] }).toString() };
  } catch (e: any) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}

test("flow input end to end: check loop with type errors, then start with checked, converted input", { skip: !fs.existsSync(path.join(root, "dist/typecheck/ts.cjs")) && "build first (dist/typecheck)" }, async () => {
  const project = tmp("age-input-");
  const state = tmp("age-engine-");
  fs.mkdirSync(path.join(project, "flows"));
  const env = { ...process.env, AGE_PROJECT: project, AGE_HOME: tmp("age-lib-"), AGE_STATE_DIR: state, AGE_NOTIFY: "off" } as Record<string, string>;
  const file = path.join(project, "flows/review.flow.ts");
  try {
    // 1. The authoring loop: a type error and a bad hint are reported, with positions.
    fs.writeFileSync(file, FLOW.replace("job.variables.pr + 1", "job.variables.pr.toUpperCase()").replace('pr: { title: "PR number" }', 'prr: { title: "PR number" }'));
    let r = run(["check", "--json"], env, project);
    assert.equal(r.code, 1);
    const j = JSON.parse(r.out);
    assert.equal(j.ok, false);
    assert.equal(j.typesChecked, true);
    const msgs = j.files[0].problems.map((p: any) => p.message).join("\n");
    assert.match(msgs, /flows\/review\.flow\.ts:5:\d+ TS2339: Property 'toUpperCase' does not exist on type 'number'/);
    assert.match(msgs, /TS2353: .*'prr' does not exist/); // typed hints
    assert.match(msgs, /startForm field "prr" is not in the input ReviewInput/); // and the lint
    // Fixed → clean, and the input is reported.
    fs.writeFileSync(file, FLOW);
    r = run(["check", "--json"], env, project);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(JSON.parse(r.out).files[0].flows[0].input.fields.map((f: any) => f.name), ["pr", "repo", "labels"]);

    // 2. Status shows the signature; a bad start is refused, naming the fields.
    run(["up"], env, project);
    assert.match(run(["status"], env, project).out, /review\(pr: integer, repo: string, labels\?: string\[\]\)/);
    r = run(["start", "review", "--pr", "abc"], env, project);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /invalid input for review: pr must be a whole number; repo is required/);

    // 3. Text from the CLI is converted to the declared types.
    r = run(["start", "review", "--pr", "42", "--repo", "a/b", "labels=x,y", "--title", "t1"], env, project);
    assert.equal(r.code, 0, r.out);
    const key = r.out.match(/instance (\d+)/)![1];
    const { url } = JSON.parse(fs.readFileSync(path.join(state, "daemon.json"), "utf8"));
    const inst: any = await (await fetch(`${url}/api/instances/${key}`)).json();
    assert.equal(inst.variables.pr, 42);
    assert.deepEqual(inst.variables.labels, ["x", "y"]);

    // 4. The API: flows carry input + start form; a bad body is a 400 with problems.
    const st: any = await (await fetch(`${url}/api/state?project=${encodeURIComponent(project)}`)).json();
    const flow = st.flows.find((f: any) => f.id === "review");
    assert.equal(flow.startForm.title, "Review a PR");
    assert.equal(flow.startForm.fields.pr.title, "PR number");
    assert.deepEqual(flow.startForm.required, ["pr", "repo"]);
    const res = await fetch(`${url}/api/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ flowId: "review", project, variables: { pr: 1.5, repo: "a/b" } }) });
    assert.equal(res.status, 400);
    assert.deepEqual(((await res.json()) as any).problems, [{ field: "pr", message: "must be a whole number" }]);
  } finally {
    run(["down"], env, project);
  }
});
