import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleSheetsStore, REQUIRED_HEADERS } from '../server/sheets-store.mjs';
const currencyColumn = REQUIRED_HEADERS.indexOf('Moneda');
const operationColumn = REQUIRED_HEADERS.indexOf('ID de consulta');
const nameColumn = REQUIRED_HEADERS.indexOf('Nombre');
for (const [label, currency, expectWrite] of [
  ['fórmula cuya evaluación inicial está vacía', '=IF(B2<>"","ARS","")', false],
  ['fórmula que devuelve ARS', '="ARS"', false],
  ['celda vacía sin fórmula', '', true],
  ['moneda preexistente', 'USD', false]
]) test(`Moneda: ${label}`, async () => {
  const row = Array(REQUIRED_HEADERS.length).fill(''); row[currencyColumn] = currency;
  const renders = []; let written;
  const api = {
    async get({ valueRenderOption }) {
      renders.push(valueRenderOption); const returned = [...row];
      if (valueRenderOption === 'UNFORMATTED_VALUE' && String(currency).startsWith('=')) returned[currencyColumn] = row[nameColumn] ? 'ARS' : '';
      return { data: { values: [REQUIRED_HEADERS, returned] } };
    },
    async batchUpdate({ requestBody }) {
      written = requestBody; assert.equal(requestBody.valueInputOption, 'RAW');
      for (const item of requestBody.data) {
        if (item.range === "'Leads'!R2") row[currencyColumn] = item.values[0][0];
        if (item.range === "'Leads'!U2") row[operationColumn] = item.values[0][0];
        if (item.range === "'Leads'!B2") row[nameColumn] = item.values[0][0];
      }
    }
  };
  const store = new GoogleSheetsStore({ sheets: { spreadsheets: { values: api } }, spreadsheetId: 'test-only', tab: 'Leads' });
  const result = await store.writeAndConfirm({ 'ID de consulta': 'currency-operation', Nombre: 'PRUEBA MONEDA', Moneda: 'ARS' });
  assert.equal(result.rowNumber, 2);
  assert.deepEqual(renders, ['FORMULA', 'UNFORMATTED_VALUE']);
  const currencyWrites = written.data.filter(item => item.range === "'Leads'!R2");
  assert.equal(currencyWrites.length, expectWrite ? 1 : 0);
  assert.equal(row[currencyColumn], expectWrite ? 'ARS' : currency);
});
