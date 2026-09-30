import fs from 'node:fs/promises';
import { google } from 'googleapis';
import { getAPIToken } from '@netlify/dev-utils';
import { REQUIRED_HEADERS, PRODUCTION_SHEET_ID } from '../server/sheets-store.mjs';

// Read-only: no row reads, writes, secret output, deployments or tag execution.
const credential = JSON.parse(await fs.readFile(process.env.TATOS_CREDENTIAL_FILE || 'C:/Users/fe-de/Downloads/centered-sight-383720-c94a9c7c1147.json', 'utf8'));
const auth = new google.auth.JWT({ email: credential.client_email, key: credential.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const sheets = google.sheets({ version: 'v4', auth });
const report = { checkedAt: new Date().toISOString(), readOnly: true, sheetID: PRODUCTION_SHEET_ID };
try {
  const metadata = (await sheets.spreadsheets.get({ spreadsheetId: PRODUCTION_SHEET_ID, fields: 'sheets.properties' })).data;
  const tab = metadata.sheets.find(item => item.properties.title === 'Leads Google Ads');
  if (!tab) throw new Error('PRODUCTION_TAB_NOT_FOUND');
  const values = (await sheets.spreadsheets.values.get({ spreadsheetId: PRODUCTION_SHEET_ID, range: "'Leads Google Ads'!A1:AZ1" })).data.values || [];
  const headers = values[0] || [];
  report.sheet = { accessConfirmed: true, tab: tab.properties.title, headerRange: 'A1:AZ1', headers, missingHeaders: REQUIRED_HEADERS.filter(header => !headers.includes(header)), duplicateHeaders: [...new Set(headers.filter((header, index) => headers.indexOf(header) !== index))] };
} catch (error) {
  report.sheet = { accessConfirmed: false, error: error.response?.status || error.code || error.name };
}
try {
  const token = await getAPIToken();
  const siteID = '80fb5b5d-a41b-48d2-8f76-26d91a6c795d';
  const response = await fetch(`https://api.netlify.com/api/v1/accounts/federicomiguelnunez/env?site_id=${siteID}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`NETLIFY_HTTP_${response.status}`);
  const variables = await response.json();
  const expected = JSON.parse(await fs.readFile('docs/configuracion-produccion-pendiente.json', 'utf8')).variables;
  report.netlify = { siteID, variables: Object.entries(expected).map(([key, value]) => {
    const item = variables.find(variable => variable.key === key);
    const setting = item?.values?.find(candidate => candidate.context === 'production') || item?.values?.find(candidate => candidate.context === 'all');
    return { key, productionValuePresent: Boolean(setting?.value), matchesPreparedValue: key === 'GOOGLE_PRIVATE_KEY' ? undefined : setting?.value === value, availableToFunctions: Boolean(item?.scopes?.includes('functions')) };
  }) };
} catch (error) { report.netlify = { error: error.message }; }
console.log(JSON.stringify(report, null, 2));
