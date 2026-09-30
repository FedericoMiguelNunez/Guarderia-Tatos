var TATOS = Object.freeze({
  TAB: 'Leads Google Ads',
  CONFIRMED: 'Confirmada',
  NOT_CONFIGURED: 'No configurado',
  TZ: 'America/Buenos_Aires'
});

function reservationDecision_(row) {
  var confirmed = String(row.status || '').trim() === TATOS.CONFIRMED;
  var amountText = String(row.amount == null ? '' : row.amount).trim().replace(/\s/g, '').replace(',', '.');
  var amount = Number(amountText);
  var hasAmount = amountText !== '' && isFinite(amount) && amount > 0;
  var cancelled = String(row.cancellation || '').trim() !== '';
  var hasClickId = Boolean(String(row.gclid || row.gbraid || row.wbraid || '').trim());
  var note = !confirmed ? 'Reserva aún no confirmada.'
    : cancelled ? 'Ajuste o cancelación pendiente de revisión; no enviar.'
    : !hasAmount ? 'Importe total faltante o inválido; debe ser mayor que cero.'
    : !hasClickId ? 'Confirmada; atribución pendiente de revisión.'
    : 'Lista para una futura integración; envío a Ads no configurado.';
  return { confirmed: confirmed, hasAmount: hasAmount, cancelled: cancelled, note: note };
}

function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== TATOS.TAB || e.range.getRow() < 2) return;
  var lock = LockService.getDocumentLock(); lock.waitLock(20000);
  try {
    var start = Math.max(2, e.range.getRow());
    var end = e.range.getLastRow();
    for (var row = start; row <= end; row++) initializeLeadRow_(sheet, row);
  } finally { lock.releaseLock(); }
}

function initializeLeadRow_(sheet, rowNumber) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var index = {}; headers.forEach(function (header, i) { index[String(header).trim()] = i + 1; });
  ['Estado de la reserva', 'Fecha y hora de confirmación', 'Valor total de la estadía', 'Estado de envío a Google Ads', 'Observaciones', 'ID único de reserva', 'Moneda', 'Cancelación o ajuste'].forEach(function (header) {
    if (!index[header]) throw new Error('Falta el encabezado requerido: ' + header);
  });
  var value = function (header) { return sheet.getRange(rowNumber, index[header]).getValue(); };
  var decision = reservationDecision_({
    status: value('Estado de la reserva'), amount: value('Valor total de la estadía'), cancellation: value('Cancelación o ajuste'),
    gclid: index.GCLID ? value('GCLID') : '', gbraid: index.GBRAID ? value('GBRAID') : '', wbraid: index.WBRAID ? value('WBRAID') : ''
  });
  if (decision.confirmed) {
    if (!value('Fecha y hora de confirmación')) sheet.getRange(rowNumber, index['Fecha y hora de confirmación']).setValue(new Date()).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    if (!value('ID único de reserva')) sheet.getRange(rowNumber, index['ID único de reserva']).setValue(Utilities.getUuid());
    sheet.getRange(rowNumber, index.Moneda).setValue('ARS');
  }
  if (!value('Estado de envío a Google Ads')) sheet.getRange(rowNumber, index['Estado de envío a Google Ads']).setValue(TATOS.NOT_CONFIGURED);
  sheet.getRange(rowNumber, index.Observaciones).setNote(decision.note);
}

function installEditTrigger() {
  var sheet = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().filter(function (trigger) { return trigger.getHandlerFunction() === 'onEdit'; }).forEach(ScriptApp.deleteTrigger);
  ScriptApp.newTrigger('onEdit').forSpreadsheet(sheet).onEdit().create();
}
