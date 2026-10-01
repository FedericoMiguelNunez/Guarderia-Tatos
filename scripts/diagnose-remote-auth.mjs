import assert from 'node:assert/strict';
import { getAPIToken, getGlobalConfigStore } from '@netlify/dev-utils';

// Read-only audit. Never print response bodies or credential values.
const siteID = '19f95382-9b4e-44dc-b1df-21e9856ff58f';
const teamID = '643c722dd45d4c2b212bedf8';
const token = process.env.NETLIFY_AUTH_TOKEN || await getAPIToken();
assert.ok(token, 'CLI_LOGIN_REQUIRED');
const config = await getGlobalConfigStore();
const userID = config.get('userId');
console.log(JSON.stringify({ credentialSource: process.env.NETLIFY_AUTH_TOKEN ? 'NETLIFY_AUTH_TOKEN' : 'CLI global config, active user', userID, environmentTokenPresent: Boolean(process.env.NETLIFY_AUTH_TOKEN), localBlobsContextPresent: Boolean(process.env.NETLIFY_BLOBS_CONTEXT) }));
console.log(JSON.stringify({ credentialFormat: { hasWhitespace: /\s/.test(token), hasNonASCII: /[^\x20-\x7e]/.test(token), hasQuotes: /['"]/.test(token), hasControlCharacters: /[\x00-\x1f\x7f]/.test(token) } }));
async function read(route, select) {
  const response = await fetch(`https://api.netlify.com/api/v1${route}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  console.log(JSON.stringify({ route, status: response.status }));
  if (!response.ok) return;
  const data = await response.json();
  console.log(JSON.stringify(select(data)));
}
try {
  if (process.argv.includes('--membership-only')) {
    await read('/federicomiguelnunez/members', d => ({ membership: d.filter(m => m.id === userID || m.user_id === userID).map(m => ({ id: m.id, user_id: m.user_id, role: m.role, site_access: m.site_access })) }));
  } else {
  await read('/user', d => ({ identity: { id: d.id, email: d.email } }));
  await read(`/sites/${siteID}`, d => {
    assert.equal(d.id, siteID); assert.equal(d.account_id, teamID);
    return { site: { id: d.id, name: d.name, account_id: d.account_id, account_slug: d.account_slug, published_deploy_id: d.published_deploy?.id ?? null } };
  });
  await read(`/accounts/${teamID}`, d => ({ team: { id: d.id, name: d.name, slug: d.slug, type_name: d.type_name, saml_enabled: d.saml_enabled, saml_enforced: d.saml_enforced } }));
  await read('/federicomiguelnunez/members', d => ({ membership: d.filter(m => m.id === userID || m.user_id === userID).map(m => ({ id: m.id, user_id: m.user_id, role: m.role, site_access: m.site_access })) }));
  }
} catch (error) { console.error(JSON.stringify({ error: 'READ_ONLY_AUTH_AUDIT_FAILED', name: error.name, code: error.code ?? error.cause?.code ?? null })); process.exitCode = 1; }
