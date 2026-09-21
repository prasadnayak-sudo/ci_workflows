#!/usr/bin/env node
/**
 * merge-summary.mjs
 * Merge ke baad ki summary: kya merge hua, merged code abhi bhi green hai ya
 * nahi, import graph theek hai ya nahi, aur blast radius kitna tha.
 *
 * Ye hissa deterministic hai — AI ke bina bhi hamesha chalega.
 *
 * Env:
 *   CHANGED_FILES  newline-separated files (git diff se)
 *   COMMIT_LINES   newline-separated commit subjects
 *   PR_NUMBER, PR_TITLE, PR_AUTHOR, BASE_REF
 *   CHECK_TS, CHECK_LINT, CHECK_TEST   exit codes ("0" = pass)
 *   TEST_TOTALS, CHECK_DETAIL          verification ki detail
 * Output: stdout pe markdown (English)
 */
import {
  allDependents,
  buildGraph,
  dependentsIndex,
  errorDetail,
  importHealth,
  isSource,
  isTest,
  short,
} from './lib/graph.mjs';
import { MERMAID_LEGEND, buildMermaid } from './lib/mermaid.mjs';

const FENCE = String.fromCharCode(96, 96, 96);
const TICK = String.fromCharCode(96);

const lines = (value) =>
  (value || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const changed = lines(process.env.CHANGED_FILES);
const commits = lines(process.env.COMMIT_LINES);

const pr = {
  number: process.env.PR_NUMBER || '',
  title: process.env.PR_TITLE || '(untitled)',
  author: process.env.PR_AUTHOR || 'unknown',
  base: process.env.BASE_REF || 'unknown',
};

const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
const code = (text) => TICK + text + TICK;

/** Files ko category mein baant deta hai, taaki ek nazar mein shape dikhe. */
function categorise(files) {
  const buckets = { source: [], test: [], style: [], ci: [], config: [], other: [] };
  for (const file of files) {
    if (isTest(file)) buckets.test.push(file);
    else if (isSource(file)) buckets.source.push(file);
    else if (/\.css$/.test(file)) buckets.style.push(file);
    else if (file.startsWith('.github/')) buckets.ci.push(file);
    else if (/^(package(-lock)?\.json|tsconfig.*\.json|\.?dependency-cruiser\.|eslint|vite\.config)/.test(file))
      buckets.config.push(file);
    else buckets.other.push(file);
  }
  return buckets;
}

const buckets = categorise(changed);

let md = '## 🧾 Merge Summary\n\n';
md += pr.number
  ? '**PR #' + pr.number + '** — ' + pr.title + '\n\nMerged into ' + code(pr.base) + ' by @' + pr.author + '.\n\n'
  : 'Merged into ' + code(pr.base) + '.\n\n';

md += '**' + plural(commits.length, 'commit') + '**, **' + plural(changed.length, 'file') + ' changed**.\n\n';

if (commits.length) {
  md += '<details><summary>Commits</summary>\n\n';
  commits.slice(0, 30).forEach((c) => (md += '- ' + c + '\n'));
  if (commits.length > 30) md += '- _...and ' + (commits.length - 30) + ' more_\n';
  md += '\n</details>\n\n';
}

const shape = Object.entries(buckets)
  .filter(([, files]) => files.length > 0)
  .map(([name, files]) => files.length + ' ' + name)
  .join(' · ');
if (shape) md += '**Breakdown:** ' + shape + '\n\n';

// Checks merged code par dobara chalte hain. PR green tha iska matlab nahi ki
// merge ke baad bhi green hai — base uske neeche se badal chuka hota hai.
const CHECKS = [
  { name: 'TypeScript', exit: process.env.CHECK_TS, hint: code('npx tsc -b') },
  { name: 'Lint', exit: process.env.CHECK_LINT, hint: code('npm run lint') },
  { name: 'Tests', exit: process.env.CHECK_TEST, hint: process.env.TEST_TOTALS || code('npm test') },
];

const ran = CHECKS.filter((c) => c.exit !== undefined && c.exit !== '');

if (ran.length) {
  const failed = ran.filter((c) => c.exit !== '0');

  md += '### ' + (failed.length ? '❌' : '✅') + ' Verification\n\n';
  md += '| Check | Result | Detail |\n|---|---|---|\n';
  ran.forEach((c) => {
    md += '| ' + c.name + ' | ' + (c.exit === '0' ? '✅ pass' : '❌ fail') + ' | ' + c.hint + ' |\n';
  });
  md += '\n';

  const detail = (process.env.CHECK_DETAIL || '').trim();
  if (failed.length && detail) {
    md += '<details><summary>What failed</summary>\n\n';
    md += FENCE + '\n' + detail + '\n' + FENCE + '\n\n';
    md += '</details>\n\n';
  }
  if (failed.length) {
    md += '> ⚠️ **This is broken on ' + code(pr.base) + ' right now.** It passed on the PR, so the base moved under it.\n\n';
  }
}

// Blast radius — sirf tab jab source files badli hon.
const changedSource = changed.filter(isSource);

if (changedSource.length === 0) {
  md += '_No source files changed — nothing to analyse for dependency impact._\n';
} else {
  try {
    const graph = buildGraph();
    const index = dependentsIndex(graph);

    const ranked = changedSource
      .map((file) => {
        const deps = allDependents(index, file);
        return { file, total: deps.size, tests: [...deps].filter(isTest).length };
      })
      .sort((a, b) => b.total - a.total);

    const affected = new Set();
    for (const file of changedSource) {
      allDependents(index, file).forEach((d) => affected.add(d));
    }

    md += '### 💥 Blast radius\n\n';
    md += '**' + affected.size + '** unique file' + (affected.size === 1 ? '' : 's') + ' affected by this merge.\n\n';
    md += '| Changed file | Files affected | Tests in chain |\n|---|---|---|\n';
    ranked.slice(0, 10).forEach(({ file, total, tests }) => {
      md += '| ' + code(short(file)) + ' | ' + total + ' | ' + (tests || '—') + ' |\n';
    });
    if (ranked.length > 10) md += '\n_...and ' + (ranked.length - 10) + ' more files._\n';
    md += '\n';

    const diagram = buildMermaid({ graph, dependents: index, changed: changedSource });
    if (diagram) {
      md += '### 🕸️ How it all connects\n\n';
      md += MERMAID_LEGEND + '\n\n';
      md += FENCE + 'mermaid\n' + diagram.body + '\n' + FENCE + '\n\n';
      if (diagram.truncated) {
        md += '_Only ' + diagram.nodeCount + ' files are shown — the rest were trimmed to keep the diagram readable._\n\n';
      }
    }

    // Import-level problems compile bhi ho jaate hain aur tests bhi pass kar
    // lete hain — inhe sirf graph pakadta hai.
    const health = importHealth(graph);
    const healthRows = [
      ['Circular imports', health.circular.map((c) => short(c.from) + ' → ' + short(c.to))],
      ['Unresolved imports', health.unresolved.map((c) => short(c.from) + ' → ' + c.to)],
      ['Orphan modules', health.orphans.map(short)],
    ];

    md += '### 🔗 Import health\n\n';
    if (healthRows.every(([, items]) => items.length === 0)) {
      md += 'No circular imports, no unresolved imports, no orphan modules.\n\n';
    } else {
      md += '| Issue | Count |\n|---|---|\n';
      healthRows.forEach(([label, items]) => {
        md += '| ' + label + ' | ' + (items.length === 0 ? '—' : items.length) + ' |\n';
      });
      md += '\n';
      healthRows
        .filter(([, items]) => items.length > 0)
        .forEach(([label, items]) => {
          md += '**' + label + ':**\n';
          items.slice(0, 8).forEach((item) => (md += '- ' + code(item) + '\n'));
          if (items.length > 8) md += '- _...and ' + (items.length - 8) + ' more_\n';
          md += '\n';
        });
    }

    const risky = ranked.filter((r) => r.total >= 10 && r.tests === 0);
    if (risky.length) {
      md += '> ⚠️ **Worth a second look:** these have a wide blast radius but no tests in their chain —\n';
      risky.slice(0, 5).forEach((r) => (md += '> ' + code(short(r.file)) + ' (' + r.total + ' files)\n'));
      md += '\n';
    }
  } catch (e) {
    const detail = errorDetail(e);
    console.error(detail);
    md += '### 💥 Blast radius\n\n';
    md += '⚠️ Could not build the dependency graph.\n\n';
    md += '<details><summary>Actual error</summary>\n\n' + FENCE + '\n' + detail + '\n' + FENCE + '\n\n</details>\n\n';
  }
}

console.log(md);
