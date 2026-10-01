import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createPrivateKey } from 'node:crypto';
import { getAPIToken } from '@netlify/dev-utils';

// Environment configuration only. No deployment, build, Sheets write or tag execution.
let phase = 'read-prepared-configuration';
try {
  const prepared = JSON.parse(await fs.readFile('docs/configuracion-produccion-pendiente.json', 'utf8'));
  const siteID = '80fb5b5d-a41b-48d2-8f76-26d91a6c795d';
  const accountID = '643c722dd45d4c2b212bedf8';
  const accountSlug = 'federicomiguelnunez';
  assert.equal(prepared.siteID, siteID);
  assert.equal(prepared.context, 'production');
  assert.equal(Object.keys(prepared.variables).length, 10);
  assert.equal(prepared.variables.ALLOW_PRODUCTION_WRITES, 'false');
  assert.equal(prepared.variables.ALLOW_TEST_SHEET_WRITES, 'false');
  const credential = JSON.parse(await fs.readFile(process.env.TATOS_CREDENTIAL_FILE || 'C:/Users/fe-de/Downloads/centered-sight-383720-c94a9c7c1147.json', 'utf8'));
  assert.equal(credential.client_email, prepared.variables.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  assert.equal(credential.type, 'service_account');
  assert.equal(createPrivateKey(credential.private_key).type, 'private');
  const expected = { ...prepared.variables, GOOGLE_PRIVATE_KEY: credential.private_key };
  const token = await getAPIToken();
  assert.ok(token, 'NETLIFY_LOGIN_REQUIRED');
  async function api(route, method = 'GET', body) {
    const response = await fetch(`https://api.netlify.com/api/v1${route}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw Object.assign(new Error('NETLIFY_API_REJECTED'), { safeStatus: response.status });
    if (response.status === 204) return null;
    return response.json();
  }
  phase = 'confirm-production-site';
  const beforeSite = await api(`/sites/${siteID}`);
  assert.equal(beforeSite.id, siteID);
  assert.equal(beforeSite.account_id, accountID);
  assert.equal(beforeSite.custom_domain, 'guarderiatatos.com.ar');
  const envRoute = `/accounts/${accountSlug}/env`;
  const query = `?site_id=${siteID}`;
  const before = await api(envRoute + query);
  const newVariables = [];
  phase = 'configure-production-variables';
  for (const [key, value] of Object.entries(expected)) {
    const existing = before.find(item => item.key === key);
    const preserved = (existing?.values || []).filter(item => item.context !== 'production');
    const values = [...preserved, { context: 'production', value }];
    const scopes = [...new Set([...(existing?.scopes || []), ...prepared.scopes])];
    const body = { key, scopes, values };
    if (existing) await api(`${envRoute}/${encodeURIComponent(key)}${query}`, 'PUT', body);
    else newVariables.push(body);
  }
  if (newVariables.length) await api(envRoute + query, 'POST', newVariables);
  phase = 'verify-without-secret-output';
  const after = await api(envRoute + query);
  const checks = [];
  for (const [key, value] of Object.entries(expected)) {
    const item = after.find(variable => variable.key === key);
    const setting = item?.values?.find(candidate => candidate.context === 'production');
    assert.ok(setting?.value === value, `VALUE_NOT_CONFIRMED_${key}`);
    assert.ok(prepared.scopes.every(scope => item.scopes.includes(scope)), `SCOPES_NOT_CONFIRMED_${key}`);
    const previous = before.find(variable => variable.key === key);
    for (const preserved of previous?.values?.filter(candidate => candidate.context !== 'production') || []) {
      assert.ok(item.values.some(candidate => candidate.context === preserved.context && candidate.context_parameter === preserved.context_parameter && candidate.value === preserved.value), `OTHER_CONTEXT_CHANGED_${key}`);
    }
    checks.push({ key, productionValueVerified: true, scopesVerified: true });
  }
  const afterSite = await api(`/sites/${siteID}`);
  assert.equal(afterSite.published_deploy?.id, beforeSite.published_deploy?.id, 'PUBLISHED_DEPLOY_CHANGED');
  assert.equal(afterSite.deploy_id, beforeSite.deploy_id, 'DEPLOY_CHANGED');
  console.log(JSON.stringify({ verified: true, siteID, domain: 'guarderiatatos.com.ar', context: 'production', variables: checks, ALLOW_PRODUCTION_WRITES: 'false', ALLOW_TEST_SHEET_WRITES: 'false', privateKeySource: 'external file; exact equality verified in memory', publishedDeployUnchanged: true, deploymentRequested: false, secretsPrintedOrWrittenToWorkspace: false }, null, 2));
} catch (error) {
  // Never serialize API errors, response bodies, credentials or assertion values.
  console.error(JSON.stringify({ verified: false, phase, errorType: error.name, httpStatus: error.safeStatus || null }));
  process.exitCode = 1;
}
