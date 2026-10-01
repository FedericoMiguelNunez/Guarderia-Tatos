import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { getAPIToken } from '@netlify/dev-utils';
import { getStore } from '@netlify/blobs';
import { verifyBlobsConditions } from './verify-blobs-conditions.mjs';

const accountId = '643c722dd45d4c2b212bedf8';
const productionId = '80fb5b5d-a41b-48d2-8f76-26d91a6c795d';
const stateDir = path.join(os.tmpdir(), 'tatos-remote-audit');
const statePath = path.join(stateDir, 'state.json');
const token = process.env.NETLIFY_AUTH_TOKEN || await getAPIToken();
assert.ok(token, 'NETLIFY_LOGIN_REQUIRED');
async function api(route, method = 'GET', body) {
  const res = await fetch(`https://api.netlify.com/api/v1${route}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const data = await res.json();
  if (!res.ok) throw new Error(`NETLIFY_API_${res.status}:${route}`);
  return data;
}
try {
  if (process.argv.includes('--child')) {
    const store = getStore({ name: process.env.TEST_STORE, siteID: process.env.TEST_SITE, token, consistency: 'strong' });
    process.send({ ready: true });
    process.once('message', async () => {
      try { const result = await store.set(process.env.TEST_KEY, JSON.stringify({ process: process.pid }), { onlyIfNew: true }); process.send({ modified: result.modified }); process.disconnect(); }
      catch { process.send({ error: 'REMOTE_CHILD_WRITE_FAILED' }); process.disconnect(); process.exitCode = 1; }
    });
  } else {
    await fs.mkdir(stateDir, { recursive: true });
    const account = await api(`/accounts/${accountId}`);
    assert.equal(account.type_name, 'Free', 'FREE_PLAN_REQUIRED');
    assert.equal(account.auto_topup_enabled, false, 'AUTO_TOPUP_ENABLED');
    assert.equal(account.usages_exceeded.length, 0, 'USAGE_LIMIT_EXCEEDED');
    for (const metric of ['functions', 'build_minutes', 'bandwidth']) assert.ok(account.capabilities[metric].used < account.capabilities[metric].included, `NO_CAPACITY_${metric}`);
    let state;
    try { state = JSON.parse(await fs.readFile(statePath, 'utf8')); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    if (!state) {
      const name = `tatos-backend-test-${Date.now().toString(36)}`;
      const site = await api('/federicomiguelnunez/sites', 'POST', { name });
      assert.equal(site.account_id, accountId);
      assert.notEqual(site.id, productionId);
      state = { siteId: site.id, name: site.name, url: site.ssl_url || site.url, store: `tatos-remote-test-${site.id}`, productionId, createdAt: new Date().toISOString() };
      await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    }
    assert.notEqual(state.siteId, productionId);
    console.log(JSON.stringify({ site: state, freeCapacity: Object.fromEntries(['functions', 'build_minutes', 'bandwidth'].map(k => [k, account.capabilities[k]])) }));
    const store = getStore({ name: state.store, siteID: state.siteId, token, consistency: 'strong' });
    state.blobs = await verifyBlobsConditions(store);
    const key = `process-check/${crypto.randomUUID()}`;
    const children = [0, 1].map(() => fork(new URL(import.meta.url), ['--child'], { env: { ...process.env, TEST_SITE: state.siteId, TEST_STORE: state.store, TEST_KEY: key }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
    await Promise.all(children.map(child => new Promise((resolve, reject) => { child.once('message', msg => msg.ready ? resolve() : reject(new Error('CHILD_NOT_READY'))); child.once('error', reject); })));
    const outcomes = children.map(child => new Promise((resolve, reject) => { child.once('message', msg => msg.error ? reject(new Error(msg.error)) : resolve(msg.modified)); child.once('error', reject); }));
    children.forEach(child => child.send({ go: true }));
    assert.equal((await Promise.all(outcomes)).filter(Boolean).length, 1, 'CROSS_PROCESS_CONDITION_FAILED');
    state.blobs.crossProcessConcurrency = true;
    state.blobsVerifiedAt = new Date().toISOString();
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    console.log(JSON.stringify({ blobs: state.blobs, statePath }));
  }
} catch (err) { console.error(JSON.stringify({ error: err.message?.split('\n')[0] || 'REMOTE_TEST_FAILED' })); process.exitCode = 1; }
