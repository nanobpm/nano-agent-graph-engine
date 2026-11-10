// Type-check flow files with the kit in dist/typecheck (TypeScript, ES libs, Node types,
// and the declarations of agent-graph-engine + @nanobpm/workflow). The engine loads flows
// with types stripped, so without this a flow with a type error deploys and fails at run
// time — or worse, runs with the wrong data. `nage check`, flow_check and flow_write run it.
import { ENGINE_SPECIFIERS } from "./resolve-hook.ts";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { Problem } from "./compile.ts";

/** Where the kit is: next to the bundle (dist/typecheck), or dist/ when running from src. */
export function typecheckKit(): string | undefined {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const dir of [path.join(here, "typecheck"), path.join(here, "..", "dist", "typecheck")])
    if (fs.existsSync(path.join(dir, "ts.cjs"))) return dir;
  return undefined;
}

let tsCache: any;
function loadTs(kit: string): any {
  return (tsCache ??= createRequire(path.join(kit, "ts.cjs"))("./ts.cjs"));
}

export interface TypeProblem extends Problem {
  file: string;
  line: number;
  column: number;
  code: number;
}

/** Type-check the TypeScript flow files given (and what they import from the project).
 *  Returns problems per checked file, or undefined when the kit isn't there. */
export function typecheckFlows(files: string[]): Map<string, TypeProblem[]> | undefined {
  const kit = typecheckKit();
  if (!kit) return undefined;
  const roots = files.filter((f) => /\.(ts|mts)$/.test(f)).map((f) => path.resolve(f));
  const out = new Map<string, TypeProblem[]>(roots.map((f) => [f, []]));
  if (!roots.length) return out;
  const ts = loadTs(kit);
  const options = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    lib: ["lib.es2023.d.ts"],
    types: ["node"],
    typeRoots: [path.join(kit, "node_modules", "@types")],
    // The engine's import names resolve to the kit, like the engine's resolve hook.
    paths: Object.fromEntries(ENGINE_SPECIFIERS.map((s) => [s, [path.join(kit, "agent-graph-engine", "index.d.ts")]])),
  };
  const program = ts.createProgram(roots, options);
  const diags = [...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics(), ...program.getGlobalDiagnostics()];
  for (const d of diags) {
    const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (!d.file) {
      for (const list of out.values()) list.push({ severity: "error", message: `TS${d.code}: ${message}`, file: "", line: 0, column: 0, code: d.code });
      continue;
    }
    const file = path.resolve(d.file.fileName);
    if (file.startsWith(kit) || file.includes(`${path.sep}node_modules${path.sep}`)) continue;
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    // A problem in an imported project module is reported once, with the first flow.
    const owners = out.has(file) ? [file] : [roots[0]];
    const where = path.relative(path.dirname(path.dirname(owners[0])), file) || path.basename(file);
    for (const o of owners)
      out.get(o)!.push({
        severity: d.category === ts.DiagnosticCategory.Error ? "error" : "warning",
        message: `${where}:${line + 1}:${character + 1} TS${d.code}: ${message}`,
        file,
        line: line + 1,
        column: character + 1,
        code: d.code,
      });
  }
  return out;
}
