// Screenshot + drive the explorer with Playwright (resolved from $PLAYWRIGHT_FROM or /tmp/bh).
// usage: node test/explorer-e2e.mjs <daemonUrl> [outDir]
import { createRequire } from "node:module";
const require = createRequire((process.env.PLAYWRIGHT_FROM ?? "/tmp/bh") + "/package.json");
const { chromium } = require("playwright");

const url = process.argv[2];
const out = process.argv[3] ?? "/tmp/age-e2e";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(url);
await page.waitForSelector("#taskform", { timeout: 10000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}-task.png` });
console.log("markers active:", await page.locator(".djs-element.active").count(), "done:", await page.locator(".djs-element.done").count(), "taken:", await page.locator(".djs-connection.taken").count());
console.log("badges:", await page.locator(".badge").allTextContents());

await page.selectOption("#f_decision", "publish");
await page.click("#taskform button[type=submit]");
await page.waitForSelector(".head .pill.done", { timeout: 10000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}-done.png` });
console.log("after publish:", await page.locator(".head").innerText());

await page.click("nav a[href^='#flow=']");
await page.waitForSelector("#startform");
await page.screenshot({ path: `${out}-flow.png` });
console.log("errors:", errors);
await browser.close();
