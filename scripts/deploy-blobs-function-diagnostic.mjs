import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { getAPIToken } from '@netlify/dev-utils';
import { build } from 'esbuild';
import { zipFunctions } from '@netlify/zip-it-and-ship-it';

// CLI session only. No PAT helper, Google credentials or application deployment.
const siteID = '19f95382-9b4e-44dc-b1df-21e9856ff58f';
const teamID = '643c722dd45d4c2b212bedf8';
const productionID = '80fb5b5d-a41b-48d2-8f76-26d91a6c795d';
const name = 'blobs-diagnostic';
const token = await getAPIToken();
assert.ok(token, 'CLI_LOGIN_REQUIRED');
assert.notEqual(siteID, productionID);
const invocationSecret = randomBytes(32).toString('hex');
const secretHash = createHash('sha256').update(invocationSecret).digest('hex');
const expiresAt = Date.now() + 15 * 60_000;
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tatos-functions-blobs-'));
const evidence = { siteID, teamID, function: name, expiresAt: new Date(expiresAt).toISOString(), googleIncluded: false, draft: true };
const evidencePath = path.join(os.tmpdir(), 'tatos-remote-audit', 'function-diagnostic.json');
let stage = 'preflight';
async function api(route, method = 'GET', body, binary = false) {
  const response = await fetch(`https://api.netlify.com/api/v1${route}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': binary ? 'application/octet-stream' : 'application/json' },
    body: body === undefined ? undefined : binary ? body : JSON.stringify(body), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) { const error = new Error('NETLIFY_API_REJECTED'); error.status = response.status; throw error; }
  return response.json();
}
try {
  const site = await api(`/sites/${siteID}`);
  assert.equal(site.id, siteID); assert.equal(site.account_id, teamID); assert.equal(site.name, 'tatos-backend-test-mun7j93b');
  const account = await api(`/accounts/${teamID}`);
  assert.equal(account.type_name, 'Free'); assert.equal(account.auto_topup_enabled, false);
  assert.equal(account.usages_exceeded.length, 0);
  assert.ok(account.capabilities.functions.used < account.capabilities.functions.included);
  stage = 'package';
  const source = `
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';
import assert from 'node:assert/strict';
const expectedHash = Buffer.from(${JSON.stringify(secretHash)}, 'hex');
const reply = (status, value) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export default async (request, context) => {
  const presented = request.headers.get('x-tatos-diagnostic') || '';
  const actualHash = createHash('sha256').update(presented).digest();
  if (!timingSafeEqual(expectedHash, actualHash)) return reply(401, { error: 'UNAUTHORIZED' });
  if (Date.now() > ${expiresAt}) return reply(410, { error: 'DIAGNOSTIC_EXPIRED' });
  if (request.method !== 'POST') return reply(405, { error: 'POST_REQUIRED' });
  if (context.site.id !== ${JSON.stringify(siteID)}) return reply(403, { error: 'TEST_SITE_REQUIRED' });
  let phase = 'input';
  let upstreamStatus = null;
  try {
    const body = await request.text();
    if (body.length > 100) return reply(400, { error: 'INVALID_INPUT' });
    const input = JSON.parse(body || '{}');
    if (!/^[0-9a-f-]{36}$/.test(input.runID || '')) return reply(400, { error: 'INVALID_RUN_ID' });
    phase = 'runtime-context';
    const store = getStore({ name: 'tatos-function-diagnostic-' + ${JSON.stringify(siteID)}, consistency: 'strong', fetch: async (...args) => { const response = await fetch(...args); upstreamStatus = response.status; return response; } });
    const prefix = 'runs/' + input.runID;
    phase = 'reserve-write';
    const first = await store.set(prefix + '/reservation', 'reserved', { onlyIfNew: true });
    if (!first.modified) {
      phase = 'retry-read';
      const previous = await store.get(prefix + '/result', { type: 'json', consistency: 'strong' });
      if (!previous) return reply(409, { error: 'RUN_ALREADY_RESERVED', phase });
      return reply(200, { ...previous, replayed: true });
    }
    phase = 'read';
    assert.equal(await store.get(prefix + '/reservation'), 'reserved');
    phase = 'duplicate-condition';
    assert.equal((await store.set(prefix + '/reservation', 'duplicate', { onlyIfNew: true })).modified, false);
    assert.equal(await store.get(prefix + '/reservation'), 'reserved');
    phase = 'etag-read';
    const snapshot = await store.getWithMetadata(prefix + '/reservation', { type: 'text', consistency: 'strong' });
    assert.ok(snapshot.etag);
    phase = 'current-etag';
    assert.equal((await store.set(prefix + '/reservation', 'updated-longer-value', { onlyIfMatch: snapshot.etag })).modified, true);
    phase = 'stale-etag';
    assert.equal((await store.set(prefix + '/reservation', 'stale', { onlyIfMatch: snapshot.etag })).modified, false);
    assert.equal(await store.get(prefix + '/reservation'), 'updated-longer-value');
    phase = 'missing-key';
    assert.equal((await store.set(prefix + '/missing', 'absent', { onlyIfMatch: snapshot.etag })).modified, false);
    phase = 'concurrent-condition';
    const contenders = await Promise.all([store.set(prefix + '/concurrent', 'one', { onlyIfNew: true }), store.set(prefix + '/concurrent', 'two', { onlyIfNew: true })]);
    assert.equal(contenders.filter(result => result.modified).length, 1);
    const result = { runID: input.runID, write: true, read: true, duplicateRejected: true, currentETag: true, staleETagRejected: true, missingKeyRejected: true, concurrentSingleWinner: true, replayed: false };
    phase = 'result-write';
    await store.set(prefix + '/result', JSON.stringify(result), { onlyIfNew: true });
    return reply(200, result);
  } catch (error) {
    return reply(503, { error: error.name === 'AssertionError' ? 'CONDITION_ASSERTION_FAILED' : 'BLOBS_DIAGNOSTIC_FAILED', phase, upstreamStatus, errorType: error.name });
  }
};`;
  await fs.mkdir(path.join(directory, 'source'));
  const outputFile = path.join(directory, 'source', `${name}.mjs`);
  await build({ stdin: { contents: source, resolveDir: process.cwd(), sourcefile: 'blobs-diagnostic.mjs' }, bundle: true, platform: 'node', format: 'esm', target: 'node20', outfile: outputFile, logLevel: 'silent' });
  const functions = await zipFunctions(path.join(directory, 'source'), path.join(directory, 'bundles'));
  assert.equal(functions.length, 1); assert.equal(functions[0].name, name);
  assert.equal(functions[0].runtimeAPIVersion, 2, 'MODERN_FUNCTION_RUNTIME_REQUIRED');
  const bundle = await fs.readFile(functions[0].path);
  assert.ok(!bundle.includes(Buffer.from(invocationSecret)), 'INVOCATION_SECRET_IN_BUNDLE');
  const sha = createHash('sha256').update(bundle).digest('hex');
  console.log(JSON.stringify({ stage: 'package-ready', functionCount: 1, googleIncluded: false, siteID, protection: 'random secret hash with 15 minute expiry' }));
  stage = 'create-draft-deploy';
  const fn = functions[0];
  evidence.invocationMode = fn.invocationMode;
  let deploy = await api(`/sites/${siteID}/deploys`, 'POST', { draft: true, files: {}, functions: { [name]: sha }, functions_config: { [name]: { build_data: { bootstrapVersion: fn.bootstrapVersion, runtimeAPIVersion: fn.runtimeAPIVersion }, routes: fn.routes, excluded_routes: fn.excludedRoutes } } });
  assert.equal(deploy.site_id, siteID);
  evidence.deployID = deploy.id;
  console.log(JSON.stringify({ stage, deployID: deploy.id, state: deploy.state }));
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  stage = 'upload-function';
  const uploadParameters = new URLSearchParams({ runtime: fn.runtimeVersion || fn.runtime, invocation_mode: fn.invocationMode });
  if (deploy.required_functions?.includes(sha)) await api(`/deploys/${deploy.id}/functions/${name}?${uploadParameters}`, 'PUT', bundle, true);
  stage = 'wait-deploy';
  const deadline = Date.now() + 120000;
  while (deploy.state !== 'ready') {
    if (deploy.state === 'error') { const error = new Error('DEPLOY_FAILED'); error.status = null; throw error; }
    assert.ok(Date.now() < deadline, 'DEPLOY_READY_TIMEOUT');
    await new Promise(resolve => setTimeout(resolve, 3000));
    deploy = await api(`/deploys/${deploy.id}`);
  }
  const base = deploy.deploy_ssl_url || deploy.deploy_url;
  assert.ok(base?.startsWith('https://'));
  evidence.url = base;
  const endpoint = base + '/.netlify/functions/' + name;
  stage = 'access-control';
  const denied = await fetch(endpoint, { method: 'POST', signal: AbortSignal.timeout(30000) });
  assert.equal(denied.status, 401, 'UNAUTHENTICATED_REQUEST_NOT_DENIED');
  const wrong = await fetch(endpoint, { method: 'POST', headers: { 'x-tatos-diagnostic': 'synthetic-invalid-key' }, signal: AbortSignal.timeout(30000) });
  assert.equal(wrong.status, 401, 'INVALID_KEY_NOT_DENIED');
  const method = await fetch(endpoint, { headers: { 'x-tatos-diagnostic': invocationSecret }, signal: AbortSignal.timeout(30000) });
  assert.equal(method.status, 405, 'GET_NOT_DENIED');
  evidence.accessControl = { noKeyDenied: true, wrongKeyDenied: true, getDenied: true };
  stage = 'blobs-runtime-probe';
  const runID = randomUUID();
  const invoke = () => fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-tatos-diagnostic': invocationSecret }, body: JSON.stringify({ runID }), signal: AbortSignal.timeout(60000) });
  const first = await invoke();
  evidence.first = { status: first.status, result: await first.json() };
  console.log(JSON.stringify({ stage, ...evidence.first }));
  assert.equal(first.status, 200, 'REMOTE_BLOBS_PROBE_FAILED');
  stage = 'same-run-retry';
  const retry = await invoke();
  evidence.retry = { status: retry.status, result: await retry.json() };
  assert.equal(retry.status, 200); assert.equal(evidence.retry.result.replayed, true); assert.equal(evidence.retry.result.runID, runID);
  evidence.passed = true;
  console.log(JSON.stringify({ passed: true, accessControl: evidence.accessControl, retry: evidence.retry, url: base }));
} catch (error) {
  evidence.passed = false;
  evidence.failure = { stage, code: error.code || (error.name === 'AssertionError' ? error.message : error.name), status: error.status ?? null };
  console.error(JSON.stringify(evidence.failure));
  process.exitCode = 1;
} finally {
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ evidencePath }));
}
