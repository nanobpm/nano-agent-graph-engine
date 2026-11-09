// Load the nanobpmn WASM engine in Node (synchronously, once). The read-model build: it
// adds the AgentInstance search surface the explorer's agent panel reads.
import fs from "node:fs";
import { createRequire } from "node:module";
import { initSync, TestEngine } from "@nanobpm/engine-wasm/readmodel";

let ready = false;

function wasmPath(): string {
  // Bundled: the .wasm sits next to the bundle. Dev: resolve from node_modules.
  const local = new URL("./nanobpmn_engine_bg.wasm", import.meta.url);
  if (fs.existsSync(local)) return local.pathname;
  const req = createRequire(import.meta.url);
  const pkg = req.resolve("@nanobpm/engine-wasm/readmodel");
  return pkg.replace(/nanobpmn_engine\.js$/, "nanobpmn_engine_bg.wasm");
}

export function newEngine(): TestEngine {
  if (!ready) {
    initSync({ module: fs.readFileSync(wasmPath()) });
    ready = true;
  }
  return new TestEngine();
}

export type { TestEngine };
