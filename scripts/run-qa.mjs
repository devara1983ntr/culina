#!/usr/bin/env node
/**
 * CULINA — E2E runner with a single, loudly-logged infra retry.
 *
 * The suite itself is deterministic; on a 2 GB single-process sandbox the
 * headless browser occasionally dies mid-run (Target page/browser closed) or
 * NS_ERROR_* surfaces — environmental noise, not product failures. This
 * wrapper re-runs the FULL suite once when (and only when) every failure
 * matches those infrastructure patterns. Assertion failures never trigger a
 * retry. The retry is printed, never silent.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SUITE = join(fileURLToPath(new URL('.', import.meta.url)), 'browser-qa.mjs');

const INFRA = /Target page, context or browser has been closed|browserContext\.newPage|NS_ERROR|page\.crash|Target closed/i;

function run() {
  return new Promise((resolve) => {
    const child = spawn('node', [SUITE, ...process.argv.slice(2)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      process.stdout.write(d);
    });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

const first = await run();
if (first.code === 0) process.exit(0);

const fails = [...first.out.matchAll(/  ✗[^\n]*/g)].map((m) => m[0].trim());
// zero reported failures + nonzero exit = the suite died before reporting → infra class
const infraOnly = fails.every((f) => INFRA.test(f));

if (!infraOnly) {
  console.log('\n[run-qa] failures include real assertions — no retry.');
  process.exit(first.code ?? 1);
}

console.log(`\n[run-qa] ${fails.length} infrastructure failure(s): ${fails.map((f) => f.slice(2, 70)).join(' | ')}`);
console.log('[run-qa] re-running the complete suite once (retry is logged, never silent)…\n');
const second = await run();
process.exit(second.code ?? 1);
