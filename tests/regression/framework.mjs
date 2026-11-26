// Minimal dependency-free test framework for the Ground View regression suite.
//
// A test passes if its function returns, fails if it throws. Tests registered
// with level 'warn' report WARN instead of FAIL: they flag things that need
// attention but do not mean something is broken. `finding()` records an
// observation that is not a pass/fail check (for example "20 vulnerabilities").

import fs from 'node:fs';
import path from 'node:path';

export const results = [];
let currentSuite = 'general';

export function suite(name) {
  currentSuite = name;
  console.log(`\n=== ${name} ===`);
}

export async function test(name, fn, opts = {}) {
  const level = opts.level || 'fail'; // 'fail' | 'warn'
  const entry = { suite: currentSuite, name, status: 'pass', detail: '', level, severity: opts.severity || null };
  const started = Date.now();
  try {
    const out = await fn();
    if (typeof out === 'string') entry.detail = out;
  } catch (e) {
    entry.status = level === 'warn' ? 'warn' : 'fail';
    entry.detail = String(e && e.message ? e.message : e).slice(0, 400);
  }
  entry.ms = Date.now() - started;
  results.push(entry);
  const tag = entry.status === 'pass' ? 'PASS' : entry.status === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${tag}  ${name}${entry.detail ? '  [' + entry.detail + ']' : ''}`);
  return entry;
}

export function finding(severity, title, detail = '') {
  results.push({ suite: currentSuite, name: title, status: 'finding', detail, severity, level: 'finding', ms: 0 });
  console.log(`NOTE  (${severity}) ${title}${detail ? '  [' + detail + ']' : ''}`);
}

export function assert(cond, message) {
  if (!cond) throw new Error(message || 'assertion failed');
}

export async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

export function summary(outFile) {
  const count = (s) => results.filter((r) => r.status === s).length;
  const totals = { pass: count('pass'), fail: count('fail'), warn: count('warn'), finding: count('finding') };
  console.log('\n' + '='.repeat(60));
  console.log(`TOTAL  ${totals.pass} passed | ${totals.fail} failed | ${totals.warn} warnings | ${totals.finding} findings`);
  const bySuite = {};
  for (const r of results) {
    bySuite[r.suite] = bySuite[r.suite] || { pass: 0, fail: 0, warn: 0, finding: 0 };
    bySuite[r.suite][r.status]++;
  }
  for (const [s, c] of Object.entries(bySuite)) {
    console.log(`  ${s.padEnd(34)} pass ${String(c.pass).padStart(3)} | fail ${c.fail} | warn ${c.warn} | notes ${c.finding}`);
  }
  if (outFile) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({ ranAt: new Date().toISOString(), totals, results }, null, 2));
    console.log(`\nResults written to ${outFile}`);
  }
  return totals;
}
