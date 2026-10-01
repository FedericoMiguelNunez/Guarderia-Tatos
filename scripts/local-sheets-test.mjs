import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import { google } from 'googleapis';
import { LocalConditionalBlobsServer } from './local-conditional-blobs-server.mjs';
import { verifyBlobsConditions } from './verify-blobs-conditions.mjs';
import { runSheetsRetryCases, finishSheetsRetryCases, normalizedFingerprint } from './sheets-retry-cases.mjs';
import { verifyFrozenBrowserRequest } from './check-frozen-browser-request.mjs';
import { measureFormFlow } from './measure-form-flow.mjs';
import { verifyPendingAndCurrency } from './verify-pending-currency.mjs';
import { installPersistenceTracing } from './trace-local-persistence.mjs';
import { setEnvironmentContext, getStore } from '@netlify/blobs';
import { REQUIRED_HEADERS, PRODUCTION_SHEET_ID, createSheetsStore } from '../server/sheets-store.mjs';
import { createIdempotencyStore } from '../server/idempotency-store.mjs';

const TEST_SHEET = '17UZOjIkLGw8ykFsJRmiGlqIGwf91u8eurTZIU3fv5gc';
const TAB = 'Leads Google Ads';
const EXPECTED_EMAIL = 'tatos-sheets@centered-sight-383720.iam.gserviceaccount.com';
const credentialPath = process.env.TATOS_CREDENTIAL_FILE || 'C:/Users/fe-de/Downloads/centered-sight-383720-c94a9c7c1147.json';
const stateRoot = path.join(os.tmpdir(), 'tatos-auditoria-17UZOjIk');
const base = 'http://127.0.0.1:8888';
const quotedTab = `'${TAB.replaceAll("'", "''")}'`;
const col = index => { let n = index + 1, value = ''; while (n) { n--; value = String.fromCharCode(65 + n % 26) + value; n = Math.floor(n / 26); } return value; };
let phase = 'credential';
let blobs, server, browser, persistenceTrace;
const requestAudit = [];
const report = { sheetId: TEST_SHEET, tab: TAB, blobs: 'SDK y servidor oficial local; aislado, sin acceso a Blobs remoto' };
try {
  assert.notEqual(TEST_SHEET, PRODUCTION_SHEET_ID);
  const credential = JSON.parse(await readFile(credentialPath, 'utf8'));
  assert.equal(credential.client_email, EXPECTED_EMAIL, 'SERVICE_ACCOUNT_MISMATCH');
  assert.equal(typeof credential.private_key, 'string', 'PRIVATE_KEY_MISSING');
  Object.assign(process.env, {
    APP_ENV: 'local', LEAD_STORAGE_MODE: 'blobs', ALLOW_PRODUCTION_WRITES: 'false', ALLOW_TEST_SHEET_WRITES: 'true',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: credential.client_email, GOOGLE_PRIVATE_KEY: credential.private_key,
    GOOGLE_SHEETS_ID: TEST_SHEET, GOOGLE_SHEETS_TAB: TAB,
    LEAD_BLOBS_STORE_NAME: 'tatos-lead-operations-auditoria-17UZOjIk',
    ALLOWED_ORIGINS: `${base},http://localhost:8888`
  });
  const auth = new google.auth.JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const readValues = async (valueRenderOption = 'FORMULA') => (await sheets.spreadsheets.values.get({ spreadsheetId: TEST_SHEET, range: quotedTab, valueRenderOption })).data.values || [];
  phase = 'sheets-access';
  const metadata = (await sheets.spreadsheets.get({ spreadsheetId: TEST_SHEET, fields: 'sheets.properties' })).data;
  const tab = metadata.sheets.find(s => s.properties.title === TAB);
  assert.ok(tab, 'EXPECTED_TAB_NOT_FOUND');
  let values = await readValues();
  const headers = values[0] || [];
  if (process.argv.includes('--readback')) {
    const rows = values.slice(1).map((row, i) => ({ rowNumber: i + 2, record: Object.fromEntries(headers.map((header, j) => [header, row[j] ?? ''])) })).filter(item => String(item.record.Nombre).startsWith('PRUEBA AUDITORÍA'));
    const result = { connection: 'Sheets real: lectura directa confirmada', sheetId: TEST_SHEET, tab: TAB, auditRows: rows, idempotency: 'Corrección local set + JSON.stringify; resultados dirigidos en last-retry-verification.json, sin ejecutar envíos en este modo', productionWrites: false };
    await mkdir(stateRoot, { recursive: true });
    await writeFile(path.join(stateRoot, 'readback.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }
  phase = 'local-blobs';
  await mkdir(stateRoot, { recursive: true });
  const token = crypto.randomUUID();
  blobs = new LocalConditionalBlobsServer({ directory: path.join(stateRoot, 'blobs'), token, logger: () => {} });
  const address = await blobs.start();
  const edge = `http://localhost:${address.port}`;
  setEnvironmentContext({ siteID: 'tatos-local-auditoria-only', token, edgeURL: edge, uncachedEdgeURL: edge });
  const idempotency = await createIdempotencyStore();
  const sdkStore = getStore({ name: process.env.LEAD_BLOBS_STORE_NAME, consistency: 'strong' });
  try { report.blobsConditions = await verifyBlobsConditions(sdkStore); }
  catch { throw new Error('BLOBS_CONDITIONAL_WRITES_BROKEN: conditions verification failed; all Sheets writes and HTTP serving blocked'); }
  console.log('PASS: condiciones, ETag y exclusión verificadas en Blobs local aislado; habilitando solo Sheets de prueba.');
  report.localBlobsCompatibility = 'Servidor oficial local 10.0.10 extendido para devolver ETag y serializar solicitudes; no se probó Blobs remoto.';

  const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
  const width = Math.max(0, ...values.map(row => row.length));
  phase = 'headers';
  if (missing.length) {
    const needed = width + missing.length;
    if (needed > tab.properties.gridProperties.columnCount) await sheets.spreadsheets.batchUpdate({ spreadsheetId: TEST_SHEET, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: tab.properties.sheetId, gridProperties: { columnCount: needed } }, fields: 'gridProperties.columnCount' } }] } });
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: TEST_SHEET, requestBody: { valueInputOption: 'RAW', data: missing.map((header, i) => ({ range: `${quotedTab}!${col(width + i)}1`, values: [[header]] })) } });
  }
  const afterHeaders = await readValues();
  // Existing values/formulas must be unchanged; only new empty header cells were populated.
  for (let r = 0; r < values.length; r++) for (let c = 0; c < values[r].length; c++) assert.deepEqual(afterHeaders[r]?.[c] ?? '', values[r][c] ?? '', 'EXISTING_CELL_CHANGED');
  assert.ok(REQUIRED_HEADERS.every(h => afterHeaders[0].includes(h)), 'HEADERS_INCOMPLETE');
  report.headersAdded = missing;
  report.connection = 'real Sheets access OK';
  console.log(JSON.stringify({ connection: report.connection, headersAdded: missing, productionWrites: false }));
  if (process.argv.includes('--prepare')) process.exit(0);

  if (process.argv.includes('--form-timing')) persistenceTrace = installPersistenceTracing(sdkStore);
  const handler = (await import('../netlify/functions/create-lead.mjs')).default;
  const publicRoot = path.resolve('dist');
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, base);
      if (url.pathname === '/.netlify/functions/create-lead') {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 12000) { res.writeHead(413).end(); return; } chunks.push(chunk); }
        const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: Buffer.concat(chunks) } : {}) });
        const rawBody = Buffer.concat(chunks).toString('utf8');
        const entry = { key: JSON.parse(rawBody).idempotencyKey, sha256: crypto.createHash('sha256').update(rawBody).digest('hex') };
        requestAudit.push(entry); await appendFile(path.join(stateRoot, 'request-hashes.jsonl'), JSON.stringify(entry) + '\n');
        if (!process.argv.includes('--verify-retry') && !process.argv.includes('--form-timing') && !process.argv.includes('--close-pendings')) await writeFile(path.join(stateRoot, 'last-request.json'), rawBody);
        const response = persistenceTrace ? await persistenceTrace.run(entry.key, () => handler(request)) : await handler(request); res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return;
      }
      const filename = path.resolve(publicRoot, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
      if (!filename.startsWith(publicRoot + path.sep)) { res.writeHead(403).end(); return; }
      const content = await readFile(filename); res.writeHead(200, { 'content-type': mime[path.extname(filename)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(content);
    } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
  });
  phase = 'local-http';
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8888, '127.0.0.1', resolve); });
  console.log(`Local: ${base}; Sheets real de prueba; producción deshabilitada.`);
  if (process.argv.includes('--close-pendings')) {
    phase = 'pending-currency';
    report.pendingCurrency = await verifyPendingAndCurrency({ base, readValues, before: afterHeaders, stateRoot });
    console.log(JSON.stringify(report.pendingCurrency, null, 2));
  } else if (process.argv.includes('--form-timing')) {
    phase = 'form-timing';
    report.formFlow = await measureFormFlow({ base, readValues, before: afterHeaders, stateRoot, trace: persistenceTrace });
    await writeFile(path.join(stateRoot, 'last-form-flow.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report.formFlow, null, 2));
  } else if (process.argv.includes('--verify-retry')) {
    const prior = JSON.parse(await readFile(path.join(stateRoot, 'last-request.json'), 'utf8'));
    const oldReservation = await idempotency.get(prior.idempotencyKey);
    report.previousRequest = { key: prior.idempotencyKey, normalizedFingerprint: normalizedFingerprint(prior), matchesStoredFingerprint: oldReservation?.fingerprint === normalizedFingerprint(prior), lastStoredOperation: oldReservation?.operationId, capturedAt: prior.attribution.capturedAt };
    assert.equal(report.previousRequest.matchesStoredFingerprint, true, 'PREVIOUS_REQUEST_FINGERPRINT_MISMATCH');
    phase = 'retry-verification';
    if (process.argv.includes('--resume-retry')) {
      report.browserFrozenRequest = { passedInInitialRun: true, sameRawBody: true, sameKey: true, fieldEditsFrozen: true, attributionFrozen: true, consentFrozen: true, responsesIntercepted: true, sheetsWrites: 0 };
      report.retryVerification = await finishSheetsRetryCases({ base, readValues, stateRoot });
    } else {
      report.browserFrozenRequest = await verifyFrozenBrowserRequest(base);
      await writeFile(path.join(stateRoot, 'browser-frozen-request.json'), JSON.stringify(report.browserFrozenRequest));
      report.retryVerification = await runSheetsRetryCases({ base, readValues, before: afterHeaders, stateRoot, requestAudit });
    }
    await writeFile(path.join(stateRoot, 'last-retry-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } else if (!process.argv.includes('--audit')) {
    console.log('Usar Ctrl+C para detener. No se cargaron variables remotas de Netlify.');
    await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
  } else {
    phase = 'browser';
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const blocked = new Set(); let navigation;
    await page.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.hostname === 'wa.me') { navigation = { url: u.href, time: Date.now() }; await route.fulfill({ status: 204 }); return; }
      if (u.origin === base) { await route.continue(); return; }
      blocked.add(u.hostname); await route.abort();
    });
    await page.addInitScript(() => {
      window.tatosAdvertisingConsent = false;
      document.addEventListener('click', event => { if (event.target.closest('.lead-submit')) window.auditClickedAt = performance.now(); }, true);
      const observer = new MutationObserver(() => { const b = document.querySelector('.lead-submit'); if (b?.textContent === 'Abriendo WhatsApp…' && window.auditOpeningAt == null) window.auditOpeningAt = performance.now(); });
      observer.observe(document, { childList: true, subtree: true, characterData: true });
    });
    // Reserved NANP fictional number; never contacted.
    const sample = { name: 'PRUEBA AUDITORÍA', catName: 'Michifuz Ficticio', phone: '+12025550123' };
    const attribution = { gclid: 'PRUEBA_AUDITORIA_NO_CONVERSION', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'PRUEBA_AUDITORIA', utm_term: 'guarderia_ficticia', utm_content: 'formulario_local', campaign_id: 'TEST_CAMPAIGN', adgroup_id: 'TEST_ADGROUP', keyword: 'gato_ficticio' };
    if (process.argv.includes('--resume')) {
      const prior = JSON.parse(await readFile(path.join(stateRoot, 'last-request.json'), 'utf8'));
      assert.equal(prior.name, sample.name); assert.equal(prior.catName, sample.catName); assert.equal(prior.phone, sample.phone);
      await page.addInitScript(prior => {
        crypto.randomUUID = () => prior.idempotencyKey;
        sessionStorage.setItem('tatos_lead_attribution_v1', JSON.stringify(prior.attribution));
      }, prior);
      report.resumedSameRequest = true;
      await page.goto(base);
    } else {
      await page.goto(`${base}/?${new URLSearchParams(attribution)}`);
    }
    await page.locator('.js-lead-cta').first().click();
    await page.fill('#lead-name', sample.name); await page.fill('#lead-cat', sample.catName); await page.fill('#lead-phone', sample.phone);
    let payload;
    page.on('request', request => { if (request.url().endsWith('/.netlify/functions/create-lead')) payload = request.postDataJSON(); });
    phase = 'form-submit';
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/.netlify/functions/create-lead'), { timeout: 15000 });
    await page.click('.lead-submit');
    const response = await responsePromise; const result = await response.json();
    report.firstResponse = { status: response.status(), ...result }; await writeFile(path.join(stateRoot, 'last-response.json'), JSON.stringify(report.firstResponse));
    assert.equal(result.saved, true, `FORM_SAVE_FAILED:${JSON.stringify(result)}`);
    await page.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'success');
    const deadline = Date.now() + 5000;
    while (!navigation && Date.now() < deadline) await page.waitForTimeout(50);
    assert.ok(navigation, 'WHATSAPP_NAVIGATION_NOT_OBSERVED');
    const timing = await page.evaluate(() => ({ click: window.auditClickedAt, opening: window.auditOpeningAt, origin: performance.timeOrigin }));
    report.timingMs = { clickToOpening: timing.opening - timing.click, clickToNavigationObserved: navigation.time - (timing.origin + timing.click) };
    report.whatsappMessage = new URL(navigation.url).searchParams.get('text');
    assert.equal(report.whatsappMessage, `Hola, mi nombre es ${sample.name}. Vi su página web y quisiera consultar si tienen disponibilidad para mi gato ${sample.catName}. `);
    phase = 'sheets-readback';
    values = await readValues();
    const h = values[0], idIndex = h.indexOf('ID de consulta');
    const matches = values.map((row, i) => ({ row, number: i + 1 })).filter(x => x.row[idIndex] === result.leadId);
    assert.equal(matches.length, 1, 'LEAD_NOT_UNIQUE');
    const record = Object.fromEntries(h.map((header, i) => [header, matches[0].row[i] ?? '']));
    assert.equal(record.Nombre, sample.name); assert.equal(record['Nombre del gato'], sample.catName); assert.equal(record.WhatsApp, sample.phone);
    assert.equal(record['Página de entrada'], '/'); assert.ok(Number.isFinite(Date.parse(record['Fecha contacto'])));
    assert.ok(Number.isFinite(Date.parse(record['Captura atribución'])));
    for (const [param, header] of Object.entries({ gclid: 'GCLID', utm_source: 'UTM source', utm_medium: 'UTM medium', utm_campaign: 'UTM campaign', utm_term: 'UTM term', utm_content: 'UTM content', campaign_id: 'Campaign ID', adgroup_id: 'Adgroup ID', keyword: 'Palabra clave' })) assert.equal(record[header], attribution[param]);
    phase = 'idempotent-retry';
    const retry = await fetch(`${base}/.netlify/functions/create-lead`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(payload) });
    const retried = await retry.json(); assert.equal(retry.status, 200); assert.equal(retried.leadId, result.leadId); assert.equal(retried.replayed, true);
    const finalValues = await readValues(); assert.equal(finalValues.filter(row => row[idIndex] === result.leadId).length, 1);
    report.rowNumber = matches[0].number; report.leadId = result.leadId; report.record = record;
    report.retry = { status: retry.status, ...retried, matchingRows: 1 };
    report.blockedExternalHosts = [...blocked]; report.whatsappRequestIntercepted = true;
    report.limitations = ['Chromium headless; navegación WhatsApp interceptada antes de contactar el servicio.', 'Blobs es el servidor local oficial, no el servicio remoto.', 'Tiempo de navegación observado incluye demora de instrumentación.'];
    await writeFile(path.join(stateRoot, 'last-audit.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
} catch (error) {
  // Never dump googleapis errors: their request objects may contain authorization headers.
  const apiMessage = error.response?.data?.error?.message;
  const message = String(apiMessage || error.message || 'UNKNOWN_ERROR').replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, '[REDACTED]').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
  console.error(JSON.stringify({ phase, error: message, code: error.code ?? null, httpStatus: error.response?.status ?? null }));
  process.exitCode = 1;
} finally {
  if (browser) { for (const context of browser.contexts()) for (const page of context.pages()) await page.unrouteAll({ behavior: 'ignoreErrors' }); await browser.close(); }
  if (server) await new Promise(resolve => server.close(resolve));
  await blobs?.stop();
  persistenceTrace?.restore();
  delete process.env.GOOGLE_PRIVATE_KEY;
}
