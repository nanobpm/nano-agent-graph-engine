// A flow's input: the `Start` contract's envelope (`defineFlow(id, { Start: { in } }, …)`).
// It drives the start form (explorer, Claude Code mod, elicitation), the input schema
// agents see (flow_status, MCP prompt arguments), `nage start --field value`, and the
// check /api/start makes before it creates an instance.
import { validateEnvelope } from "@nanobpm/workflow";
import type { FormDef, FormField } from "./index.ts";

export interface InputField {
  name: string;
  type: "string" | "integer" | "number" | "boolean" | "datetime";
  optional: boolean;
  list: boolean;
}

/** What a host knows about a flow's input: the envelope, flattened. */
export interface FlowInput {
  name: string;
  fields: InputField[];
}

/** Display hints for a flow's start form, keyed by input field. Hints decorate the
 *  fields the input declares; they can't add fields. */
export interface StartFormHints {
  title?: string;
  description?: string;
  fields?: Record<string, { title?: string; description?: string; enum?: string[]; enumNames?: string[]; default?: string | number | boolean; minimum?: number; maximum?: number }>;
}

export interface InputProblem {
  field: string;
  message: string;
}

/** The start form for an input: one form field per input field. A list field is a
 *  text field taking comma- or newline-separated values; a datetime is a date-time
 *  string. Hints add titles, descriptions, choices and defaults. */
export function inputForm(input: FlowInput, hints: StartFormHints = {}): FormDef {
  const fields: Record<string, FormField> = {};
  const required: string[] = [];
  for (const f of input.fields) {
    const h = hints.fields?.[f.name] ?? {};
    const base = { title: h.title ?? f.name, description: h.description };
    let field: FormField;
    if (f.list) {
      field = { type: "string", ...base, description: [h.description, `A list of ${f.type} values, separated by commas or new lines.`].filter(Boolean).join(" ") };
      if (typeof h.default === "string") field.default = h.default;
    } else if (f.type === "boolean") {
      field = { type: "boolean", ...base };
      if (typeof h.default === "boolean") field.default = h.default;
    } else if (f.type === "integer" || f.type === "number") {
      field = { type: f.type, ...base, minimum: h.minimum, maximum: h.maximum };
      if (typeof h.default === "number") field.default = h.default;
    } else {
      field = { type: "string", ...base, enum: h.enum, enumNames: h.enumNames };
      if (f.type === "datetime") field.format = "date-time";
      if (typeof h.default === "string") field.default = h.default;
    }
    fields[f.name] = stripUndefined(field);
    if (!f.optional) required.push(f.name);
  }
  return stripUndefined({ title: hints.title, description: hints.description, fields, required });
}

/** Problems with the hints themselves, for the authoring check. */
export function hintProblems(input: FlowInput | undefined, hints: StartFormHints | undefined): string[] {
  if (!hints) return [];
  if (!input) return ["startForm is exported but the flow declares no input — add { Start: { in: envelope(...) } } to defineFlow"];
  const out: string[] = [];
  const byName = new Map(input.fields.map((f) => [f.name, f]));
  for (const [name, h] of Object.entries(hints.fields ?? {})) {
    const f = byName.get(name);
    if (!f) {
      out.push(`startForm field "${name}" is not in the input ${input.name} (fields: ${input.fields.map((x) => x.name).join(", ")})`);
      continue;
    }
    if (h.enum && (f.type !== "string" || f.list)) out.push(`startForm field "${name}": enum needs a single string field, ${input.name}.${name} is ${describeType(f)}`);
    if (h.default !== undefined && validateOne(f, h.default)) out.push(`startForm field "${name}": default ${JSON.stringify(h.default)} ${validateOne(f, h.default)}`);
  }
  return out;
}

function validateOne(f: InputField, v: unknown): string | undefined {
  if (f.list) return typeof v === "string" ? undefined : "must be text (comma-separated values)";
  return validateEnvelope({ name: "default", fields: [{ ...f, optional: true }] }, { [f.name]: v })[0]?.message;
}

export function describeType(f: InputField): string {
  return `${f.list ? "list of " : ""}${f.type}${f.optional ? " (optional)" : ""}`;
}

/** Turn text from a form, a CLI flag or a prompt argument into the declared type:
 *  "42" → 42, "yes"/"true" → true, "a, b" → ["a", "b"]. Values already of the right
 *  kind pass through; what can't be converted is left as is for validation to report.
 *  Empty text for an optional field counts as absent. */
export function coerceInput(input: FlowInput, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const f of input.fields) {
    const v = raw[f.name];
    if (typeof v === "string" && v.trim() === "") {
      delete out[f.name];
      continue;
    }
    if (f.list) {
      const items = typeof v === "string" ? v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : v;
      out[f.name] = Array.isArray(items) ? items.map((x) => scalar(f.type, x)) : items;
    } else if (v !== undefined) out[f.name] = scalar(f.type, v);
  }
  return out;
}

function scalar(type: InputField["type"], v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (type === "integer" || type === "number") return s !== "" && Number.isFinite(Number(s)) ? Number(s) : v;
  if (type === "boolean") {
    if (/^(true|yes|y|on|1)$/i.test(s)) return true;
    if (/^(false|no|n|off|0)$/i.test(s)) return false;
  }
  return type === "string" ? v : s;
}

/** Coerce then check start variables against a flow's input. */
export function checkInput(input: FlowInput, raw: Record<string, unknown>): { variables: Record<string, unknown>; problems: InputProblem[] } {
  const variables = coerceInput(input, raw);
  return { variables, problems: validateEnvelope(input, variables) };
}

export function formatInputProblems(flowId: string, problems: InputProblem[]): string {
  return `invalid input for ${flowId}: ${problems.map((p) => (p.field ? `${p.field} ${p.message}` : p.message)).join("; ")}`;
}

/** A one-line description of the input, for agents: `pr: integer, note?: string`. */
export function describeInput(input: FlowInput): string {
  return input.fields.map((f) => `${f.name}${f.optional ? "?" : ""}: ${f.list ? `${f.type}[]` : f.type}`).join(", ");
}

function stripUndefined<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

/** `--pr 42 --repo=x note="a b" {"extra":1}` → variables (the engine converts the text to
 *  the input's types). A bare `--flag` is true. */
export function parseStartArgs(args: string[]): { variables: Record<string, unknown>; title?: string } {
  const variables: Record<string, unknown> = {};
  let title: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    let m: RegExpMatchArray | null;
    if (a.trim().startsWith("{")) {
      try {
        Object.assign(variables, JSON.parse(a));
      } catch {
        throw new Error(`variables must be JSON, got: ${a}`);
      }
    }
    else if ((m = a.match(/^--([A-Za-z_][\w-]*)(?:=(.*))?$/s))) {
      const value = m[2] ?? (args[i + 1] !== undefined && !args[i + 1].startsWith("--") ? args[++i] : true);
      if (m[1] === "title") title = String(value);
      else variables[m[1]] = value;
    } else if ((m = a.match(/^([A-Za-z_]\w*)=(.*)$/s))) variables[m[1]] = m[2];
    else throw new Error(`don't know what to do with "${a}": pass --field value, field=value or a JSON object`);
  }
  return { variables, title };
}
