import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// src/step-thread.ts
import { parentPort } from "node:worker_threads";
import { pathToFileURL } from "node:url";
import path from "node:path";

// src/resolve-hook.ts
import fs from "node:fs";
import module from "node:module";
var installed = false;
function installResolveHook() {
  if (installed) return;
  installed = true;
  const js = new URL("./index.js", import.meta.url);
  const target = fs.existsSync(js) ? js.href : new URL("./index.ts", import.meta.url).href;
  module.registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "agent-graph-engine") return { url: target, shortCircuit: true };
      return next(specifier, context);
    }
  });
}

// src/step-thread.ts
installResolveHook();
var api = import("agent-graph-engine");
var current;
async function handlerFor(r) {
  const mod = await import(`${pathToFileURL(path.resolve(r.file)).href}?v=${r.stamp}`);
  const flow = Object.values(mod).find((v) => v && v.kind === "declarative" && v.id === r.flowId);
  const name = r.type.startsWith(r.flowKey + ":") ? r.type.slice(r.flowKey.length + 1) : r.type;
  const h = flow?.handlers?.[name] ?? mod.workers?.[r.type];
  if (typeof h !== "function") throw new Error(`no handler for ${r.type} in ${path.basename(r.file)}`);
  return h;
}
parentPort.on("message", async (msg) => {
  if ("abort" in msg) return current?.abort();
  const r = msg;
  current = new AbortController();
  let reply;
  try {
    const h = await handlerFor(r);
    const { runInProject } = await api;
    const out = await runInProject(r.project, () => h(r.job), current.signal);
    const variables = out && typeof out === "object" ? JSON.parse(JSON.stringify(out)) : {};
    reply = { id: r.id, ok: true, variables };
  } catch (e) {
    reply = { id: r.id, ok: false, error: String(e?.message ?? e) };
  }
  current = void 0;
  parentPort.postMessage(reply);
});
process.on("unhandledRejection", (e) => console.error(`[step thread] unhandled rejection: ${e?.stack ?? e}`));
