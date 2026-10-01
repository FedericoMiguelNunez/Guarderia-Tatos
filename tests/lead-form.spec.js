import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/googletagmanager|google-analytics|facebook|googlesyndication|wistia|fontawesome/, route => route.abort());
});
test('CTA enfoca el formulario y muestra errores accesibles', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#consulta')).toBeHidden(); await page.locator('.js-lead-cta').first().click(); await expect(page.locator('#consulta')).toBeVisible(); await expect(page.locator('#lead-name')).toBeFocused();
  await page.locator('.lead-submit').click(); await expect(page.locator('#lead-name-error')).toContainText('Completá');
  await expect(page.locator('#lead-name')).toHaveAttribute('aria-invalid', 'true');
});
test('abrir y cerrar no registra, conserva datos y devuelve el foco', async ({ page }) => {
  let requests = 0; await page.route('**/.netlify/functions/create-lead', route => { requests++; return route.abort(); });
  await page.goto('/'); const trigger = page.locator('.js-lead-cta').first(); await trigger.click(); await page.fill('#lead-name', 'Ana María');
  await page.locator('.lead-close').click(); await expect(page.locator('#consulta')).toBeHidden(); await expect(trigger).toBeFocused();
  expect(requests).toBe(0); expect(await page.evaluate(() => (window.dataLayer || []).filter(x => x.event === 'tatos_lead_saved').length)).toBe(0);
  await trigger.click(); await expect(page.locator('#lead-name')).toHaveValue('Ana María'); await page.keyboard.press('Escape'); await expect(page.locator('#consulta')).toBeHidden();
});
test('mientras guarda cambia el botón y bloquea envíos duplicados', async ({ page }) => {
  let resolveRequest; let requests = 0;
  await page.route('**/.netlify/functions/create-lead', async route => { requests++; await new Promise(resolve => { resolveRequest = resolve; }); await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"SAVE_FAILED"}' }); });
  await page.goto('/'); await page.locator('.js-lead-cta').first().click();
  await page.fill('#lead-name', 'Ana'); await page.fill('#lead-cat', 'Nina'); await page.fill('#lead-phone', '+5491135942796');
  await page.click('.lead-submit'); await expect(page.locator('.lead-submit')).toHaveText('Abriendo WhatsApp…'); await expect(page.locator('.lead-submit')).toBeDisabled();
  await page.locator('.lead-submit').click({ force: true }); expect(requests).toBe(1); resolveRequest();
  await expect(page.locator('.lead-submit')).toHaveText('Continuar a WhatsApp'); await expect(page.locator('.lead-submit')).toBeEnabled();
});
test('guarda atribución coherente, emite evento sin PII y prepara WhatsApp', async ({ page }) => {
  let body; await page.route('**/.netlify/functions/create-lead', async route => { body = route.request().postDataJSON(); await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ saved: true, leadId: 'test' }) }); });
  // A 204 response preserves the current document while intercepting navigation.
  await page.route('https://wa.me/**', route => route.fulfill({ status: 204 }));
  await page.goto('/?gclid=AbC123&utm_source=google&utm_campaign=Primavera'); await page.goto('/');
  await page.locator('.js-lead-cta').first().click();
  await page.fill('#lead-name', 'María José'); await page.fill('#lead-cat', 'Mishí y León'); await page.fill('#lead-phone', '+54 9 11 3594 2796');
  const whatsappRequest = page.waitForRequest('https://wa.me/**');
  await page.click('.lead-submit'); await expect(page.locator('#lead-status')).toContainText('Consulta guardada');
  const navigation = await whatsappRequest;
  expect(body.attribution.gclid).toBe('AbC123'); expect(body.attribution.utm_campaign).toBe('Primavera');
  const events = await page.evaluate(() => window.dataLayer.filter(x => x.event === 'tatos_lead_saved'));
  expect(events).toEqual([{ event: 'tatos_lead_saved' }]);
  const href = await page.locator('#lead-whatsapp-fallback').getAttribute('href');
  expect(navigation.url()).toBe(href);
  expect(href).toContain('wa.me/5491135942796');
  expect(new URL(href).searchParams.get('text')).toBe('Hola, mi nombre es María José. Vi su página web y quisiera consultar si tienen disponibilidad para mi gato Mishí y León. ');
  expect(href).not.toContain('AbC123'); expect(new URL(href).searchParams.get('text')).not.toContain('+54');
});
test('fallo conserva datos y ofrece continuar sin afirmar registro', async ({ page }) => {
  await page.route('**/.netlify/functions/create-lead', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"SAVE_FAILED"}' }));
  await page.goto('/'); await page.locator('.js-lead-cta').first().click(); await page.fill('#lead-name', 'Ana'); await page.fill('#lead-cat', 'Nina'); await page.fill('#lead-phone', '+5491135942796'); await page.click('.lead-submit');
  await expect(page.locator('#lead-status')).toContainText('No pudimos guardar'); await expect(page.locator('#lead-name')).toHaveValue('Ana'); await expect(page.locator('#lead-whatsapp-fallback')).toBeVisible();
});
test('layout no desborda y secretos no aparecen en red del navegador', async ({ page }) => {
  const urls = []; page.on('request', request => urls.push(request.url())); await page.goto('/'); await page.locator('.js-lead-cta').first().click(); await page.locator('#consulta').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(urls.join('\n')).not.toMatch(/GOOGLE_PRIVATE_KEY|GOOGLE_SERVICE_ACCOUNT_EMAIL|docs\.google\.com\/spreadsheets/);
});
