#!/usr/bin/env node
/**
 * impact-report.mjs
 * PR mein jo files change hui, unko kaun import karta hai (direct + indirect)
 * wo nikaal ke ek markdown report + graph banata hai, jo PR pe comment hota hai.
 *
 * Env: CHANGED_FILES -> newline-separated changed files (git diff se)
 * Output: stdout pe markdown (English)
 */
import {
  allDependents,
  buildGraph,
  dependentsIndex,
  errorDetail,
  isSource,
  isTest,
  short,
} from './lib/graph.mjs';
import { MERMAID_LEGEND, buildMermaid } from './lib/mermaid.mjs';

const changed = (process.env.CHANGED_FILES || '')
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean)
  .filter(isSource);

if (changed.length === 0) {
  console.log('_No source files (.ts/.tsx/.js/.jsx) changed — impact analysis skipped._');
  process.exit(0);
}

let graph;
try {
  graph = buildGraph();
} catch (e) {
  // Asli wajah PR comment aur CI log dono mein dikhao, warna debug karna namumkin hai.
  const detail = errorDetail(e);
  console.error(detail);
  console.log('⚠️ Could not build the dependency graph. Check the depcruise install and config.');
  console.log('');
  console.log('<details><summary>Actual error</summary>');
  console.log('');
  console.log('```');
  console.log(detail);
  console.log('```');
  console.log('');
  console.log('</details>');
  process.exit(0);
}

const index = dependentsIndex(graph);

let md = '## 🔎 PR Impact Analysis\n\n';
md += `This PR changes **${changed.length}** source file${changed.length === 1 ? '' : 's'}. Verify the areas below before merging.\n\n`;

// Sabse bade blast radius wali file upar — wahi sabse zyada dhyaan maangti hai.
const ranked = changed
  .map((file) => {
    const deps = allDependents(index, file);
    return {
      file,
      deps,
      tests: [...deps].filter(isTest),
      nonTests: [...deps].filter((d) => !isTest(d)),
    };
  })
  .sort((a, b) => b.deps.size - a.deps.size);

const globalAffected = new Set();
const isolated = [];

for (const { file, deps, tests, nonTests } of ranked) {
  deps.forEach((d) => globalAffected.add(d));

  if (deps.size === 0) {
    isolated.push(file);
    continue;
  }

  md += `### \`${short(file)}\`\n`;
  md += `- **${nonTests.length}** file${nonTests.length === 1 ? '' : 's'} affected directly or indirectly\n`;
  nonTests.slice(0, 12).forEach((d) => (md += `  - \`${short(d)}\`\n`));
  if (nonTests.length > 12) md += `  - _...and ${nonTests.length - 12} more_\n`;
  if (tests.length) {
    md += `- 🧪 **${tests.length}** test file${tests.length === 1 ? '' : 's'} in this chain — make sure they pass\n`;
  }
  md += '\n';
}

// Isolated files ko ek line mein samet do, warna wo asli impact ko dabaa deti hain.
if (isolated.length) {
  md += `### ✅ Isolated changes (${isolated.length})\n\n`;
  md += 'Nothing imports these: ';
  md += isolated.map((f) => `\`${short(f)}\``).join(', ');
  md += '\n\n';
}

const diagram = buildMermaid({ graph, dependents: index, changed });
if (diagram) {
  md += '### 🕸️ Dependency graph\n\n';
  md += MERMAID_LEGEND + '\n\n';
  md += '```mermaid\n' + diagram.body + '\n```\n\n';
  if (diagram.truncated) {
    md += `_Only ${diagram.nodeCount} files are shown — the rest were trimmed to keep the diagram readable._\n\n`;
  }
}

md += '---\n';
md += `**Total unique files affected:** ${globalAffected.size}\n\n`;
if (globalAffected.size > 40) {
  md += '> ⚠️ **Large blast radius (40+ files)** — review with extra care.\n\n';
}
md += '_Automated analysis. Read it alongside the Copilot review, not instead of it._';

console.log(md);
