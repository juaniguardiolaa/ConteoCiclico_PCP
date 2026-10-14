// Validaciones 1 a 7 y lectura de etiquetas, con los casos que se muestran en la simulación.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CASO } from '../docs/js/datos/caso.js';
import { leerEtiqueta, leerPosicionManual, leerProductoManual, textoConfig } from '../docs/js/dominio/etiquetas.js';
import {
  crearContexto,
  validarCantidad,
  validarLecturaPosicion,
  validarLecturaProducto,
  validarPosicion,
  validarProducto,
  validarRegistro,
} from '../docs/js/dominio/validaciones.js';
import { agregarRegistro, crearRegistro } from '../docs/js/dominio/registros.js';

const contexto = (registros = [], reconteos = []) =>
  crearContexto({ ...CASO, registros, campania: CASO.campania, reconteos });

const registroB2 = (extra = {}) =>
  crearRegistro({
    id: 'id-b2',
    fechaHora: '2026-10-14T10:00:00',
    usuario: 'Operario 1',
    campania: CASO.campania,
    posicion: 'B2',
    codigo: 'PROD001',
    lote: 'L0005',
    cantidad: 120,
    ...extra,
  });

test('lectura de etiquetas escaneadas', () => {
  assert.deepEqual(leerEtiqueta('POS:B2'), { tipo: 'POSICION', posicion: 'B2' });
  assert.deepEqual(leerEtiqueta(' pos:b2 '), { tipo: 'POSICION', posicion: 'B2' });
  assert.deepEqual(leerEtiqueta('MAT:PROD001|L0005'), { tipo: 'PRODUCTO', codigo: 'PROD001', lote: 'L0005' });
  assert.equal(leerEtiqueta('hola').tipo, 'DESCONOCIDA');
  assert.equal(leerEtiqueta('').tipo, 'DESCONOCIDA');
  assert.deepEqual(leerEtiqueta(textoConfig('https://script.google.com/x', 'Abc123')), {
    tipo: 'CONFIG',
    url: 'https://script.google.com/x',
    token: 'Abc123',
  });
});

test('ingreso manual con o sin prefijo', () => {
  assert.deepEqual(leerPosicionManual('b2'), { tipo: 'POSICION', posicion: 'B2' });
  assert.deepEqual(leerPosicionManual('POS:B2'), { tipo: 'POSICION', posicion: 'B2' });
  assert.deepEqual(leerProductoManual('prod001|l0005'), { tipo: 'PRODUCTO', codigo: 'PROD001', lote: 'L0005' });
  assert.deepEqual(leerProductoManual('PROD001 L0005'), { tipo: 'PRODUCTO', codigo: 'PROD001', lote: 'L0005' });
  assert.deepEqual(leerProductoManual('PROD001'), { tipo: 'PRODUCTO', codigo: 'PROD001', lote: '' });
  assert.equal(leerPosicionManual('MAT:PROD001|L0005').tipo, 'PRODUCTO');
  assert.equal(leerProductoManual('POS:B2').tipo, 'POSICION');
});

test('validación 1: POS:Z9 no existe en el maestro', () => {
  const r = validarLecturaPosicion(leerEtiqueta('POS:Z9'), contexto());
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'POSICION_INEXISTENTE');
});

test('etiqueta equivocada: producto donde se espera posición y al revés', () => {
  assert.equal(validarLecturaPosicion(leerEtiqueta('MAT:PROD001|L0005'), contexto()).codigo, 'ETIQUETA_EQUIVOCADA');
  assert.equal(validarLecturaProducto(leerEtiqueta('POS:B2'), contexto()).codigo, 'ETIQUETA_EQUIVOCADA');
  assert.equal(validarLecturaPosicion(leerEtiqueta('xyz'), contexto()).codigo, 'ETIQUETA_INVALIDA');
});

test('validación 2: B2 escaneada dos veces en la campaña', () => {
  const { registros } = agregarRegistro([], registroB2());
  const r = validarPosicion('B2', contexto(registros));
  assert.equal(r.codigo, 'POSICION_DUPLICADA');
  assert.ok(validarPosicion('B3', contexto(registros)).ok);
});

test('validación 2: el reconteo solo entra si Control lo pidió', () => {
  const { registros } = agregarRegistro([], registroB2());
  assert.equal(validarPosicion('B2', contexto(registros), 'RECONTEO').codigo, 'RECONTEO_NO_PEDIDO');
  assert.ok(validarPosicion('B2', contexto(registros, ['B2']), 'RECONTEO').ok);
});

