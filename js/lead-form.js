import { getFrozenAttribution, attributionConsentKnown } from './lead-attribution.js';
import { normalizePhone, PHONE_ERROR } from './phone-normalization.js';

import { mountLeadDialog } from './lead-dialog.js';

mountLeadDialog();

const form = document.querySelector('#lead-form');
const section = document.querySelector('#consulta');
const status = document.querySelector('#lead-status');
let attemptKey = null;
let attempt = null;
let submitting = false;
let savedEventSent = false;
let opener = null;

document.querySelectorAll('.js-lead-cta').forEach(link => link.addEventListener('click', event => {
  event.preventDefault(); opener = link; section.hidden = false; document.body.classList.add('lead-dialog-open');
  document.querySelector('#lead-name')?.focus({ preventScroll: true });
}));

function closeDialog() {
  if (section.hidden) return;
  section.hidden = true; document.body.classList.remove('lead-dialog-open'); opener?.focus();
}
section?.querySelectorAll('[data-lead-close]').forEach(control => control.addEventListener('click', closeDialog));
section?.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...section.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')].filter(node => !node.hidden && node.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

const fieldError = (name, message) => {
  const input = form.elements[name]; const node = document.querySelector(`#lead-${name === 'catName' ? 'cat' : name}-error`);
  input?.setAttribute('aria-invalid', message ? 'true' : 'false'); if (node) node.textContent = message;
};
function validate(values) {
  let ok = true;
  for (const [name, label] of [['name', 'tu nombre'], ['catName', 'el nombre de tu gato']]) {
    const value = values[name].trim(); const error = !value ? `Completá ${label}.` : value.length > (name === 'name' ? 100 : 160) ? 'El texto es demasiado largo.' : '';
    fieldError(name, error); if (error) ok = false;
  }
  let phoneError = '';
  const parser = window.libphonenumber?.parsePhoneNumberFromString;
  if (!parser) {
    fieldError('phone', '');
    status.textContent = 'No pudimos cargar la validación del teléfono. Recargá la página e intentá nuevamente.';
    status.dataset.state = 'error';
    return false;
  }
  try { values.phone = normalizePhone(values.phone, parser); }
  catch { phoneError = PHONE_ERROR; }
  fieldError('phone', phoneError); return ok && !phoneError;
}
function whatsappUrl(values) {
  const text = `Hola, mi nombre es ${values.name.trim()}. Vi su página web y quisiera consultar si tienen disponibilidad para mi gato ${values.catName.trim()}. `;
  const query = new URLSearchParams({ text });
  return `https://wa.me/${section.dataset.whatsappNumber}?${query.toString()}`;
}
const navigate = url => { location.assign(url); };

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting) return;
  status.textContent = ''; status.dataset.state = '';
  const values = Object.fromEntries(new FormData(form)); if (!validate(values)) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }
  attemptKey ||= crypto.randomUUID().replaceAll('-', '_');
  attempt ||= { name: values.name, catName: values.catName, phone: values.phone, website: values.website,
    idempotencyKey: attemptKey, attribution: getFrozenAttribution(), consentKnown: attributionConsentKnown() };
  // An uncertain write must be retried with exactly the original payload.
  for (const name of ['name', 'catName', 'phone']) { form.elements[name].value = attempt[name]; form.elements[name].readOnly = true; }
  submitting = true;
  const url = whatsappUrl(attempt); const button = form.querySelector('button[type="submit"]');
  const idleLabel = button.textContent; button.disabled = true; button.textContent = 'Abriendo WhatsApp…';
  status.textContent = 'Guardando tu consulta…';
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
  const pendingTimer = setTimeout(() => {
    status.textContent = 'El guardado sigue pendiente. Si no recibimos respuesta, te llevaremos a WhatsApp sin confirmar que la consulta se haya guardado.';
    status.dataset.state = 'pending';
  }, 3000);
  let redirectingToWhatsApp = false;
  try {
    const response = await fetch('/.netlify/functions/create-lead', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify(attempt) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.saved !== true || typeof result.leadId !== 'string' || !result.leadId.trim()) {
      throw new Error(result.retryable ? 'RETRYABLE' : 'SAVE_FAILED');
    }
    window.dataLayer = window.dataLayer || [];
    if (!savedEventSent) { window.dataLayer.push({ event: 'tatos_lead_saved' }); savedEventSent = true; }
    status.textContent = 'Consulta guardada. Abriendo WhatsApp…'; status.dataset.state = 'success';
    setTimeout(() => navigate(url), 100);
  } catch (error) {
    status.textContent = error.name === 'AbortError'
      ? 'No pudimos confirmar el guardado a tiempo. Te llevamos a WhatsApp; la consulta no está confirmada.'
      : 'No pudimos guardar la consulta. Te llevamos a WhatsApp; la consulta no está confirmada.';
    status.dataset.state = 'error';
    if (attempt) status.textContent += ' Conservamos los datos y la clave del envío para evitar duplicados.';
    redirectingToWhatsApp = true;
    setTimeout(() => navigate(url), 100);
  } finally {
    clearTimeout(timer); clearTimeout(pendingTimer); submitting = false;
    if (!redirectingToWhatsApp) { button.disabled = false; button.textContent = idleLabel; }
  }
});
