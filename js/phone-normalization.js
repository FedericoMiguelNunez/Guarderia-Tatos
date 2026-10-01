export const PHONE_ERROR = 'Ingresá un número válido e incluí el código de área (por ejemplo, 11). No hace falta el código de país.';

// Shared by the browser and the backend. The parser uses the same max metadata
// from libphonenumber-js in both environments; no area code is inferred.
export function normalizePhone(value, parsePhoneNumber) {
  if (typeof value !== 'string' || value.length > 40) throw new Error(PHONE_ERROR);
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) throw new Error(PHONE_ERROR);
  let phone = parsePhoneNumber(compact, { defaultCountry: 'AR', extract: false });
  if (!phone?.isValid() || phone.ext) throw new Error(PHONE_ERROR);

  // National 0/15 prefixes are interpreted by the Argentina metadata. A local
  // number with its area code has ten digits; WhatsApp mobiles add the 9.
  if (phone.country === 'AR' && phone.nationalNumber.length === 10) {
    phone = parsePhoneNumber(`+549${phone.nationalNumber}`);
    if (!phone?.isValid()) throw new Error(PHONE_ERROR);
  }
  return phone.number;
}
