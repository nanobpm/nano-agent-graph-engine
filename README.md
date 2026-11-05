# Agent Graph Engine

A durable process engine for Claude Code. Write a flow in TypeScript with `defineFlow`.
It compiles to BPMN with a generated diagram and runs in a small local daemon. A flow can
orchestrate:

- **scripts**: `w.run` with Node code, plus `sh()`
- **headless Claude agents**: `w.task({ jobType: "claude" })`, which runs `claude -p` with a prompt file
- **the live Claude Code session**: `w.task({ jobType: "session" })`, which the agent picks up through MCP
- **people**: `w.human` user tasks, asked in a Claude Code dialog or in the web explorer
- **time and events**: `w.timer` and `w.signal`

…with loops, switches, branches and parallel steps. State is an event log on disk, so
instances survive restarts and keep running after the Claude session ends.

This fills a different spot than [Claude Code workflows](https://code.claude.com/docs/en/workflows).
Those are session-scoped scripts that fan out subagents, with no user input mid-run, no
timers and no shell. Agent Graph flows are long-lived, can wait for people or time, run
real code, and can be inspected as a diagram.

```
flows/*.flow.ts ──check──▶ BPMN + DI ──deploy──▶ daemon (WASM engine, .agent-graph/journal.json)
                                                   │  workers: run handlers · claude -p · timers
Claude Code ──MCP (stdio)──▶ age mcp ──HTTP──▶─────┤
   hooks (SessionStart/UserPromptSubmit) ──────────┤  "user task waiting…" → context
browser ──────────────────────────────────────────▶┘  explorer: diagram, tokens, forms, incidents
```

## Install (Claude Code plugin)

```sh
claude plugin marketplace add ~/workspace/agent-graph-engine
claude plugin install agent-graph-engine@agent-graph-engine
# or, for development:
claude --plugin-dir ~/workspace/agent-graph-engine
```

`dist/` is committed, so no build is needed. Node 22.15 or newer is required (Node 24 recommended: flow files are
`.ts` and run with Node's built-in type stripping).

The plugin provides:

- the **`agent-graph` MCP server**:
  - `flow_check`, `flow_start`, `flow_status`
  - `task_list`, `task_ask`, `task_complete`
  - `session_job_next`, `session_job_complete`, `session_job_fail`
  - `flow_operate`
- the **`agent-graph` skill**: how to write flows
- **hooks**: when a user task, session job or incident is waiting, SessionStart and UserPromptSubmit add it to Claude's context. They stay silent otherwise and never start the daemon.

## Use

Ask Claude something like *"make a flow that drafts release notes from git log with an agent,
lets me review, and writes CHANGELOG.md"*. It writes `flows/<name>.flow.ts`, runs
`flow_check` until clean, and starts it. When the review step is reached, `task_ask` opens
a form dialog in Claude Code. You can also answer it in the explorer.

CLI (`node dist/cli.js …`, or `age` if linked):

```
age check | up | down | status | start <flow> [json] | tasks | complete <task> [json] | open
```

The example is in `examples/demo`:

```sh
cd examples/demo
node ../../dist/cli.js check
node ../../dist/cli.js start changelog '{"commits":10}'
node ../../dist/cli.js open      # explorer URL
```

### A flow

See `examples/demo/flows/changelog.flow.ts` and `skills/agent-graph/SKILL.md` for the full API.

```ts
import { defineFlow, defineForms, sh } from "agent-graph-engine";
export const forms = defineForms({ "review": { title: "Review", description: "{{notes}}",
  fields: { decision: { type: "string", enum: ["publish", "redo", "cancel"] }, feedback: { type: "string" } }, required: ["decision"] } });
export const changelog = defineFlow("changelog", (w) => {
  w.run("gather", async () => ({ commitLog: (await sh("git log --oneline -n 20")).stdout }));
  w.loop((b) => {
    b.task("draft", { jobType: "claude", prompt: { resourceId: "changelog.md" } });
    b.human("review", { form: "review" });
    b.switch("decision", { publish: (c) => { c.run("write", async (j) => { /* … */ }); c.break(); },
                           cancel: (c) => c.break(), default: (c) => c.continue() });
  });
});
```

**The compiler and lint step** (`flow_check` / `age check`):

1. `defineFlow` validates the structure.
2. `@nanobpm/workflow` emits BPMN.
3. `bpmn-auto-layout` generates the DI.
4. Our lint checks catch:
   - `run` steps without a handler
   - unknown forms
   - missing prompt files
   - job types no worker serves
5. A trial deploy into the engine is the final check.

Flows that pass are deployed. A new version is deployed only when the BPMN changed, and the daemon watches `flows/`.

## How it works

- **Engine**: `@nanobpm/engine-wasm` (`TestEngine`) running in Node. The host owns the clock (`tickNow(Date.now())` every 500 ms) and runs the job workers.
- **Durability**:
  - After each change, `engine.events()` is written atomically to `.agent-graph/journal.json`.
  - On start, `replayEvents()` restores it.
  - Jobs that were mid-run when the daemon died are handed back out.
  - Tested by the e2e test: it stops the daemon in the middle of a flow.
- **Workers**:
  - `run` handlers are imported from the flow file. A failed job gets 3 retries with backoff, then an incident.
  - The `claude` worker spawns `claude -p --output-format json --permission-mode dontAsk` with optional `--json-schema`, `--allowedTools` and `--model`. Options come from `export const agents`. The cost is logged.
  - `AGE_CLAUDE_CMD` swaps the binary (the tests use a fake).
- **One daemon per project**:
  - Its info is in `.agent-graph/daemon.json`, and it listens on `127.0.0.1`.
  - The MCP server, CLI and hooks are thin HTTP clients. MCP/CLI start the daemon detached on first use.
  - `flow_start` output includes the explorer URL.
- **Explorer** (`GET /`), a single HTML file using the bpmn-js viewer, shows:
  - the task inbox with forms
  - flows, with token counts and a start form
  - instances: active, done and incident markers, the path taken, ×N loop badges, variables (rebuilt from the event log for finished instances), activity and costs, retry and cancel

## Surfacing user tasks and prompting in Claude Code: findings

| Surface | Status | Used here |
|---|---|---|
| **MCP elicitation** (form/url dialogs from a tool call) | stable in Claude Code | ✅ `task_ask` asks the form in a dialog. It only works *inside* a tool call, so the agent has to call it. |
| **Hooks** `additionalContext` (SessionStart, UserPromptSubmit) | stable | ✅ tells the agent what's waiting on the next prompt (deduplicated) |
| **Web UI** (own HTTP server) | — | ✅ explorer: inbox, forms, diagram |
| **Mods** (`$.ui.open` panes in terminal/Desktop/VS Code, `$.ui.notify/toast/status`, `$.ui.ask`, `$.clock.every`, `$.prompt.submit` to start a turn from the background) | Claude Code ≥ 2.1.290 | ❌ not yet. This is the best fit: a live task-inbox pane, a status line ("2 tasks waiting"), and waking the agent when a session job arrives. Local Claude Code is 2.1.177. |
| **MCP tasks** (`input_required` → elicitation while a long job runs) | public beta, ≥ 2.1.304 | ❌ could make `flow_start … wait` a first-class background task |
| **Channels** (`notifications/claude/channel` push into a running session) | research preview, needs `--dangerously-load-development-channels` | ❌ push alternative to hooks |

Without mods, nothing can *interrupt* an idle session. Waiting work is surfaced on the next prompt (hook), in the explorer, and by `flow_status`.

## Develop

```sh
npm install
npm run build      # tsc + esbuild → dist/{cli.js,index.js,explorer.html,nanobpmn_engine_bg.wasm}
npm test           # e2e: MCP client with elicitation → server → daemon, restart mid-flow, hooks, lint
node test/explorer-e2e.mjs <daemon-url>   # Playwright screenshots (PLAYWRIGHT_FROM=<dir with playwright>)
```

Flow files import `"agent-graph-engine"`. The daemon maps that specifier to `dist/index.js`
with `module.registerHooks`, so the user's project needs no install.

## Limitations and next steps

- The explorer draws the *current* BPMN of a flow, even for instances started on an older version.
- The journal is rewritten whole on each change. Fine for local use, but long-lived projects will want compaction (snapshot + tail).
- One process: `run` handlers share the daemon. A blocking handler stalls ticks; use async APIs.
- Headless agents never prompt for permissions: list the tools they need in `agents.<step>.allowedTools`. No cost caps yet beyond what you set in prompts. Spend is logged per job.
- Not yet verified inside a real Claude Code session: the local OAuth token had expired (`claude -p` → 401). The plugin validates, and `claude mcp list` shows `agent-graph` ✔ Connected.
- Next: a mods pane/status line and `$.prompt.submit` for session jobs, plus MCP tasks for "start and wait".
