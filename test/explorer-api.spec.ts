import { test } from "node:test";
import assert from "node:assert/strict";
import { instanceFacts } from "../src/explorer-api.ts";

// The event sequence the engine logs for parallel([timer P10D, work → end({ terminate: true })]):
// the waiting timer gets a TimerCanceled but no ElementTerminated of its own.
const ev = (now: number, type: string, extra: Record<string, unknown> = {}) => ({ instance_key: 11, now, type, ...extra });
const events = [
  ev(0, "ProcessInstanceCreated", { process_id: "term" }),
  ev(1, "ElementActivated", { element_id: "wait-long", element_instance_key: 14 }),
  ev(1, "TimerCreated", { element_id: "wait-long", element_instance_key: 14 }),
  ev(1, "ElementActivated", { element_id: "work", element_instance_key: 16 }),
  ev(5, "ElementCompleted", { element_id: "work", element_instance_key: 16 }),
  ev(6, "ElementActivated", { element_id: "stopped", element_instance_key: 23 }),
  ev(6, "ElementCompleted", { element_id: "stopped", element_instance_key: 23 }),
  ev(7, "TimerCanceled", { element_id: "wait-long", element_instance_key: 14 }),
  ev(7, "ProcessInstanceCompleted"),
];

test("trace: an element cancelled by a terminate end is closed and flagged terminated", () => {
  const f = instanceFacts(events as never).get("11")!;
  assert.equal(f.outcome, "completed");
  const wait = f.elements.get("14")!;
  assert.equal(wait.exitedAt, 7);
  assert.equal(wait.durationMs, 6);
  assert.equal(wait.terminated, true);
  const work = f.elements.get("16")!;
  assert.equal(work.exitedAt, 5);
  assert.equal(work.terminated, undefined);
});

test("trace: elements still open when the instance ends (no cancel event logged) are closed as terminated", () => {
  const f = instanceFacts(events.filter((e) => e.type !== "TimerCanceled") as never).get("11")!;
  assert.equal(f.elements.get("14")!.exitedAt, 7);
  assert.equal(f.elements.get("14")!.terminated, true);
});
