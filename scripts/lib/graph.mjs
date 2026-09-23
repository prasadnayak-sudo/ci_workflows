/**
 * dependency-cruiser ka graph banane aur "kaun kisko import karta hai" nikaalne
 * wali shared logic. impact-report (PR pe) aur merge-summary (merge ke baad)
 * dono yahi use karte hain, taaki dono ek hi jawab dein.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Config ka naam branch ke hisaab se alag ho sakta hai (dotted/undotted).
export const CONFIG_CANDIDATES = [
  '.dependency-cruiser.cjs',
  'dependency-cruiser.cjs',
  '.dependency-cruiser.js',
  '.dependency-cruiser.json',
];

export const findConfig = () => CONFIG_CANDIDATES.find((f) => existsSync(f));

export const isTest = (f) =>
  /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f) || f.includes('__tests__');

export const short = (f) => f.replace(/^src\//, '');

export const isSource = (f) =>
  /\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('node_modules');

/** Graph banata hai. Fail hone pe asli wajah ke saath throw karta hai. */
export function buildGraph() {
  const config = findConfig();
  if (!config) {
    throw new Error(
      `Koi dependency-cruiser config nahi mila. Dhoonda: ${CONFIG_CANDIDATES.join(', ')}`
    );
  }
  const out = execSync(
    `npx depcruise src --config ${config} --output-type json`,
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 }
  );
  return JSON.parse(out);
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

/** Error object se padhne layak detail nikaalta hai. */
export function errorDetail(e, limit = 2000) {
  return [e.message, e.stderr, e.stdout].filter(Boolean).join('\n').slice(0, limit);
}
