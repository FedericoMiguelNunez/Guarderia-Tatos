import test from 'node:test';
import assert from 'node:assert/strict';
import { LeadService } from '../server/lead-service.mjs';
import { MockIdempotencyStore } from '../server/idempotency-store.mjs';
import { FileMockIdempotencyStore } from '../server/idempotency-store.mjs';
import { MockSheetsStore, FileMockSheetsStore } from '../server/sheets-store.mjs';
import { validateLeadPayload } from '../server/lead-validation.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const payload = (overrides = {}) => ({ name: 'María José', catName: 'Mishí y León', phone: '011 15 3594 2796', idempotencyKey: 'attempt_1234567890', attribution: {}, consentKnown: null, website: '', ...overrides });
const make = options => { const idempotency = new MockIdempotencyStore(); const sheets = new MockSheetsStore(options); return { service: new LeadService({ idempotency, sheets, uuid: () => 'lead-0001', now: () => new Date('2026-09-28T12:00:00Z') }), sheets }; };

test('normaliza teléfono argentino y conserva acentos', () => {
  const lead = validateLeadPayload(payload()); assert.equal(lead.phone, '+5491135942796'); assert.equal(lead.name, 'María José');
});
test('rechaza teléfono ambiguo y campos inesperados', () => {
  assert.throws(() => validateLeadPayload(payload({ phone: '123' }))); assert.throws(() => validateLeadPayload({ ...payload(), admin: true }));
});
test('persiste texto malicioso como texto y deja Contactó sin inferir', async () => {
  const { service, sheets } = make(); const result = await service.create(payload({ name: '=IMPORTXML("x")' }));
  assert.equal(result.status, 201); assert.equal(sheets.rows[0].Nombre, '=IMPORTXML("x")'); assert.equal(sheets.rows[0]['Contactó'], '');
});
test('mapea captura y página de entrada sin guardar la URL completa', async () => {
  const { service, sheets } = make();
  await service.create(payload({ attribution: { gclid: 'TEST_GCLID_AUDIT', capturedAt: '2026-09-28T12:34:56.000Z', entryPath: '/requisitos' } }));
  assert.equal(sheets.rows[0].GCLID, 'TEST_GCLID_AUDIT'); assert.equal(sheets.rows[0]['Captura atribución'], '2026-09-28T12:34:56.000Z');
  assert.equal(sheets.rows[0]['Página de entrada'], '/requisitos'); assert.ok(!JSON.stringify(sheets.rows[0]).includes('?'));
});
test('un reintento devuelve el mismo ID y no duplica', async () => {
  const { service, sheets } = make(); const first = await service.create(payload()); const second = await service.create(payload());
  assert.equal(first.body.leadId, second.body.leadId); assert.equal(sheets.rows.length, 1); assert.equal(second.body.replayed, true);
});
test('misma clave con otro payload se rechaza', async () => {
  const { service } = make(); await service.create(payload()); assert.equal((await service.create(payload({ catName: 'Otro' }))).status, 409);
});
test('mismo teléfono con nueva clave crea otra consulta', async () => {
  const idempotency = new MockIdempotencyStore(); const sheets = new MockSheetsStore(); let n = 0;
  const service = new LeadService({ idempotency, sheets, uuid: () => `lead-${++n}` });
  await service.create(payload()); await service.create(payload({ idempotencyKey: 'attempt_abcdefghijklmno' })); assert.equal(sheets.rows.length, 2);
});
test('reconcilia una respuesta perdida después de escribir', async () => {
  const { service, sheets } = make({ afterWriteFailure: true }); const result = await service.create(payload());
  assert.equal(result.status, 201); assert.equal(result.body.reconciled, true); assert.equal(sheets.rows.length, 1);
});
test('un fallo previo a persistir queda para revisión y no repite a ciegas', async () => {
  const { service } = make({ fail: 'SHEETS_DOWN' }); const result = await service.create(payload()); const retry = await service.create(payload());
  assert.equal(result.status, 503); assert.equal(retry.body.error, 'REVIEW_REQUIRED');
});
test('dos solicitudes simultáneas con la misma clave escriben una vez', async () => {
  const { service, sheets } = make(); const results = await Promise.all([service.create(payload()), service.create(payload())]);
  assert.equal(sheets.rows.length, 1); assert.ok(results.some(x => x.status === 201));
});
test('consultas distintas concurrentes pueden reintentar el lock sin quedar trabadas', async () => {
  const idempotency = new MockIdempotencyStore(); const sheets = new MockSheetsStore(); let n = 0;
  const service = new LeadService({ idempotency, sheets, uuid: () => `lead-${++n}` });
  const inputs = [payload(), payload({ idempotencyKey: 'attempt_distinct_12345', name: 'Juan' })];
  const first = await Promise.all(inputs.map(input => service.create(input)));
  const busyIndex = first.findIndex(result => result.body.error === 'BUSY'); assert.notEqual(busyIndex, -1);
  const retried = await service.create(inputs[busyIndex]); assert.equal(retried.status, 201); assert.equal(sheets.rows.length, 2);
});
test('mock en disco conserva idempotencia entre instancias independientes', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'tatos-audit-')); t.after(() => rm(root, { recursive: true, force: true }));
  const first = new LeadService({ idempotency: new FileMockIdempotencyStore(root), sheets: new FileMockSheetsStore(root), uuid: () => 'persistent-lead' });
  const second = new LeadService({ idempotency: new FileMockIdempotencyStore(root), sheets: new FileMockSheetsStore(root), uuid: () => 'must-not-be-used' });
  assert.equal((await first.create(payload())).body.leadId, 'persistent-lead');
  const replay = await second.create(payload()); assert.equal(replay.body.leadId, 'persistent-lead'); assert.equal(replay.body.replayed, true);
  assert.equal(JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root, 'rows.json'), 'utf8')).length, 1);
});
