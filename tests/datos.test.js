// Los datos exportados del Excel tienen que tener las filas que dice el plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CASO } from '../docs/js/datos/caso.js';
import { paresMaterialLote } from '../docs/js/dominio/conciliacion.js';

test('cantidades de filas del caso', () => {
  assert.equal(CASO.materiales.length, 10);
  assert.equal(CASO.posiciones.length, 28);
  assert.equal(CASO.stock3009.length, 13);
  assert.equal(CASO.movimientos.length, 40);
  assert.equal(CASO.stock1410.length, 23);
  assert.equal(paresMaterialLote(CASO.stock3009, CASO.movimientos).size, 22);
});

test('fechas y campaña', () => {
  assert.equal(CASO.campania, 'CC-2026-10-14');
  assert.equal(CASO.fechaStockInicial, '2026-09-30');
  assert.equal(CASO.fechaConteo, '2026-10-14');
  assert.ok(CASO.movimientos.every((m) => m.fecha >= '2026-10-01' && m.fecha <= '2026-10-14'));
});

test('el rack va de A1 a G4: bloque 1 = A–D y bloque 2 = E–G', () => {
  const posiciones = CASO.posiciones.map((p) => p.posicion);
  assert.equal(posiciones[0], 'A1');
  assert.equal(posiciones.at(-1), 'G4');
  assert.equal(CASO.posiciones.filter((p) => p.bloque === 1).length, 16);
  assert.equal(CASO.posiciones.filter((p) => p.bloque === 2).length, 12);
});
