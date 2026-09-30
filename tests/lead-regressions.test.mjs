import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BlobsIdempotencyStore, FileMockIdempotencyStore, MockIdempotencyStore } from '../server/idempotency-store.mjs';
import { createSheetsStore, GoogleSheetsStore, MockSheetsStore, PRODUCTION_SHEET_ID, REQUIRED_HEADERS } from '../server/sheets-store.mjs';
import { LeadService } from '../server/lead-service.mjs';

function blobs() {
  const entries = new Map(); let version = 0;
  return {
    async getWithMetadata(key) { return structuredClone(entries.get(key) ?? null); },
    async set(key, data, options = {}) { return this.setJSON(key, JSON.parse(data), options); },
    async setJSON(key, data, options = {}) {
      const old = entries.get(key);
      if ((options.onlyIfNew && old) || (options.onlyIfMatch && old?.etag !== options.onlyIfMatch)) return { modified: false };
      entries.set(key, { data: structuredClone(data), etag: String(++version) }); return { modified: true };
    }
  };
}

test('un bloqueo antiguo no vence; recuperación explícita exige detener escritores y usa CAS', async () => {
  const backend = blobs(); const store = new BlobsIdempotencyStore(backend);
  await backend.setJSON('locks/sheets-row', { token: 'abandoned', acquiredAt: '2000-01-01', released: false });
  const snapshot = await store.inspectWriterLock();
  await assert.rejects(store.withWriterLock(() => assert.fail()), /ROW_LOCK_BUSY/);
  await assert.rejects(store.recoverWriterLock(snapshot), /STOPPED_WRITERS/);
  assert.equal(await store.recoverWriterLock(snapshot, { writersStopped: true }), true);
  await store.withWriterLock(async () => {
    assert.equal(await store.recoverWriterLock(snapshot, { writersStopped: true }), false);
    await assert.rejects(store.withWriterLock(() => assert.fail()), /ROW_LOCK_BUSY/);
  });
  await store.withWriterLock(async () => {});
});

test('finally libera incluso si falla el escritor y no libera un token ajeno', async () => {
  const backend = blobs(); const store = new BlobsIdempotencyStore(backend);
  await assert.rejects(store.withWriterLock(async () => { throw new Error('failed'); }), /failed/);
  await store.withWriterLock(async () => backend.setJSON('locks/sheets-row', { token: 'other', released: false }));
  assert.equal((await store.inspectWriterLock()).value.released, false);
});

test('recupera offline un lock vacío legado del mock', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'tatos-recovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new FileMockIdempotencyStore(root);
  await writeFile(path.join(root, 'sheets-row.lock'), '');
  const snapshot = await store.inspectWriterLock();
  await assert.rejects(store.withWriterLock(() => assert.fail()), /ROW_LOCK_BUSY/);
  await assert.rejects(store.recoverWriterLock(snapshot), /STOPPED_WRITERS/);
  assert.equal(await store.recoverWriterLock(snapshot, { writersStopped: true }), true);
  await store.withWriterLock(async () => {});
  await writeFile(path.join(root, 'idem-attempt_123.lock'), '');
  assert.equal(await store.recoverWriterLock(await store.inspectWriterLock('idem-attempt_123'), { writersStopped: true }), true);
  await assert.rejects(store.inspectWriterLock('../outside'), /INVALID_LOCK_NAME/);
});

test('permiso de prueba no habilita producción y permiso de producción no habilita prueba', async () => {
  const env = { LEAD_STORAGE_MODE: 'blobs', GOOGLE_SHEETS_ID: PRODUCTION_SHEET_ID, ALLOW_TEST_SHEET_WRITES: 'true' };
  await assert.rejects(createSheetsStore(env), /PRODUCTION_SHEET_BLOCKED_OUTSIDE_PRODUCTION/);
  await assert.rejects(createSheetsStore({ ...env, APP_ENV: 'production' }), /PRODUCTION_WRITES_DISABLED/);
  await assert.rejects(createSheetsStore({ LEAD_STORAGE_MODE: 'blobs', GOOGLE_SHEETS_ID: 'test', ALLOW_PRODUCTION_WRITES: 'true' }), /TEST_SHEET_WRITES_DISABLED/);
  await assert.rejects(createSheetsStore({ ...env, GOOGLE_SHEETS_ID: 'test' }), /SHEETS_CONFIGURATION_MISSING/);
});

test('19 encabezados impiden escribir; 34 encabezados reordenados se escriben RAW y confirman por ID', async () => {
  let headers = REQUIRED_HEADERS.slice(0, 19); let rows = []; let writes = 0;
  const values = {
    async get() { return { data: { values: [headers, ...rows] } }; },
    async batchUpdate({ requestBody }) {
      writes++; assert.equal(requestBody.valueInputOption, 'RAW');
      assert.deepEqual(requestBody.data, [{ range: "'Leads'!A2", values: [['op']] }]);
      rows = [['op']];
    }
  };
  const store = new GoogleSheetsStore({ sheets: { spreadsheets: { values } }, spreadsheetId: 'test', tab: 'Leads' });
  await assert.rejects(store.writeAndConfirm({ 'ID de consulta': 'op' }), /SHEET_MIGRATION_REQUIRED/);
  assert.equal(writes, 0);
  headers = ['ID de consulta', ...REQUIRED_HEADERS.filter(h => h !== 'ID de consulta')];
  assert.equal((await store.writeAndConfirm({ 'ID de consulta': 'op' })).rowNumber, 2);
});

test('reintento tras bloqueo conserva ID y usa el estado Pendiente', async () => {
  const idempotency = new MockIdempotencyStore(); const sheets = new MockSheetsStore(); let count = 0;
  const service = new LeadService({ idempotency, sheets, uuid: () => `op-${++count}` });
  const input = { name: 'María', catName: 'Mishí', phone: '011 15 3594 2796', idempotencyKey: 'attempt_regression_123', attribution: {}, consentKnown: null, website: '' };
  await idempotency.withWriterLock(async () => assert.equal((await service.create(input)).body.error, 'BUSY'));
  assert.equal((await service.create(input)).body.leadId, 'op-1');
  assert.equal(sheets.rows.length, 1); assert.equal(sheets.rows[0]['Estado de la reserva'], 'Pendiente');
});
