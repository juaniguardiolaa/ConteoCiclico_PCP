// El backend demo hace lo mismo que va a hacer el Web App: valida, no duplica y concilia.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { almacenEnMemoria } from '../docs/js/almacen.js';
import { crearBackendDemo } from '../docs/js/backend/demo.js';
import { crearRegistro } from '../docs/js/dominio/registros.js';

const CAMPANIA = 'CC-2026-10-14';
const SESION = { usuario: 'Operario 1', rol: 'OPERARIO', campania: CAMPANIA };

const registro = (posicion, extra = {}) =>
  crearRegistro({
    id: `id-${posicion}-${extra.tipo ?? 'CONTEO'}`,
    fechaHora: '2026-10-14T10:00:00',
    usuario: 'Operario 1',
    campania: CAMPANIA,
    posicion,
    codigo: 'PROD001',
    lote: 'L0005',
    cantidad: 120,
    ...extra,
  });

test('registra, rechaza el duplicado de posición y no duplica el mismo ID', async () => {
  const backend = crearBackendDemo(almacenEnMemoria());
  assert.equal((await backend.registrar(registro('B2'))).codigo, 'REGISTRADO');
  assert.equal((await backend.registrar(registro('B2'))).codigo, 'YA_REGISTRADO');
  const duplicado = await backend.registrar({ ...registro('B2'), id: 'otro-id' });
  assert.equal(duplicado.ok, false);
  assert.equal(duplicado.codigo, 'POSICION_DUPLICADA');
  assert.equal((await backend.estado(CAMPANIA)).registros.length, 1);
});

test('el servidor también rechaza datos inválidos aunque la app los deje pasar', async () => {
  const backend = crearBackendDemo(almacenEnMemoria());
  assert.equal((await backend.registrar(registro('Z9'))).codigo, 'POSICION_INEXISTENTE');
  assert.equal((await backend.registrar(registro('B2', { cantidad: -12 }))).codigo, 'CANTIDAD_INVALIDA');
  assert.equal((await backend.registrar(registro('B2', { lote: 'L005' }))).codigo, 'LOTE_FORMATO');
  assert.equal((await backend.registrar(registro('B2', { usuario: '' }))).codigo, 'CAMPO_VACIO');
  assert.equal((await backend.estado(CAMPANIA)).registros.length, 0);
});

test('con el conteo del enunciado precargado, la conciliación da 24 claves y 11 diferencias', async () => {
  const backend = crearBackendDemo(almacenEnMemoria());
  await backend.precargarCaso(SESION, '2026-10-14T10:00:00');
  const r = await backend.conciliar(CAMPANIA);
  assert.equal(r.ok, true);
  assert.equal(r.cobertura.faltantes.length, 0);
  assert.equal(r.indicadores.claves, 24);
  assert.equal(r.indicadores.clavesConDiferencia, 11);
  assert.equal(r.indicadores.diferenciaNeta, -25);
});

test('borrar los datos de demo deja la campaña vacía', async () => {
  const backend = crearBackendDemo(almacenEnMemoria());
  await backend.precargarCaso(SESION, '2026-10-14T10:00:00');
  await backend.reiniciar();
  assert.equal((await backend.estado(CAMPANIA)).registros.length, 0);
});
