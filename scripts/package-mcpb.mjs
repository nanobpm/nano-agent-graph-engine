// Build the Claude Desktop extension (.mcpb): dist/ plus a manifest generated from
// package.json, packed with @anthropic-ai/mcpb. Desktop runs it with its built-in Node, so
// people need nothing installed. Usage: node scripts/package-mcpb.mjs [outDir] (default: release/)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const outDir = path.resolve(process.argv[2] ?? path.join(root, "release"));
if (!fs.existsSync(path.join(root, "dist/cli.js"))) throw new Error("dist/ is missing: run npm run build first");

const stage = fs.mkdtempSync(path.join(os.tmpdir(), "nage-mcpb-"));
fs.cpSync(path.join(root, "dist"), path.join(stage, "dist"), { recursive: true });
fs.cpSync(path.join(root, "README.md"), path.join(stage, "README.md"));
// mcpb leaves out *.d.ts by default; `nage check` type-checks flows against these.
fs.writeFileSync(path.join(stage, ".mcpbignore"), "!*.d.ts\n");
fs.writeFileSync(path.join(stage, "package.json"), JSON.stringify({ name: pkg.name, version: pkg.version, type: "module" }, null, 2));

const manifest = {
  manifest_version: "0.2",
  name: "nano-agent-graph-engine",
  display_name: "Nano Agent Graph Engine",
  version: pkg.version,
  description: "Durable BPMN flows for agents: write flows in TypeScript, run them in a local engine that orchestrates scripts, headless agents and you.",
  long_description: pkg.description,
  author: { name: "nanobpm", url: "https://github.com/nanobpm" },
  repository: { type: "git", url: "https://github.com/nanobpm/nano-agent-graph-engine" },
  homepage: "https://github.com/nanobpm/nano-agent-graph-engine",
  documentation: "https://github.com/nanobpm/nano-agent-graph-engine#readme",
  support: "https://github.com/nanobpm/nano-agent-graph-engine/issues",
  license: pkg.license,
  keywords: pkg.keywords,
  server: {
    type: "node",
    entry_point: "dist/cli.js",
    mcp_config: { command: "node", args: ["${__dirname}/dist/cli.js", "mcp"], env: {} },
  },
  compatibility: { platforms: ["darwin", "win32", "linux"], runtimes: { node: pkg.engines.node } },
};
fs.writeFileSync(path.join(stage, "manifest.json"), JSON.stringify(manifest, null, 2));

fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `nano-agent-graph-engine-${pkg.version}.mcpb`);
const mcpb = ["-y", "@anthropic-ai/mcpb@2"];
execFileSync("npx", [...mcpb, "validate", path.join(stage, "manifest.json")], { stdio: "inherit" });
execFileSync("npx", [...mcpb, "pack", stage, out], { stdio: "inherit" });
fs.rmSync(stage, { recursive: true, force: true });
console.log(out);
