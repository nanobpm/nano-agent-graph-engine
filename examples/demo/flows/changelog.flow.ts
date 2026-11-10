// changelog: draft release notes from recent commits with a headless Claude agent,
// get a human sign-off, then write the file.
//
//   gather ─▶ ┌▶ draft (agent) ─▶ review (human) ─▶ decision: publish → write → end
//             └──────────────── redo with feedback ┘           cancel  → end
import { defineFlow, projectPath, defineForms, sh } from "@nanobpm/nano-agent-graph-engine";
import { writeFileSync } from "node:fs";

export const description = "Draft release notes from git history, review, and write CHANGELOG-draft.md";

export const forms = defineForms({
  "changelog-review": {
    title: "Review the draft release notes",
    description: "{{notes}}",
    fields: {
      decision: { type: "string", title: "Decision", enum: ["publish", "redo", "cancel"], enumNames: ["Publish", "Redo with feedback", "Cancel"] },
      feedback: { type: "string", title: "Feedback for a redo" },
    },
    required: ["decision"],
  },
});

export const changelog = defineFlow("changelog", (w) => {
  w.run("gather", async (job) => {
    const n = Number(job.variables.commits ?? 20);
    const log = await sh(`git log --no-merges --pretty='- %s (%h)' -n ${n}`);
    return { commitLog: log.stdout.trim() || "(no commits)" };
  });

  w.loop((b) => {
    // A BPMN agent task: served by the built-in "claude" worker with the prompt
    // in flows/prompts/changelog.md; the job's variables are appended as context.
    b.task("draft", { jobType: "senior:draft", prompt: { resourceId: "changelog.md" } });
    b.human("review", { form: "changelog-review" });
    b.switch("decision", {
      publish: (c) => {
        c.run("write", async (job) => {
          const file = "CHANGELOG-draft.md";
          writeFileSync(projectPath(file), `${job.variables.notes}\n`);
          return { written: file };
        });
        c.break();
      },
      cancel: (c) => c.break(),
      default: (c) => c.continue(),
    });
  });
});
