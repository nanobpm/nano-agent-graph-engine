---
name: agent-graph
description: Build and run durable workflows ("flows") in this project with the Agent Graph Engine — multi-step processes that mix shell scripts, headless Claude agents, work for this session, timers and human approvals, and that survive restarts. Use when the user wants to automate a repeatable multi-step process, a pipeline with review/approval steps, or something that waits (for time, a person, or an event); or asks about running flows, waiting tasks or incidents.
---

# Agent Graph Engine

A flow is a TypeScript file in `flows/<name>.flow.ts` written with `defineFlow`. It
compiles to BPMN (with a generated diagram) and runs in a per-project daemon that keeps
an event log in `.agent-graph/`, so instances survive restarts and keep running after
this session ends. The daemon starts on demand and redeploys flows when files change.

## Tools

| Tool | Use |
|---|---|
| `flow_write` / `flow_read` | Write (or read) `flows/<name>.flow.ts` + prompt files and compile/lint it in one go — use these when you have no file access (Claude Desktop chat). |
| `flow_list` / `flow_import` | List flows here and in the shared library `~/AgentGraph` (where Claude Desktop keeps flows); copy one into this project to reuse it. |
| `flow_check` | Compile + lint all flows. **Run after every edit**; fix every error. Deploys flows that pass. |
| `show_explorer` | Show the live explorer inline (diagram with where runs are, task inbox with forms the user can fill in, incidents). |
| `flow_start` | Start an instance (`flowId`, `variables`, optional `title`). |
| `flow_status` | Overview, or one instance in detail (`instanceKey`). Gives the explorer URL. |
| `task_list` / `task_ask` | Open user tasks. `task_ask` shows the form to the user in a dialog and completes the task with their answer. |
| `task_complete` | Complete a task with an answer the user gave you in chat (when dialogs aren't available). |
| `session_job_next` / `session_job_complete` / `session_job_fail` | Do work a flow assigned to *this* session. |
| `flow_operate` | `retry` an incident after fixing its cause, `cancel` an instance, send a `message`. |

Never answer a user task yourself: it is the person's decision. Use `task_ask`.

## Writing a flow

```ts
// flows/triage.flow.ts
import { defineFlow, defineForms, defineAgents, sh, claude } from "agent-graph-engine";

export const description = "Triage new GitHub issues";   // shown in the explorer

export const forms = defineForms({
  "triage-review": {
    title: "Confirm triage for #{{issue}}",
    description: "{{summary}}",                          // {{var}} = instance variable
    fields: {
      action: { type: "string", enum: ["label", "close", "skip"] },
      comment: { type: "string", title: "Comment" },
    },
    required: ["action"],
  },
});

export const agents = defineAgents({
  // options for the agent task "summarize" below
  summarize: { schema: { type: "object", properties: { summary: { type: "string" }, labels: { type: "array", items: { type: "string" } } }, required: ["summary"] },
               allowedTools: ["Bash(gh issue view:*)"], model: "sonnet" },
});

export const triage = defineFlow("triage", (w) => {
  // run: code in this file (any Node). Return an object → merged into the variables.
  w.run("fetch", async (job) => {
    const r = await sh('gh issue view "$N" --json title,body', { env: { N: String(job.variables.issue) } });
    return { issueJson: r.stdout };
  });
  // Agent task: headless `claude -p` with the prompt in flows/prompts/summarize.md;
  // the instance variables are appended as JSON context. Result object → variables.
  w.task("summarize", { jobType: "claude", prompt: { resourceId: "summarize.md" } });
  // Human step: waits for the user (task_ask / explorer).
  w.human("review", { form: "triage-review" });
  w.switch("action", {
    label: (b) => b.run("label", async (job) => { await sh(`gh issue edit ${job.variables.issue} --add-label triaged`); }),
    close: (b) => b.run("close", async (job) => { await sh(`gh issue close ${job.variables.issue}`); }),
    default: (b) => {},
  });
});
```

### Steps

- `w.run(name, async (job) => vars)` — inline code. `job.variables` holds the instance variables. Throwing fails the job (3 tries with backoff, then an **incident**).
- `w.task(name, { jobType: "claude", prompt: { resourceId } })` — an agent step; prompt file in `flows/prompts/`. Runs as headless `claude -p` when the Claude Code CLI is installed and logged in; otherwise (e.g. Claude Desktop chat) it is handed to you — pick it up with `session_job_next`, do it, return the result with `session_job_complete`. Options per step via `export const agents`. Headless runs never prompt: list the tools it needs in `allowedTools`. Ask for JSON (or give `schema`) so the answer becomes variables.
- `w.task(name, { jobType: "session", agent: true })` — work for the live Claude Code session: you pick it up with `session_job_next`.
- Inside `run` you can also call `await claude(prompt, opts)` directly.
- `w.human(name, { form })` — user task; form from `export const forms` (fields: string/enum, boolean, number/integer).
- `w.switch("var", { value: (b) => …, default: (b) => … })`, `w.branch("<FEEL condition>", { then, else })`.
- `w.loop((b) => { …; b.break(); … b.continue(); })` — repeat (e.g. draft → review → redo).
- `w.parallel([(b) => …, (b) => …])` — fixed branches, all run, joined before continuing.
- `w.forEach("items", "item", (b) => …, { outputCollection: "results", outputElement: "notes" })` — fan out one branch per list item (e.g. one agent per file); results collected in order. Options: `sequential`, `completionCondition`.
  Headless agent branches run concurrently (up to 4). If agent steps come to you instead, claim them as a batch with `session_job_next` `max` and hand them to subagents if you have them.
- `w.timer(name, { after: "PT1H" })` — durable wait (ISO 8601 duration).
- `w.signal(name, { correlationKey: "orderId" })` — wait for a message (`flow_operate` `message`).

Step names are BPMN ids: letters, digits, `_`, `-`; don't start them with `Gw_`, `Loop_`, `Sub_`, `Msg_`, `f_`, and don't use `Start`/`End`.

Variables are JSON; keep them small (paths and ids, not file contents). Code runs in the
daemon with the project as cwd. Put reusable logic in normal modules and import them.

## Workflow

1. Sketch the steps with the user (who decides where?).
2. Write `flows/<name>.flow.ts` (+ prompts), run `flow_check` until clean.
3. `flow_start`; then `show_explorer` (or share the explorer URL).
4. When a user task is waiting (the hook or `flow_status` tells you), call `task_ask` or `show_explorer` with the task. When agent steps wait for you, do them via `session_job_next` — keep going until the flow waits on the user, a timer, or is done.
5. Fixing a flow that doesn't work: read it (`flow_read` or the file), change it, write it back (`flow_write` or edit + `flow_check`). Code changes (`run` handlers, prompts) apply to runs already in progress — then `flow_operate` `retry` the incident and the *same* run continues. Changes to the steps themselves (adding/removing/reordering) deploy a new version: running instances keep the old shape, so cancel and start a new run.
6. On an incident: read it with `flow_status`, fix the cause (often the flow code — it reloads on save), then `flow_operate` `retry`.

CLI equivalent: `node <plugin>/dist/cli.js check|up|status|start|tasks|complete|down`.
