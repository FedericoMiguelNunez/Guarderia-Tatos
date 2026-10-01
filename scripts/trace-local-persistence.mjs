import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import { GoogleSheetsStore } from '../server/sheets-store.mjs';

// Timing-only wrappers around unchanged backend methods; no values, headers or tokens logged.
export function installPersistenceTracing(sdkStore) {
  const context = new AsyncLocalStorage(); const calls = []; const restores = [];
  const wrap = (object, name, stage) => {
    const original = object[name]; if (typeof original !== 'function') return;
    object[name] = async function (...args) {
      const key = context.getStore(); const start = performance.now();
      try { return await original.apply(this, args); }
      finally { if (key) calls.push({ key, stage, startMs: start, durationMs: performance.now() - start }); }
    };
    restores.push(() => { object[name] = original; });
  };
  const storePrototype = Object.getPrototypeOf(sdkStore);
  wrap(storePrototype, 'set', 'blobs.set'); wrap(storePrototype, 'getWithMetadata', 'blobs.get');
  const seen = new WeakSet();
  const instrumentGoogle = instance => {
    if (seen.has(instance)) return; seen.add(instance);
    wrap(instance.sheets.spreadsheets.values, 'get', 'sheets.read');
    wrap(instance.sheets.spreadsheets.values, 'batchUpdate', 'sheets.write');
    const auth = instance.sheets.context?._options?.auth;
    if (auth) wrap(auth, 'refreshTokenNoCache', 'google.oauth');
  };
  for (const name of ['findByOperationId', 'writeAndConfirm']) {
    const original = GoogleSheetsStore.prototype[name];
    GoogleSheetsStore.prototype[name] = async function (...args) { instrumentGoogle(this); return original.apply(this, args); };
    restores.push(() => { GoogleSheetsStore.prototype[name] = original; });
  }
  return {
    calls,
    async run(key, fn) {
      return context.run(key, async () => {
        const start = performance.now();
        try { return await fn(); }
        finally { calls.push({ key, stage: 'handler.total', startMs: start, durationMs: performance.now() - start }); }
      });
    },
    restore() { for (const restore of restores.reverse()) restore(); }
  };
}
