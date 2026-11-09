// Unit tests for the worker: timeouts, concurrency limits, failures → retries/incidents,
// and stopping. A fake engine port records what the worker reports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLimits, Worker, type ActivatedJob, type JobPort } from "../src/worker.ts";

function fakePort() {
  const calls: { op: string; key: string; retries?: number; message?: string; variables?: Record<string, unknown> }[] = [];
  const port: JobPort = {
    complete: (key, variables) => void calls.push({ op: "complete", key, variables }),
    fail: (key, retries, message) => void calls.push({ op: "fail", key, retries, message }),
  };
  return { port, calls };
}

const job = (key: string, type = "shell", retries = 3): ActivatedJob => ({ key, type, elementId: `step${key}`, instanceKey: "1", retries });
const opts = { maxConcurrent: 4, timeoutMs: () => 1_000, backoffMs: 10 };

test("completes with the handler's variables", async () => {
  const { port, calls } = fakePort();
  const w = new Worker(port, opts);
  await w.run(job("1"), async () => ({ variables: { ok: true } }));
  assert.deepEqual(calls, [{ op: "complete", key: "1", variables: { ok: true } }]);
  assert.equal(w.running.size, 0);
});

test("a throwing handler (sync or async) fails the job with one retry less, then raises an incident", async () => {
  const { port, calls } = fakePort();
  const events: string[] = [];
  const w = new Worker(port, { ...opts, log: (e) => events.push(e.kind) });
  await w.run(job("1", "shell", 2), () => {
    throw new Error("boom");
  });
  await w.run(job("2", "shell", 1), async () => {
    throw new Error("bang");
  });
  assert.deepEqual(
    calls.map((c) => [c.op, c.key, c.retries, c.message]),
    [
      ["fail", "1", 1, "boom"],
      ["fail", "2", 0, "bang"],
    ],
  );
  assert.deepEqual(events, ["job", "retry", "job", "incident"]);
  assert.ok(w.backingOff("1"));
  assert.ok(!w.backingOff("2"));
});

test("a hung handler times out, its signal aborts, and the job fails", async () => {
  const { port, calls } = fakePort();
  const w = new Worker(port, { ...opts, timeoutMs: () => 50 });
  let aborted = false;
  await w.run(job("1"), (_j, signal) => {
    signal.addEventListener("abort", () => (aborted = true));
    return new Promise(() => {});
  });
  assert.ok(aborted);
  assert.equal(calls[0].op, "fail");
  assert.match(calls[0].message!, /timed out/);
  assert.equal(w.running.size, 0);
});

test("concurrency: overall and per-type limits", async () => {
  const { port } = fakePort();
  const w = new Worker(port, { ...opts, maxConcurrent: 3, perType: parseLimits("claude=1") });
  const release: (() => void)[] = [];
  const hold = () => new Promise<void>((r) => release.push(r));
  assert.equal(w.free("claude"), 1);
  const a = w.run(job("1", "claude"), hold);
  assert.equal(w.free("claude"), 0);
  assert.equal(w.free("shell"), 2);
  const b = w.run(job("2", "shell"), hold);
  const c = w.run(job("3", "shell"), hold);
  assert.equal(w.free("shell"), 0);
  await new Promise((r) => setTimeout(r, 0));
  release.forEach((r) => r());
  await Promise.all([a, b, c]);
  assert.equal(w.free("claude"), 1);
  assert.equal(w.free("shell"), 3);
});

test("onError can take a failure over", async () => {
  const { port, calls } = fakePort();
  const w = new Worker(port, { ...opts, onError: (_j, e) => /401/.test(e.message) });
  await w.run(job("1", "claude"), async () => {
    throw new Error("401 not logged in");
  });
  assert.deepEqual(calls, []);
});

test("stop aborts running jobs and leaves them activated (the next start hands them out)", async () => {
  const { port, calls } = fakePort();
  const w = new Worker(port, opts);
  const p = w.run(job("1"), (_j, signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))));
  w.stop();
  await p;
  assert.deepEqual(calls, []);
});

test("parseLimits", () => {
  assert.deepEqual(parseLimits("claude=2, shell=1,bad,x="), { claude: 2, shell: 1 });
  assert.deepEqual(parseLimits(undefined), {});
});
