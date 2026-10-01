import assert from 'node:assert/strict';
import { BlobsIdempotencyStore } from '../server/idempotency-store.mjs';

// Runs against the actual SDK store. Failure must prevent any Sheets write.
export async function verifyBlobsConditions(sdkStore) {
  const prefix = `condition-check/${crypto.randomUUID()}`;
  const key = `${prefix}/cas`;
  const first = await sdkStore.set(key, JSON.stringify({ value: 'initial' }), { onlyIfNew: true });
  assert.equal(first.modified, true, 'BLOBS_ONLY_IF_NEW_INITIAL_FAILED');
  const duplicate = await sdkStore.set(key, JSON.stringify({ value: 'must-not-replace' }), { onlyIfNew: true });
  assert.equal(duplicate.modified, false, 'BLOBS_ONLY_IF_NEW_NOT_ENFORCED');
  const snapshot = await sdkStore.getWithMetadata(key, { type: 'json', consistency: 'strong' });
  assert.equal(snapshot.data.value, 'initial'); assert.ok(snapshot.etag, 'BLOBS_ETAG_MISSING');
  const cas = await sdkStore.set(key, JSON.stringify({ value: 'updated-with-longer-content' }), { onlyIfMatch: snapshot.etag });
  assert.equal(cas.modified, true, 'BLOBS_CAS_CURRENT_ETAG_FAILED');
  const stale = await sdkStore.set(key, JSON.stringify({ value: 'must-not-replace' }), { onlyIfMatch: snapshot.etag });
  assert.equal(stale.modified, false, 'BLOBS_CAS_STALE_ETAG_NOT_ENFORCED');
  const absent = await sdkStore.set(`${prefix}/missing`, '{}', { onlyIfMatch: snapshot.etag });
  assert.equal(absent.modified, false, 'BLOBS_CAS_MISSING_KEY_NOT_ENFORCED');
  assert.equal((await sdkStore.get(key, { type: 'json' })).value, 'updated-with-longer-content');

  // Namespace the real adapter's keys, so the probes never touch operation locks.
  const scoped = { set: (k, ...args) => sdkStore.set(`${prefix}/${k}`, ...args), getWithMetadata: (k, ...args) => sdkStore.getWithMetadata(`${prefix}/${k}`, ...args) };
  const adapter = new BlobsIdempotencyStore(scoped);
  assert.equal((await adapter.reserve('same-key', 'same-body', 'original-operation')).created, true);
  const retry = await adapter.reserve('same-key', 'same-body', 'different-candidate');
  assert.equal(retry.created, false); assert.equal(retry.value.operationId, 'original-operation');
  assert.equal(await adapter.complete('same-key', 'wrong-body', { status: 'complete' }), false);
  assert.equal(await adapter.complete('same-key', 'same-body', { status: 'complete', operationId: 'original-operation' }), true);
  assert.equal((await adapter.get('same-key')).operationId, 'original-operation');

  await adapter.withWriterLock(async () => {
    await assert.rejects(adapter.withWriterLock(async () => assert.fail('OVERLAPPING_WRITER')), /ROW_LOCK_BUSY/);
  });
  await assert.rejects(adapter.withWriterLock(async () => { throw new Error('writer-error'); }), /writer-error/);
  await adapter.withWriterLock(async () => {});
  await scoped.set('locks/sheets-row', JSON.stringify({ token: 'probe-abandoned-lock', released: false }), {});
  const abandoned = await adapter.inspectWriterLock();
  await assert.rejects(adapter.recoverWriterLock(abandoned), /STOPPED_WRITERS/);
  assert.equal(await adapter.recoverWriterLock(abandoned, { writersStopped: true }), true);
  assert.equal(await adapter.recoverWriterLock(abandoned, { writersStopped: true }), false);
  await adapter.withWriterLock(async () => {});

  // The local server must also enforce atomicity when conditional requests overlap.
  const simultaneousKey = `${prefix}/simultaneous`;
  const contenders = await Promise.all([
    sdkStore.set(simultaneousKey, 'one', { onlyIfNew: true }),
    sdkStore.set(simultaneousKey, 'two', { onlyIfNew: true })
  ]);
  assert.equal(contenders.filter(r => r.modified).length, 1, 'BLOBS_CONCURRENT_ONLY_IF_NEW_NOT_ATOMIC');
  const summary = { onlyIfNew: true, currentETag: true, staleETagRejected: true, absentKeyRejected: true, reservationReplay: true, lockExclusion: true, lockRelease: true, recoveryCAS: true, concurrentReservation: true };
  return summary;
}
