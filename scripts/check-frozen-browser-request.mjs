import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Only verifies request freezing. Both responses here are intercepted 503s;
// no request from this browser check is sent to Sheets. The backend cases are real.
export async function verifyFrozenBrowserRequest(base) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(); const bodies = [];
    await page.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.pathname === '/.netlify/functions/create-lead') {
        bodies.push(request.postData());
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"SAVE_FAILED"}' }); return;
      }
      if (url.origin === base) { await route.continue(); return; }
      await route.abort();
    });
    await page.addInitScript(() => { window.tatosAdvertisingConsent = false; });
    await page.goto(`${base}/?utm_source=TEST_FREEZE&utm_campaign=NO_GUARDAR`);
    await page.locator('.js-lead-cta').first().click();
    await page.fill('#lead-name', 'PRUEBA CUERPO CONGELADO'); await page.fill('#lead-cat', 'Gato sin guardar'); await page.fill('#lead-phone', '+12025550125');
    await page.click('.lead-submit');
    await page.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'error' && !document.querySelector('.lead-submit').disabled);
    await page.evaluate(() => {
      document.querySelector('#lead-name').value = 'Nombre editado'; document.querySelector('#lead-cat').value = 'Gato editado'; document.querySelector('#lead-phone').value = '+12025550126';
      window.tatosAdvertisingConsent = true;
      localStorage.setItem('tatos_lead_attribution_v1', JSON.stringify({ utm_source: 'CHANGED', capturedAt: new Date().toISOString(), entryPath: '/', expiresAt: new Date(Date.now() + 86400000).toISOString() }));
    });
    await page.click('.lead-submit');
    await page.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'error' && !document.querySelector('.lead-submit').disabled);
    assert.equal(bodies.length, 2); assert.equal(bodies[0], bodies[1], 'BROWSER_RETRY_CHANGED_RAW_BODY');
    const parsed = JSON.parse(bodies[0]); assert.ok(parsed.idempotencyKey); assert.equal(parsed.consentKnown, false); assert.equal(parsed.attribution.utm_source, 'TEST_FREEZE');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    return { sameRawBody: true, sameKey: true, fieldEditsFrozen: true, attributionFrozen: true, consentFrozen: true, responsesIntercepted: true, sheetsWrites: 0 };
  } finally { await browser.close(); }
}
