#!/usr/bin/env node
/**
 * init.mjs
 * Kisi bhi repo mein caller workflow files likh deta hai.
 *
 *   npx github:OWNER/ci-workflows init
 *   node scripts/init.mjs --owner prasadnayak-sudo --ref v1 --branches main,dev
 *
 * Caller files jaan-boojh ke patli hain — unmein koi logic nahi, sirf ek
 * pointer. Logic badalne par ye files kabhi nahi badalti, isliye 10 repos
 * mein dobara jaana nahi padta.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = join(TOOLS_ROOT, 'templates');
const TARGET = join(process.cwd(), '.github', 'workflows');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const owner = arg('owner', 'prasadnayak-sudo');
const ref = arg('ref', 'v1');
const branches = arg('branches', 'main,dev')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean)
  .join(', ');
const force = process.argv.includes('--force');

if (!existsSync(TEMPLATES)) {
  console.error(`Templates nahi mile: ${TEMPLATES}`);
  process.exit(1);
}

mkdirSync(TARGET, { recursive: true });

let written = 0;
let skipped = 0;

for (const name of readdirSync(TEMPLATES)) {
  const destination = join(TARGET, name);

  if (existsSync(destination) && !force) {
    console.log(`skip   .github/workflows/${name} (pehle se hai — --force se overwrite karo)`);
    skipped += 1;
    continue;
  }

  const body = readFileSync(join(TEMPLATES, name), 'utf8')
    .replaceAll('__OWNER__', owner)
    .replaceAll('__REF__', ref)
    .replaceAll('__BASE_BRANCHES__', branches);

  writeFileSync(destination, body);
  console.log(`write  .github/workflows/${name}`);
  written += 1;
}

console.log(`\n${written} likhi, ${skipped} chhodi.`);
if (written > 0) {
  console.log(`\nAage:\n  1. git add .github/workflows && git commit && git push`);
  console.log(`  2. Settings > Rules mein "tests" ko required check banao`);
  console.log(`  3. COPILOT_PAT secret add karo (Copilot prose chahiye to)`);
}
