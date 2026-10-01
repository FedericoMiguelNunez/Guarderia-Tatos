import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getAPIToken } from '@netlify/dev-utils';
import { zipFunctions } from '@netlify/zip-it-and-ship-it';
import { google } from 'googleapis';
import { chromium } from '@playwright/test';
import { REQUIRED_HEADERS } from '../server/sheets-store.mjs';

const siteID = '19f95382-9b4e-44dc-b1df-21e9856ff58f';
const sheetID = '17UZOjIkLGw8ykFsJRmiGlqIGwf91u8eurTZIU3fv5gc';
const teamID = '643c722dd45d4c2b212bedf8';
const teamSlug = 'federicomiguelnunez';
const tab = 'Leads Google Ads';
const token = await getAPIToken();
assert.ok(token, 'CLI_LOGIN_REQUIRED');
const reportPath = path.join(os.tmpdir(), 'tatos-remote-audit', 'integration-result.json');
const report = { siteID, sheetID, draft: true, productionActivated: false };
let phase = 'access', browser;
async function api(route, method = 'GET', body, binary = false) {
  const response = await fetch(`https://api.netlify.com/api/v1${route}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': binary ? 'application/octet-stream' : 'application/json' },
    body: body === undefined ? undefined : binary ? body : JSON.stringify(body), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) {
    const detail = await response.text();
    const scopeRestriction = /scope|plan|upgrade|premium/i.test(detail);
    throw new Error(`NETLIFY_HTTP_${response.status}_${method}_${route}${scopeRestriction ? '_SCOPE_OR_PLAN_RESTRICTION' : ''}`);
  }
  return response.json();
}
async function filesIn(directory, prefix = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) results.push(...await filesIn(path.join(directory, entry.name), relative + '/'));
    else results.push({ relative, buffer: await fs.readFile(path.join(directory, entry.name)) });
  }
  return results;
}
try {
  const site = await api(`/sites/${siteID}`);
  assert.equal(site.account_id, teamID);
  assert.equal(site.name, 'tatos-backend-test-mun7j93b');
  const account = await api(`/accounts/${teamID}`);
  assert.equal(account.type_name, 'Free');
  assert.equal(account.auto_topup_enabled, false);
  assert.equal(account.usages_exceeded.length, 0);
  assert.ok(account.capabilities.functions.used < account.capabilities.functions.included);
  const credential = JSON.parse(await fs.readFile(process.env.TATOS_CREDENTIAL_FILE || 'C:/Users/fe-de/Downloads/centered-sight-383720-c94a9c7c1147.json', 'utf8'));
  assert.equal(credential.client_email, 'tatos-sheets@centered-sight-383720.iam.gserviceaccount.com');
  const auth = new google.auth.JWT({ email: credential.client_email, key: credential.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const read = async () => (await sheets.spreadsheets.values.get({ spreadsheetId: sheetID, range: `'${tab}'!A1:AZ`, valueRenderOption: 'FORMULA' })).data.values || [];
  const before = await read();
  assert.ok(REQUIRED_HEADERS.every(header => before[0].includes(header)), 'TEST_SHEET_HEADERS_MISSING');
  phase = 'test-environment';
  const settings = {
    APP_ENV: 'test', TEST_NETLIFY_SITE_ID: siteID, LEAD_STORAGE_MODE: 'blobs', ALLOW_PRODUCTION_WRITES: 'false', ALLOW_TEST_SHEET_WRITES: 'true',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: credential.client_email, GOOGLE_PRIVATE_KEY: credential.private_key,
    GOOGLE_SHEETS_ID: sheetID, GOOGLE_SHEETS_TAB: tab,
    LEAD_BLOBS_STORE_NAME: 'tatos-lead-operations-test-17UZOjIk'
  };
  // Only this existing test site's un-published contexts receive these settings.
  const existing = await api(`/accounts/${teamSlug}/env?site_id=${siteID}`);
  for (const [key, value] of Object.entries(settings)) {
    const previous = existing.find(item => item.key === key);
    const values = (previous?.values || []).filter(item => !['dev', 'deploy-preview'].includes(item.context));
    values.push({ context: 'dev', value }, { context: 'deploy-preview', value });
    const body = { key, scopes: ['builds', 'functions', 'runtime', 'post_processing'], values };
    if (previous) await api(`/accounts/${teamSlug}/env/${encodeURIComponent(key)}?site_id=${siteID}`, 'PUT', body);
    else await api(`/accounts/${teamSlug}/env?site_id=${siteID}`, 'POST', [body]);
  }
  phase = 'package';
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tatos-integration-'));
  const functions = await zipFunctions(path.resolve('netlify/functions'), path.join(directory, 'functions'), { config: { '*': { nodeBundler: 'esbuild' } } });
  assert.equal(functions.length, 1);
  const fn = functions[0];
  assert.equal(fn.runtimeAPIVersion, 2);
  const bundle = await fs.readFile(fn.path);
  assert.ok(!bundle.includes(Buffer.from(credential.private_key)), 'SECRET_IN_BUNDLE');
  const publicFiles = await filesIn(path.resolve('dist'));
  const hash = buffer => createHash('sha1').update(buffer).digest('hex');
  const fileMap = Object.fromEntries(publicFiles.map(file => ['/' + file.relative, hash(file.buffer)]));
  const functionHash = createHash('sha256').update(bundle).digest('hex');
  phase = 'draft-deploy';
  let deploy = await api(`/sites/${siteID}/deploys`, 'POST', {
    draft: true, files: fileMap, functions: { [fn.name]: functionHash },
    functions_config: { [fn.name]: { build_data: { bootstrapVersion: fn.bootstrapVersion, runtimeAPIVersion: fn.runtimeAPIVersion }, routes: fn.routes, excluded_routes: fn.excludedRoutes } }
  });
  report.deployID = deploy.id;
  const required = new Set(deploy.required || []);
  for (const file of publicFiles) if (required.has(hash(file.buffer))) {
    await api(`/deploys/${deploy.id}/files/${file.relative.split('/').map(encodeURIComponent).join('/')}`, 'PUT', file.buffer, true);
    required.delete(hash(file.buffer));
  }
  if (deploy.required_functions?.includes(functionHash)) {
    const parameters = new URLSearchParams({ runtime: fn.runtimeVersion || fn.runtime, invocation_mode: fn.invocationMode });
    await api(`/deploys/${deploy.id}/functions/${fn.name}?${parameters}`, 'PUT', bundle, true);
  }
  const deadline = Date.now() + 180000;
  while (deploy.state !== 'ready') {
    assert.notEqual(deploy.state, 'error', 'DEPLOY_FAILED');
    assert.ok(Date.now() < deadline, 'DEPLOY_TIMEOUT');
    await new Promise(resolve => setTimeout(resolve, 3000));
    deploy = await api(`/deploys/${deploy.id}`);
  }
  const base = deploy.deploy_ssl_url || deploy.deploy_url;
  report.url = base;
  console.log(JSON.stringify({ phase: 'draft-ready', url: base, runtimeAPIVersion: fn.runtimeAPIVersion }));
  // Origin is configured through the existing test site, without publishing.
  const origins = await api(`/accounts/${teamSlug}/env?site_id=${siteID}`);
  const previousOrigin = origins.find(item => item.key === 'ALLOWED_ORIGINS');
  const originValues = (previousOrigin?.values || []).filter(item => !['dev', 'deploy-preview'].includes(item.context));
  originValues.push({ context: 'dev', value: base }, { context: 'deploy-preview', value: base });
  const originBody = { key: 'ALLOWED_ORIGINS', scopes: ['builds', 'functions', 'runtime', 'post_processing'], values: originValues };
  if (previousOrigin) await api(`/accounts/${teamSlug}/env/ALLOWED_ORIGINS?site_id=${siteID}`, 'PUT', originBody);
  else await api(`/accounts/${teamSlug}/env?site_id=${siteID}`, 'POST', [originBody]);
  phase = 'complete-submit';
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let navigation, payload;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'wa.me') { navigation = url.href; await route.fulfill({ status: 204 }); }
    else if (url.origin === base) await route.continue();
    else await route.abort();
  });
  await page.addInitScript(() => { window.tatosAdvertisingConsent = false; });
  await page.goto(base);
  await page.locator('.js-lead-cta').first().click();
  await page.fill('#lead-name', 'PRUEBA INTEGRACIÓN REMOTA');
  await page.fill('#lead-cat', 'Michifuz Ficticio');
  await page.fill('#lead-phone', '+12025550123');
  page.on('request', request => { if (request.url().endsWith('/.netlify/functions/create-lead')) payload = request.postDataJSON(); });
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/.netlify/functions/create-lead'), { timeout: 60000 });
  await page.click('.lead-submit');
  const response = await responsePromise;
  const result = await response.json();
  report.first = { status: response.status(), ...result };
  assert.equal(result.saved, true, `SUBMIT_FAILED_${response.status()}_${result.error}`);
  await page.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'success');
  for (let i = 0; !navigation && i < 100; i++) await page.waitForTimeout(50);
  assert.ok(navigation, 'WHATSAPP_NOT_OBSERVED');
  report.whatsapp = { observed: true, intercepted: true, message: new URL(navigation).searchParams.get('text') };
  phase = 'same-request-retry';
  const retry = await fetch(base + '/.netlify/functions/create-lead', { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60000) });
  const replay = await retry.json();
  report.retry = { status: retry.status, ...replay };
  assert.equal(retry.status, 200); assert.equal(replay.replayed, true); assert.equal(replay.leadId, result.leadId);
  const after = await read();
  const idColumn = after[0].indexOf('ID de consulta');
  const matching = after.slice(1).filter(row => row[idColumn] === result.leadId);
  assert.equal(matching.length, 1, 'DUPLICATE_OR_MISSING_ROW');
  report.matchingRows = matching.length;
  phase = 'registration-failure-whatsapp';
  const fallbackPage = await browser.newPage();
  let fallbackNavigation;
  await fallbackPage.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/.netlify/functions/create-lead') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'SERVICE_UNAVAILABLE' }) });
    else if (url.hostname === 'wa.me') { fallbackNavigation = url.href; await route.fulfill({ status: 204 }); }
    else if (url.origin === base) await route.continue();
    else await route.abort();
  });
  await fallbackPage.goto(base);
  await fallbackPage.locator('.js-lead-cta').first().click();
  await fallbackPage.fill('#lead-name', 'PRUEBA FALLO REGISTRO');
  await fallbackPage.fill('#lead-cat', 'Michifuz Ficticio');
  await fallbackPage.fill('#lead-phone', '+12025550123');
  await fallbackPage.click('.lead-submit');
  await fallbackPage.waitForFunction(() => document.querySelector('#lead-status').dataset.state === 'error');
  await fallbackPage.click('#lead-whatsapp-fallback');
  assert.ok(fallbackNavigation, 'FAILURE_WHATSAPP_NOT_OBSERVED');
  report.failureFallback = { observed: true, injectedHTTPStatus: 503, intercepted: true, sheetsWrites: 0 };
  report.passed = true;
  console.log(JSON.stringify(report));
} catch (error) {
  report.passed = false;
  report.failure = { phase, code: error.code || error.message?.split('\n')[0] || error.name, status: error.response?.status };
  console.error(JSON.stringify(report.failure));
  process.exitCode = 1;
} finally {
  if (browser) { for (const context of browser.contexts()) for (const page of context.pages()) await page.unrouteAll({ behavior: 'ignoreErrors' }); await browser.close(); }
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath }));
}
