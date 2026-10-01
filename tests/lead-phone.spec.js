import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { LeadService } from '../server/lead-service.mjs';
import { MockIdempotencyStore } from '../server/idempotency-store.mjs';
import { MockSheetsStore } from '../server/sheets-store.mjs';

// Exercise the real backend validation/record mapping, with storage only in
// memory. No request reaches Netlify Functions, Sheets, WhatsApp or ad tags.
const test = base.extend({
  flow: async ({ page, baseURL }, use) => {
    const sheets = new MockSheetsStore();
    const service = new LeadService({ idempotency: new MockIdempotencyStore(), sheets });
    const requests = []; const whatsapp = [];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'wa.me') {
        whatsapp.push(url.href);
        return route.fulfill({ status: 204 });
      }
      if (url.origin !== new URL(baseURL).origin) return route.abort();
      if (url.pathname === '/.netlify/functions/create-lead') {
        const payload = route.request().postDataJSON(); requests.push(payload);
        try {
          const result = await service.create(payload);
          return route.fulfill({ status: result.status, json: result.body });
        } catch (error) {
          return route.fulfill({ status: 400, json: { error: 'VALIDATION_ERROR', field: error.field } });
        }
      }
      return route.continue();
    });
    await use({ requests, whatsapp, rows: sheets.rows });
  }
});

async function fillForm(page, phone) {
  await page.locator('.js-lead-cta').first().click();
  await page.getByLabel('Tu nombre', { exact: true }).fill('Prueba ficticia');
  await page.getByLabel('Nombre de tu gato', { exact: true }).fill('Gato ficticio');
  await page.getByLabel('Tu número de WhatsApp', { exact: true }).fill(phone);
}

const accepted = [
  ['11 2345-6789', '+5491123456789'],
  ['011 15 2345-6789', '+5491123456789'],
  ['+54 9 11 2345-6789', '+5491123456789'],
  ['1123456789', '+5491123456789'],
  ['(011) 15-2345-6789', '+5491123456789'],
  ['011 2345-6789', '+5491123456789'],
  ['(0341) 15 234-5678', '+5493412345678'],
  ['(02954) 15 23-4567', '+5492954234567'],
  ['+1 (202) 555-0123', '+12025550123']
];

for (const [phone, international] of accepted) {
  test(`teléfono: acepta ${phone} y conserva el mismo número hasta el registro`, async ({ page, flow }, testInfo) => {
    await page.goto('/');
    await fillForm(page, phone);
    await page.getByRole('button', { name: 'Continuar a WhatsApp', exact: true }).click();
    await expect(page.locator('#lead-phone-error')).toBeEmpty();
    await expect(page.locator('#lead-phone')).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('#lead-status')).toContainText('Consulta guardada');
    await expect.poll(() => flow.whatsapp.length).toBe(1);
    expect(flow.requests).toHaveLength(1);
    expect(flow.requests[0].phone).toBe(international);
    expect(flow.rows).toHaveLength(1);
    expect(flow.rows[0].WhatsApp).toBe(international);
    await expect(page.locator('#lead-phone')).toHaveValue(international);
    expect(new URL(flow.whatsapp[0]).pathname).toBe('/5491135942796');
    if (accepted.slice(0, 3).some(([value]) => value === phone)) {
      await page.screenshot({ path: testInfo.outputPath('formulario-aceptado.png') });
    }
  });
}

test('teléfono: pide el código de área y no inventa una característica', async ({ page, flow }) => {
  for (const phone of ['2345-6789', '15 2345-6789', '15 11 2345-6789']) {
    await page.goto('/'); await fillForm(page, phone);
    await page.locator('.lead-submit').click();
    await expect(page.locator('#lead-phone')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#lead-phone-error')).toContainText('código de área (por ejemplo, 11)');
  }
  expect(flow.requests).toHaveLength(0);
  expect(flow.rows).toHaveLength(0);
  expect(flow.whatsapp).toHaveLength(0);
});

test('teléfono: carga la versión actual y la biblioteca sin 404', async ({ page, flow }) => {
  const responses = new Map();
  page.on('response', response => responses.set(new URL(response.url()).pathname, response));
  await page.goto('/');
  for (const asset of ['js/lead-form.js', 'js/phone-normalization.js', 'vendor/libphonenumber-js.min.js']) {
    const response = responses.get('/' + asset);
    expect(response, `Falta ${asset}`).toBeTruthy();
    expect(response.status()).toBe(200);
    expect(await response.body()).toEqual(await readFile(new URL('../' + asset, import.meta.url)));
  }
  await page.locator('.js-lead-cta').first().click();
  await expect(page.locator('#lead-phone-help')).toContainText('011 15 2345-6789');
  expect(flow.requests).toHaveLength(0);
});

test('teléfono: una biblioteca ausente no se informa como número inválido', async ({ page, flow }) => {
  await page.route('**/vendor/libphonenumber-js.min.js', route => route.abort());
  await page.goto('/'); await fillForm(page, '11 2345-6789');
  await page.locator('.lead-submit').click();
  await expect(page.locator('#lead-phone-error')).toBeEmpty();
  await expect(page.locator('#lead-status')).toContainText('No pudimos cargar la validación');
  expect(flow.requests).toHaveLength(0);
  expect(flow.whatsapp).toHaveLength(0);
});
