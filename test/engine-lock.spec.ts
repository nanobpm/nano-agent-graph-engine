import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { acquireEngineLock } from "../src/paths.ts";

test("one engine per state dir: a live owner blocks a second, a dead one is taken over", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "age-lock-"));
  const lock = path.join(dir, "engine.lock");
  // Another live process (our parent) owns it.
  fs.writeFileSync(lock, String(process.ppid));
  assert.throws(() => acquireEngineLock(dir), /another engine \(pid \d+\) owns/);
  // Its owner died: taken over.
  fs.writeFileSync(lock, "999999");
  const release = acquireEngineLock(dir);
  assert.equal(fs.readFileSync(lock, "utf8"), String(process.pid));
  release();
  assert.equal(fs.existsSync(lock), false);
});
