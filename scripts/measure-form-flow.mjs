import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const median = values => { const sorted = [...values].sort((a, b) => a - b); const i = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2; };
const summarize = cases => Object.fromEntries(['clickToOpeningVisibleMs', 'clickToNavigationMs'].map(field => [field, { median: median(cases.map(item => item[field])), maximum: Math.max(...cases.map(item => item[field])) }]));

export async function measureFormFlow({ base, readValues, before, stateRoot, trace }) {
  const browser = await chromium.launch({ headless: true });
  const runId = crypto.randomUUID().slice(0, 8);
  await writeFile(path.join(stateRoot, 'form-before-' + runId + '.json'), JSON.stringify(before));
  const report = { runId, successes: [], errors: [], measurements: '5 envíos reales: 3 escritorio, 2 celular. Fallo y demora interceptados en ambos tamaños.', backendChanges: false, advertisingRequestsBlocked: true, whatsappIntercepted: true, limitations: ['Chromium headless, celular emulado; sin aplicación nativa.', 'Aparición: primer muestreo rAF posterior a un frame con el texto actualizado; precisión de aproximadamente un frame.', 'Navegación: evento CDP Network.requestWillBeSent a wa.me, interceptado sin contactar WhatsApp.', 'Blobs local con compatibilidad ETag/serialización; Sheets real.'] };
  const save = () => writeFile(path.join(stateRoot, 'form-timing-results.json'), JSON.stringify(report, null, 2));
  const sizes = { escritorio: { viewport: { width: 1280, height: 900 } }, celular: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } };
  const headers = before[0]; const idColumn = headers.indexOf('ID de consulta'); const nameColumn = headers.indexOf('Nombre');
  const newNames = new Set(); const contexts = [];
  let releaseSlow;
  try {
    const setup = async (size, mode) => {
      const context = await browser.newContext(sizes[size]); contexts.push(context);
      const page = await context.newPage(); const blocked = new Set(); const navs = []; let body;
      const cdp = await context.newCDPSession(page); await cdp.send('Network.enable');
      cdp.on('Network.requestWillBeSent', event => { if (event.request.url.startsWith('https://wa.me/')) navs.push({ url: event.request.url, epochMs: event.wallTime * 1000, monotonicMs: event.timestamp * 1000 }); });
      await page.route('**/*', async route => {
        const request = route.request(); const url = new URL(request.url());
        if (url.hostname === 'wa.me') { await route.fulfill({ status: 204 }); return; }
        if (url.pathname === '/.netlify/functions/create-lead') {
          body = request.postDataJSON();
          if (mode === 'failure') { await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"SAVE_FAILED","retryable":false}' }); return; }
          if (mode === 'slow') {
            await new Promise(resolve => { releaseSlow = resolve; });
            await route.abort('timedout').catch(() => {}); return;
          }
        }
        if (url.origin === base) { await route.continue(); return; }
        blocked.add(url.hostname); await route.abort();
      });
      await page.addInitScript(() => {
        window.tatosAdvertisingConsent = false;
        window.formMeasure = { fetch: {} };
        document.addEventListener('click', event => { if (event.target.closest('.lead-submit')) window.formMeasure.click = performance.now(); }, true);
        const observer = new MutationObserver(() => {
          const button = document.querySelector('.lead-submit'); const status = document.querySelector('#lead-status');
          if (button?.textContent === 'Abriendo WhatsApp…' && window.formMeasure.openingDOM == null) {
            window.formMeasure.openingDOM = performance.now();
            requestAnimationFrame(() => requestAnimationFrame(() => { if (button.textContent === 'Abriendo WhatsApp…' && button.getBoundingClientRect().width > 0) window.formMeasure.openingVisible = performance.now(); }));
          }
          if (status?.dataset.state === 'error' && window.formMeasure.errorAt == null) window.formMeasure.errorAt = performance.now();
          if (status?.dataset.state === 'success' && window.formMeasure.savedAt == null) window.formMeasure.savedAt = performance.now();
        });
        observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-state'] });
        const originalFetch = window.fetch;
        window.fetch = async function (...args) {
          if (!String(args[0]).includes('/.netlify/functions/create-lead')) return originalFetch.apply(this, args);
          window.formMeasure.fetch.start = performance.now();
          try {
            const response = await originalFetch.apply(this, args); window.formMeasure.fetch.headers = performance.now();
            const json = response.json.bind(response);
            response.json = async () => { const value = await json(); window.formMeasure.fetch.parsed = performance.now(); return value; };
            return response;
          } catch (error) { window.formMeasure.fetch.failed = performance.now(); window.formMeasure.fetch.failureName = error.name; throw error; }
        };
      });
      return { context, page, blocked, navs, payload: () => body };
    };
    const fill = async (page, sample, attribution) => {
      await page.goto(`${base}/?${new URLSearchParams(attribution)}`);
      await page.locator('.js-lead-cta').first().click();
      await page.fill('#lead-name', sample.name); await page.fill('#lead-cat', sample.catName); await page.fill('#lead-phone', sample.phone);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'HORIZONTAL_OVERFLOW');
    };
    const snapshot = page => page.evaluate(() => ({ ...window.formMeasure, timeOrigin: performance.timeOrigin, status: document.querySelector('#lead-status').textContent, button: document.querySelector('.lead-submit').textContent, buttonDisabled: document.querySelector('.lead-submit').disabled, fallbackHidden: document.querySelector('#lead-whatsapp-fallback').hidden, fallbackURL: document.querySelector('#lead-whatsapp-fallback').href, fields: { name: document.querySelector('#lead-name').value, catName: document.querySelector('#lead-cat').value, phone: document.querySelector('#lead-phone').value }, savedEvents: (window.dataLayer || []).filter(item => item.event === 'tatos_lead_saved').length }));
    const waitNavigation = async ({ page, navs }) => { const deadline = Date.now() + 4000; while (!navs.length && Date.now() < deadline) await page.waitForTimeout(30); assert.equal(navs.length, 1, 'WHATSAPP_NAVIGATION_NOT_OBSERVED'); };
    const names = ['Nube Medición', 'Luna Medición', 'Sol Medición', 'Menta Medición', 'Nina Medición'];
    for (const [index, size] of ['escritorio', 'celular', 'escritorio', 'celular', 'escritorio'].entries()) {
      const sample = { name: `PRUEBA AUDITORÍA TIEMPOS ${runId} ${index + 1}`, catName: names[index], phone: '+12025550127' };
      newNames.add(sample.name);
      const attribution = { gclid: `PRUEBA_TIEMPOS_${runId}_${index + 1}`, utm_source: 'google', utm_medium: 'cpc', utm_campaign: `PRUEBA_TIEMPOS_${runId}`, utm_content: size };
      const view = await setup(size, 'real'); const { page } = view;
      await fill(page, sample, attribution);
      const responsePromise = page.waitForResponse(r => r.url().endsWith('/.netlify/functions/create-lead'), { timeout: 12000 });
      await page.click('.lead-submit');
      const response = await responsePromise; const result = await response.json();
      const measured = { index: index + 1, size, name: sample.name, catName: sample.catName, status: response.status(), ...result };
      report.successes.push(measured); await save(); // Save evidence immediately after a real write.
      assert.equal(result.saved, true, `REAL_FORM_SAVE_FAILED:${JSON.stringify(result)}`); assert.equal(response.status(), 201);
      await page.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'success');
      await waitNavigation(view);
      const timing = await snapshot(page); assert.ok(Number.isFinite(timing.openingVisible));
      measured.clickToOpeningVisibleMs = timing.openingVisible - timing.click;
      measured.clickToOpeningDOMMs = timing.openingDOM - timing.click;
      measured.clickToNavigationMs = view.navs[0].epochMs - (timing.timeOrigin + timing.click);
      measured.clickToRequestMs = timing.fetch.start - timing.click;
      measured.requestToResponseHeadersMs = timing.fetch.headers - timing.fetch.start;
      measured.requestToParsedResponseMs = timing.fetch.parsed - timing.fetch.start;
      measured.parsedResponseToNavigationMs = view.navs[0].epochMs - (timing.timeOrigin + timing.fetch.parsed);
      measured.whatsappMessage = new URL(view.navs[0].url).searchParams.get('text');
      assert.equal(measured.whatsappMessage, `Hola, mi nombre es ${sample.name}. Vi su página web y quisiera consultar si tienen disponibilidad para mi gato ${sample.catName}. `);
      assert.equal(view.navs[0].url, timing.fallbackURL); assert.equal(timing.savedEvents, 1);
      const rows = await readValues(); const matches = rows.map((row, i) => ({ row, number: i + 1 })).filter(row => row.row[idColumn] === result.leadId);
      assert.equal(matches.length, 1); measured.rowNumber = matches[0].number;
      measured.record = Object.fromEntries(headers.map((h, i) => [h, matches[0].row[i] ?? '']));
      assert.equal(measured.record.Nombre, sample.name); assert.equal(measured.record['Nombre del gato'], sample.catName); assert.equal(measured.record.WhatsApp, sample.phone);
      assert.equal(measured.record['Página de entrada'], '/'); assert.equal(measured.record.GCLID, attribution.gclid); assert.equal(measured.record['UTM campaign'], attribution.utm_campaign); assert.equal(measured.record['UTM content'], size);
      assert.ok(Number.isFinite(Date.parse(measured.record['Fecha contacto']))); assert.ok(Number.isFinite(Date.parse(measured.record['Captura atribución'])));
      const key = view.payload().idempotencyKey; measured.idempotencyKey = key;
      measured.persistenceTrace = trace.calls.filter(call => call.key === key).map(({ stage, durationMs }) => ({ stage, durationMs }));
      measured.stageTotalsMs = Object.fromEntries(['sheets.read', 'sheets.write', 'blobs.set', 'blobs.get', 'google.oauth', 'handler.total'].map(stage => [stage, measured.persistenceTrace.filter(call => call.stage === stage).reduce((sum, call) => sum + call.durationMs, 0)]));
      measured.blockedHosts = [...view.blocked]; await save();
      await mkdir(path.join(stateRoot, 'form-screenshots'), { recursive: true });
      await page.screenshot({ path: path.join(stateRoot, 'form-screenshots', `success-${index + 1}-${size}.png`), fullPage: false });
      await page.unrouteAll({ behavior: 'ignoreErrors' }); await view.context.close();
    }
    report.summary = summarize(report.successes);
    report.summaryBySize = Object.fromEntries(Object.keys(sizes).map(size => [size, summarize(report.successes.filter(c => c.size === size))]));
    await save();
    for (const size of Object.keys(sizes)) for (const mode of ['failure', 'slow']) {
      const sample = { name: `PRUEBA AUDITORÍA ${mode.toUpperCase()} ${runId} ${size}`, catName: `Gato ${mode} Ficticio`, phone: '+12025550128' };
      const view = await setup(size, mode); const { page } = view;
      await fill(page, sample, { utm_source: 'PRUEBA_FALLO', utm_campaign: `PRUEBA_${mode}_${runId}` });
      await page.click('.lead-submit');
      await page.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'error' && !document.querySelector('.lead-submit').disabled, null, { timeout: 11000 });
      const timing = await snapshot(page); const outcome = { size, mode, clickToErrorMs: timing.errorAt - timing.click, statusText: timing.status, buttonText: timing.button, fieldsPreserved: JSON.stringify(timing.fields) === JSON.stringify(sample), continueVisible: !timing.fallbackHidden, buttonEnabled: !timing.buttonDisabled, savedEvents: timing.savedEvents, failureName: timing.fetch.failureName ?? null, sheetsWrites: 0, simulatedResponse: true };
      report.errors.push(outcome); await save();
      assert.equal(outcome.fieldsPreserved, true); assert.equal(outcome.continueVisible, true); assert.equal(outcome.buttonEnabled, true); assert.equal(outcome.savedEvents, 0);
      assert.ok(!timing.status.includes('Consulta guardada')); assert.equal(timing.button, 'Continuar a WhatsApp'); assert.equal(view.navs.length, 0, 'ERROR_AUTO_NAVIGATED');
      if (mode === 'slow') { assert.equal(timing.fetch.failureName, 'AbortError'); assert.ok(outcome.clickToErrorMs >= 7900 && outcome.clickToErrorMs < 10000); assert.ok(timing.status.includes('La respuesta demoró')); releaseSlow?.(); releaseSlow = null; }
      else assert.ok(timing.status.includes('No pudimos guardar'));
      await page.screenshot({ path: path.join(stateRoot, 'form-screenshots', `${mode}-${size}.png`), fullPage: false });
      await page.click('#lead-whatsapp-fallback'); await waitNavigation(view);
      outcome.manualWhatsAppNavigationObserved = true;
      assert.equal(new URL(view.navs[0].url).searchParams.get('text'), `Hola, mi nombre es ${sample.name}. Vi su página web y quisiera consultar si tienen disponibilidad para mi gato ${sample.catName}. `);
      assert.equal((await snapshot(page)).savedEvents, 0);
      const rows = await readValues(); assert.equal(rows.filter(row => row[nameColumn] === sample.name).length, 0);
      outcome.blockedHosts = [...view.blocked]; await save();
      await page.unrouteAll({ behavior: 'ignoreErrors' }); await view.context.close();
    }
    const after = await readValues();
    assert.equal(after.filter(row => newNames.has(row[nameColumn])).length, 5);
    assert.equal(new Set(report.successes.map(row => row.idempotencyKey)).size, 5);
    const writtenRows = new Set(report.successes.map(item => item.rowNumber));
    for (let r = 0; r < before.length; r++) for (let c = 0; c < before[r].length; c++) {
      if (writtenRows.has(r + 1) && (before[r][c] ?? '') === '') continue;
      assert.deepEqual(after[r]?.[c] ?? '', before[r][c] ?? '', 'OLD_SHEET_CELL_CHANGED');
    }
    for (const success of report.successes) assert.equal(after.filter(row => row[idColumn] === success.leadId).length, 1);
    report.previousRowsPreserved = true; report.exactlyFiveNewRows = true; report.completed = true;
    await save(); return report;
  } catch (error) { report.error = error.message; await save(); throw error; }
  finally { releaseSlow?.(); for (const context of contexts) { for (const page of context.pages()) await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {}); } await browser.close(); }
}
