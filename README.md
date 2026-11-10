# Agent Graph Engine

A durable process engine for Claude Code. Write a flow in TypeScript with `defineFlow`.
It compiles to BPMN with a generated diagram and runs in a small local daemon. A flow can
orchestrate:

- **scripts**: `w.run` with Node code, plus `sh()`
- **headless agents**: `w.task({ jobType: "claude" })` runs a prompt file on an agent CLI of your choice — `claude -p`, or any ACP agent such as OpenCode or nano-coder — and records the transcript as an AgentInstance
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
flows/*.flow.ts ──check──▶ BPMN + DI ──deploy──▶ engine (one per user, ~/.agent-graph/journal.json)
                                                   │  workers: run handlers · claude -p · timers
Claude Code ──MCP (stdio)──▶ age mcp ──HTTP──▶─────┤
   hooks (SessionStart/UserPromptSubmit) ──────────┤  "user task waiting…" → context
browser ──────────────────────────────────────────▶┘  explorer: diagram, tokens, forms, incidents
```

## Install in Claude Desktop (chat)

No server to run and no workers to configure. Add one entry to
`~/Library/Application Support/Claude/claude_desktop_config.json` and restart Desktop (⌘Q):

```json
"mcpServers": {
  "agent-graph": {
    "command": "/absolute/path/to/node",
    "args": ["/path/to/agent-graph-engine/dist/cli.js", "mcp"]
  }
}
```

Use an absolute path to `node` (24+). Desktop doesn't load your shell PATH, so `nvm` installs aren't found otherwise.

- **One engine, every project.** You have one engine (state in `~/.agent-graph`, `AGE_STATE_DIR` moves it). Each project's flows are in its `flows/`; a project joins the engine the first time a flow tool, the CLI or the `/flows` pane is used there. The flows in `~/AgentGraph/flows` (the library; `AGE_HOME` moves it) are *global*: offered in every project and run in the project they were started from. A project flow with the same id takes the global one's place there (`flow_import` copies one in to customize it). Every run belongs to a project: its `sh()` steps and agent steps run in that folder, and files a step writes should use `projectPath("file")`. `flow_status`, the `/flows` pane and the explorer show work in all projects (the explorer has a project picker), so nothing waits somewhere you aren't looking. Agent steps for the session only go to a session in the run's project. Nothing is written into your repos.
- **Where flows live.** Desktop starts servers in `/`, so flows go in `~/AgentGraph/flows/`. Override with `"env": {"AGE_PROJECT": "/some/dir"}`.
- **Authoring.** Claude reads `flow_guide`, then writes flows with `flow_write`, which saves, compiles, lints and deploys in one step. Nothing is needed on your side.
- **Agent steps** (`jobType: "claude"`) need no setup:
  - If the Claude Code CLI is installed and logged in, they run headless in the background.
  - Otherwise the Claude you are chatting with does them (`session_job_next`/`session_job_complete`). If the CLI fails to authenticate, the engine switches to this automatically.
  - To force one mode: `AGE_AGENT_MODE=cli|session`.
- **Seeing and answering.**
  - `show_explorer` renders the explorer **inline in the chat** as an MCP App, with three tabs:
    - **Inbox:** task forms.
    - **Flows:** diagrams with live token counts, and a start form.
    - **Instances:** the nano console's Process Explorer: filters, diagram, variables (editable), jobs, incidents, cancel, and a step-by-step trace.
  - The view reaches the engine only through the server's app-only `ui_api` tool, so the iframe needs no network access.
  - The same explorer is also at the daemon URL in a browser.
- **Background.** The engine daemon keeps running after the chat is closed, so timers and CLI agent steps continue. In chat, nothing can wake Claude by itself: the explorer shows "agent step waiting — say *continue the flow*".

### Reusing flows across Desktop and Claude Code

`~/AgentGraph` doubles as a **library**. In any Claude Code project, `flow_list` shows the
project's flows and the library's, with descriptions and steps. `flow_import <name>` copies a
library flow and its prompt files into `./flows/` and deploys it there. Runs and state stay
per project. Relative imports from a flow file (your own helper modules) are not copied.

## In the interface: slash commands and the Claude Code mod

**Every MCP client: prompts.** The server publishes one prompt per flow in the project,
`start-<flow>`, with an `inputs` argument, plus `flows`, which shows what's going on. The
list follows `flows/` as you add or change flows.

| Client | How the prompts appear |
|---|---|
| Claude Code | `/mcp__agent-graph__start-release-notes since v1.0` |
| Claude Desktop | In the prompt menu (+) |
| OpenCode | As the command `agent-graph:start-release-notes`, e.g. `opencode run --command agent-graph:start-release-notes "since v1.0"` |

**Claude Code: the mod.** This needs Claude Code v2.1.287 or later, or v2.1.286 or later
in the Desktop Code tab. The plugin includes a mod (`hooks/mod.js`), so the engine shows up
in the Claude Code interface itself: the terminal, the Desktop Code tab, and VS Code
(panes only).

- **Band above the prompt.** While something is going on, it shows
  `⚙ Agent Graph · 2 flows running · 1 task waiting for you · 1 incident`, with a
  buttons that open the pane and the web explorer.
- **`/flows` pane**, with three tabs:
  - **Inbox:** user tasks drawn as forms that you answer right there, and incidents
    with **Retry**, **Ask Claude to fix** and **Cancel run**.
  - **Flows:** every flow has a **Start** button. Type JSON variables and the mod starts
    the run directly, with no model turn. Type plain words and Claude works out the
    variables.
  - **Runs:** what's active and where.
  - **Open ↗** (hotkey `o`) opens the web explorer at what needs you: the waiting
    task, else the incident, else this project's one running flow, else the flows. **↗**
    on a run opens that instance. The band's **Open ↗** does the same.
- **Where it opens:** in the terminal, your default browser (the engine starts if
  needed; `age open [instance=K | task=K | flow=ID]` does the same from a shell). In the
  Desktop app, the links open in its Browser pane, if you chose "Open links in built-in
  browser" there (Browser pane ⋮ menu). The engine answers on `http://localhost`, the
  only plain-http links the app makes clickable.
- **Wakes the agent.** When a flow hands agent steps to the session, the mod submits a
  prompt so the agent picks them up, using `session_job_next` with `max` for a fan-out.
  New user tasks show a toast.
- **No engine running?** The pane offers **Start engine**.

The mod polls the engine every 3 s over its local HTTP API. It reads the engine's
address from `~/.agent-graph/daemon.json`. Run the mod's tests with
`claude plugin test .`; `npm test` runs them after the engine tests.

**Organisations.** Mods are on by default. An administrator can allow only managed mods
with `allowManagedModsOnly` in managed settings. If they do, the band and pane don't
appear, and everything else keeps working.

## Install in OpenCode

Add the server to `~/.config/opencode/opencode.json`, or to `opencode.json` in a project:

```json
"mcp": {
  "agent-graph": {
    "type": "local",
    "command": ["/absolute/path/to/node", "/path/to/agent-graph-engine/dist/cli.js", "mcp"],
    "enabled": true
  }
}
```

Then install the skill, so OpenCode knows how to write flows. A symlink keeps it current:

```sh
ln -s /path/to/agent-graph-engine/skills/agent-graph ~/.config/opencode/skills/agent-graph
```

Check it with `opencode mcp list`, which should show `✓ agent-graph connected`.

**OpenCode desktop app (2.x).** The app runs its own bundled server (`opencode-cli serve --service`, 2.2.6 at the time of writing) and reads the same `~/.config/opencode/opencode.json` and `skills/`, so the entry above is all it needs. It accepts the 1.x shape shown here; the 2.x shape is `"mcp": {"servers": {"agent-graph": {..., "disabled": false}}}`. Restart the app after editing the config. Two things differ from the terminal CLI:

- The 2.x `opencode mcp list` prints "No MCP servers configured" even when the server is connected. Ask the running app instead: `"~/Library/Application Support/ai.opencode.desktop/cli/<version>/opencode-cli" api mcp.list` should list `agent-graph` as `connected`.
- The model calls tools from code, through one `execute` tool (`tools["agent-graph"].flow_start(...)`). Tool names and results are the same.

- **Where flows live.** The project is OpenCode's working directory, or the nearest parent with `flows/`, as in Claude Code. `flow_list` and `flow_import` reach the `~/AgentGraph` library.
- **Agent steps.** If the Claude Code CLI is installed and logged in, these still run as headless `claude -p`. Otherwise they go to the OpenCode agent through `session_job_next`, which uses whatever model you picked. To force this, set `"environment": {"AGE_AGENT_MODE": "session"}` on the server entry.
- **User tasks.** OpenCode renders neither MCP Apps nor MCP elicitation forms. The 2.x app does declare elicitation support, but it never shows the form, so the call would hang until OpenCode's 60-second tool timeout. `task_ask` therefore skips the dialog for OpenCode and falls back to text: the agent asks you in chat and records the answer with `task_complete`. Or answer in the browser explorer; `flow_start` and `flow_status` print its URL. For any client, a form that gets no answer within 10 minutes (`AGE_ELICIT_TIMEOUT_MS`) also falls back to chat. `AGE_ELICIT=on|off` overrides the detection.
- **No hooks.** OpenCode has no equivalent of Claude Code's SessionStart and UserPromptSubmit hooks, so ask "anything waiting in my flows?" and the agent will call `flow_status`.

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

## Which agent runs an agent step

An agent step (`jobType: "claude"`) runs on an **agent profile**: a CLI the engine starts headless for that step. So one tool can orchestrate while another subscription or model does the work, or you can pit models of different classes against each other (a writer on one, a critic on another).

Built-in profiles:

| profile | runs | protocol |
| --- | --- | --- |
| `claude` | `claude -p --output-format stream-json` | Claude Code print mode |
| `opencode` | `opencode acp` | [ACP](https://agentclientprotocol.com) |
| `nano-coder` | `nano-coder --acp` | ACP |
| `gemini` | `gemini --experimental-acp` | ACP |

Any ACP agent works. Add your own in `~/.agent-graph/agents.json`, or in a flow file:

```jsonc
// ~/.agent-graph/agents.json
{
  "default": "nano-coder",
  "profiles": {
    "critic": { "protocol": "acp", "command": "nano-coder", "args": ["--acp"], "model": "openrouter/openai/gpt-5", "modelArg": "--model" },
    "oc-sonnet": { "protocol": "acp", "command": "opencode", "args": ["acp"], "model": "anthropic/claude-sonnet-4-5" }
  }
}
```

```ts
// flows/review.flow.ts
export const agentProfiles = defineAgentProfiles({ critic: { protocol: "acp", command: "nano-coder", args: ["--acp"], model: "…" } });
export const defaultAgent = "claude";
export const agents = { critique: { use: "critic" }, draft: { model: "opus" } };
```

The profile for a step is the first of:

1. the step's `use`;
2. the flow's `defaultAgent`;
3. `default` in `agents.json`;
4. the CLI of the host that started the run (Claude Code → `claude`, OpenCode → `opencode`, nano-coder → `nano-coder`);
5. the first installed of `claude`, `opencode`, `nano-coder`.

On a name clash `agents.json` wins over a flow's `agentProfiles`, which win over the built-ins. An unknown `use` is a compile error. `age agent` lists the profiles and the default; `age agent default <name>` sets it. If no agent CLI is installed, agent steps go to the chat session (`session_job_next`), as before.

ACP agents run in the run's project directory with permission requests approved, so give them a sandbox you trust. Each step is a fresh ACP session. `schema` is passed as an instruction to answer with JSON; the first JSON object in the answer becomes variables.

### Agent transcripts (AgentInstance)

Each agent step is recorded in the engine as an **AgentInstance** with its **history** (the same read model Camunda's agentic orchestration and `c8ctl-plugin-nano` use): a CONFIGURATION item (profile as provider, model, prompt), the USER prompt, each ASSISTANT turn with its tool calls and token/time metrics, and each TOOL_RESULT. Agent jobs are activated with a lease token, so writes are fenced to the activation; the history is committed when the step completes and discarded if it fails. A retry of the same step continues the same AgentInstance.

The explorer shows an agent badge on the step; click it for the transcript, with a timeline, metrics and a run picker when a step ran several times. The data comes from `GET /api/explorer/instances/<key>/agents` and `GET /api/explorer/agents/<key>/history`. Recording is best-effort: a failure is logged and never fails the step.

## Notifications

The engine runs in the background, so a run can stop long after you've left the session. When an incident is raised, or a user task starts waiting for you, the engine shows a desktop notification with the flow and project. Clicking it opens that run or task in the explorer, where available. Each incident or task is announced once. Anything already waiting when the engine starts is not announced again. More than three at once are combined into one notification.

| Platform | Uses | Click opens the explorer |
|---|---|---|
| macOS | `terminal-notifier` if installed (`brew install terminal-notifier`), else `osascript` | only with `terminal-notifier` |
| Linux | `notify-send` (libnotify, any freedesktop notification daemon) | with libnotify 0.7.9+ (`--action`); the URL is also in the text |
| Windows 10/11 | a PowerShell toast (no install) | yes |

`AGE_NOTIFY=off` turns them off, and `AGE_NOTIFY=incidents` or `AGE_NOTIFY=tasks` limits them to one kind. Set it in the environment the engine starts from. A missing notifier is logged once in the activity log and never affects runs.

## Parallelism and fan-out

Flows fan out with `w.parallel([...])`, a fixed set of branches, and
`w.forEach("files", "file", body, { outputCollection, outputElement })`, one branch per
list item with the results collected in order. Both are BPMN parallel gateways and
multi-instance activities, so the engine joins the branches and continues only when
all are done, or when `completionCondition` holds.

How the branches run depends on who does the work:

- **`run` steps and headless agents** (`claude -p`) run concurrently inside the daemon, up to `AGE_MAX_CONCURRENT` at a time (default 4). `AGE_CONCURRENCY="claude=2"` sets a lower limit for a step type. Each agent step is its own `claude -p` process: a durable subagent with its own context, tools and cost line. Measured with six 2-second agent steps plus a two-branch `parallel`: they ran in three waves of 4 + 2 + 2, so about 7 s instead of 16 s.
- **Steps handed to the chat agent** (`session` jobs, and agent steps when there's no CLI) are queued. `session_job_next` hands them out one at a time, or as a batch with `max`. An agent that has subagents (Claude Code's Task tool, OpenCode's `task`) can then do the batch in parallel and complete each job by key. Without subagents, the agent works through them one by one.

Compared with session-scoped workflow tools (Claude Code workflows, dsh `workflow`):

- **What's the same:** both fan out to fresh agents.
- **What's different:**
  - The fan-out here is a step in a durable process, so it can be joined, retried per branch (an incident on one branch doesn't lose the others), and followed by human review or timers.
  - Each branch shows on the diagram with ×N badges.

## How it works

- **Engine**: `@nanobpm/engine-wasm` (`TestEngine`) running in Node. The host owns the clock (`tickNow(Date.now())` every 500 ms) and runs the job workers.
- **Durability**:
  - After each change, `engine.events()` is written atomically to `~/.agent-graph/journal.json`.
  - On start, `replayEvents()` restores it.
  - Jobs that were mid-run when the daemon died are handed back out.
  - Tested by the e2e test: it stops the daemon in the middle of a flow.
- **Code layout**: three parts with narrow seams between them.
  - **Control** (`src/client.ts`): `EngineClient`, the one typed client the MCP server, CLI and hooks use. It finds or starts the engine, scopes calls to a project and builds explorer links. The mod runs sandboxed and keeps a few direct calls to the same routes.
  - **Engine** (`src/daemon.ts`): the WASM engine, event log, timers and HTTP API.
  - **Worker** (`src/worker.ts`): runs activated jobs. It meets the engine only through complete/fail, so it's tested with a fake engine (`test/worker.spec.ts`).
  - **Step threads** (`src/step-pool.ts`, `src/step-thread.ts`): flow code runs on a pool of worker threads, one step per thread, up to `AGE_MAX_CONCURRENT` threads. Each thread imports the flow file itself, and only JSON variables pass between it and the engine.
- **Workers**:
  - `run` handlers are imported from the flow file. A failed job gets 3 retries with backoff, then an incident.
  - A step can't take the engine down. A handler that throws, rejects or hangs fails its job. Steps time out after 25 minutes, agent steps after 55 (`AGE_JOB_TIMEOUT_MS` overrides both); on timeout the step's `sh()`/`claude()` process is killed, and handlers can pass `jobSignal()` to `fetch()` and other long calls. A stray rejection or exception from flow code is logged, not fatal.
  - Flow code runs on step threads, not the engine's thread. Steps that compute run in parallel, and the engine keeps ticking timers and answering the explorer meanwhile. A step that doesn't stop within 2 s of its timeout, even one stuck in a synchronous loop, has its thread terminated. `process.exit()` in a step ends only its thread and fails the step. Threads are replaced when flows are reloaded. `AGE_STEP_THREADS=0` runs flow code on the engine's thread, as before 0.7.
  - Threads share the process's memory, so a step that exhausts memory or crashes native code still stops the engine. Module-level state in a flow file isn't shared between steps, since each thread has its own copy; keep shared state in variables or files.
  - Agent steps (`claude`) stay on the engine's thread: they only wait on the `claude` process.
  - The agent worker runs the step's profile (see [Which agent runs an agent step](#which-agent-runs-an-agent-step)). For `claude` it spawns `claude -p --output-format stream-json --verbose --permission-mode dontAsk` with optional `--json-schema`, `--allowedTools` and `--model`; ACP profiles go through the `@nanobpm/agentic` ACP client. Options come from `export const agents`. The cost is logged when the CLI reports it.
  - `AGE_CLAUDE_CMD` swaps the `claude` binary (the tests use fakes: `test/fixtures/fake-claude.mjs`, `fake-acp.mjs`).
- **One engine per user**:
  - Its info is in `~/.agent-graph/daemon.json`, and it listens on `localhost` (`127.0.0.1` and `::1`).
  - The MCP server, CLI and hooks are thin HTTP clients. MCP/CLI start the engine detached on first use (one client starts it; the others wait) and register their project with it (`projects.json`).
  - A project's flows deploy as `<folder>-<hash>.<id>`, so two repos can both have a `release` flow; global flows keep their id. Runs record their project; handlers run inside an async context that `sh()`, `claude()` and `projectPath()` read.
  - Before 0.5 each project had its own engine in `<project>/.agent-graph/`. Those aren't migrated: stop one with the old version's `age down` once its runs are done (its history stays in that folder).
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
npm run build      # fetch the Process Explorer, typecheck, esbuild + tailwind →
                   #   dist/{cli.js,index.js,explorer.html,explorer-app.html,nanobpmn_engine_bg.wasm}
npm test           # e2e: MCP client with elicitation → server → daemon, restart mid-flow, hooks, lint,
                   #      and a Desktop-like client (cwd /, no CLI, no elicitation) authoring + running via MCP only
node dist/cli.js mcp --http 3001          # Streamable HTTP, for MCP Apps hosts / inspector
PLAYWRIGHT_FROM=/tmp/bh node test/app-host-e2e.mjs http://localhost:8090   # explorer as MCP App in basic-host
node test/explorer-e2e.mjs [out-prefix]  # temp project + daemon, drives inbox → instance → flows; screenshots
                                          #   (PLAYWRIGHT_FROM=<dir with playwright>)
```

The explorer's Instances tab is the nano console's Process Explorer
([`@nanobpm/process-explorer`](https://github.com/nanobpm/nano-bpm/tree/main/process-explorer)),
over the daemon's `/api/explorer/*` routes (`src/explorer-api.ts` maps the engine snapshot and
event log onto the console's wire model, including the trace). It isn't on npm yet
([nanobpm/nano-bpm#1475](https://github.com/nanobpm/nano-bpm/issues/1475)) and npm can't install a
git subdirectory, so `scripts/fetch-explorer.mjs` sparse-clones it at a pinned commit into
`node_modules/.cache/nano-bpm` and the build bundles it. `dist/` is committed, so only building
needs access to that repo. Bump `NANO_BPM_REV` to update it.

Flow files import `"agent-graph-engine"`. The daemon maps that specifier to `dist/index.js`
with `module.registerHooks`, so the user's project needs no install.

## Limitations and next steps

- The explorer draws the *current* BPMN of a flow, even for instances started on an older version (the flow id is the definition key).
- The explorer polls (every 1.5 s); the daemon has no push feed.
- The journal is rewritten whole on each change. Fine for local use, but long-lived projects will want compaction (snapshot + tail).
- One process: `run` handlers share the daemon. A blocking handler stalls ticks; use async APIs.
- Headless agents never prompt for permissions: list the tools they need in `agents.<step>.allowedTools`. No cost caps yet beyond what you set in prompts. Spend is logged per job.
- Not yet verified inside a real Claude Code session: the local OAuth token had expired (`claude -p` → 401). The plugin validates, and `claude mcp list` shows `agent-graph` ✔ Connected.
- MCP Apps view verified in the ext-apps reference host (`test/app-host-e2e.mjs`). Claude Desktop's own rendering has not been verified yet.
- Next: a mods pane/status line and `$.prompt.submit` for session jobs, plus MCP tasks for "start and wait".
