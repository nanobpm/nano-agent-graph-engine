import type { FormDef } from "./index.ts";
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
    fields?: Record<string, {
        title?: string;
        description?: string;
        enum?: string[];
        enumNames?: string[];
        default?: string | number | boolean;
        minimum?: number;
        maximum?: number;
    }>;
}
export interface InputProblem {
    field: string;
    message: string;
}
/** The start form for an input: one form field per input field. A list field is a
 *  text field taking comma- or newline-separated values; a datetime is a date-time
 *  string. Hints add titles, descriptions, choices and defaults. */
export declare function inputForm(input: FlowInput, hints?: StartFormHints): FormDef;
/** Problems with the hints themselves, for the authoring check. */
export declare function hintProblems(input: FlowInput | undefined, hints: StartFormHints | undefined): string[];
export declare function describeType(f: InputField): string;
/** Turn text from a form, a CLI flag or a prompt argument into the declared type:
 *  "42" → 42, "yes"/"true" → true, "a, b" → ["a", "b"]. Values already of the right
 *  kind pass through; what can't be converted is left as is for validation to report.
 *  Empty text for an optional field counts as absent. */
export declare function coerceInput(input: FlowInput, raw: Record<string, unknown>): Record<string, unknown>;
/** Coerce then check start variables against a flow's input. */
export declare function checkInput(input: FlowInput, raw: Record<string, unknown>): {
    variables: Record<string, unknown>;
    problems: InputProblem[];
};
export declare function formatInputProblems(flowId: string, problems: InputProblem[]): string;
/** A one-line description of the input, for agents: `pr: integer, note?: string`. */
export declare function describeInput(input: FlowInput): string;
/** `--pr 42 --repo=x note="a b" {"extra":1}` → variables (the engine converts the text to
 *  the input's types). A bare `--flag` is true. */
export declare function parseStartArgs(args: string[]): {
    variables: Record<string, unknown>;
    title?: string;
};
