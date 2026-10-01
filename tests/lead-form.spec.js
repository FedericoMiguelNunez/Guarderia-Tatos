import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'wa.me') return route.fulfill({ status: 204 });
    if (url.origin !== new URL(baseURL).origin || url.pathname === '/.netlify/functions/create-lead') return route.abort();
    return route.continue();
  });
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
  await page.route('**/.netlify/functions/create-lead', async route => { requests++; await new Promise(resolve => { resolveRequest = resolve; }); await route.fulfill({ status: 201, contentType: 'application/json', body: '{"saved":true,"leadId":"fake-blocked-submit"}' }); });
  await page.goto('/'); await page.locator('.js-lead-cta').first().click();
  await page.fill('#lead-name', 'Ana'); await page.fill('#lead-cat', 'Nina'); await page.fill('#lead-phone', '1112345678');
  await page.click('.lead-submit'); await expect(page.locator('.lead-submit')).toHaveText('Abriendo WhatsApp…'); await expect(page.locator('.lead-submit')).toBeDisabled();
  await page.locator('.lead-submit').click({ force: true }); expect(requests).toBe(1);
  const whatsappResponse = page.waitForResponse('https://wa.me/**'); resolveRequest();
  await expect(page.locator('.lead-submit')).toHaveText('Continuar a WhatsApp'); await expect(page.locator('.lead-submit')).toBeEnabled();
  await whatsappResponse;
});
test('guarda atribución coherente, emite evento sin PII y prepara WhatsApp', async ({ page }) => {
  let body; await page.route('**/.netlify/functions/create-lead', async route => { body = route.request().postDataJSON(); await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ saved: true, leadId: 'test' }) }); });
  // A 204 response preserves the current document while intercepting navigation.
  await page.route('https://wa.me/**', route => route.fulfill({ status: 204 }));
  await page.goto('/?gclid=AbC123&utm_source=google&utm_campaign=Primavera'); await page.goto('/');
  await page.locator('.js-lead-cta').first().click();
  await expect(page.locator('#lead-phone-help')).toContainText('código de área (por ejemplo, 11)');
  await page.fill('#lead-name', 'María José'); await page.fill('#lead-cat', 'Mishí y León'); await page.fill('#lead-phone', '1112345678');
  const whatsappRequest = page.waitForRequest('https://wa.me/**');
  await page.click('.lead-submit'); await expect(page.locator('#lead-status')).toContainText('Consulta guardada');
  const navigation = await whatsappRequest;
  expect(body.phone).toBe('+5491112345678');
  expect(body.attribution.gclid).toBe('AbC123'); expect(body.attribution.utm_campaign).toBe('Primavera');
  const events = await page.evaluate(() => window.dataLayer.filter(x => x.event === 'tatos_lead_saved'));
  expect(events).toEqual([{ event: 'tatos_lead_saved' }]);
  const href = navigation.url();
  expect(href).toContain('wa.me/5491135942796');
  expect(new URL(href).searchParams.get('text')).toBe('Hola, mi nombre es María José. Vi su página web y quisiera consultar si tienen disponibilidad para mi gato Mishí y León. ');
  expect(href).not.toContain('AbC123'); expect(new URL(href).searchParams.get('text')).not.toContain('+54');
});
test('reproduce y corrige el rechazo de formatos argentinos habituales en el formulario', async ({ page }) => {
  const requests = [];
  await page.route('**/.netlify/functions/create-lead', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ saved: true, leadId: `fake-${requests.length}` }) });
  });
  await page.route('https://wa.me/**', route => route.fulfill({ status: 204 }));

  for (const phone of ['11 2345-6789', '011 15 2345-6789', '+54 9 11 2345-6789']) {
    await page.goto('/');
    await page.locator('.js-lead-cta').first().click();
    await page.fill('#lead-name', 'Prueba ficticia');
    await page.fill('#lead-cat', 'Gato ficticio');
    await page.fill('#lead-phone', phone);
    const whatsappRequest = page.waitForRequest('https://wa.me/**');
    await page.locator('.lead-submit').click();
    await expect(page.locator('#lead-phone')).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('#lead-phone-error')).toBeEmpty();
    await expect(page.locator('#lead-status')).toContainText('Consulta guardada');
    await whatsappRequest;
  }

  expect(requests.map(request => request.phone)).toEqual([
    '+5491123456789', '+5491123456789', '+5491123456789'
  ]);

  await page.goto('/');
  await page.locator('.js-lead-cta').first().click();
  await page.fill('#lead-name', 'Prueba ficticia');
  await page.fill('#lead-cat', 'Gato ficticio');
  await page.fill('#lead-phone', '2345-6789');
  await page.locator('.lead-submit').click();
  await expect(page.locator('#lead-phone')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#lead-phone-error')).toContainText('código de área (por ejemplo, 11)');
  expect(requests).toHaveLength(3);
});
test('fallo y timeout llevan a WhatsApp sin reenvío ni evento de éxito', async ({ page }) => {
  let mode = 'timeout'; let requests = 0; let finishSlowRoute;
  const slowRouteFinished = new Promise(resolve => { finishSlowRoute = resolve; });
  await page.route('**/.netlify/functions/create-lead', async route => {
    requests++;
    if (mode === 'timeout') {
      await new Promise(resolve => setTimeout(resolve, 9000));
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{"saved":true,"leadId":"late"}' }).catch(() => {});
      finishSlowRoute();
    } else {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"SAVE_FAILED"}' });
    }
  });
  await page.route('https://wa.me/**', route => route.fulfill({ status: 204 }));

  const submitAndCheckFailure = async (expectedStatus, statusTimeout = 5000) => {
    await page.locator('.js-lead-cta').first().click();
    await page.fill('#lead-name', 'Ana'); await page.fill('#lead-cat', 'Nina'); await page.fill('#lead-phone', '+5491135942796');
    const whatsappRequest = page.waitForRequest('https://wa.me/**');
    await page.click('.lead-submit');
    await expect(page.locator('#lead-status')).toContainText(expectedStatus, { timeout: statusTimeout });
    const navigation = await whatsappRequest;
    expect(new URL(navigation.url()).searchParams.get('text')).toContain('mi nombre es Ana');
    await expect(page.locator('#lead-name')).toHaveValue('Ana');
    await expect(page.locator('.lead-submit')).toHaveText('Abriendo WhatsApp…');
    await expect(page.locator('.lead-submit')).toBeDisabled();
    await expect(page.locator('#lead-whatsapp-fallback')).toHaveCount(0);
    expect(await page.evaluate(() => (window.dataLayer || []).filter(item => item.event === 'tatos_lead_saved').length)).toBe(0);
    await page.locator('.lead-submit').click({ force: true });
  };

  await page.goto('/');
  await submitAndCheckFailure('No pudimos confirmar el guardado a tiempo', 12000);
  expect(requests).toBe(1);
  await slowRouteFinished;

  mode = 'save-failure';
  await page.goto('/');
  await submitAndCheckFailure('No pudimos guardar la consulta');
  expect(requests).toBe(2);
});
test('layout no desborda y secretos no aparecen en red del navegador', async ({ page }) => {
  const urls = []; page.on('request', request => urls.push(request.url())); await page.goto('/'); await page.locator('.js-lead-cta').first().click(); await page.locator('#consulta').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(urls.join('\n')).not.toMatch(/GOOGLE_PRIVATE_KEY|GOOGLE_SERVICE_ACCOUNT_EMAIL|docs\.google\.com\/spreadsheets/);
});
