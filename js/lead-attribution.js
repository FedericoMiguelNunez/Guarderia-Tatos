const PARAMS = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'campaign_id', 'adgroup_id', 'keyword'];
const KEY = 'tatos_lead_attribution_v1';
const TTL_DAYS = Math.max(1, Math.min(365, Number(document.documentElement.dataset.attributionTtlDays || 90)));
let memoryValue = null;

function storage() {
  try {
    const selected = window.tatosAdvertisingConsent === true ? localStorage : sessionStorage;
    const probe = `${KEY}_probe`; selected.setItem(probe, '1'); selected.removeItem(probe); return selected;
  } catch { return null; }
}
function read() {
  try {
    const value = JSON.parse(storage()?.getItem(KEY) || 'null') || memoryValue;
    if (!value || Date.parse(value.expiresAt) <= Date.now()) return null;
    return value;
  } catch { return memoryValue; }
}
function capture() {
  const query = new URLSearchParams(location.search); const params = {};
  for (const name of PARAMS) if (query.has(name) && query.get(name)) params[name] = query.get(name).slice(0, 500);
  if (!Object.keys(params).length) return read();
  const capturedAt = new Date().toISOString();
  const value = { ...params, capturedAt, entryPath: location.pathname, expiresAt: new Date(Date.now() + TTL_DAYS * 86400000).toISOString() };
  memoryValue = value; try { storage()?.setItem(KEY, JSON.stringify(value)); } catch { /* memory fallback */ }
  return value;
}

capture();
export const getFrozenAttribution = () => structuredClone(read() || {});
export const attributionConsentKnown = () => window.tatosAdvertisingConsent === true ? true : window.tatosAdvertisingConsent === false ? false : null;
