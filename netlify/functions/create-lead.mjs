import { LeadService } from '../../server/lead-service.mjs';
import { ValidationError } from '../../server/lead-validation.mjs';
import { createIdempotencyStore } from '../../server/idempotency-store.mjs';
import { createSheetsStore } from '../../server/sheets-store.mjs';

let servicePromise;
const json = (body, status, origin) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}) } });

export default async function handler(request, context) {
  const origin = request.headers.get('origin') || '';
  const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:8888,http://127.0.0.1:8888').split(',').map(x => x.trim());
  const testSameOrigin = process.env.APP_ENV === 'test' && process.env.TEST_NETLIFY_SITE_ID && context?.site?.id === process.env.TEST_NETLIFY_SITE_ID && origin === new URL(request.url).origin;
  if (origin && !allowed.includes(origin) && !testSameOrigin) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403, '');
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json({ error: 'JSON_REQUIRED' }, 415, origin);
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 12_000) return json({ error: 'PAYLOAD_TOO_LARGE' }, 413, origin);
  try {
    const text = await request.text(); if (text.length > 12_000) return json({ error: 'PAYLOAD_TOO_LARGE' }, 413, origin);
    const input = JSON.parse(text);
    servicePromise ||= Promise.all([createIdempotencyStore(), createSheetsStore()]).then(([idempotency, sheets]) => new LeadService({ idempotency, sheets }));
    const result = await (await servicePromise).create(input);
    return json(result.body, result.status, origin);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof SyntaxError) return json({ error: 'VALIDATION_ERROR', field: error.field || null, message: error.message }, 400, origin);
    return json({ error: 'SERVICE_UNAVAILABLE' }, 503, origin);
  }
}
