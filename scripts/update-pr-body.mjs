#!/usr/bin/env node
/**
 * update-pr-body.mjs
 * PR description mein summary ka block daalta/refresh karta hai.
 *
 * Block markers ke beech rehta hai, isliye har run par wahi hissa badalta hai
 * aur user ka likha hua description bacha rehta hai.
 *
 * Env: PR_BODY (maujooda description), SUMMARY (block ka content)
 * Output: stdout pe naya description
 */
const START = '<!-- impact-summary:start -->';
const END = '<!-- impact-summary:end -->';

const body = (process.env.PR_BODY || '').replace(/\r\n/g, '\n');
const summary = (process.env.SUMMARY || '').trim();

const block = [START, summary, END].join('\n');

const start = body.indexOf(START);
const end = body.indexOf(END);

let next;
if (start !== -1 && end !== -1 && end > start) {
  next = body.slice(0, start) + block + body.slice(end + END.length);
} else {
  // Pehli baar: description ke aakhir mein jodo.
  next = body.trim() ? `${body.trim()}\n\n${block}` : block;
}

console.log(next);
