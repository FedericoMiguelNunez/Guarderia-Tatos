import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BlobsServer } from '@netlify/blobs/server';
import { setEnvironmentContext, getStore } from '@netlify/blobs';
const directory = await mkdtemp(path.join(os.tmpdir(), 'tatos-local-limit-'));
const token = crypto.randomUUID(); const server = new BlobsServer({ directory, token, logger: () => {} });
try {
 const { port } = await server.start(); const url = `http://localhost:${port}`;
 setEnvironmentContext({ siteID: 'test-only', token, edgeURL: url, uncachedEdgeURL: url });
 const store = getStore({ name: 'tatos-limit-test-only', consistency: 'strong' });
 const first = await store.set('etag', 'initial', { onlyIfNew: true });
 const read = await store.getWithMetadata('etag');
 const concurrent = await Promise.all([store.set('concurrent', 'one', { onlyIfNew: true }), store.set('concurrent', 'two', { onlyIfNew: true })]);
 console.log(JSON.stringify({ writeReturnsETag: Boolean(first.etag), readReturnsETag: Boolean(read.etag), concurrentSuccessfulCreates: concurrent.filter(r => r.modified).length }));
} finally { await server.stop(); await rm(directory, { recursive: true, force: true }); }
