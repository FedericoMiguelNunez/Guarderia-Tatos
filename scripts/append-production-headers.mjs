import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { google } from 'googleapis';
import { REQUIRED_HEADERS, PRODUCTION_SHEET_ID } from '../server/sheets-store.mjs';

const credential = JSON.parse(await fs.readFile(process.env.TATOS_CREDENTIAL_FILE || 'C:/Users/fe-de/Downloads/centered-sight-383720-c94a9c7c1147.json', 'utf8'));
const auth = new google.auth.JWT({ email: credential.client_email, key: credential.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = PRODUCTION_SHEET_ID;
const tab = 'Leads Google Ads';
let phase = 'read-metadata';
try {
  const metadata = (await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties,merges,conditionalFormats,basicFilter,filterViews,protectedRanges,bandedRanges,tables)' })).data;
  const sheet = metadata.sheets.find(item => item.properties.title === tab);
  assert.ok(sheet, 'TARGET_TAB_NOT_FOUND');
  const { sheetId, gridProperties } = sheet.properties;
  const rows = gridProperties.rowCount;
  const headerRead = async () => (await sheets.spreadsheets.values.get({ spreadsheetId, range: "'Leads Google Ads'!A1:AZ1", valueRenderOption: 'FORMULA' })).data.values?.[0] || [];
  const headers = await headerRead();
  assert.deepEqual(headers, REQUIRED_HEADERS.slice(0, 19), 'EXISTING_HEADERS_CHANGED');
  const missing = REQUIRED_HEADERS.filter(header => !headers.includes(header));
  assert.equal(missing.length, 15, 'UNEXPECTED_MISSING_HEADERS');
  const fields = 'sheets(data(startRow,startColumn,rowData(values(userEnteredValue,userEnteredFormat,dataValidation,chipRuns,textFormatRuns,note))),properties.gridProperties)';
  const originalRead = async () => (await sheets.spreadsheets.get({ spreadsheetId, ranges: [`'Leads Google Ads'!A1:S${rows}`], fields })).data.sheets[0].data;
  phase = 'snapshot-existing-columns';
  const before = await originalRead();
  const targetEnd = Math.min(34, gridProperties.columnCount);
  if (targetEnd > 19) {
    const col = index => { let n = index + 1, value = ''; while (n) { n--; value = String.fromCharCode(65 + n % 26) + value; n = Math.floor(n / 26); } return value; };
    const target = (await sheets.spreadsheets.get({ spreadsheetId, ranges: [`'Leads Google Ads'!T1:${col(targetEnd - 1)}1`], fields })).data.sheets[0].data;
    for (const block of target || []) for (const row of block.rowData || []) for (const cell of row.values || []) {
      assert.ok(!cell.userEnteredValue && !cell.chipRuns?.length, 'TARGET_HEADER_CELL_NOT_EMPTY');
      assert.ok(!cell.dataValidation, 'TARGET_HEADER_HAS_VALIDATION');
    }
  }
  // Re-read the headers immediately before the only write.
  assert.deepEqual(await headerRead(), headers, 'HEADERS_CHANGED_BEFORE_WRITE');
  const requests = [];
  if (gridProperties.columnCount < 34) requests.push({ appendDimension: { sheetId, dimension: 'COLUMNS', length: 34 - gridProperties.columnCount } });
  requests.push({ updateCells: {
    range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 19, endColumnIndex: 34 },
    rows: [{ values: missing.map(header => ({ userEnteredValue: { stringValue: header } })) }],
    fields: 'userEnteredValue'
  } });
  phase = 'append-headers';
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  phase = 'verify';
  const finalHeaders = await headerRead();
  assert.deepEqual(finalHeaders, REQUIRED_HEADERS, 'FINAL_HEADERS_MISMATCH');
  assert.equal(new Set(finalHeaders).size, 34, 'DUPLICATE_HEADERS');
  assert.deepEqual(await originalRead(), before, 'EXISTING_COLUMNS_CHANGED');
  const afterMeta = (await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties,merges,conditionalFormats,basicFilter,filterViews,protectedRanges,bandedRanges,tables)' })).data.sheets.find(item => item.properties.sheetId === sheetId);
  const expected = structuredClone(sheet);
  expected.properties.gridProperties.columnCount = Math.max(34, gridProperties.columnCount);
  assert.deepEqual(afterMeta, expected, 'UNEXPECTED_METADATA_CHANGE');
  console.log(JSON.stringify({ verified: true, tab, writtenRange: 'T1:AH1', addedHeaders: missing, headerCount: 34, duplicateHeaders: [], originalColumnsValuesFormulasFormatsValidationsPreserved: true, testLeadsInserted: 0, backendActivated: false }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ phase, error: error.response?.status ? `SHEETS_HTTP_${error.response.status}` : error.name === 'AssertionError' ? error.message.split('\n')[0] : error.code || error.name }));
  process.exitCode = 1;
}
