import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BlobsServer } from '@netlify/blobs/server';

// Local test harness compatibility only. No SDK client or remote service is patched.
// 10.0.10's local server omits read ETags and races check-then-write on its files.
// Preserve its storage/auth/conditional implementation, add ETags and serialize requests.
const version = JSON.parse(await readFile(new URL('../node_modules/@netlify/blobs/package.json', import.meta.url), 'utf8')).version;
assert.equal(version, '10.0.10', 'REVIEW_LOCAL_BLOBS_COMPATIBILITY_FOR_NEW_VERSION');
export class LocalConditionalBlobsServer extends BlobsServer {
  #pending = Promise.resolve();
  handleRequest(request) {
    const result = this.#pending.then(() => super.handleRequest(request));
    this.#pending = result.then(() => {}, () => {});
    return result;
  }
  async #readWithETag(request, response) {
    if (response.status !== 200) return response;
    const apiMatch = this.parseAPIRequest(request);
    if (apiMatch?.useSignedURL) return response;
    const url = apiMatch?.url ?? new URL(request.url, this.address);
    const { dataPath, key } = this.getLocalPaths(url);
    if (dataPath && key) {
      const etag = await BlobsServer.generateETag(dataPath);
      if (etag) response.headers.set('etag', etag);
    }
    return response;
  }
  async get(request) { return this.#readWithETag(request, await super.get(request)); }
  async head(request) { return this.#readWithETag(request, await super.head(request)); }
}
