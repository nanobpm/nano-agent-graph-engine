// Fetch @nanobpm/process-explorer (nanobpm/nano-bpm, process-explorer/) at a pinned
// commit into node_modules/.cache/nano-bpm. It isn't published to npm (nanobpm/nano-bpm#1475) and
// npm can't install a git subdirectory, so this does a sparse, blob-less checkout of
// just the package plus the console theme tokens its Tailwind classes resolve through.
// The explorer is bundled into dist/, so only people building the plugin need this
// (and access to the repo).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const NANO_BPM_REV = "9cf92ec556968958f6550d9ebe67613527737030";
const REPO = process.env.NANO_BPM_REPO ?? "https://github.com/nanobpm/nano-bpm.git";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
// Under node_modules/.cache: npm leaves it alone, and test runners skip node_modules.
export const vendorDir = path.join(root, "node_modules", ".cache", "nano-bpm");

const git = (...args) => execFileSync("git", ["-C", vendorDir, ...args], { stdio: ["ignore", "pipe", "inherit"] }).toString().trim();

export function fetchExplorer() {
  if (fs.existsSync(path.join(vendorDir, ".git"))) {
    if (git("rev-parse", "HEAD") === NANO_BPM_REV) return vendorDir;
  } else {
    fs.rmSync(vendorDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(vendorDir), { recursive: true });
    execFileSync("git", ["clone", "--quiet", "--filter=blob:none", "--no-checkout", "--sparse", REPO, vendorDir], { stdio: "inherit" });
    git("sparse-checkout", "set", "--no-cone", "/process-explorer/", "/console/src/theme/tokens.css");
  }
  try {
    git("cat-file", "-e", `${NANO_BPM_REV}^{commit}`);
  } catch {
    git("fetch", "--quiet", "--filter=blob:none", "origin", NANO_BPM_REV);
  }
  git("checkout", "--quiet", "--detach", NANO_BPM_REV);
  return vendorDir;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(fetchExplorer());
