import { getFrozenAttribution, attributionConsentKnown } from './lead-attribution.js';

const form = document.querySelector('#lead-form');
const section = document.querySelector('#consulta');
const status = document.querySelector('#lead-status');
const fallback = document.querySelector('#lead-whatsapp-fallback');
let attemptKey = null;
let attempt = null;
let submitting = false;
let savedEventSent = false;
let whatsappRequested = false;
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
  try {
    const parsed = window.libphonenumber?.parsePhoneNumber(values.phone.trim(), 'AR');
    if (!parsed?.isValid()) phoneError = 'Ingresá el número completo con código de área. Para otro país, incluí + y el código.';
  } catch { phoneError = 'Revisá el número e incluí el código de área.'; }
  fieldError('phone', phoneError); return ok && !phoneError;
}
function whatsappUrl(values) {
  const text = `Hola, mi nombre es ${values.name.trim()}. Vi su página web y quisiera consultar si tienen disponibilidad para mi gato ${values.catName.trim()}. `;
  const query = new URLSearchParams({ text });
  return `https://wa.me/${section.dataset.whatsappNumber}?${query.toString()}`;
}
const navigate = url => { location.assign(url); };
// Manual navigation is not confirmation of a saved lead. Keep the pending
// request's frozen payload/key for reconciliation while the document is alive.
fallback?.addEventListener('click', () => { if (!fallback.hidden) whatsappRequested = true; });

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting) return;
  fallback.hidden = true; fallback.textContent = 'Abrir WhatsApp'; status.textContent = ''; status.dataset.state = '';
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
  const continueTimer = setTimeout(() => {
    status.textContent = 'El guardado sigue pendiente. Podés continuar a WhatsApp; todavía no confirmamos que la consulta se haya guardado.';
    status.dataset.state = 'pending';
    fallback.href = url; fallback.textContent = 'Continuar a WhatsApp'; fallback.hidden = false;
  }, 3000);
  try {
    const response = await fetch('/.netlify/functions/create-lead', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify(attempt) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.saved !== true || typeof result.leadId !== 'string' || !result.leadId.trim()) {
      if (response.status === 400 && result.error === 'VALIDATION_ERROR') {
        attempt = null; attemptKey = null;
        for (const name of ['name', 'catName', 'phone']) form.elements[name].readOnly = false;
      }
      throw new Error(result.retryable ? 'RETRYABLE' : 'SAVE_FAILED');
    }
    window.dataLayer = window.dataLayer || [];
    if (!savedEventSent) { window.dataLayer.push({ event: 'tatos_lead_saved' }); savedEventSent = true; }
    status.textContent = whatsappRequested ? 'Consulta guardada.' : 'Consulta guardada. Abriendo WhatsApp…'; status.dataset.state = 'success';
    fallback.href = url; fallback.hidden = false;
    if (!whatsappRequested) setTimeout(() => navigate(url), 100);
  } catch (error) {
    status.textContent = error.message === 'RETRYABLE' || error.name === 'AbortError'
      ? 'La respuesta demoró. Podés reintentar sin duplicar la consulta o continuar a WhatsApp.'
      : 'No pudimos guardar la consulta. Podés reintentar o continuar igualmente a WhatsApp.';
    status.dataset.state = 'error'; fallback.href = url; fallback.hidden = false;
    if (attempt) status.textContent += ' Conservamos los datos del envío para evitar duplicados; podés aclarar cambios por WhatsApp.';
  } finally { clearTimeout(timer); clearTimeout(continueTimer); submitting = false; button.disabled = false; button.textContent = idleLabel; }
});
