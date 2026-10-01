import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BlobsServer } from '@netlify/blobs/server';
import { setEnvironmentContext, getStore } from '@netlify/blobs';
import { createIdempotencyStore } from '../server/idempotency-store.mjs';
const directory = await mkdtemp(path.join(os.tmpdir(), 'tatos-blobs-check-'));
// The SDK context is local only; no Netlify account or production store is used.
const token = crypto.randomUUID();
const local = new BlobsServer({ directory, token, logger: () => {} });
try {
  const { port } = await local.start();
  const url = `http://localhost:${port}`;
  setEnvironmentContext({ siteID: 'tatos-local-test', token, edgeURL: url, uncachedEdgeURL: url });
  const prod = await createIdempotencyStore({ LEAD_STORAGE_MODE: 'blobs' });
  const test = await createIdempotencyStore({ LEAD_STORAGE_MODE: 'blobs', LEAD_BLOBS_STORE_NAME: 'tatos-auditoria-test-only' });
  const key = 'isolated_test_key_001';
  assert.equal((await test.reserve(key, 'test', 'test-operation')).created, true);
  assert.equal(await prod.get(key), null);
  assert.equal((await prod.reserve(key, 'prod', 'prod-operation')).created, true);
  assert.equal((await test.get(key)).operationId, 'test-operation');
  assert.equal((await getStore('tatos-lead-operations').get(`idem/${key}`, { type: 'json' })).operationId, 'prod-operation');
  console.log('PASS: nombre de producción conservado y almacén de prueba aislado (Blobs local oficial).');
} finally { await local.stop(); await rm(directory, { recursive: true, force: true }); }
