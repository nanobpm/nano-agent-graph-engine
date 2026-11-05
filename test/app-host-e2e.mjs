// Drive the explorer as an MCP App inside the reference host (ext-apps basic-host):
// the host calls show_explorer, renders the ui:// resource in its sandbox, and the view
// reaches the engine only through the server's app-only ui_api tool.
// usage: PLAYWRIGHT_FROM=/tmp/bh node test/app-host-e2e.mjs [hostUrl] [outPrefix]
import { createRequire } from "node:module";
const req = createRequire((process.env.PLAYWRIGHT_FROM ?? "/tmp/bh") + "/package.json");
const { chromium } = req("playwright");

const host = process.argv[2] ?? "http://localhost:8090";
const out = process.argv[3] ?? "/tmp/age-app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(host);
await page.waitForTimeout(1500);
await page.locator("select").nth(1).selectOption("show_explorer");
await page.locator("textarea").first().fill(JSON.stringify(process.env.ARGS ? JSON.parse(process.env.ARGS) : {}));
await page.locator('button[type="submit"]').click();

let app;
for (let i = 0; i < 40 && !app; i++) {
  await page.waitForTimeout(500);
  app = page.frames().find((f) => f.parentFrame() && f.parentFrame() !== page.mainFrame());
}
if (!app) {
  await page.screenshot({ path: `${out}-noframe.png`, fullPage: true });
  console.log("frames:", page.frames().map((f) => f.url().slice(0, 80)), errors);
  throw new Error("no app frame");
}
await app.waitForSelector(".djs-element, #flows li, nav", { timeout: 20000 });
await page.waitForTimeout(2500);
console.log("app text:", (await app.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400));
await page.screenshot({ path: `${out}-1.png`, fullPage: true });

// open a waiting task if any, else first flow
const taskLink = app.locator("a[href^='#task=']").first();
if (await taskLink.count()) {
  await taskLink.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}-task.png`, fullPage: true });
}
console.log("shapes:", await app.locator(".djs-shape").count(), "active markers:", await app.locator(".m-active, .active").count());
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no errors");
await browser.close();
