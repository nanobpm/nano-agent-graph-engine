// Build dist/: cli.js (CLI + daemon + MCP + hooks), index.js (flow authoring API, what
// `import "agent-graph-engine"` resolves to), the engine .wasm, and explorer.html.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const banner = { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" };
await build({
  entryPoints: { cli: "src/cli.ts", index: "src/index.ts" },
  outdir: dist,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  banner,
  // cli.js loads flows that import "agent-graph-engine" → dist/index.js (resolve hook).
  external: ["agent-graph-engine"],
  logLevel: "warning",
});
fs.chmodSync(path.join(dist, "cli.js"), 0o755);

const wasm = require.resolve("@nanobpm/engine-wasm").replace(/nanobpmn_engine\.js$/, "nanobpmn_engine_bg.wasm");
fs.copyFileSync(wasm, path.join(dist, "nanobpmn_engine_bg.wasm"));

// Explorer: one self-contained HTML file.
const ui = await build({
  entryPoints: ["ui/explorer.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  write: false,
  logLevel: "warning",
});
const bpmnDist = path.dirname(require.resolve("bpmn-js/package.json")) + "/dist/assets";
const css = [
  fs.readFileSync(path.join(bpmnDist, "diagram-js.css"), "utf8"),
  fs.readFileSync(path.join(bpmnDist, "bpmn-js.css"), "utf8"),
  fs.readFileSync("ui/explorer.css", "utf8"),
].join("\n");
const js = ui.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = fs
  .readFileSync("ui/explorer.html", "utf8")
  .replace("/*CSS*/", () => css)
  .replace("/*JS*/", () => js);
fs.writeFileSync(path.join(dist, "explorer.html"), html);

for (const f of fs.readdirSync(dist)) console.log(`dist/${f}  ${(fs.statSync(path.join(dist, f)).size / 1024).toFixed(0)} kB`);
