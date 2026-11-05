// The web explorer page. Built by scripts/build.mjs into dist/explorer.html; in dev the
// stub below is served until then.
import fs from "node:fs";

let cached: string | undefined;
export function explorerHtml(): string {
  if (cached) return cached;
  for (const rel of ["./explorer.html", "../dist/explorer.html"]) {
    const u = new URL(rel, import.meta.url);
    if (fs.existsSync(u)) return (cached = fs.readFileSync(u, "utf8"));
  }
  return "<!doctype html><title>Agent Graph Engine</title><p>Explorer not built — run <code>npm run build</code>. API: <a href=/api/state>/api/state</a>";
}
