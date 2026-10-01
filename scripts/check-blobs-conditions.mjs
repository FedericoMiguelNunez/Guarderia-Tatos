import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalConditionalBlobsServer } from './local-conditional-blobs-server.mjs';
import { setEnvironmentContext, getStore } from '@netlify/blobs';
import { verifyBlobsConditions } from './verify-blobs-conditions.mjs';
const directory = await mkdtemp(path.join(os.tmpdir(), 'tatos-condition-check-'));
const token = crypto.randomUUID();
const server = new LocalConditionalBlobsServer({ directory, token, logger: () => {} });
try {
  const { port } = await server.start(); const url = `http://localhost:${port}`;
  setEnvironmentContext({ siteID: 'tatos-conditions-test-only', token, edgeURL: url, uncachedEdgeURL: url });
  const sdk = getStore({ name: 'tatos-conditions-test-only', consistency: 'strong' });
    const valid = await verifyBlobsConditions(sdk);
  let sheetsEnabled = false;
  const broken = { set: (key, value) => sdk.set(key, value), getWithMetadata: (...args) => sdk.getWithMetadata(...args), get: (...args) => sdk.get(...args) };
  await assert.rejects(async () => { await verifyBlobsConditions(broken); sheetsEnabled = true; }, /BLOBS_ONLY_IF_NEW_NOT_ENFORCED/);
  assert.equal(sheetsEnabled, false);
  const brokenCAS = { set: (key, value, opts) => sdk.set(key, value, opts.onlyIfNew ? opts : {}), getWithMetadata: (...args) => sdk.getWithMetadata(...args), get: (...args) => sdk.get(...args) };
  await assert.rejects(async () => { await verifyBlobsConditions(brokenCAS); sheetsEnabled = true; }, /BLOBS_CAS_STALE_ETAG_NOT_ENFORCED/);
  assert.equal(sheetsEnabled, false);
  console.log(JSON.stringify({ ...valid, guardRejectsMissingNewCondition: true, guardRejectsMissingCASCondition: true }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await server.stop(); await rm(directory, { recursive: true, force: true }); }
