---
name: agent-graph-authoring
description: Write, change and debug Agent Graph flows — TypeScript files (flows/<name>.flow.ts) built with defineFlow that compile to BPMN; their typed input and start form, steps (code, agents, people, timers, parallel), forms and agent options — and check them in a loop with `age check` / flow_check until they type-check, compile and lint clean. Use whenever creating or editing a flow file.
---

# Writing Agent Graph flows

A flow file is TypeScript in `flows/<name>.flow.ts`. It imports from
`agent-graph-engine`, exports one or more `defineFlow(...)` flows, and is compiled to
BPMN with a generated diagram. The engine redeploys it when the file changes. For
running flows, answering tasks and fixing incidents, see the `agent-graph` skill.

## The check loop: run it after every edit

```
age check [flows/<name>.flow.ts] [--json]     # or the MCP tool flow_check; flow_write runs it too
```

It does three things:

- **Type-checks** the file (TypeScript strict mode, against the real `agent-graph-engine` and `@nanobpm/workflow` types and Node's). Errors come as `flows/x.flow.ts:12:5 TS2322: …`.
- **Compiles** each flow to BPMN.
- **Lints** it: missing `run` handlers, forms, prompt files and agent profiles, job types no worker serves, start-form hints that don't match the input, and whatever the engine refuses when it deploys the BPMN.

Exit code 1 means errors; warnings don't fail. `--json` gives `{ ok, files: [{ file, flows: [{ id, input }], problems: [{ severity, element?, message }] }] }`.

**Loop: edit → `age check` → fix every error → repeat until it reports `✓`.** Don't start runs of a flow that doesn't check clean. The engine still deploys a file with type errors (it strips types), so it would fail or carry wrong data at run time.
Find the CLI at `<plugin>/dist/cli.js`. Without a shell (Claude Desktop), use `flow_write`, which writes the file and checks it, then `flow_check`.

## A flow

```ts
// flows/triage.flow.ts
import { defineFlow, defineForms, defineAgents, defineStartForm, envelope, sh } from "agent-graph-engine";

export const description = "Triage a GitHub issue";      // shown in the explorer and to agents

// The input: what a run is started with. Typed, checked when a run starts, and it
// becomes the start form (explorer, /flows), the MCP prompt arguments and CLI flags.
const Input = envelope("TriageInput", {
  issue: "integer",
  repo: "string",
  labels: { type: "string", list: true, optional: true },
});
export const startForm = defineStartForm(Input, {          // optional display hints
  title: "Triage an issue",
  fields: { issue: { title: "Issue number" }, repo: { default: "nanobpm/nano-ide" } },
});

export const forms = defineForms({
  "triage-review": {
    title: "Confirm triage for #{{issue}}",
    description: "{{summary}}",                            // {{var}} = instance variable
    fields: {
      action: { type: "string", enum: ["label", "close", "skip"] },
      comment: { type: "string", title: "Comment" },
    },
    required: ["action"],
  },
});

export const agents = defineAgents({
  summarize: {                                             // options for the agent task below
    schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
    allowedTools: ["Bash(gh issue view:*)"],
    model: "sonnet",
  },
});

// Contracts are keyed by step name; `Start` is the flow's input. A step with an `in`
// envelope gets typed job.variables.
export const triage = defineFlow("triage", { Start: { in: Input }, fetch: { in: Input } }, (w) => {
  w.run("fetch", async (job) => {
    const { issue, repo } = job.variables;                 // number, string
    const r = await sh(`gh issue view ${issue} -R ${repo} --json title,body`);
    return { issueJson: r.stdout };                        // merged into the variables
  });
  w.task("summarize", { jobType: "claude", prompt: { resourceId: "summarize.md" } });
  w.human("review", { form: "triage-review" });
  w.switch("action", {
    label: (b) => b.run("label", async (job) => { await sh(`gh issue edit ${job.variables.issue} --add-label triaged`); }),
    close: (b) => b.run("close", async (job) => { await sh(`gh issue close ${job.variables.issue}`); }),
    default: (b) => {},
  });
});
```

## Input

- **Declare it** with `envelope(name, fields)` as `{ Start: { in: Input } }` in the contracts. Field types: `"string"`, `"integer"`, `"number"`, `"boolean"`, `"datetime"` (ISO 8601). A field can also be `{ type, optional: true, list: true }`.
- **Everything is derived from it**: the start form, the `flow_status` signature `triage(issue: integer, repo: string, labels?: string[])`, the MCP prompt `/start-triage` with one argument per field, and `age start triage --issue 7 --repo x`.
- **Checked at start**: `/api/start` converts text to the declared types and refuses missing or wrong fields, naming each one.
- **Display hints** go in `defineStartForm(Input, { title, description, fields: { f: { title, description, enum, default, minimum, maximum } } })`. Field names are type-checked against the input.
- **Typing step variables**: to type a step's `job.variables`, give the step its own contract, e.g. `fetch: { in: Input }` (or a narrower envelope), plus an `out` envelope to type what it returns. Variables are `envelope & JsonObject`: a misspelled name isn't a type error, it is just untyped, so check names against the envelope.
- **No input declared**: the flow takes free-form JSON variables, and the start form is a JSON box.

## Steps

- **`w.run(name, async (job) => vars, opts?)`** runs inline code. `job.variables` holds the instance variables; return an object (or nothing).
  - Throwing fails the job: it is tried 3 times with backoff, then becomes an **incident**.
  - `opts`: `{ timeoutMs }`.
- **`w.task(name, { jobType: "claude", prompt: { resourceId } })`** is an agent step. The prompt file goes in `flows/prompts/`.
  - **Where it runs**: as a headless agent CLI when one is installed; otherwise it is handed to the chat session (`session_job_next`).
  - **Per-step options** go in `export const agents = defineAgents({...})`:
    - `schema`: a JSON schema for the answer, which becomes variables. Also ask for JSON in the prompt.
    - `allowedTools`: headless runs never prompt, so list every tool the step needs.
    - `model`, `system`.
    - `context`: which variables to pass (default: all).
    - `use`: which agent runs it — `claude`, `opencode`, `nano-coder`, `gemini`, or a profile from `export const agentProfiles = defineAgentProfiles({...})` or `~/.agent-graph/agents.json`.
  - **Flow default**: `export const defaultAgent = "…"`.
- **`w.task(name, { jobType: "session", agent: true })`** is work for the live Claude Code session.
- Inside `run`, `await claude(prompt, opts)` calls an agent directly.
- **`w.human(name, { form })`** is a user task. The form comes from `export const forms = defineForms({...})`. Fields can be string (optionally `enum`/`enumNames`, `format: "date-time"`), boolean, or number/integer (`minimum`, `maximum`), plus `required: [...]`. `{{var}}` in the title and description is filled from the variables.
- **Choices**: `w.switch("var", { value: (b) => …, default: (b) => … })`, or `w.branch("<FEEL condition>", { then, else })`.
- **Repeats**: `w.loop((b) => { …; b.break(); … b.continue(); })`, e.g. draft → review → redo.
- **Fixed branches**: `w.parallel([(b) => …, (b) => …])` runs every branch and joins them before continuing.
- **Fan-out**: `w.forEach("items", "item", (b) => …, { outputCollection: "results", outputElement: "notes" })` runs one branch per list item, with results collected in order. Options: `sequential`, `completionCondition`. Up to 4 headless agent branches run at once.
- **Waits**:
  - `w.timer(name, { after: "PT1H" })` waits for a duration.
  - `w.startOn({ cycle: "R/PT24H" })` starts the flow on a timer.
  - `w.signal(name, { correlationKey: "orderId" })` waits for a message (`flow_operate` `message`).

## Rules that bite

- **Step names** are BPMN ids: letters, digits, `_` and `-`. Don't start them with `Gw_`, `Loop_`, `Sub_`, `Msg_` or `f_`, and don't use `Start`/`End` as step names (`Start` is only a contract key).
- **Variables are JSON**: keep them small (paths and ids, not file contents). Return values must be JSON-typed. A `{}` or `unknown` where JSON is expected is a type error: convert it with `String(…)`/`Number(…)`, or declare an `out` envelope.
- **File paths**: the engine serves every project. `sh()` and agent steps run in the run's project, but plain `fs` calls don't, so use `projectPath("file")` or absolute paths.
- **Threads**: each step runs on its own thread, so module-level state isn't shared between steps. Pass data in variables or files. Put reusable logic in normal modules and import them (they are type-checked too).
- **Timeouts**: steps time out after 25 min (agent steps after 55). `sh()` and `claude()` stop then; pass `jobSignal()` to `fetch()` and other long calls.
- **Unknown options**: an option the types don't know (for example `{ retries: 0 }`) is a type error, because the engine ignores it.

## Changing a flow

- **Code changes** (`run` handlers, prompts, forms) apply to runs already in progress. Fix the code, check it, then `flow_operate` `retry` the incident.
- **Step changes** (added, removed or reordered steps) deploy a new version. Running instances keep the old shape.
- **Without file access**: read with `flow_read` and write with `flow_write`. Both check the flow.
