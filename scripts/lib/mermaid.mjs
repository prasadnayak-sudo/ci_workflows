/**
 * Impact ka mermaid diagram banata hai.
 *
 * Do cheezein yahan jaan-boojh ke ki gayi hain:
 *
 * 1. Edges *asli* import edges hote hain. Pehle har dependent se changed file
 *    tak seedha arrow khinchta tha, jis se lagta tha ki main.tsx seedha
 *    board.ts import karta hai — jabki wo App.tsx ke through jaata hai.
 *    Ab chain waisi hi dikhti hai jaisi code mein hai.
 *
 * 2. Nodes layer ke hisaab se subgraph mein grouped hain, taaki architecture
 *    ek nazar mein dikhe aur arrows bayein se dayein "kaun kisko import karta
 *    hai" ki direction mein padhe jaayein.
 */
import { isTest, short } from './graph.mjs';

/** Layers, jis order mein diagram mein dikhni chahiye (importer pehle). */
const LAYER_ORDER = ['app', 'components', 'hooks', 'game', 'lib', 'types', 'other'];

const LAYER_TITLES = {
  app: 'app',
  components: 'components/',
  hooks: 'hooks/',
  game: 'game/ (pure logic)',
  lib: 'lib/ (helpers)',
  types: 'types/',
  other: 'baaki',
};

export function layerOf(file) {
  const match = /^src\/([^/]+)\//.exec(file);
  if (!match) return 'app';
  return LAYER_ORDER.includes(match[1]) ? match[1] : 'other';
}

/** Forward map: file -> jinko wo import karta hai. */
function importsIndex(graph) {
  const index = new Map();
  for (const mod of graph.modules) {
    index.set(mod.source, (mod.dependencies || []).map((d) => d.resolved));
  }
  return index;
}

/**
 * Changed files se shuru karke unke importers tak BFS — sabse kareebi pehle,
 * taaki cap lagne par bhi diagram ka sabse kaam ka hissa bacha rahe.
 */
function collectNodes(dependents, changed, maxNodes) {
  const nodes = new Set(changed);
  let frontier = [...changed];
  let truncated = false;

  while (frontier.length) {
    const next = [];
    for (const file of frontier) {
      for (const parent of dependents.get(file) || []) {
        if (nodes.has(parent)) continue;
        if (nodes.size >= maxNodes) {
          truncated = true;
          continue;
        }
        nodes.add(parent);
        next.push(parent);
      }
    }
    frontier = next;
  }

  return { nodes, truncated };
}

const escapeLabel = (text) => text.replace(/"/g, '#quot;');

/** File ka wo hissa jo label mein dikhega — layer subgraph se pata chal jaata hai. */
const nodeLabel = (file) => {
  const path = short(file);
  const parts = path.split('/');
  return escapeLabel(parts.length > 1 ? parts.slice(1).join('/') : path);
};

/**
 * @returns {string | null} mermaid block ka andar ka hissa, ya null agar
 * dikhane layak kuch na ho.
 */
export function buildMermaid({ graph, dependents, changed, maxNodes = 40 }) {
  // Test files diagram se bahar — unka count report ke text mein already hai,
  // aur diagram mein wo sirf ghana kar deti hain.
  const seeds = changed.filter((f) => !isTest(f));
  if (seeds.length === 0) return null;

  const { nodes: raw, truncated } = collectNodes(dependents, seeds, maxNodes);
  const nodes = new Set([...raw].filter((f) => !isTest(f)));
  if (nodes.size < 2) return null;

  const ids = new Map();
  [...nodes].forEach((file, i) => ids.set(file, `n${i}`));

  // Nodes ko layer ke hisaab se baanto.
  const byLayer = new Map();
  for (const file of nodes) {
    const layer = layerOf(file);
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer).push(file);
  }

  const lines = ['graph LR'];

  for (const layer of LAYER_ORDER) {
    const files = byLayer.get(layer);
    if (!files) continue;
    lines.push(`  subgraph sg_${layer}["${LAYER_TITLES[layer]}"]`);
    for (const file of files.sort()) {
      lines.push(`    ${ids.get(file)}["${nodeLabel(file)}"]`);
    }
    lines.push('  end');
  }

  // Sirf asli import edges, aur sirf un nodes ke beech jo diagram mein hain.
  const imports = importsIndex(graph);
  const edges = new Set();
  for (const file of nodes) {
    for (const dep of imports.get(file) || []) {
      if (nodes.has(dep)) edges.add(`  ${ids.get(file)} --> ${ids.get(dep)}`);
    }
  }
  const edgeNum = (line) => Number(line.trim().split(" ")[0].slice(1));
  lines.push(...[...edges].sort((a, b) => edgeNum(a) - edgeNum(b)));

  // Changed files highlight, test files alag dikhein.
  const changedIds = seeds.filter((f) => ids.has(f)).map((f) => ids.get(f));

  lines.push('  classDef changed stroke:#e3b341,stroke-width:3px;');
  if (changedIds.length) lines.push(`  class ${changedIds.join(',')} changed;`);

  return { body: lines.join('\n'), truncated, nodeCount: nodes.size };
}

/** Diagram ke saath ek chhoti legend, taaki padhne wale ko guess na karna pade. */
export const MERMAID_LEGEND =
  '**A --> B** means A imports B. ' +
  'Files with a yellow border are the ones this PR changed; test files are left out of the diagram.';
