import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const clone = value => value == null ? value : structuredClone(value);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export class MockIdempotencyStore {
  #entries = new Map(); #locks = new Set();
  async reserve(key, fingerprint, operationId) {
    const current = this.#entries.get(key);
    if (current) return { created: false, value: clone(current) };
    const value = { status: 'processing', fingerprint, operationId, updatedAt: new Date().toISOString() };
    this.#entries.set(key, value); return { created: true, value: clone(value) };
  }
  async get(key) { return clone(this.#entries.get(key) ?? null); }
  async complete(key, expected, value) {
    const current = this.#entries.get(key);
    if (!current || current.fingerprint !== expected) return false;
    this.#entries.set(key, { ...value, fingerprint: expected, updatedAt: new Date().toISOString() }); return true;
  }
  async markReview(key, expected, reason) { return this.complete(key, expected, { status: 'review', operationId: (await this.get(key))?.operationId, reason }); }
  async withWriterLock(fn) {
    if (this.#locks.has('rows')) throw new Error('ROW_LOCK_BUSY');
    this.#locks.add('rows'); try { return await fn(); } finally { this.#locks.delete('rows'); }
  }
}

export class FileMockIdempotencyStore {
  constructor(root = path.resolve('.netlify/mock-leads')) { this.root = root; }
  #lockPath(name) {
    if (name !== 'sheets-row' && !/^idem-[A-Za-z0-9_-]+$/.test(name)) throw new Error('INVALID_LOCK_NAME');
    return path.join(this.root, `${name}.lock`);
  }
  async inspectWriterLock(name = 'sheets-row') {
    try { return { name, contents: await readFile(this.#lockPath(name), 'utf8') }; }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  // Offline maintenance only: filesystem unlink has no compare-and-swap.
  async recoverWriterLock(expected, { writersStopped = false } = {}) {
    if (!writersStopped) throw new Error('RECOVERY_REQUIRES_STOPPED_WRITERS');
    const name = expected?.name || 'sheets-row';
    const current = await this.inspectWriterLock(name);
    if (!current || current.contents !== expected?.contents) return false;
    await unlink(this.#lockPath(name)); return true;
  }
  #entry(key) { return path.join(this.root, 'idempotency', `${key}.json`); }
  async #ensure() { await mkdir(path.join(this.root, 'idempotency'), { recursive: true }); }
  async #lock(name, attempts = 100) {
    await this.#ensure(); const filename = path.join(this.root, `${name}.lock`);
    for (let i = 0; i < attempts; i++) {
      try { const handle = await open(filename, 'wx'); return async () => { await handle.close(); await unlink(filename).catch(() => {}); }; }
      catch (error) { if (error.code !== 'EEXIST') throw error; await pause(10); }
    }
    throw new Error('ROW_LOCK_BUSY');
  }
  async reserve(key, fingerprint, operationId) {
    await this.#ensure(); const filename = this.#entry(key);
    const value = { status: 'processing', fingerprint, operationId, updatedAt: new Date().toISOString() };
    try { const handle = await open(filename, 'wx'); await handle.writeFile(JSON.stringify(value)); await handle.close(); return { created: true, value }; }
    catch (error) { if (error.code !== 'EEXIST') throw error; return { created: false, value: await this.get(key) }; }
  }
  async get(key) { try { return JSON.parse(await readFile(this.#entry(key), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
  async complete(key, expected, value) {
    const release = await this.#lock(`idem-${key}`);
    try {
      const current = await this.get(key); if (!current || current.fingerprint !== expected) return false;
      const filename = this.#entry(key); const temp = `${filename}.${crypto.randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify({ ...value, fingerprint: expected, updatedAt: new Date().toISOString() })); await rename(temp, filename); return true;
    } finally { await release(); }
  }
  async markReview(key, expected, reason) { const old = await this.get(key); return this.complete(key, expected, { status: 'review', operationId: old?.operationId, reason }); }
  async withWriterLock(fn) { const release = await this.#lock('sheets-row', 1); try { return await fn(); } finally { await release(); } }
}

export class BlobsIdempotencyStore {
  constructor(store) { this.store = store; }
  // @netlify/blobs 10.0.10 setJSON drops conditions; set forwards them correctly.
  async #writeJSON(key, value, options) {
    if ('onlyIfMatch' in options && !options.onlyIfMatch) throw new Error('BLOBS_ETAG_MISSING');
    return this.store.set(key, JSON.stringify(value), options);
  }
  async inspectWriterLock() { return this.#read('locks/sheets-row'); }
  async recoverWriterLock(expected, { writersStopped = false } = {}) {
    if (!writersStopped) throw new Error('RECOVERY_REQUIRES_STOPPED_WRITERS');
    if (!expected?.etag || !expected?.value?.token) return false;
    const result = await this.#writeJSON('locks/sheets-row', {
      ...expected.value, released: true, recoveredAt: new Date().toISOString()
    }, { onlyIfMatch: expected.etag });
    return result.modified;
  }
  async #read(key) { const result = await this.store.getWithMetadata(key, { consistency: 'strong', type: 'json' }); return result ? { value: result.data, etag: result.etag } : null; }
  async reserve(key, fingerprint, operationId) {
    const value = { status: 'processing', fingerprint, operationId, updatedAt: new Date().toISOString() };
    const result = await this.#writeJSON(`idem/${key}`, value, { onlyIfNew: true });
    return result.modified ? { created: true, value } : { created: false, value: (await this.#read(`idem/${key}`))?.value };
  }
  async get(key) { return (await this.#read(`idem/${key}`))?.value ?? null; }
  async complete(key, expected, value) {
    const item = await this.#read(`idem/${key}`); if (!item || item.value.fingerprint !== expected) return false;
    const result = await this.#writeJSON(`idem/${key}`, { ...value, fingerprint: expected, updatedAt: new Date().toISOString() }, { onlyIfMatch: item.etag });
    return result.modified;
  }
  async markReview(key, expected, reason) { const old = await this.get(key); return this.complete(key, expected, { status: 'review', operationId: old?.operationId, reason }); }
  async withWriterLock(fn) {
    const token = crypto.randomUUID(); const lockKey = 'locks/sheets-row';
    const value = { token, released: false, acquiredAt: new Date().toISOString() };
    let acquired = await this.#writeJSON(lockKey, value, { onlyIfNew: true });
    if (!acquired.modified) {
      const stale = await this.#read(lockKey);
      // Time alone cannot fence a Sheets writer. Only explicit release permits takeover.
      if (stale?.value?.released === true) acquired = await this.#writeJSON(lockKey, value, { onlyIfMatch: stale.etag });
    }
    if (!acquired.modified) throw new Error('ROW_LOCK_BUSY');
    try { return await fn(); } finally {
      const lock = await this.#read(lockKey);
      if (lock?.value?.token === token) await this.#writeJSON(lockKey, { token, released: true }, { onlyIfMatch: lock.etag });
    }
  }
}

export async function createIdempotencyStore(env = process.env) {
  if ((env.LEAD_STORAGE_MODE || 'mock') === 'mock') return new FileMockIdempotencyStore(env.LEAD_MOCK_DIR);
  if (env.LEAD_STORAGE_MODE !== 'blobs') throw new Error('LEAD_STORAGE_MODE_UNSUPPORTED');
  const { getStore } = await import('@netlify/blobs');
  return new BlobsIdempotencyStore(getStore({ name: env.LEAD_BLOBS_STORE_NAME || 'tatos-lead-operations', consistency: 'strong' }));
}
