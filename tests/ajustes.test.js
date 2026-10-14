// Movimientos que generan los ajustes y transferencias aprobados en la conciliación.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { movimientosDeAjuste } from '../docs/js/dominio/ajustes.js';

const DATOS = { fecha: '2026-10-14', campania: 'CC-2026-10-14' };
const fila = (posicion, codigo, lote, diferencia, extra = {}) => ({ posicion, codigo, lote, diferencia, ...extra });

test('un ajuste aprobado genera un Ajuste_Inventario_Ciclico por la diferencia', () => {
  const { movimientos, sinAprobar, errores } = movimientosDeAjuste(
    [fila('B3', 'PROD001', 'L0007', 10, { accion: 'Ajuste', causa: 'Error de conteo', aprobadoPor: 'Jefe' })],
    DATOS,
  );
  assert.deepEqual(errores, []);
  assert.deepEqual(sinAprobar, []);
  assert.deepEqual(movimientos, [
    {
      fecha: '2026-10-14', codigo: 'PROD001', lote: 'L0007', cantidad: 10, tipo: 'Ajuste_Inventario_Ciclico',
      posicion: 'B3', motivo: 'Error de conteo. Aprobó Jefe. Conteo CC-2026-10-14.', origen: 'AJUSTE_CONTEO',
    },
  ]);
});

test('una transferencia F1 → F2 genera dos movimientos que suman cero', () => {
  const { movimientos, errores } = movimientosDeAjuste(
    [
      fila('F1', 'PROD003', 'L0009', -20, { accion: 'Transferencia', causa: 'Error de ubicación', aprobadoPor: 'Jefe' }),
      fila('F2', 'PROD003', 'L0009', 20, { accion: 'Transferencia', causa: 'Error de ubicación', aprobadoPor: 'Jefe' }),
    ],
    DATOS,
  );
  assert.deepEqual(errores, []);
  assert.deepEqual(
    movimientos.map((m) => [m.posicion, m.cantidad, m.tipo, m.origen]),
    [
      ['F1', -20, 'Transferencia_Posicion', 'TRANSFERENCIA'],
      ['F2', 20, 'Transferencia_Posicion', 'TRANSFERENCIA'],
    ],
  );
});

test('una transferencia que no suma cero o con una sola posición no se registra', () => {
  const r = movimientosDeAjuste([fila('F1', 'PROD003', 'L0009', -20, { accion: 'Transferencia', aprobadoPor: 'Jefe' })], DATOS);
  assert.deepEqual(r.movimientos, []);
  assert.match(r.errores[0], /PROD003\|L0009 no cierra/);
});

test('sin Aprobado_por no se registra nada; las filas OK, de reconteo o sin acción se ignoran', () => {
  const r = movimientosDeAjuste(
    [
      fila('A1', 'PROD003', 'L0003', 5, { accion: 'Ajuste' }),
      fila('B3', 'PROD001', 'L0007', 10, { accion: 'Reconteo', aprobadoPor: 'Jefe' }),
      fila('A3', 'PROD010', 'L0003', 0, { accion: 'Ajuste', aprobadoPor: 'Jefe' }),
      fila('G2', 'PROD010', 'L0001', -3),
    ],
    DATOS,
  );
  assert.deepEqual(r.movimientos, []);
  assert.deepEqual(r.sinAprobar.map((f) => f.posicion), ['A1']);
});
