import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

export async function verifyPendingAndCurrency({ base, readValues, before, stateRoot }) {
  const browser = await chromium.launch({ headless: true });
  const report = { run: crypto.randomUUID().slice(0, 8), browserCases: [], realQuery: null, adRequestsBlocked: true, whatsappIntercepted: true };
  const save = () => writeFile(path.join(stateRoot, 'pending-currency-results.json'), JSON.stringify(report, null, 2));
  const negativeNames = []; const contexts = []; let unblock;
  await writeFile(path.join(stateRoot, 'pending-currency-before.json'), JSON.stringify(before));
  await mkdir(path.join(stateRoot, 'pending-currency-screenshots'), { recursive: true });
  try {
    const setup = async (size, scenario) => {
      const context = await browser.newContext(size === 'escritorio' ? { viewport: { width: 1280, height: 900 } } : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      contexts.push(context); const page = await context.newPage(); const bodies = [], navigations = [];
      await context.route('**/*', async route => {
        const req = route.request(); const url = new URL(req.url());
        if (url.hostname === 'wa.me') { navigations.push(url.href); await route.fulfill({ status: 204 }); return; }
        if (url.pathname === '/.netlify/functions/create-lead' && scenario !== 'real') {
          bodies.push(req.postData());
          if ((scenario === 'manual' || scenario === 'timeout') && bodies.length === 1) {
            await new Promise(resolve => { unblock = resolve; });
            await route.abort('aborted').catch(() => {}); return;
          }
          const result = scenario === 'fast-error' ? { error: 'SAVE_FAILED' } : { saved: true, leadId: 'CONFIRMACION_SIMULADA_SIN_SHEETS' };
          await route.fulfill({ status: scenario === 'fast-error' ? 503 : 201, contentType: 'application/json', body: JSON.stringify(result) }); return;
        }
        if (url.origin === base) { await route.continue(); return; }
        await route.abort();
      });
      await page.addInitScript(() => {
        window.tatosAdvertisingConsent = false; window.pendingMeasure = {};
        document.addEventListener('click', event => { if (event.target.closest('.lead-submit') && window.pendingMeasure.click == null) window.pendingMeasure.click = performance.now(); }, true);
        const observer = new MutationObserver(() => {
          const measure = window.pendingMeasure;
          if (document.querySelector('.lead-submit')?.textContent === 'Abriendo WhatsApp…' && measure.opening == null) measure.opening = performance.now();
          const fallback = document.querySelector('#lead-whatsapp-fallback');
          if (fallback && !fallback.hidden && fallback.textContent === 'Continuar a WhatsApp' && measure.continueAt == null) measure.continueAt = performance.now();
          if (document.querySelector('#lead-status')?.dataset.state === 'error' && measure.errorAt == null) measure.errorAt = performance.now();
        });
        observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
      });
      const sample = { name: `PRUEBA AUDITORÍA ESPERA ${report.run} ${size} ${scenario}`, catName: 'Gato Espera Ficticio', phone: '+12025550130' };
      await page.goto(`${base}/?utm_source=PRUEBA_LOCAL&utm_campaign=PRUEBA_MONEDA_ESPERA`);
      await page.locator('.js-lead-cta').first().click();
      await page.fill('#lead-name', sample.name); await page.fill('#lead-cat', sample.catName); await page.fill('#lead-phone', sample.phone);
      return { context, page, bodies, navigations, sample };
    };
    const snapshot = page => page.evaluate(() => ({ ...window.pendingMeasure, state: document.querySelector('#lead-status').dataset.state, status: document.querySelector('#lead-status').textContent, fallbackHidden: document.querySelector('#lead-whatsapp-fallback').hidden, fallbackLabel: document.querySelector('#lead-whatsapp-fallback').textContent, disabled: document.querySelector('.lead-submit').disabled, savedEvents: (window.dataLayer || []).filter(item => item.event === 'tatos_lead_saved').length, fields: { name: document.querySelector('#lead-name').value, catName: document.querySelector('#lead-cat').value, phone: document.querySelector('#lead-phone').value } }));
    const waitNav = async view => { const deadline = Date.now() + 3000; while (!view.navigations.length && Date.now() < deadline) await view.page.waitForTimeout(30); assert.equal(view.navigations.length, 1); };
    for (const size of ['escritorio', 'celular']) for (const scenario of ['manual', 'timeout', 'fast-success', 'fast-error']) {
      const view = await setup(size, scenario); const { page } = view; negativeNames.push(view.sample.name);
      await page.click('.lead-submit');
      let first;
      if (scenario === 'manual' || scenario === 'timeout') {
        await page.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'pending', null, { timeout: 4500 });
        first = await snapshot(page);
        assert.ok(first.opening - first.click < 100); assert.ok(first.continueAt - first.click >= 2900 && first.continueAt - first.click < 4000);
        assert.equal(first.fallbackHidden, false); assert.equal(first.fallbackLabel, 'Continuar a WhatsApp'); assert.equal(first.savedEvents, 0); assert.equal(first.disabled, true); assert.equal(view.navigations.length, 0);
        assert.ok(first.status.includes('todavía no confirmamos')); assert.equal(first.status.includes('Consulta guardada'), false);
        await page.screenshot({ path: path.join(stateRoot, 'pending-currency-screenshots', `${size}-${scenario}-pending.png`) });
        if (scenario === 'manual') {
          await page.evaluate(() => document.querySelector('#lead-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
          assert.equal(view.bodies.length, 1, 'PENDING_DUPLICATE_REQUEST');
          await page.click('#lead-whatsapp-fallback'); await waitNav(view);
          const pendingAfterNav = await snapshot(page); assert.equal(pendingAfterNav.savedEvents, 0); assert.equal(pendingAfterNav.state, 'pending');
          unblock(); unblock = null;
          await page.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'error' && !document.querySelector('.lead-submit').disabled);
          const failed = await snapshot(page); assert.equal(failed.savedEvents, 0); assert.deepEqual(failed.fields, view.sample);
          // Change fields by script to challenge the frozen attempt; retry must reuse the original bytes.
          await page.evaluate(() => { document.querySelector('#lead-name').value = 'Nombre editado'; document.querySelector('#lead-cat').value = 'Gato editado'; window.tatosAdvertisingConsent = true; });
          await page.click('.lead-submit');
          await page.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'success');
          assert.equal(view.bodies.length, 2); assert.equal(view.bodies[0], view.bodies[1]);
          const confirmed = await snapshot(page); assert.equal(confirmed.savedEvents, 1);
          await page.waitForTimeout(250); assert.equal(view.navigations.length, 1, 'LATE_CONFIRMATION_NAVIGATED_AGAIN');
        } else {
          await page.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'error' && !document.querySelector('.lead-submit').disabled, null, { timeout: 6000 });
          const failed = await snapshot(page); assert.ok(failed.errorAt - failed.click >= 7900 && failed.errorAt - failed.click < 10000);
          assert.equal(failed.savedEvents, 0); assert.deepEqual(failed.fields, view.sample); assert.ok(failed.status.includes('La respuesta demoró'));
          unblock(); unblock = null;
          await page.click('#lead-whatsapp-fallback'); await waitNav(view);
        }
      } else {
        const state = scenario === 'fast-success' ? 'success' : 'error';
        await page.waitForFunction(state => document.querySelector('#lead-status').dataset.state === state, state);
        await page.waitForTimeout(3200); first = await snapshot(page);
        assert.equal(first.state, state); assert.equal(first.continueAt, undefined, 'THREE_SECOND_TIMER_NOT_CANCELLED');
        assert.equal(first.savedEvents, scenario === 'fast-success' ? 1 : 0);
        assert.equal(view.navigations.length, scenario === 'fast-success' ? 1 : 0);
      }
      const last = await snapshot(page);
      const result = { size, scenario, openingMs: first.opening - first.click, continueVisibleMs: first.continueAt == null ? null : first.continueAt - first.click, errorMs: last.errorAt == null ? null : last.errorAt - last.click, savedOnlyAfterConfirmation: true, requests: view.bodies.length, whatsappNavigations: view.navigations.length, sameRetryKeyAndBody: scenario === 'manual' ? view.bodies[0] === view.bodies[1] : null, responseSimulation: true, sheetsWrites: 0 };
      report.browserCases.push(result); await save(); console.log(JSON.stringify({ browserCase: result }));
      await contextCleanup(view.context); 
    }
    const view = await setup('escritorio', 'real'); const { page } = view;
    const headers = before[0]; const currencyCol = headers.indexOf('Moneda'); const idCol = headers.indexOf('ID de consulta');
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/.netlify/functions/create-lead'), { timeout: 12000 });
    await page.click('.lead-submit'); const response = await responsePromise; const result = await response.json();
    report.realQuery = { status: response.status(), ...result, sample: view.sample }; await save();
    assert.equal(response.status(), 201); assert.equal(result.saved, true);
    await page.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'success'); await waitNav(view);
    const after = await readValues(); const matches = after.map((row, i) => ({ row, rowNumber: i + 1 })).filter(item => item.row[idCol] === result.leadId);
    assert.equal(matches.length, 1); const match = matches[0];
    const previousCurrency = before[match.rowNumber - 1]?.[currencyCol] ?? '';
    assert.ok(String(previousCurrency).startsWith('='), 'REAL_QUERY_MUST_TARGET_EXISTING_TEMPLATE_FORMULA');
    assert.equal(match.row[currencyCol], previousCurrency, 'CURRENCY_FORMULA_OVERWRITTEN');
    const evaluated = await readValues('UNFORMATTED_VALUE'); assert.equal(evaluated[match.rowNumber - 1][currencyCol], 'ARS');
    for (let r = 0; r < before.length; r++) for (let c = 0; c < before[r].length; c++) {
      if (r + 1 === match.rowNumber && (before[r][c] ?? '') === '') continue;
      assert.deepEqual(after[r]?.[c] ?? '', before[r][c] ?? '', 'PREEXISTING_CELL_CHANGED');
    }
    const nameCol = headers.indexOf('Nombre');
    for (const name of negativeNames) assert.equal(after.filter(row => row[nameCol] === name).length, 0);
    report.realQuery.rowNumber = match.rowNumber; report.realQuery.currencyFormula = match.row[currencyCol]; report.realQuery.evaluatedCurrency = 'ARS';
    report.realQuery.record = Object.fromEntries(headers.map((h, i) => [h, match.row[i] ?? '']));
    report.realQuery.whatsappMessage = new URL(view.navigations[0]).searchParams.get('text');
    assert.equal(report.realQuery.whatsappMessage, `Hola, mi nombre es ${view.sample.name}. Vi su página web y quisiera consultar si tienen disponibilidad para mi gato ${view.sample.catName}. `);
    assert.equal((await snapshot(page)).savedEvents, 1);
    report.previousRowsPreserved = true; report.completed = true; await save();
    await contextCleanup(view.context); return report;
  } catch (error) { report.error = error.message; await save(); throw error; }
  finally { unblock?.(); for (const context of contexts) await contextCleanup(context); await browser.close(); }
}
async function contextCleanup(context) {
  for (const page of context.pages()) await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
  await context.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
  await context.close().catch(() => {});
}
