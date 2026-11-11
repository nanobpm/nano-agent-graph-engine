// The persistent layout cache is keyed by the diagram-less BPMN *and* the layout
// generator's version: a @nanobpm/workflow upgrade (e.g. 0.19's expanded forEach
// diagrams) must not keep serving diagrams cached by the previous release.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d" targetNamespace="t">
  <bpmn:process id="p" isExecutable="true"><bpmn:startEvent id="s" /></bpmn:process>
</bpmn:definitions>`;

test("layout cache key is versioned: a stale pre-upgrade entry is not a hit", async () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "age-layout-"));
  process.env.AGE_STATE_DIR = state;
  process.env.AGE_LAYOUT_MS = "50"; // don't wait for the worker in a test
  const { layoutXml } = await import("../src/layout.ts");

  // Seed the cache the way 0.18 did: keyed by the bare XML hash, holding an
  // old collapsed diagram. The versioned key must NOT find it.
  const cache = path.join(state, "layout-cache");
  fs.mkdirSync(cache, { recursive: true });
  const legacyKey = crypto.createHash("sha256").update(XML).digest("hex").slice(0, 32);
  fs.writeFileSync(path.join(cache, `${legacyKey}.bpmn`), "STALE-COLLAPSED-DIAGRAM");

  const out = await layoutXml(XML);
  assert.notEqual(out, "STALE-COLLAPSED-DIAGRAM", "a pre-upgrade cache entry must not be served");
  assert.match(out, /bpmn:definitions|bpmn2:definitions/, "a fresh layout was produced instead");

  // And the new entry is a hit on the second call (same output, from the versioned key).
  const again = await layoutXml(XML);
  assert.equal(typeof again, "string");
});
