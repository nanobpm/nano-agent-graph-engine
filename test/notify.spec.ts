import { test } from "node:test";
import assert from "node:assert/strict";
import { Notifier, notifyCommand, notifyMode, type Notice } from "../src/notify.ts";

const n: Notice = { key: "incident:22", title: `Incident in boom (oc "test")`, body: "check: missing <ok> & 'x'", url: "http://localhost:5/?project=%2Ftmp#instance=18" };

test("macOS: terminal-notifier opens the explorer on click; osascript otherwise, quoted", () => {
  const tn = notifyCommand(n, "darwin", true)!;
  assert.equal(tn.cmd, "terminal-notifier");
  assert.deepEqual(tn.args.slice(-2), ["-open", n.url]);
  const as = notifyCommand(n, "darwin", false)!;
  assert.equal(as.cmd, "osascript");
  assert.match(as.args[1], /subtitle "Incident in boom \(oc \\"test\\"\)"$/);
});

test("Linux: notify-send with an Open action, URL in the body", () => {
  const c = notifyCommand(n, "linux")!;
  assert.equal(c.cmd, "notify-send");
  assert.ok(c.args.includes("--action=open=Open") && c.args.includes("--wait"));
  assert.equal(c.openOnAction, "open");
  assert.match(c.args.at(-1)!, /instance=18$/);
  assert.equal(notifyCommand({ ...n, url: undefined }, "linux")!.args.includes("--wait"), false);
});

test("Windows: an encoded PowerShell toast with protocol activation and escaped XML", () => {
  const c = notifyCommand(n, "win32")!;
  assert.equal(c.cmd, "powershell.exe");
  const ps = Buffer.from(c.args.at(-1)!, "base64").toString("utf16le");
  assert.match(ps, /activationType="protocol" launch="http:\/\/localhost:5\/\?project=%2Ftmp#instance=18"/);
  assert.match(ps, /missing &#60;ok&#62; &#38; &#39;x&#39;/);
  assert.doesNotMatch(ps.split("LoadXml")[1].split("\n")[0].slice(2, -2), /(?<!')'(?!')/); // single quotes doubled in the PS string
  assert.match(ps, /CreateToastNotifier\(\$id\)\.Show/);
});

test("Notifier: primes silently, announces each new key once, filters by mode, coalesces bursts", () => {
  const shown: Notice[] = [];
  const nf = new Notifier("all", (x) => shown.push(x));
  const t = (k: string): Notice => ({ key: k, title: k, body: "" });
  nf.update([t("incident:1")]); // startup: already there, not news
  assert.equal(shown.length, 0);
  nf.update([t("incident:1"), t("task:2")]);
  nf.update([t("incident:1"), t("task:2")]);
  assert.deepEqual(shown.map((x) => x.key), ["task:2"]);
  nf.update([t("task:7"), t("incident:3"), t("incident:4"), t("task:5"), t("task:6")]);
  assert.equal(shown.at(-1)!.key, "burst");
  assert.match(shown.at(-1)!.title, /2 incidents, 3 tasks waiting/);

  const only: Notice[] = [];
  const inc = new Notifier("incidents", (x) => only.push(x));
  inc.update([]);
  inc.update([t("task:1"), t("incident:2")]);
  assert.deepEqual(only.map((x) => x.key), ["incident:2"]);
  assert.equal(notifyMode("off"), "off");
  assert.equal(notifyMode(undefined), "all");
});
