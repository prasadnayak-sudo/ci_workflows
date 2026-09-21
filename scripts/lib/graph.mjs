/**
 * dependency-cruiser ka graph banane aur "kaun kisko import karta hai" nikaalne
 * wali shared logic.
 *
 * Ye scripts consumer repo ke andar se chalti hain, par install central repo
 * (.ci-tools) mein hota hai. Isliye binary aur default config dono yahin se
 * resolve hote hain — consumer repo mein depcruise add karne ki zaroorat nahi.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** .../ci-tools/  — is file se do level upar. */
const TOOLS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Consumer repo apna config rakh sakta hai; warna hamara default chalta hai. */
export const CONFIG_CANDIDATES = [
  '.dependency-cruiser.cjs',
  'dependency-cruiser.cjs',
  '.dependency-cruiser.js',
  '.dependency-cruiser.json',
];

export function findConfig() {
  const local = CONFIG_CANDIDATES.find((f) => existsSync(f));
  if (local) return local;

  const fallback = join(TOOLS_ROOT, '.dependency-cruiser.cjs');
  return existsSync(fallback) ? fallback : null;
}

/**
 * Shim (node_modules/.bin/depcruise) ke bajay CLI ka .mjs seedha node se
 * chalate hain — wo shim Windows par extension-less hota hai aur spawn nahi
 * hota, aur .cmd ke liye shell chahiye. Package ka apna entry dono par ek jaisa
 * chalta hai.
 */
function depcruiseEntry() {
  const entry = join(
    TOOLS_ROOT,
    'node_modules',
    'dependency-cruiser',
    'bin',
    'dependency-cruiser.mjs',
  );
  if (!existsSync(entry)) {
    throw new Error(
      `dependency-cruiser nahi mila (${entry}). ${TOOLS_ROOT} mein "npm ci" chala hai ya nahi, wo check karo.`,
    );
  }
  return entry;
}

export const isTest = (f) =>
  /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f) || f.includes('__tests__');

export const short = (f) => f.replace(/^src\//, '');

export const isSource = (f) =>
  /\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('node_modules');

/**
 * Graph banata hai. Fail hone pe asli wajah ke saath throw karta hai.
 * @param {{ sourceDir?: string }} options
 */
export function buildGraph({ sourceDir = process.env.SOURCE_DIR || 'src' } = {}) {
  const config = findConfig();
  if (!config) {
    throw new Error(
      `Koi dependency-cruiser config nahi mila. Dhoonda: ${CONFIG_CANDIDATES.join(', ')} ` +
        `aur ${join(TOOLS_ROOT, '.dependency-cruiser.cjs')}`,
    );
  }
  if (!existsSync(sourceDir)) {
    throw new Error(
      `Source directory "${sourceDir}" maujood nahi. Caller workflow mein source-dir input set karo.`,
    );
  }

  const out = execFileSync(
    process.execPath,
    [depcruiseEntry(), sourceDir, '--config', config, '--output-type', 'json'],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 },
  );

  const graph = JSON.parse(out);

  // Empty graph ka matlab report "kuch bhi kisi ko import nahi karta" bol degi,
  // jo bilkul jhoot hota hai. Ye chup-chaap tab hota hai jab dependency-cruiser
  // source parse hi na kar paaye — jaise TypeScript ka aisa major jise wo abhi
  // support nahi karta. Isliye yahin rok do.
  if (!graph.modules || graph.modules.length === 0) {
    throw new Error(
      `dependency-cruiser ne "${sourceDir}" mein ek bhi module nahi paaya. ` +
        'Graph khaali hai, isliye blast radius bhi jhooth hoga. ' +
        'Aksar iski wajah TypeScript version ka mismatch hoti hai ' +
        '(depcruise 18.x TypeScript 7 par chup-chaap 0 modules deta hai) ' +
        `ya galat source-dir. Config: ${config}`,
    );
  }

  return graph;
}

/** Reverse index: file -> usko seedha import karne waale. */
export function dependentsIndex(graph) {
  const index = new Map();
  for (const mod of graph.modules) {
    for (const dep of mod.dependencies || []) {
      if (!index.has(dep.resolved)) index.set(dep.resolved, new Set());
      index.get(dep.resolved).add(mod.source);
    }
  }
  return index;
}

/** Direct + indirect dependents (BFS). */
export function allDependents(index, file) {
  const seen = new Set();
  const queue = [file];
  while (queue.length) {
    const cur = queue.shift();
    for (const parent of index.get(cur) || []) {
      if (!seen.has(parent)) {
        seen.add(parent);
        queue.push(parent);
      }
    }
  }
  return seen;
}

/**
 * Import graph ki sehat. Ye teeno cheezein compile ho jaati hain aur tests bhi
 * pass kar leti hain — pakad sirf graph se aati hai.
 *
 * - circular: A -> B -> A. Runtime par aadha-initialised module deta hai.
 * - unresolved: import likha hai, file milti nahi.
 * - orphan: na koi import karta hai, na ye kisi ko. Aksar bhoola hua dead code.
 */
export function importHealth(graph) {
  const circular = [];
  const unresolved = [];

  for (const mod of graph.modules) {
    for (const dep of mod.dependencies || []) {
      if (dep.circular) circular.push({ from: mod.source, to: dep.resolved });
      if (dep.couldNotResolve) unresolved.push({ from: mod.source, to: dep.module });
    }
  }

  const orphans = graph.modules.filter((m) => m.orphan).map((m) => m.source);

  return { circular, unresolved, orphans };
}

/** Error object se padhne layak detail nikaalta hai. */
export function errorDetail(e, limit = 2000) {
  return [e.message, e.stderr, e.stdout].filter(Boolean).join('\n').slice(0, limit);
}
