// Build dist/: cli.js (CLI + daemon + MCP + hooks), index.js (flow authoring API, what
// `import "agent-graph-engine"` resolves to), the engine .wasm, and explorer.html.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fetchExplorer } from "./fetch-explorer.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const banner = { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" };
await build({
  entryPoints: { cli: "src/cli.ts", index: "src/index.ts", "step-thread": "src/step-thread.ts", "layout-thread": "src/layout-thread.ts" },
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

const wasm = require.resolve("@nanobpm/engine-wasm/readmodel").replace(/nanobpmn_engine\.js$/, "nanobpmn_engine_bg.wasm");
fs.copyFileSync(wasm, path.join(dist, "nanobpmn_engine_bg.wasm"));

// Explorer: one self-contained HTML file, built for the browser and for MCP Apps. It
// renders the nano console's Process Explorer (@nanobpm/process-explorer), fetched
// from nanobpm/nano-bpm at a pinned commit into node_modules/.cache (not on npm yet).
const explorerSrc = path.join(fetchExplorer(), "process-explorer", "src");
const css = execFileSync(path.join(root, "node_modules", ".bin", "tailwindcss"), ["-i", "ui/explorer.css", "--minify"], {
  cwd: root,
  stdio: ["ignore", "pipe", "inherit"],
}).toString();
for (const [isApp, out] of [[false, "explorer.html"], [true, "explorer-app.html"]]) {
  const ui = await build({
    define: { __APP__: String(isApp), "process.env.NODE_ENV": '"production"' },
    entryPoints: ["ui/explorer.tsx"],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    minify: true,
    write: false,
    outdir: "out",
    // The vendored package has no node_modules: its bare imports (react, bpmn-js, …)
    // resolve from ours.
    // react-query is pinned to one build: through nodePaths esbuild otherwise picks
    // its "legacy" build for the package and "modern" for us — two contexts, and the
    // explorer can't see our QueryClientProvider.
    alias: {
      "@nanobpm/process-explorer": path.join(explorerSrc, "index.ts"),
      "@tanstack/react-query": path.join(root, "node_modules/@tanstack/react-query/build/modern/index.js"),
    },
    nodePaths: [path.join(root, "node_modules")],
    loader: { ".woff": "dataurl", ".woff2": "dataurl", ".ttf": "dataurl", ".eot": "dataurl", ".svg": "dataurl" },
    logLevel: "warning",
  });
  const pick = (ext) => ui.outputFiles.filter((f) => f.path.endsWith(ext)).map((f) => f.text).join("\n");
  const js = pick(".js").replace(/<\/script/gi, "<\\/script");
  const html = fs
    .readFileSync("ui/explorer.html", "utf8")
    .replace("/*CSS*/", () => `${pick(".css")}\n${css}`.replace(/<\/style/gi, "<\\/style"))
    .replace("/*JS*/", () => js);
  fs.writeFileSync(path.join(dist, out), html);
}
fs.copyFileSync("skills/agent-graph-authoring/SKILL.md", path.join(dist, "guide.md"));

// Type-check kit (dist/typecheck): `age check` / flow_check type-check flow files with
// it, so authoring mistakes TypeScript can see (a typo'd variable, a wrong form field
// type, a missing start input) are reported without anything installed in the project.
// TypeScript itself (minified), the ES libs, Node's types, and the declarations of
// agent-graph-engine and @nanobpm/workflow, laid out so module resolution finds them.
const kit = path.join(dist, "typecheck");
const nm = path.join(root, "node_modules");
fs.mkdirSync(kit, { recursive: true });
await build({ entryPoints: [path.join(nm, "typescript/lib/typescript.js")], outfile: path.join(kit, "ts.cjs"), platform: "node", format: "cjs", minify: true, logLevel: "error" });
// The default lib location is next to ts.cjs.
for (const f of fs.readdirSync(path.join(nm, "typescript/lib")))
  if (/^lib\.(es\d{4}|es5|decorators)[\w.]*\.d\.ts$/.test(f)) fs.copyFileSync(path.join(nm, "typescript/lib", f), path.join(kit, f));
const copyDts = (from, to) => {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name);
    if (e.isDirectory()) copyDts(src, path.join(to, e.name));
    else if (e.name.endsWith(".d.ts") || e.name === "package.json") {
      fs.mkdirSync(to, { recursive: true });
      fs.copyFileSync(src, path.join(to, e.name));
    }
  }
};
copyDts(path.join(nm, "@types/node"), path.join(kit, "node_modules/@types/node"));
copyDts(path.join(nm, "undici-types"), path.join(kit, "node_modules/undici-types"));
copyDts(path.join(nm, "@nanobpm/workflow"), path.join(kit, "node_modules/@nanobpm/workflow"));
execFileSync(
  path.join(nm, ".bin", "tsc"),
  ["src/index.ts", "--declaration", "--emitDeclarationOnly", "--allowImportingTsExtensions", "--rewriteRelativeImportExtensions", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2023", "--types", "node", "--skipLibCheck", "--strict", "--outDir", path.join(kit, "agent-graph-engine")],
  { cwd: root, stdio: "inherit" },
);
let kitBytes = 0;
const sizeOf = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? sizeOf(path.join(d, e.name)) : (kitBytes += fs.statSync(path.join(d, e.name)).size); };
sizeOf(kit);
console.log(`dist/typecheck/  ${(kitBytes / 1024).toFixed(0)} kB`);

for (const f of fs.readdirSync(dist)) console.log(`dist/${f}  ${(fs.statSync(path.join(dist, f)).size / 1024).toFixed(0)} kB`);
