import crypto from 'node:crypto';
import { validateLeadPayload } from './lead-validation.mjs';

const digest = lead => crypto.createHash('sha256').update(JSON.stringify({ name: lead.name, catName: lead.catName, phone: lead.phone, attribution: lead.attribution, consentKnown: lead.consentKnown })).digest('hex');

function sourceFor(a) {
  if (a.gclid || a.gbraid || a.wbraid) return a.utm_source || 'Google Ads';
  return a.utm_source || '';
}
function diagnosis(a) {
  if (a.gclid) return 'Identificador de clic GCLID recibido';
  if (a.gbraid || a.wbraid) return 'Identificador BRAID recibido';
  if (Object.keys(a).some(k => k.startsWith('utm_'))) return 'Solo UTM; sin identificador de clic';
  return 'Sin atribución publicitaria conocida';
}
function recordFor(lead, id, now) {
  const a = lead.attribution;
  return {
    'Fecha contacto': now.toISOString(), 'Nombre': lead.name, 'WhatsApp': lead.phone, 'Fuente': sourceFor(a),
    'Campaña': a.utm_campaign || '', 'Término de búsqueda': '', 'Palabra clave': a.keyword || '', 'GCLID': a.gclid || '',
    'Contactó': '', 'Interesado': '', 'Estado de la reserva': 'Pendiente', 'Estado de envío a Google Ads': 'No configurado',
    'Observaciones': 'Consulta guardada; apertura de WhatsApp no verificada.', 'Moneda': 'ARS', 'Nombre del gato': lead.catName,
    'ID de consulta': id, 'GBRAID': a.gbraid || '', 'WBRAID': a.wbraid || '', 'UTM source': a.utm_source || '',
    'UTM medium': a.utm_medium || '', 'UTM campaign': a.utm_campaign || '', 'UTM term': a.utm_term || '',
    'UTM content': a.utm_content || '', 'Campaign ID': a.campaign_id || '', 'Adgroup ID': a.adgroup_id || '',
    'Captura atribución': a.capturedAt || '', 'Página de entrada': a.entryPath || '',
    'Consentimiento conocido': lead.consentKnown, 'Diagnóstico de atribución': diagnosis(a)
  };
}

export class LeadService {
  constructor({ idempotency, sheets, now = () => new Date(), uuid = () => crypto.randomUUID() }) { Object.assign(this, { idempotency, sheets, now, uuid }); }
  async persist(lead, fingerprint, operationId) {
    try {
      await this.idempotency.withWriterLock(async () => {
        const found = await this.sheets.findByOperationId(operationId);
        if (!found) await this.sheets.writeAndConfirm(recordFor(lead, operationId, this.now()));
      });
      const completed = await this.idempotency.complete(lead.idempotencyKey, fingerprint, { status: 'complete', operationId });
      if (!completed) throw new Error('IDEMPOTENCY_STATE_LOST');
      return { status: 201, body: { saved: true, leadId: operationId } };
    } catch (error) {
      try {
        const found = await this.sheets.findByOperationId(operationId);
        if (found) {
          await this.idempotency.complete(lead.idempotencyKey, fingerprint, { status: 'complete', operationId });
          return { status: 201, body: { saved: true, leadId: operationId, reconciled: true } };
        }
      } catch { /* uncertain state is handled below */ }
      if (error.message === 'ROW_LOCK_BUSY') {
        await this.idempotency.complete(lead.idempotencyKey, fingerprint, { status: 'retryable', operationId });
        return { status: 503, body: { error: 'BUSY', retryable: true } };
      }
      await this.idempotency.markReview(lead.idempotencyKey, fingerprint, 'PERSISTENCE_UNCERTAIN');
      return { status: 503, body: { error: 'SAVE_FAILED', retryable: false } };
    }
  }
  async create(input) {
    const lead = validateLeadPayload(input); const fingerprint = digest(lead); const operationId = this.uuid();
    const reservation = await this.idempotency.reserve(lead.idempotencyKey, fingerprint, operationId);
    if (!reservation.created) {
      const prior = reservation.value;
      if (!prior || prior.fingerprint !== fingerprint) return { status: 409, body: { error: 'IDEMPOTENCY_CONFLICT' } };
      if (prior.status === 'complete') return { status: 200, body: { saved: true, leadId: prior.operationId, replayed: true } };
      if (prior.status === 'review') return { status: 503, body: { error: 'REVIEW_REQUIRED', retryable: false } };
      if (prior.status === 'retryable') return this.persist(lead, fingerprint, prior.operationId);
      const found = await this.sheets.findByOperationId(prior.operationId);
      if (found) {
        await this.idempotency.complete(lead.idempotencyKey, fingerprint, { status: 'complete', operationId: prior.operationId });
        return { status: 200, body: { saved: true, leadId: prior.operationId, replayed: true } };
      }
      return { status: 409, body: { error: 'REQUEST_IN_PROGRESS', retryable: true } };
    }
    return this.persist(lead, fingerprint, operationId);
  }
}
