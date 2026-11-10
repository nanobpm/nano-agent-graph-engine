// Publish the version in package.json, if it isn't out yet (release.yml, after green CI on main).
// Idempotent: each step checks first, so re-runs and ordinary main commits do nothing.
//   1. npm: @nanobpm/nano-agent-graph-engine@<version> (OIDC Trusted Publisher, provenance)
//   2. the GitHub Release v<version> (release-please cuts it when its PR merges; created
//      here only if it still doesn't exist after a wait)
//   3. the Claude Desktop extension (.mcpb) on that release, and the plugin `release` branch
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const tag = `v${pkg.version}`;
const asset = `nano-agent-graph-engine-${pkg.version}.mcpb`;
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, encoding: "utf8", ...opts });
const ok = (cmd, args) => {
  try {
    return sh(cmd, args, { stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const onNpm = ok("npm", ["view", `${pkg.name}@${pkg.version}`, "version"])?.trim() === pkg.version;
const release = () => ok("gh", ["release", "view", tag, "--json", "assets", "--jq", "[.assets[].name]"]);
let assets = release();
if (onNpm && assets && JSON.parse(assets).includes(asset)) {
  console.log(`${pkg.name}@${pkg.version} is out (npm + ${tag} with ${asset}); nothing to do`);
  process.exit(0);
}

if (!onNpm) {
  console.log(`npm publish ${pkg.name}@${pkg.version}`);
  sh("npm", ["publish", "--provenance", "--access", "public"], { stdio: "inherit" });
}

// release-please creates the release right after its PR merges, usually before CI ends.
for (let i = 0; !assets && i < 10; i++) {
  console.log(`waiting for GitHub Release ${tag}…`);
  await sleep(30_000);
  assets = release();
}
if (!assets) {
  const sha = sh("git", ["rev-parse", "HEAD"]).trim();
  console.log(`no release ${tag} from release-please; creating it at ${sha}`);
  sh("gh", ["release", "create", tag, "--target", sha, "--title", tag, "--generate-notes"], { stdio: "inherit" });
  assets = "[]";
}

if (!JSON.parse(assets).includes(asset)) {
  sh("node", ["scripts/package-mcpb.mjs", "release"], { stdio: "inherit" });
  sh("gh", ["release", "upload", tag, path.join("release", asset), "--clobber"], { stdio: "inherit" });
}

sh("node", ["scripts/publish-plugin-branch.mjs", "--push"], { stdio: "inherit" });
console.log(`released ${tag}`);
