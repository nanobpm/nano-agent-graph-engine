// `nage install <host>`: writes each host's MCP config (keeping what's there), copies the
// skills where the host reads them, is idempotent, and `nage uninstall` takes it back out.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = fs.existsSync(path.join(root, "dist/cli.js")) && !process.env.AGE_TEST_SRC ? path.join(root, "dist/cli.js") : path.join(root, "src/cli.ts");

function setup() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "nage-install-"));
  const env: Record<string, string> = { ...(process.env as Record<string, string>), HOME: home };
  delete env.XDG_CONFIG_HOME;
  delete env.CODEX_HOME;
  delete env.APPDATA;
  const run = (...args: string[]) => execFileSync(process.execPath, [cli, ...args], { env, encoding: "utf8" });
  return { home, run };
}

test("install opencode: keeps other servers, copies skills, idempotent, uninstall removes", () => {
  const { home, run } = setup();
  const file = path.join(home, ".config/opencode/opencode.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ theme: "dark", mcp: { other: { type: "local", command: ["x"] } } }));
  run("install", "opencode");
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(cfg.theme, "dark");
  assert.deepEqual(cfg.mcp.other, { type: "local", command: ["x"] });
  assert.equal(cfg.mcp["agent-graph"].type, "local");
  assert.equal(cfg.mcp["agent-graph"].command[0], process.execPath);
  assert.deepEqual(cfg.mcp["agent-graph"].command.slice(-1), ["mcp"]);
  assert.ok(fs.existsSync(path.join(home, ".config/opencode/skills/agent-graph/SKILL.md")));
  assert.ok(fs.existsSync(path.join(home, ".config/opencode/skills/agent-graph-authoring/SKILL.md")));
  assert.ok(fs.existsSync(`${file}.bak`));
  assert.match(run("install", "opencode"), /already up to date/);
  run("uninstall", "opencode");
  const after = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(after.mcp["agent-graph"], undefined);
  assert.ok(after.mcp.other);
  assert.ok(!fs.existsSync(path.join(home, ".config/opencode/skills/agent-graph")));
});

test("install codex: a TOML table, replaced not duplicated, the rest of the file kept", () => {
  const { home, run } = setup();
  const file = path.join(home, ".codex/config.toml");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'model = "gpt-5"\n\n[mcp_servers.other]\ncommand = "x"\n');
  run("install", "codex");
  run("install", "codex");
  const toml = fs.readFileSync(file, "utf8");
  assert.equal(toml.match(/\[mcp_servers\.agent-graph\]/g)?.length, 1);
  assert.match(toml, /^model = "gpt-5"/);
  assert.match(toml, /\[mcp_servers\.other\]\ncommand = "x"/);
  assert.match(toml, /args = \[".*cli\.(js|ts)", "mcp"\]/);
  assert.ok(fs.existsSync(path.join(home, ".codex/skills/agent-graph/SKILL.md")));
  run("uninstall", "codex");
  const out = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(out, /agent-graph/);
  assert.match(out, /\[mcp_servers\.other\]/);
});

test("install cursor and claude-desktop: mcpServers entry; --dry-run writes nothing", () => {
  const { home, run } = setup();
  assert.match(run("install", "cursor", "--dry-run"), /would write/);
  assert.ok(!fs.existsSync(path.join(home, ".cursor/mcp.json")));
  run("install", "cursor");
  const cursor = JSON.parse(fs.readFileSync(path.join(home, ".cursor/mcp.json"), "utf8"));
  assert.equal(cursor.mcpServers["agent-graph"].command, process.execPath);
  run("install", "claude-desktop");
  const desktop =
    process.platform === "darwin" ? path.join(home, "Library/Application Support/Claude/claude_desktop_config.json") : path.join(home, ".config/Claude/claude_desktop_config.json");
  assert.deepEqual(JSON.parse(fs.readFileSync(desktop, "utf8")).mcpServers["agent-graph"].args.slice(-1), ["mcp"]);
});

test("install claude-code plans the marketplace + plugin commands; unknown hosts are refused", () => {
  const { run } = setup();
  const out = run("install", "claude-code", "--dry-run");
  assert.match(out, /would run: claude plugin marketplace add nanobpm\/nano-agent-graph-engine/);
  assert.match(out, /would run: claude plugin install nano-agent-graph-engine@nanobpm/);
  assert.throws(() => run("install", "vim"), /usage: nage install <claude-code\|claude-desktop\|opencode\|codex\|cursor>/);
});
