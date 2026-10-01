import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const context = {}; vm.createContext(context); vm.runInContext(await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), context);

test('lógica de reserva cubre ambos órdenes, cero, cancelación y atribución', () => {
  assert.match(context.reservationDecision_({ status: 'Confirmada', amount: '' }).note, /Importe/);
  assert.match(context.reservationDecision_({ status: '', amount: '200000' }).note, /aún no/);
  assert.match(context.reservationDecision_({ status: 'Confirmada', amount: '0' }).note, /Importe/);
  assert.match(context.reservationDecision_({ status: 'Confirmada', amount: '200000', cancellation: 'Cancelada' }).note, /Ajuste/);
  assert.match(context.reservationDecision_({ status: 'Confirmada', amount: '200000', gclid: 'AbC' }).note, /Lista/);
});
