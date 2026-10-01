import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { google } from 'googleapis';
const stateRoot = path.join(os.tmpdir(), 'tatos-auditoria-17UZOjIk');
const report = JSON.parse(await readFile(path.join(stateRoot, 'form-timing-results.json'), 'utf8'));
const credential = JSON.parse(await readFile('C:/Users/fe-de/Downloads/centered-sight-383720-c94a9c7c1147.json', 'utf8'));
assert.equal(credential.client_email, 'tatos-sheets@centered-sight-383720.iam.gserviceaccount.com');
const auth = new google.auth.JWT({ email: credential.client_email, key: credential.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = '17UZOjIkLGw8ykFsJRmiGlqIGwf91u8eurTZIU3fv5gc';
const tab = "'Leads Google Ads'";
const formula = row => `=IF(OR(B${row}<>"";K${row}<>"";M${row}<>"");"ARS";"")`;
const col = index => { let n = index + 1, value = ''; while (n) { n--; value = String.fromCharCode(65 + n % 26) + value; n = Math.floor(n / 26); } return value; };
const read = async (render = 'FORMULA') => (await sheets.spreadsheets.values.get({ spreadsheetId, range: tab, valueRenderOption: render })).data.values || [];
try {
 assert.equal(report.successes.length, 5); assert.equal(report.errors.length, 4);
 assert.ok(report.error.includes('OLD_SHEET_CELL_CHANGED'));
 const before = await read(); const headers = before[0]; const currencyCol = headers.indexOf('Moneda'); const idCol = headers.indexOf('ID de consulta'); const nameCol = headers.indexOf('Nombre');
 assert.ok(currencyCol >= 0);
 for (const row of [12, 13, 14, 15]) assert.equal(before[row - 1][currencyCol], formula(row), 'TEMPLATE_CURRENCY_PATTERN_MISMATCH');
 const baseline = JSON.parse(await readFile(path.join(stateRoot, 'readback.json'), 'utf8'));
 for (const item of baseline.auditRows.filter(item => item.rowNumber <= 4)) assert.deepEqual(Object.fromEntries(headers.map((h, i) => [h, before[item.rowNumber - 1][i] ?? ''])), item.record);
 const retry = JSON.parse(await readFile(path.join(stateRoot, 'retry-results.json'), 'utf8'));
 for (const item of [retry.firstRow, retry.concurrentRow]) assert.deepEqual(Object.fromEntries(headers.map((h, i) => [h, before[item.rowNumber - 1][i] ?? ''])), item.record);
 const rows = report.successes.map(item => item.rowNumber);
 assert.deepEqual(rows, [7, 8, 9, 10, 11]);
 for (const item of report.successes) { assert.equal(before[item.rowNumber - 1][idCol], item.leadId); assert.equal(before[item.rowNumber - 1][nameCol], item.name); assert.equal(before[item.rowNumber - 1][currencyCol], 'ARS'); }
 // Restore only the 5 affected test cells; no format/validation update and no other row write.
 await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'USER_ENTERED', data: rows.map(row => ({ range: `${tab}!${col(currencyCol)}${row}`, values: [[formula(row)]] })) } });
 const after = await read(); const evaluated = await read('UNFORMATTED_VALUE');
 for (let r = 0; r < before.length; r++) for (let c = 0; c < before[r].length; c++) {
  if (rows.includes(r + 1) && c === currencyCol) { assert.equal(after[r]?.[c], formula(r + 1)); assert.equal(evaluated[r]?.[c], 'ARS'); }
  else assert.deepEqual(after[r]?.[c] ?? '', before[r][c] ?? '', 'UNRELATED_CELL_CHANGED_DURING_RESTORE');
 }
 for (const item of report.successes) {
  assert.equal(after.filter(row => row[idCol] === item.leadId).length, 1);
  item.record = Object.fromEntries(headers.map((h, i) => [h, after[item.rowNumber - 1][i] ?? '']));
 }
 assert.equal(after.filter(row => report.successes.some(item => row[nameCol] === item.name)).length, 5);
 assert.ok(report.errors.every(item => item.fieldsPreserved && item.continueVisible && item.buttonEnabled && item.savedEvents === 0 && item.manualWhatsAppNavigationObserved));
 report.findings = [{ issue: 'Backend existente sobrescribe fórmula de Moneda al guardar un lead', originalAssertion: report.error, restoredTestCells: rows.map(row => `${col(currencyCol)}${row}`), restorationSource: 'Fórmula original de fila 7 y patrón uniforme verificado en filas 12–15', evaluatedCurrency: 'ARS', backendChanged: false, backendFixPending: true }];
 delete report.error;
 report.exactlyFiveNewRows = true; report.previousEvidenceRows2To6Preserved = true; report.completed = true; report.completedWithFinding = true;
 await writeFile(path.join(stateRoot, 'form-timing-results.json'), JSON.stringify(report, null, 2));
 console.log(JSON.stringify({ completed: true, restoredCells: report.findings[0].restoredTestCells, rows: report.successes.map(item => ({ rowNumber: item.rowNumber, leadId: item.leadId, size: item.size, clickToOpeningMs: item.clickToOpeningVisibleMs, clickToNavigationMs: item.clickToNavigationMs })), summary: report.summary, errors: report.errors.map(item => ({ size: item.size, mode: item.mode, clickToErrorMs: item.clickToErrorMs, dataPreserved: item.fieldsPreserved, manualWhatsApp: item.manualWhatsAppNavigationObserved })), backendUnchanged: true }, null, 2));
} catch (error) { console.error(JSON.stringify({ error: error.response?.data?.error?.message || error.message, status: error.response?.status || null })); process.exitCode = 1; }
