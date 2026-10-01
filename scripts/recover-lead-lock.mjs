import { readFile, writeFile } from 'node:fs/promises';
import { createIdempotencyStore } from '../server/idempotency-store.mjs';

const [action, snapshot, confirmation] = process.argv.slice(2);
if (!['inspect', 'recover'].includes(action) || !snapshot) {
  throw new Error('Usage: node scripts/recover-lead-lock.mjs inspect|recover snapshot.json [--writers-stopped]');
}
const store = await createIdempotencyStore();
if (action === 'inspect') {
  if (confirmation && process.env.LEAD_STORAGE_MODE === 'blobs') throw new Error('BLOBS_ONLY_SUPPORTS_SHEETS_ROW_LOCK');
  await writeFile(snapshot, JSON.stringify(await store.inspectWriterLock(confirmation), null, 2), { flag: 'wx' });
  console.log('Snapshot saved. Stop all writers and resolve in-flight Sheets requests before recovery.');
} else {
  const recovered = await store.recoverWriterLock(JSON.parse(await readFile(snapshot, 'utf8')), {
    writersStopped: confirmation === '--writers-stopped'
  });
  if (!recovered) throw new Error('LOCK_CHANGED_OR_MISSING: inspect again; do not reuse this snapshot');
  console.log('Writer lock recovered. Pending operations still require reconciliation by ID de consulta.');
}
