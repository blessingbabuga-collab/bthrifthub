#!/usr/bin/env bun
/**
 * Fails when installed @tanstack/* router/start packages have unsatisfied
 * cross-dependencies (drift). This catches the class of failure that broke
 * `build:dev` after previous ad-hoc `bun update` runs.
 *
 * For each @tanstack/* package installed in node_modules, we read its
 * `dependencies` and `peerDependencies` entries that reference OTHER
 * `@tanstack/*` packages and verify the installed version satisfies the
 * declared range (semver).
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { satisfies } from "semver";

type Pkg = { name: string; version: string; dependencies?: Record<string, string>; peerDependencies?: Record<string, string> };

function readPkg(dir: string): Pkg | null {
  const p = join(dir, "package.json");
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function collectTanstackDirs(): string[] {
  const base = "node_modules/@tanstack";
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .map((d) => join(base, d))
    .filter((d) => statSync(d).isDirectory());
}

const dirs = collectTanstackDirs();
const installed = new Map<string, string>();
const pkgs: Pkg[] = [];
for (const d of dirs) {
  const pkg = readPkg(d);
  if (pkg?.name && pkg.version) {
    installed.set(pkg.name, pkg.version);
    pkgs.push(pkg);
  }
}

const problems: string[] = [];
for (const pkg of pkgs) {
  const check = (kind: "dependencies" | "peerDependencies") => {
    const block = pkg[kind] ?? {};
    for (const [dep, range] of Object.entries(block)) {
      if (!dep.startsWith("@tanstack/")) continue;
      const actual = installed.get(dep);
      if (!actual) continue; // optional peer not installed
      if (!satisfies(actual, range)) {
        problems.push(
          `${pkg.name}@${pkg.version} ${kind}["${dep}"] wants "${range}" but installed is ${actual}`,
        );
      }
    }
  };
  check("dependencies");
  check("peerDependencies");
}

const KEY = [
  "@tanstack/react-router", "@tanstack/react-start", "@tanstack/router-core",
  "@tanstack/router-plugin", "@tanstack/react-router-devtools", "@tanstack/router-devtools",
];
console.log("Installed key TanStack packages:");
for (const k of KEY) console.log(`  ${k.padEnd(40)} ${installed.get(k) ?? "<missing>"}`);

if (problems.length) {
  console.error(`\n✖ TanStack version drift (${problems.length} unsatisfied constraint${problems.length === 1 ? "" : "s"}):`);
  for (const p of problems) console.error("  - " + p);
  console.error("\nRun: bun add " + KEY.map((k) => `${k}@latest`).join(" "));
  process.exit(1);
}

console.log(`\n✓ All @tanstack/* cross-dependencies satisfied (${pkgs.length} packages checked)`);