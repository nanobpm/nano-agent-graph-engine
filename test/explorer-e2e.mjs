// Drive the web explorer with Playwright and take screenshots: a temp copy of
// examples/demo, a daemon with the fake claude, one changelog instance through its
// review form, then the Process Explorer's instance detail, and the flows view.
// Playwright resolves from $PLAYWRIGHT_FROM (default /tmp/bh).
// usage: npm run build && node test/explorer-e2e.mjs [outPrefix]
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire((process.env.PLAYWRIGHT_FROM ?? "/tmp/bh") + "/package.json");
const { chromium } = require("playwright");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = process.argv[2] ?? "/tmp/age-e2e";
const project = fs.mkdtempSync(path.join(os.tmpdir(), "age-ui-"));
fs.cpSync(path.join(root, "examples/demo/flows"), path.join(project, "flows"), { recursive: true });
execFileSync("git", ["init", "-q"], { cwd: project });
execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "feat: first"], { cwd: project });
const env = { ...process.env, AGE_CLAUDE_CMD: path.join(root, "test/fixtures/fake-claude.mjs"), AGE_PROJECT: project };
const cli = (...args) => execFileSync(process.execPath, [path.join(root, "dist/cli.js"), ...args], { cwd: project, env }).toString();

const daemon = spawn(process.execPath, [path.join(root, "dist/cli.js"), "daemon"], { cwd: project, env, stdio: "ignore" });
let url;
for (let i = 0; i < 100 && !url; i++) {
  await new Promise((r) => setTimeout(r, 100));
  try {
    url = JSON.parse(fs.readFileSync(path.join(project, ".agent-graph/daemon.json"), "utf8")).url;
  } catch {}
}
console.log("daemon", url, "project", project);
console.log(cli("start", "changelog").trim());

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
try {
  await page.goto(url);
  // Inbox: the review form appears once the agent steps ran.
  await page.getByRole("button", { name: "Complete" }).waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${out}-inbox.png` });
  await page.locator("main select").first().selectOption("publish");
  await page.getByRole("button", { name: "Complete" }).click();

  // Completing jumps to the instance in the Process Explorer.
  await page.waitForURL(/#\/instances/);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}-instance.png` });
  console.log("explorer:", (await page.locator("main").innerText()).slice(0, 700).replace(/\s*\n+\s*/g, " | "));
  console.log("diagram elements:", await page.locator(".djs-element").count());

  await page.getByRole("button", { name: "Flows" }).click();
  await page.getByRole("button", { name: "Start instance" }).waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}-flows.png` });
  console.log("errors:", errors);
} catch (e) {
  await page.screenshot({ path: `${out}-fail.png` });
  console.log("errors:", errors);
  throw e;
} finally {
  await browser.close();
  daemon.kill();
}
