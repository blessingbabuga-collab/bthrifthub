#!/usr/bin/env bun
/**
 * Fails if installed @tanstack/react-router*, @tanstack/router-*, and
 * @tanstack/react-start packages drift to incompatible minor versions.
 *
 * The TanStack Start ↔ Router packages share an internal ABI and MUST stay
 * on the same minor. A drift here previously broke `build:dev`.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const GROUP = [
  "@tanstack/react-router",
  "@tanstack/react-router-devtools",
  "@tanstack/react-start",
  "@tanstack/router-core",
  "@tanstack/router-devtools",
  "@tanstack/router-plugin",
];

function installedVersion(pkg: string): string | null {
  const p = join("node_modules", ...pkg.split("/"), "package.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")).version as string;
}

function minor(v: string) {
  const [maj, min] = v.split(".");
  return `${maj}.${min}`;
}

const rows = GROUP.map((name) => ({ name, version: installedVersion(name) }));
const missing = rows.filter((r) => !r.version);
if (missing.length) {
  console.error("Missing TanStack packages:", missing.map((m) => m.name).join(", "));
  process.exit(1);
}

const minors = new Set(rows.map((r) => minor(r.version!)));
console.log("TanStack package versions:");
for (const r of rows) console.log(`  ${r.name.padEnd(40)} ${r.version}`);

if (minors.size > 1) {
  console.error(
    `\n✖ TanStack router/start version drift detected across minors: ${[...minors].join(", ")}`,
  );
  console.error("  Run: bun update " + GROUP.join(" "));
  process.exit(1);
}

console.log(`\n✓ All TanStack router/start packages aligned on minor ${[...minors][0]}`);