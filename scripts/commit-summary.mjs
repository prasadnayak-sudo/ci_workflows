#!/usr/bin/env node
/**
 * commit-summary.mjs
 * Ek chhota summary block banata hai jo PR description mein jaata hai — aur
 * wahan se squash/merge commit ke message mein.
 *
 * Commit message ke liye jaan-boojh ke compact hai: koi mermaid graph nahi
 * (message mein render hota hi nahi) aur lambi file lists nahi. Poori report
 * PR comment mein alag se aati hai.
 *
 * Env:
 *   CHANGED_FILES  newline-separated changed files
 *   COMMIT_LINES   newline-separated commit subjects (optional)
 * Output: stdout pe plain markdown
 */
import {
  allDependents,
  buildGraph,
  dependentsIndex,
  isSource,
  isTest,
  short,
} from './lib/graph.mjs';

const lines = (value) =>
  (value || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const changed = lines(process.env.CHANGED_FILES);
const commits = lines(process.env.COMMIT_LINES);

const source = changed.filter(isSource);
const tests = changed.filter(isTest);

const out = [];

// Kya badla — commit subjects hi sabse seedha jawab hain.
if (commits.length) {
  out.push('What changed:');
  commits.slice(0, 15).forEach((c) => out.push(`- ${c}`));
  if (commits.length > 15) out.push(`- ...and ${commits.length - 15} more commits`);
  out.push('');
}

out.push(
  `Touches ${changed.length} file${changed.length === 1 ? '' : 's'}` +
    (source.length ? `, ${source.length} source` : '') +
    (tests.length ? `, ${tests.length} test` : '') +
    '.',
);

if (source.length) {
  try {
    const index = dependentsIndex(buildGraph());

    const ranked = source
      .map((file) => ({ file, total: allDependents(index, file).size }))
      .sort((a, b) => b.total - a.total);

    const affected = new Set();
    for (const file of source) allDependents(index, file).forEach((d) => affected.add(d));

    // Sabse zyada asar daalne wali files — inhi par revert/debug ke waqt nazar jaati hai.
    out.push('');
    out.push('Files changed (by blast radius):');
    ranked.slice(0, 8).forEach(({ file, total }) => {
      out.push(`- ${short(file)}${total ? ` (${total} dependents)` : ''}`);
    });
    if (ranked.length > 8) out.push(`- ...and ${ranked.length - 8} more`);

    if (affected.size > 0) {
      out.push('');
      out.push(`Blast radius: ${affected.size} file${affected.size === 1 ? '' : 's'} affected in total.`);
    }
  } catch {
    // Graph na bane to summary ke bina hi chalo — commit message rokna nahi hai.
    out.push('');
    out.push('Files changed:');
    source.slice(0, 8).forEach((f) => out.push(`- ${short(f)}`));
  }
}

console.log(out.join('\n'));
