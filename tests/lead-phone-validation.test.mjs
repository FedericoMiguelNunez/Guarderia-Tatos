import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLeadPayload } from '../server/lead-validation.mjs';

const payload = phone => ({
  name: 'María José',
  catName: 'Mishí',
  phone,
  idempotencyKey: 'attempt_phone_test_123',
  attribution: {},
  consentKnown: null,
  website: ''
});

for (const phone of ['11 2345-6789', '011 15 2345-6789', '+54 9 11 2345-6789', '1123456789', '(011) 15-2345-6789', '011 2345-6789']) {
  test(`normaliza ${phone} y conserva el formato canónico al validarlo otra vez`, () => {
    const canonical = validateLeadPayload(payload(phone)).phone;
    assert.equal(canonical, '+5491123456789');
    assert.equal(validateLeadPayload(payload(canonical)).phone, canonical);
  });
}

test('conserva un número internacional válido', () => {
  assert.equal(validateLeadPayload(payload('+1 (202) 555-0123')).phone, '+12025550123');
});

test('rechaza un número de WhatsApp inválido', () => {
  for (const phone of ['1234567890', '2345-6789', '15 2345-6789', '15 11 2345-6789', '11 2345-6789 ext 12', null]) {
    assert.throws(() => validateLeadPayload(payload(phone)), error => error.field === 'phone' && error.message.includes('código de área (por ejemplo, 11)'));
  }
});
