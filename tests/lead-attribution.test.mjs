import test from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = new URL('../js/lead-attribution.js', import.meta.url);
const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
};
async function load(search, { session = memoryStorage(), local = memoryStorage(), consent } = {}) {
  globalThis.document = { documentElement: { dataset: {} } };
  globalThis.location = { search, pathname: '/pagina-de-entrada' };
  globalThis.sessionStorage = session; globalThis.localStorage = local;
  globalThis.window = { tatosAdvertisingConsent: consent };
  return import(`${moduleUrl.href}?audit=${Math.random()}`);
}

for (const key of ['gclid', 'gbraid', 'wbraid']) {
  test(`captura ${key} ficticio sin mezclar identificadores`, async () => {
    const mod = await load(`?${key}=TEST_${key.toUpperCase()}_AUDIT&utm_source=google`); const value = mod.getFrozenAttribution();
    assert.equal(value[key], `TEST_${key.toUpperCase()}_AUDIT`); assert.equal(value.entryPath, '/pagina-de-entrada');
    assert.ok(!value.gclid || key === 'gclid'); assert.ok(!value.gbraid || key === 'gbraid'); assert.ok(!value.wbraid || key === 'wbraid');
    assert.ok(Number.isFinite(Date.parse(value.capturedAt))); assert.ok(Date.parse(value.expiresAt) > Date.parse(value.capturedAt));
  });
}

test('captura todas las UTM y una visita directa posterior no las borra', async () => {
  const session = memoryStorage();
  const first = await load('?utm_source=google&utm_medium=cpc&utm_campaign=auditoria&utm_term=gatos&utm_content=modal', { session });
  const captured = first.getFrozenAttribution();
  const direct = await load('', { session }); assert.deepEqual(direct.getFrozenAttribution(), captured);
});

test('una campaña nueva reemplaza el conjunto anterior y un dato vencido desaparece', async () => {
  const session = memoryStorage();
  await load('?gclid=OLD_GCLID&utm_campaign=vieja', { session });
  const current = await load('?wbraid=NEW_WBRAID&utm_campaign=nueva', { session });
  assert.equal(current.getFrozenAttribution().wbraid, 'NEW_WBRAID'); assert.equal(current.getFrozenAttribution().gclid, undefined);
  session.setItem('tatos_lead_attribution_v1', JSON.stringify({ gclid: 'EXPIRED', expiresAt: '2000-01-01T00:00:00.000Z' }));
  const expired = await load('', { session }); assert.deepEqual(expired.getFrozenAttribution(), {});
});

test('si el almacenamiento está bloqueado conserva la captura en memoria', async () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const mod = await load('?gclid=TEST_BLOCKED_STORAGE', { session: blocked, local: blocked });
  assert.equal(mod.getFrozenAttribution().gclid, 'TEST_BLOCKED_STORAGE');
});

test('conserva valores exactos, parámetros adicionales y una copia independiente', async () => {
  const expected = {
    gclid: 'Test_Aa-09', gbraid: 'Test_Bb_10', wbraid: 'Test_Cc-11',
    utm_source: 'Google', utm_medium: 'cpc', utm_campaign: 'Verano + gatos & familia',
    utm_term: 'guardería felina', utm_content: 'Anuncio/A', campaign_id: '001234',
    adgroup_id: '005678', keyword: 'hotel para gatos'
  };
  const session = memoryStorage();
  const mod = await load(`?${new URLSearchParams(expected)}&email=no-guardar`, { session });
  const captured = mod.getFrozenAttribution();
  for (const [key, value] of Object.entries(expected)) assert.equal(captured[key], value);
  assert.equal(captured.email, undefined);
  captured.gclid = 'MODIFIED_COPY';
  assert.equal(mod.getFrozenAttribution().gclid, expected.gclid);
  const direct = await load('', { session });
  for (const [key, value] of Object.entries(expected)) assert.equal(direct.getFrozenAttribution()[key], value);
});

test('sin consentimiento conserva solo en sesión; con consentimiento persiste entre sesiones', async () => {
  const key = 'tatos_lead_attribution_v1';
  const session = memoryStorage(); const local = memoryStorage();
  await load('?gclid=SESSION_ONLY', { session, local, consent: false });
  assert.ok(session.getItem(key)); assert.equal(local.getItem(key), null);
  const newSession = await load('', { local, consent: false });
  assert.deepEqual(newSession.getFrozenAttribution(), {});
  await load('?gclid=PERSISTENT', { local, consent: true });
  const returnVisit = await load('', { local, consent: true });
  assert.equal(returnVisit.getFrozenAttribution().gclid, 'PERSISTENT');
});

test('una visita UTM nueva elimina el identificador de la campaña anterior', async () => {
  const session = memoryStorage();
  await load('?gclid=OLD&utm_campaign=anterior', { session });
  const mod = await load('?utm_source=newsletter&utm_campaign=nueva', { session });
  assert.equal(mod.getFrozenAttribution().gclid, undefined);
  assert.equal(mod.getFrozenAttribution().utm_campaign, 'nueva');
});

test('mantiene el plazo predeterminado de 90 días y descarta al vencer', async () => {
  const mod = await load('?gclid=TTL_TEST');
  const captured = mod.getFrozenAttribution();
  assert.ok(Math.abs(Date.parse(captured.expiresAt) - Date.parse(captured.capturedAt) - 90 * 86400000) < 1000);
  const originalNow = Date.now;
  try {
    Date.now = () => Date.parse(captured.expiresAt);
    assert.deepEqual(mod.getFrozenAttribution(), {});
    assert.equal(captured.gclid, 'TTL_TEST');
  } finally { Date.now = originalNow; }
});
