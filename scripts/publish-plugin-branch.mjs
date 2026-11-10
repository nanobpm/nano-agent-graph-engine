// Publish the Claude Code plugin to the `release` branch: the same files as the npm package
// (built dist/, skills, hooks, .claude-plugin, .mcp.json), one commit per version. The
// marketplace on main points at this branch, so `main` doesn't have to carry dist/.
// Usage (CI, after npm run build): node scripts/publish-plugin-branch.mjs [--push]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BRANCH = process.env.PLUGIN_BRANCH ?? "release";
const push = process.argv.includes("--push");
const git = (args, cwd = root) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// Exactly what npm would publish.
const [packed] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" }));
const files = packed.files.map((f) => f.path);
if (!files.includes("dist/cli.js")) throw new Error("dist/ is missing: run npm run build first");

const wt = fs.mkdtempSync(path.join(os.tmpdir(), "nage-plugin-"));
let exists = true;
try {
  git(["fetch", "--quiet", "origin", `${BRANCH}:refs/remotes/origin/${BRANCH}`]);
} catch {
  exists = false;
}
if (exists) git(["worktree", "add", "--quiet", "-B", BRANCH, wt, `origin/${BRANCH}`]);
else git(["worktree", "add", "--quiet", "--orphan", "-b", BRANCH, wt]);
try {
  for (const e of fs.readdirSync(wt)) if (e !== ".git") fs.rmSync(path.join(wt, e), { recursive: true, force: true });
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(wt, f)), { recursive: true });
    fs.copyFileSync(path.join(root, f), path.join(wt, f));
  }
  git(["add", "-A", "."], wt);
  const changed = git(["status", "--porcelain"], wt) !== "";
  if (changed) {
    const msg = `release v${pkg.version} (from ${git(["rev-parse", "--short", "HEAD"])})`;
    execFileSync("git", ["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "--quiet", "-m", msg], { cwd: wt, stdio: "inherit" });
    console.log(`${BRANCH}: ${msg}`);
  } else console.log(`${BRANCH}: no changes`);
  if (push) git(["push", "--quiet", "origin", `${BRANCH}:${BRANCH}`], wt);
} finally {
  git(["worktree", "remove", "--force", wt]);
}
