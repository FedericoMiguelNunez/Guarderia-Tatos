import { readFile } from 'node:fs/promises';
import { google } from 'googleapis';
import path from 'node:path';
import os from 'node:os';
const credential = JSON.parse(await readFile('C:/Users/fe-de/Downloads/centered-sight-383720-c94a9c7c1147.json', 'utf8'));
if (credential.client_email !== 'tatos-sheets@centered-sight-383720.iam.gserviceaccount.com') throw new Error('SERVICE_ACCOUNT_MISMATCH');
const auth = new google.auth.JWT({ email: credential.client_email, key: credential.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
try {
 const values = (await sheets.spreadsheets.values.get({ spreadsheetId: '17UZOjIkLGw8ykFsJRmiGlqIGwf91u8eurTZIU3fv5gc', range: "'Leads Google Ads'!A1:AZ16", valueRenderOption: 'FORMULA' })).data.values || [];
 const headers = values[0];
 console.log(JSON.stringify(values.slice(6, 15).map((row, index) => ({ row: index + 7, formulas: Object.fromEntries(headers.map((h, i) => [h, row[i]]).filter(([, v]) => typeof v === 'string' && v.startsWith('='))), moneda: row[headers.indexOf('Moneda')] })), null, 2));
 const report = JSON.parse(await readFile(path.join(os.tmpdir(), 'tatos-auditoria-17UZOjIk/form-timing-results.json'), 'utf8'));
 console.log(JSON.stringify({ runId: report.runId, summary: report.summary, summaryBySize: report.summaryBySize, error: report.error, successes: report.successes.map(item => ({ index: item.index, size: item.size, row: item.rowNumber, leadId: item.leadId, openingVisibleMs: item.clickToOpeningVisibleMs, openingDOMMs: item.clickToOpeningDOMMs, navigationMs: item.clickToNavigationMs, requestToParsedMs: item.requestToParsedResponseMs, afterParsedMs: item.parsedResponseToNavigationMs, stageTotals: item.stageTotalsMs, trace: item.persistenceTrace, blockedHosts: item.blockedHosts })), errors: report.errors }, null, 2));
} catch(error) { console.error(JSON.stringify({ error: error.response?.data?.error?.message || error.message, status: error.response?.status || null })); process.exitCode = 1; }
