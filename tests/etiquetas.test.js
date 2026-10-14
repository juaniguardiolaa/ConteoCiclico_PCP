// Las etiquetas que se imprimen tienen que leerse de vuelta y pasar (o fallar) las validaciones
// tal como se espera.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CASO } from '../docs/js/datos/caso.js';
import { paresMaterialLote } from '../docs/js/dominio/conciliacion.js';
import {
  ETIQUETAS_DE_PRUEBA,
  etiquetasDeSimulacion,
  leerEtiqueta,
  textoPosicion,
  textoProducto,
} from '../docs/js/dominio/etiquetas.js';
import { crearContexto, validarLecturaPosicion, validarLecturaProducto } from '../docs/js/dominio/validaciones.js';

const contexto = crearContexto({ ...CASO, campania: CASO.campania });

test('las 28 etiquetas de posición se leen y son válidas', () => {
  for (const { posicion } of CASO.posiciones) {
    const lectura = leerEtiqueta(textoPosicion(posicion));
    assert.deepEqual(lectura, { tipo: 'POSICION', posicion });
    assert.ok(validarLecturaPosicion(lectura, contexto).ok, posicion);
  }
});

test('las 22 etiquetas de producto-lote del catálogo se leen y no generan advertencias', () => {
  const pares = [...paresMaterialLote(CASO.stock3009, CASO.movimientos)];
  assert.equal(pares.length, 22);
  for (const par of pares) {
    const [codigo, lote] = par.split('|');
    const lectura = leerEtiqueta(textoProducto(codigo, lote));
    assert.deepEqual(lectura, { tipo: 'PRODUCTO', codigo, lote });
    const v = validarLecturaProducto(lectura, contexto);
    assert.ok(v.ok && !v.advertencia, par);
  }
});

test('para la simulación hace falta una etiqueta por posición ocupada: 21, con dos de PROD003 L0009', () => {
  const sim = etiquetasDeSimulacion(CASO.stock1410);
  assert.equal(sim.length, 21);
  assert.deepEqual(
    sim.filter((e) => e.codigo === 'PROD003' && e.lote === 'L0009').map((e) => [e.posicion, e.cantidad]),
    [
      ['C4', 40],
      ['F2', 20],
    ],
  );
  assert.equal(new Set(sim.map((e) => e.posicion)).size, 21);
});

test('cada etiqueta de prueba dispara el control que dice', () => {
  for (const e of ETIQUETAS_DE_PRUEBA) {
    const lectura = leerEtiqueta(e.texto);
    const v = e.espera === 'POSICION' ? validarLecturaPosicion(lectura, contexto) : validarLecturaProducto(lectura, contexto);
    assert.equal(v.codigo ?? v.advertencia?.codigo, e.control, e.texto);
  }
});
