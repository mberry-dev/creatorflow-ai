// CreatorFlow AI eval runner.
//
// Sends every case in cases.json through the real Express app (server.js),
// runs the pass/fail checks in checks.js, prints a score, and saves the
// full outputs to evals/results/ so you can compare prompt versions.
//
// Run from the backend/ folder:
//   npm run eval -- --mock            free dry run (no OpenAI calls)
//   npm run eval -- --label v1        real run with the key in backend/.env
//   npm run eval -- --label v1 --yes  same, without the cost prompt
//   npm run eval -- --only T1,D4      run just some cases
//
// Live runs use gpt-4o-mini (the model in server.js). 20 cases cost about 1 cent.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { Completions } from 'openai/resources/chat/completions';
import { runChecks } from './checks.js';

const EVALS_DIR = path.dirname(fileURLToPath(import.meta.url));

// gpt-4o-mini prices in US dollars per 1 million tokens (OpenAI pricing page).
// Update these if you change the model in server.js.
const PRICE_INPUT_PER_M = 0.15;
const PRICE_OUTPUT_PER_M = 0.60;

// ---------- Command-line options ----------
const args = process.argv.slice(2);
const opt = (name) => args.includes(`--${name}`);
const optValue = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const MOCK = opt('mock');
const LABEL = optValue('label') || (MOCK ? 'dryrun' : 'run');
const ONLY = optValue('only')?.split(',').map((s) => s.trim().toUpperCase());

// ---------- Load cases ----------
let cases = JSON.parse(fs.readFileSync(path.join(EVALS_DIR, 'cases.json'), 'utf8'));
if (ONLY) cases = cases.filter((c) => ONLY.includes(c.id.toUpperCase()));
for (const c of cases) {
  if (c.repeatTopic) c.body = { ...c.body, topic: c.body.topic.repeat(c.repeatTopic).trim() };
}

// ---------- Set up the app ----------
process.env.NODE_ENV = 'test';           // server.js won't start listening on a port
process.env.DOTENV_CONFIG_QUIET = 'true';
if (MOCK) process.env.OPENAI_API_KEY = ''; // forces Mock Mode; dotenv won't overwrite it

// Count OpenAI calls, errors and tokens without changing server.js.
const usage = { calls: 0, errors: 0, inputTokens: 0, outputTokens: 0, lastError: '' };
const originalCreate = Completions.prototype.create;
Completions.prototype.create = function (...callArgs) {
  usage.calls += 1;
  return originalCreate.apply(this, callArgs).then(
    (completion) => {
      usage.inputTokens += completion.usage?.prompt_tokens || 0;
      usage.outputTokens += completion.usage?.completion_tokens || 0;
      return completion;
    },
    (error) => {
      usage.errors += 1;
      usage.lastError = error.message;
      throw error;
    }
  );
};

const { default: app } = await import('../server.js');
const health = await request(app).get('/api/health');
const mode = health.body.mode; // 'live' or 'mock'

const cost = (inTok, outTok) => (inTok * PRICE_INPUT_PER_M + outTok * PRICE_OUTPUT_PER_M) / 1e6;

console.log(`\nCreatorFlow AI evals: ${cases.length} cases, label "${LABEL}", mode: ${mode.toUpperCase()}`);

if (mode === 'mock') {
  console.log('Mock Mode: no OpenAI calls, no cost. Outputs are canned, so this checks the');
  console.log('eval plumbing only. The score is NOT a measure of AI quality.\n');
} else {
  // Generous upper bound: about 800 input and 600 output tokens per call.
  const estimate = cost(cases.length * 800, cases.length * 600);
  console.log(`Live mode: up to ${cases.length} calls to gpt-4o-mini. Estimated cost: at most $${estimate.toFixed(3)}.`);
  if (!opt('yes')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Continue? (y/N) ');
    rl.close();
    if (answer.trim().toLowerCase() !== 'y') {
      console.log('Cancelled. Nothing was sent.');
      process.exit(0);
    }
  }
  console.log('');
}

// ---------- Run ----------
const results = [];
for (const testCase of cases) {
  const before = { ...usage };
  const started = Date.now();
  const res = await request(app).post(`/api/generate/${testCase.endpoint}`).send(testCase.body);
  const ms = Date.now() - started;

  const checks = runChecks(testCase, res);

  // In live mode, server.js quietly switches to canned output when OpenAI fails.
  // That output must not count as a pass.
  const openaiFailed = mode === 'live' && usage.errors > before.errors;
  if (openaiFailed) {
    checks.push({ check: 'liveAI', pass: false, detail: `OpenAI error, app fell back to mock output: ${usage.lastError}` });
  }

  const pass = checks.every((c) => c.pass);
  results.push({
    id: testCase.id,
    name: testCase.name,
    endpoint: testCase.endpoint,
    group: testCase.expectReject ? 'validation' : testCase.endpoint,
    input: testCase.body,
    pass,
    ms,
    openaiCalls: usage.calls - before.calls,
    checks,
    output: res.body
  });

  const failed = checks.filter((c) => !c.pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${testCase.id.padEnd(3)} ${testCase.name}`);
  for (const f of failed) console.log(`        x ${f.check}${f.detail ? `: ${f.detail}` : ''}`);
}

// ---------- Summary ----------
const passed = results.filter((r) => r.pass).length;
const byEndpoint = {};
for (const r of results) {
  byEndpoint[r.group] ??= { passed: 0, total: 0 };
  byEndpoint[r.group].total += 1;
  if (r.pass) byEndpoint[r.group].passed += 1;
}
const byCheck = {};
for (const r of results) {
  for (const c of r.checks) {
    if (!c.pass) byCheck[c.check] = (byCheck[c.check] || 0) + 1;
  }
}
const actualCost = cost(usage.inputTokens, usage.outputTokens);

console.log('\n----------------------------------------');
console.log(`SCORE: ${passed}/${results.length} cases passed (${Math.round((passed / Math.max(results.length, 1)) * 100)}%)`);
for (const [endpoint, s] of Object.entries(byEndpoint)) {
  console.log(`  ${endpoint.padEnd(12)} ${s.passed}/${s.total}`);
}
if (Object.keys(byCheck).length) {
  console.log('Most common failures:');
  for (const [check, n] of Object.entries(byCheck).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${check.padEnd(20)} ${n}`);
  }
}
if (mode === 'live') {
  console.log(`OpenAI: ${usage.calls} calls, ${usage.errors} errors, ${usage.inputTokens} input + ${usage.outputTokens} output tokens, about $${actualCost.toFixed(4)}`);
}

// ---------- Save ----------
const resultsDir = path.join(EVALS_DIR, 'results');
fs.mkdirSync(resultsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = path.join(resultsDir, `${LABEL}-${mode}-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify({
  label: LABEL,
  mode,
  date: new Date().toISOString(),
  model: 'gpt-4o-mini',
  score: { passed, total: results.length },
  byEndpoint,
  openai: { ...usage, estimatedCostUSD: Number(actualCost.toFixed(6)) },
  results
}, null, 2));
console.log(`Saved full outputs to evals/results/${path.basename(file)}\n`);
