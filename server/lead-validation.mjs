import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { normalizePhone as normalizeSharedPhone, PHONE_ERROR } from '../js/phone-normalization.js';

const ALLOWED_ATTRIBUTION = new Set([
  'gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign',
  'utm_term', 'utm_content', 'campaign_id', 'adgroup_id', 'keyword'
]);
const TOP_LEVEL = new Set(['name', 'catName', 'phone', 'idempotencyKey', 'attribution', 'consentKnown', 'website']);

export class ValidationError extends Error {
  constructor(message, field = null) { super(message); this.name = 'ValidationError'; this.field = field; }
}

function cleanText(value, field, max) {
  if (typeof value !== 'string') throw new ValidationError('El campo debe ser texto.', field);
  const cleaned = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length > max) throw new ValidationError(`Completá ${field} (máximo ${max} caracteres).`, field);
  return cleaned;
}

export function normalizePhone(value) {
  try { return normalizeSharedPhone(value, parsePhoneNumberFromString); }
  catch { throw new ValidationError(PHONE_ERROR, 'phone'); }
}

export function validateLeadPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('El cuerpo JSON no es válido.');
  for (const key of Object.keys(input)) if (!TOP_LEVEL.has(key)) throw new ValidationError(`Campo inesperado: ${key}`);
  if (input.website) throw new ValidationError('Solicitud rechazada.');
  const idempotencyKey = cleanText(input.idempotencyKey, 'idempotencyKey', 100);
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) throw new ValidationError('Clave de reintento inválida.', 'idempotencyKey');
  const attributionInput = input.attribution ?? {};
  if (typeof attributionInput !== 'object' || Array.isArray(attributionInput)) throw new ValidationError('Atribución inválida.');
  const attribution = {};
  for (const [key, value] of Object.entries(attributionInput)) {
    if (!ALLOWED_ATTRIBUTION.has(key) && !['capturedAt', 'entryPath', 'expiresAt'].includes(key)) throw new ValidationError(`Dato de atribución inesperado: ${key}`);
    if (typeof value !== 'string' || value.length > 500) throw new ValidationError('Dato de atribución inválido.');
    attribution[key] = value;
  }
  if (attribution.entryPath && (!attribution.entryPath.startsWith('/') || attribution.entryPath.includes('?'))) throw new ValidationError('Ruta de entrada inválida.');
  return {
    name: cleanText(input.name, 'name', 100),
    catName: cleanText(input.catName, 'catName', 160),
    phone: normalizePhone(input.phone), idempotencyKey, attribution,
    consentKnown: input.consentKnown === true ? 'Sí' : input.consentKnown === false ? 'No' : 'Desconocido'
  };
}
