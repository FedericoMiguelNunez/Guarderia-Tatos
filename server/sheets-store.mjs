import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PRODUCTION_SHEET_ID = '1_f64qlaRjbUKeFsNiQ9MAy-Zxdgozwhc73fs9_uCYyY';
export const REQUIRED_HEADERS = [
  'Fecha contacto', 'Nombre', 'WhatsApp', 'Fuente', 'Campaña', 'Término de búsqueda', 'Palabra clave', 'GCLID',
  'Contactó', 'Interesado', 'Estado de la reserva', 'Fecha y hora de confirmación', 'Valor total de la estadía',
  'Días estadía', 'Estado de envío a Google Ads', 'Observaciones', 'ID único de reserva', 'Moneda',
  'Cancelación o ajuste', 'Nombre del gato', 'ID de consulta', 'GBRAID', 'WBRAID', 'UTM source', 'UTM medium',
  'UTM campaign', 'UTM term', 'UTM content', 'Campaign ID', 'Adgroup ID', 'Captura atribución',
  'Página de entrada', 'Consentimiento conocido', 'Diagnóstico de atribución'
];

const colName = index => { let n = index + 1, out = ''; while (n) { n--; out = String.fromCharCode(65 + n % 26) + out; n = Math.floor(n / 26); } return out; };
const quoteTab = tab => `'${tab.replaceAll("'", "''")}'`;

export class MockSheetsStore {
  constructor(options = {}) { this.rows = []; this.fail = options.fail || null; this.afterWriteFailure = options.afterWriteFailure || false; }
  async findByOperationId(id) { return this.rows.find(row => row['ID de consulta'] === id) ?? null; }
  async writeAndConfirm(record) {
    if (this.fail) throw new Error(this.fail);
    this.rows.push(structuredClone(record));
    if (this.afterWriteFailure) { this.afterWriteFailure = false; throw new Error('RESPONSE_LOST_AFTER_WRITE'); }
    return this.findByOperationId(record['ID de consulta']);
  }
}

export class FileMockSheetsStore {
  constructor(root = path.resolve('.netlify/mock-leads')) { this.root = root; this.filename = path.join(root, 'rows.json'); }
  async #rows() { try { return JSON.parse(await readFile(this.filename, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } }
  async findByOperationId(id) { return (await this.#rows()).find(row => row['ID de consulta'] === id) ?? null; }
  async writeAndConfirm(record) {
    await mkdir(this.root, { recursive: true }); const rows = await this.#rows(); rows.push(structuredClone(record));
    const temp = `${this.filename}.${crypto.randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(rows, null, 2)); await rename(temp, this.filename);
    return this.findByOperationId(record['ID de consulta']);
  }
}

export class GoogleSheetsStore {
  constructor({ sheets, spreadsheetId, tab }) { this.sheets = sheets; this.spreadsheetId = spreadsheetId; this.tab = tab; }
  async #read(valueRenderOption = 'UNFORMATTED_VALUE') {
    const range = `${quoteTab(this.tab)}!A1:AZ`;
    const { data } = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range, valueRenderOption });
    const values = data.values || []; return { headers: values[0] || [], rows: values.slice(1) };
  }
  async findByOperationId(id) {
    const { headers, rows } = await this.#read(); const idx = headers.indexOf('ID de consulta');
    if (idx < 0) throw new Error('SHEET_MIGRATION_REQUIRED');
    const pos = rows.findIndex(row => String(row[idx] ?? '') === id);
    return pos < 0 ? null : { rowNumber: pos + 2, 'ID de consulta': id };
  }
  async writeAndConfirm(record) {
    const { headers, rows } = await this.#read('FORMULA');
    const missing = REQUIRED_HEADERS.filter(header => !headers.includes(header));
    if (missing.length) throw new Error(`SHEET_MIGRATION_REQUIRED:${missing.join(',')}`);
    const occupiedHeaders = ['ID de consulta', 'Nombre', 'WhatsApp', 'Nombre del gato'];
    const occupiedIndexes = occupiedHeaders.map(h => headers.indexOf(h));
    const offset = rows.findIndex(row => occupiedIndexes.every(i => String(row[i] ?? '').trim() === ''));
    const rowNumber = (offset < 0 ? rows.length : offset) + 2;
    const currencyCell = rows[rowNumber - 2]?.[headers.indexOf('Moneda')] ?? '';
    // FORMULA distinguishes an empty formula result from a genuinely empty cell.
    // Preserve formulas and existing currency values; only populate empty cells.
    const data = Object.entries(record).filter(([header]) => headers.includes(header) && (header !== 'Moneda' || currencyCell === '')).map(([header, value]) => ({
      range: `${quoteTab(this.tab)}!${colName(headers.indexOf(header))}${rowNumber}`,
      values: [[String(value ?? '')]]
    }));
    await this.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: this.spreadsheetId, requestBody: { valueInputOption: 'RAW', data } });
    const confirmed = await this.findByOperationId(record['ID de consulta']);
    if (!confirmed || confirmed.rowNumber !== rowNumber) throw new Error('SHEET_CONFIRMATION_FAILED');
    return confirmed;
  }
}

export async function createSheetsStore(env = process.env) {
  if ((env.LEAD_STORAGE_MODE || 'mock') === 'mock') return new FileMockSheetsStore(env.LEAD_MOCK_DIR);
  if (env.LEAD_STORAGE_MODE !== 'blobs') throw new Error('LEAD_STORAGE_MODE_UNSUPPORTED');
  if (env.GOOGLE_SHEETS_ID === PRODUCTION_SHEET_ID && env.APP_ENV !== 'production') throw new Error('PRODUCTION_SHEET_BLOCKED_OUTSIDE_PRODUCTION');
  if (env.GOOGLE_SHEETS_ID === PRODUCTION_SHEET_ID) {
    if (env.ALLOW_PRODUCTION_WRITES !== 'true') throw new Error('PRODUCTION_WRITES_DISABLED');
  } else if (env.ALLOW_TEST_SHEET_WRITES !== 'true') throw new Error('TEST_SHEET_WRITES_DISABLED');
  const missing = ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEETS_ID'].filter(key => !env[key]?.trim());
  if (missing.length) throw new Error(`SHEETS_CONFIGURATION_MISSING:${missing.join(',')}`);
  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({ email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return new GoogleSheetsStore({ sheets: google.sheets({ version: 'v4', auth }), spreadsheetId: env.GOOGLE_SHEETS_ID, tab: env.GOOGLE_SHEETS_TAB || 'Leads Google Ads' });
}
