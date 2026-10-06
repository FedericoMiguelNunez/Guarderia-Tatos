import { test, expect } from '@playwright/test';

const pages = [
  '/index.html', '/Nosotros.html', '/Servicios-de-la-guarderia-para-gatos.html',
  '/requisitos-para-ingresar-a-la-guarderia-para-gatos.html', '/galeria.html'
];

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'wa.me') return route.fulfill({ status: 204 });
    if (url.origin !== new URL(baseURL).origin || url.pathname === '/.netlify/functions/create-lead') return route.abort();
    return route.continue();
  });
});

for (const [index, path] of pages.entries()) {
  test(`${path}: todos los CTA abren el modal y conservan el flujo y la atribución`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    let confirmSave;
    await page.route('**/.netlify/functions/create-lead', async route => {
      requests.push(route.request().postDataJSON());
      await new Promise(resolve => { confirmSave = resolve; });
      await route.fulfill({ status: 201, json: { saved: true, leadId: `test-page-${index}` } });
    });
    const attribution = {
      utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'disponibilidad',
      utm_term: 'guarderia gatos', utm_content: 'anuncio',
      gclid: 'test-gclid', gbraid: 'test-gbraid', wbraid: 'test-wbraid'
    };
    const entryPath = pages[(index + 1) % pages.length];
    await page.goto(`${entryPath}?${new URLSearchParams(attribution)}`);
    await page.goto(path);
    await expect(page.locator('#lead-form')).toHaveCount(1);
    await expect(page.locator('#consulta')).toBeHidden();
    await expect(page.locator('a[href*="wa.link"], a[href*="wa.me"], [onclick*="wa.link"]')).toHaveCount(0);
    const triggers = page.locator('.js-lead-cta');
    expect(await triggers.count()).toBeGreaterThan(0);
    for (const trigger of await triggers.all()) {
      // Icon fonts are blocked. The standalone gallery also has no responsive page CSS.
      if (path !== '/galeria.html' && (await trigger.textContent()).trim()) await trigger.click();
      else await trigger.press('Enter');
      await expect(page.locator('#consulta')).toBeVisible();
      await expect(page.locator('#lead-name')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('#consulta')).toBeHidden();
      await expect(trigger).toBeFocused();
    }
    expect(requests).toHaveLength(0);
    await triggers.first().press('Enter');
    await page.fill('#lead-name', 'Ana');
    await page.fill('#lead-cat', 'Mishi');
    await page.fill('#lead-phone', '2345-6789');
    await page.locator('.lead-submit').click();
    await expect(page.locator('#lead-phone')).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toHaveLength(0);
    expect(await page.locator('.lead-card').evaluate(node => {
      const rect = node.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    })).toBe(true);
    await page.fill('#lead-phone', '011 15 2345-6789');
    let navigations = 0;
    page.on('request', request => { if (new URL(request.url()).hostname === 'wa.me') navigations++; });
    await page.locator('.lead-submit').click();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toMatchObject({ phone: '+5491123456789', attribution: { ...attribution, entryPath } });
    expect(requests[0].idempotencyKey).toMatch(/^[\da-f]{8}(?:_[\da-f]{4}){3}_[\da-f]{12}$/);
    const events = () => page.evaluate(() => (window.dataLayer || []).filter(item => item.event === 'tatos_lead_saved'));
    expect(await events()).toEqual([]);
    expect(navigations).toBe(0);
    await expect(page.locator('.lead-submit')).toBeDisabled();
    // Record the event before the intercepted WhatsApp navigation.
    await page.evaluate(() => {
      const push = window.dataLayer?.push || Array.prototype.push;
      window.dataLayer ||= [];
      window.dataLayer.push = function (...items) {
        if (items.some(item => item.event === 'tatos_lead_saved')) window.savedAt = Date.now();
        return push.apply(this, items);
      };
    });
    const whatsapp = page.waitForRequest('https://wa.me/**');
    confirmSave();
    const request = await whatsapp;
    expect(await page.evaluate(() => window.savedAt)).toBeGreaterThan(0);
    expect(await events()).toEqual([{ event: 'tatos_lead_saved' }]);
    expect(new URL(request.url()).pathname).toBe('/5491135942796');
    expect(new URL(request.url()).searchParams.get('text')).toContain('mi gato Mishi');
    expect(requests).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}
