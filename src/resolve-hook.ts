// Make `import … from "agent-graph-engine"` in a flow file resolve to this package,
// wherever the flow lives (the user's project has no node_modules for it). Installed in
// the engine and in every step thread.
import fs from "node:fs";
import module from "node:module";

let installed = false;
export function installResolveHook(): void {
  if (installed) return;
  installed = true;
  const js = new URL("./index.js", import.meta.url);
  const target = fs.existsSync(js) ? js.href : new URL("./index.ts", import.meta.url).href;
  module.registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "agent-graph-engine") return { url: target, shortCircuit: true };
      return next(specifier, context);
    },
  });
}
