---
name: agent-graph
description: Run and operate durable workflows ("flows") with the Agent Graph Engine — start flows (with their inputs), answer user tasks, do agent steps assigned to this session, watch runs and fix incidents. Use when the user wants to run a flow, asks what's running or waiting, has a task or incident to deal with, or wants to automate a repeatable multi-step process (then also load agent-graph-authoring to write the flow).
---

# Agent Graph Engine — running flows

A flow is a durable process (`flows/<name>.flow.ts`, compiled to BPMN) that mixes
scripts, headless agents, work for this session, timers and people. One engine per
user runs every project's flows, keeps its event log in `~/.agent-graph/`, and keeps
going after this session ends. It starts on demand and redeploys flows when files
change. **To write or change a flow, use the `agent-graph-authoring` skill** (or
`flow_guide` when you have no skills).

## Tools

| Tool | Use |
|---|---|
| `flow_status` | Flows this project can start — with their **input** as `id(field: type, optional?: type)` — and runs, open tasks, incidents and running jobs in every project. Pass `instanceKey` for one run in detail (variables, activity). |
| `flow_start` | Start a run: `flowId`, `variables`, a short `title`. |
| `show_explorer` | The live explorer inline: diagrams with where runs are, start forms, the task inbox, incidents, agent transcripts. |
| `task_list` / `task_ask` | Open user tasks. `task_ask` shows the form to the user and completes the task with their answer. |
| `task_complete` | Complete a task with an answer the user gave you in chat (when dialogs aren't available). |
| `session_job_next` / `session_job_complete` / `session_job_fail` | Do work a flow assigned to *this* session. |
| `flow_operate` | `retry` an incident after fixing its cause, `cancel` a run, send a `message`. |
| `flow_list` / `flow_import` | This project's flows and the global ones (`~/AgentGraph/flows`, startable anywhere; they run in the project they're started in). Import copies a global flow here to customize it. |

**Never answer a user task yourself**: it is the person's decision. Use `task_ask`.

## Starting a flow

- If the flow declares an input, `flow_status` shows it, e.g. `review(pr: integer, repo: string, note?: string)`. Pass exactly those fields as `variables`. Fill them in from the conversation, and ask the user only for required fields you can't infer.
- Text is fine. The engine converts it to the declared types: `"42"` becomes 42, `"yes"` becomes true, and `"a, b"` becomes a list. It refuses missing or wrong fields and names each one. Fix what it lists and call `flow_start` again.
- A flow without a declared input takes free-form variables. Read the flow (`flow_read`) to see which ones it uses.
- The user can also start a run from the explorer's start form, from `/flows` in Claude Code, or with `age start <flow> --pr 42 --repo x`.
- After starting, show the run with `show_explorer`, or share the explorer URL.

## While a run is going

- **User task waiting** (the hook or `flow_status` tells you): call `task_ask`, or `show_explorer` with the task.
- **Agent steps for this session**: `session_job_next`, do the work, `session_job_complete` with the result (JSON object → variables). Keep going until the run waits on the user or a timer, or is done. Batches (`max`) can go to subagents.
- **Incident** (a step failed 3 times): read it with `flow_status`. Fix the cause — often the flow code, which reloads on save, or a missing file or tool — then `flow_operate` `retry`, and the *same* run continues.
- **Changed steps** (added, removed or reordered): this deploys a new version. Running instances keep the old shape, so cancel them and start new runs.

CLI equivalent: `node <plugin>/dist/cli.js status|start|tasks|complete|up|down|open`.
