// Desktop notifications from the engine: an incident was raised, or a user task is
// waiting. The engine runs in the background, so without these a run that stops hours
// later goes unnoticed until someone opens a session or the explorer.
//
// No dependencies; each platform's own notifier:
//   macOS    terminal-notifier if installed (click opens the explorer), else osascript
//   Linux    notify-send (libnotify); with an "Open" action where supported (≥ 0.7.9)
//   Windows  a PowerShell WinRT toast; clicking it opens the explorer (protocol activation)
// AGE_NOTIFY=off disables them; AGE_NOTIFY=tasks|incidents limits them to one kind.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export interface Notice {
  /** Stable id (e.g. "incident:22"): a key is announced at most once. */
  key: string;
  title: string;
  body: string;
  /** Opened when the notification is clicked, where the platform supports it. */
  url?: string;
}

export interface Command {
  cmd: string;
  args: string[];
  /** Linux: watch stdout for the clicked action and open `url`. */
  openOnAction?: string;
}

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
const appleString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** terminal-notifier's path: on PATH, or in Homebrew's bin (an engine started from a GUI
 *  app often has a PATH without it). Checked per notification, so installing it later works. */
function findTerminalNotifier(): string | undefined {
  const r = spawnSync("which", ["terminal-notifier"], { encoding: "utf8" });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  return ["/opt/homebrew/bin/terminal-notifier", "/usr/local/bin/terminal-notifier"].find((p) => existsSync(p));
}

/** The command that shows `n` on `platform` (pure apart from a PATH probe on macOS). */
export function notifyCommand(n: Notice, platform: NodeJS.Platform = process.platform, terminalNotifier?: string | false): Command | undefined {
  const body = n.body.length > 240 ? `${n.body.slice(0, 237)}…` : n.body;
  if (platform === "darwin") {
    terminalNotifier ??= findTerminalNotifier() ?? false;
    if (terminalNotifier) {
      return {
        cmd: terminalNotifier,
        args: ["-title", "Agent Graph", "-subtitle", n.title, "-message", body, "-group", n.key, ...(n.url ? ["-open", n.url] : [])],
      };
    }
    return { cmd: "osascript", args: ["-e", `display notification ${appleString(body)} with title "Agent Graph" subtitle ${appleString(n.title)}`] };
  }
  if (platform === "win32") {
    const launch = n.url ? ` activationType="protocol" launch="${xml(n.url)}"` : "";
    const toast = `<toast${launch}><visual><binding template="ToastGeneric"><text>${xml(`Agent Graph: ${n.title}`)}</text><text>${xml(body)}</text></binding></visual></toast>`;
    // Shown under PowerShell's own AppUserModelID, which every Windows 10/11 has registered.
    const ps = [
      "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null",
      "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null",
      "$x = New-Object Windows.Data.Xml.Dom.XmlDocument",
      `$x.LoadXml('${toast.replace(/'/g, "''")}')`,
      "$id = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'",
      "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show([Windows.UI.Notifications.ToastNotification]::new($x))",
    ].join("\n");
    return { cmd: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(ps, "utf16le").toString("base64")] };
  }
  // Linux and the BSDs: the freedesktop notification service via libnotify.
  const base = ["-a", "Agent Graph", `Agent Graph: ${n.title}`, n.url ? `${body}\n${n.url}` : body];
  if (n.url) return { cmd: "notify-send", args: ["--action=open=Open", "--wait", ...base], openOnAction: "open" };
  return { cmd: "notify-send", args: base };
}

export function openUrl(url: string, platform: NodeJS.Platform = process.platform) {
  const [cmd, args] =
    platform === "darwin" ? ["open", [url]] : platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    spawn(cmd as string, args as string[], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  } catch {
    /* no opener */
  }
}

/** Show `n` best-effort: a missing notifier is logged once, never thrown. */
export function notify(n: Notice, log: (m: string) => void = () => {}) {
  const c = notifyCommand(n);
  if (!c) return;
  const run = (cmd: Command, fallback?: Command) => {
    let out = "";
    let child;
    try {
      child = spawn(cmd.cmd, cmd.args, { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    } catch (e: any) {
      return log(`notification failed (${cmd.cmd}): ${e?.message ?? e}`);
    }
    child.stdout?.on("data", (d) => (out += d));
    child.on("error", (e: any) => {
      if (!warned.has(cmd.cmd)) log(`notifications: ${cmd.cmd} unavailable (${e.code ?? e.message}); set AGE_NOTIFY=off to silence`);
      warned.add(cmd.cmd);
    });
    child.on("close", (code) => {
      if (cmd.openOnAction && out.trim() === cmd.openOnAction && n.url) openUrl(n.url);
      // An older notify-send without --action/--wait exits non-zero at once: plain notice.
      else if (code !== 0 && fallback) run(fallback);
    });
  };
  run(c, c.openOnAction ? { cmd: c.cmd, args: c.args.filter((a) => a !== "--wait" && !a.startsWith("--action")) } : undefined);
}
const warned = new Set<string>();

export type NotifyMode = "all" | "tasks" | "incidents" | "off";
export function notifyMode(env = process.env.AGE_NOTIFY): NotifyMode {
  const v = (env ?? "").toLowerCase();
  if (["off", "0", "false", "no"].includes(v)) return "off";
  if (v === "tasks" || v === "incidents") return v;
  return "all";
}

/** Announces each new incident / user task once. `prime` records what already exists
 *  (at startup) without announcing it, so a restart doesn't replay old news. */
export class Notifier {
  private seen = new Set<string>();
  private primed = false;
  private readonly mode: NotifyMode;
  private readonly show: (n: Notice) => void;
  constructor(mode: NotifyMode, show: (n: Notice) => void) {
    this.mode = mode;
    this.show = show;
  }

  update(notices: Notice[]) {
    const fresh = notices.filter((n) => !this.seen.has(n.key));
    for (const n of fresh) this.seen.add(n.key);
    // Forget keys that are gone (resolved, completed), keeping the set small.
    const live = new Set(notices.map((n) => n.key));
    for (const k of this.seen) if (!live.has(k)) this.seen.delete(k);
    if (!this.primed) {
      this.primed = true;
      return;
    }
    const wanted = fresh.filter((n) => this.mode === "all" || n.key.startsWith(this.mode === "tasks" ? "task:" : "incident:"));
    if (this.mode === "off" || !wanted.length) return;
    // A burst (many runs failing at once) is one notice, not a wall of them.
    if (wanted.length > 3) {
      const inc = wanted.filter((n) => n.key.startsWith("incident:")).length;
      const parts = [inc && `${inc} incident${inc > 1 ? "s" : ""}`, wanted.length - inc && `${wanted.length - inc} task${wanted.length - inc > 1 ? "s" : ""} waiting`].filter(Boolean);
      this.show({ key: "burst", title: parts.join(", "), body: wanted.map((n) => n.title).slice(0, 5).join("; "), url: wanted[0].url?.replace(/#.*$/, "") });
      return;
    }
    for (const n of wanted) this.show(n);
  }
}