test('validación 3: material inexistente o lote mal formado', () => {
  assert.equal(validarProducto('PROD011', 'L0005', contexto()).codigo, 'MATERIAL_INEXISTENTE');
  assert.equal(validarProducto('PROD001', 'L005', contexto()).codigo, 'LOTE_FORMATO');
  assert.equal(validarProducto('PROD001', '', contexto()).codigo, 'CAMPO_VACIO');
  assert.equal(validarProducto('', 'L0005', contexto()).codigo, 'CAMPO_VACIO');
});

test('validación 4: lote desconocido advierte pero no bloquea', () => {
  const r = validarProducto('PROD001', 'L0099', contexto());
  assert.equal(r.ok, true);
  assert.equal(r.advertencia.codigo, 'LOTE_DESCONOCIDO');
  assert.equal(validarProducto('PROD001', 'L0005', contexto()).advertencia, undefined);
});

test('validación 5: cantidad entera entre 0 y 9999', () => {
  assert.deepEqual(validarCantidad('120'), { ok: true, valor: 120 });
  assert.deepEqual(validarCantidad(0), { ok: true, valor: 0 });
  assert.equal(validarCantidad('-12').codigo, 'CANTIDAD_INVALIDA');
  assert.equal(validarCantidad('1.5').codigo, 'CANTIDAD_INVALIDA');
  assert.equal(validarCantidad('1,5').codigo, 'CANTIDAD_INVALIDA');
  assert.equal(validarCantidad('doce').codigo, 'CANTIDAD_INVALIDA');
  assert.equal(validarCantidad('10000').codigo, 'CANTIDAD_FUERA_DE_RANGO');
  assert.equal(validarCantidad('').codigo, 'CAMPO_VACIO');
  assert.equal(validarCantidad(null).codigo, 'CAMPO_VACIO');
});

test('validación 6: ningún campo obligatorio vacío', () => {
  assert.ok(validarRegistro(registroB2(), contexto()).ok);
  assert.equal(validarRegistro(registroB2({ usuario: '  ' }), contexto()).codigo, 'CAMPO_VACIO');
  assert.equal(validarRegistro(registroB2({ id: '' }), contexto()).codigo, 'CAMPO_VACIO');
  assert.equal(validarRegistro(registroB2({ lote: '' }), contexto()).codigo, 'CAMPO_VACIO');
  assert.equal(validarRegistro(registroB2({ cantidad: '' }), contexto()).codigo, 'CAMPO_VACIO');
});

test('una posición vacía se registra con cantidad 0 y sin material', () => {
  const vacia = crearRegistro({ id: 'v', usuario: 'Op', campania: CASO.campania, posicion: 'B1', vacia: true, codigo: 'PROD001', cantidad: 5 });
  assert.equal(vacia.cantidad, 0);
  assert.equal(vacia.codigo, '');
  assert.ok(validarRegistro(vacia, contexto()).ok);
  assert.equal(validarRegistro({ ...vacia, cantidad: 3 }, contexto()).codigo, 'VACIA_CON_DATOS');
});

test('validación 7: el mismo ID enviado dos veces no duplica', () => {
  const primero = agregarRegistro([], registroB2());
  const segundo = agregarRegistro(primero.registros, registroB2());
  assert.equal(segundo.registros.length, 1);
  assert.equal(segundo.resultado.codigo, 'YA_REGISTRADO');
  assert.equal(segundo.resultado.ok, true);
});

test('un reconteo deja el registro anterior como REEMPLAZADO', () => {
  const primero = agregarRegistro([], registroB2({ cantidad: 18, posicion: 'G3', codigo: 'PROD004', lote: 'L0074' }));
  const reconteo = registroB2({ id: 'id-reconteo', tipo: 'RECONTEO', posicion: 'G3', codigo: 'PROD004', lote: 'L0074', cantidad: 180 });
  const { registros } = agregarRegistro(primero.registros, reconteo);
  assert.deepEqual(
    registros.map((r) => [r.id, r.estado, r.cantidad]),
    [
      ['id-b2', 'REEMPLAZADO', 18],
      ['id-reconteo', 'VALIDO', 180],
    ],
  );
});
