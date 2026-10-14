// Prueba de aceptación: con el stock físico del 14/10 del enunciado cargado como si fuera el
// conteo de la app, la conciliación tiene que dar exactamente la tabla "Resultado esperado" de PLAN.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CASO } from '../docs/js/datos/caso.js';
import { conciliar, categoriaMovimiento } from '../docs/js/dominio/conciliacion.js';
import { calcularIndicadores, cobertura } from '../docs/js/dominio/indicadores.js';
import { registrosDesdeStockFisico } from '../docs/js/dominio/registros.js';

const POSICIONES = CASO.posiciones.map((p) => p.posicion);
const BASE = { campania: CASO.campania, usuario: 'test', fechaHora: '2026-10-14T10:00:00' };

// Posición, código, lote, stock 30/09, movimientos 01–14/10, teórico, físico, diferencia, clasificación
const ESPERADO = [
  ['A1', 'PROD003', 'L0003', 20, -20, 0, 5, 5, 'SOBRANTE'],
  ['A2', 'PROD003', 'L0010', 0, 52, 52, 45, -7, 'FALTANTE'],
  ['A3', 'PROD010', 'L0003', 0, 50, 50, 50, 0, 'OK'],
  ['A4', 'PROD004', 'L0064', 400, -370, 30, 20, -10, 'FALTANTE'],
  ['B2', 'PROD001', 'L0005', 300, -170, 130, 120, -10, 'FALTANTE'],
  ['B3', 'PROD001', 'L0007', 0, 480, 480, 490, 10, 'SOBRANTE'],
  ['B4', 'PROD001', 'L0006', 0, 100, 100, 100, 0, 'OK'],
  ['C3', 'PROD002', 'L0150', 0, 180, 180, 180, 0, 'OK'],
  ['C4', 'PROD003', 'L0009', 40, 0, 40, 40, 0, 'OK'],
  ['D1', 'PROD010', 'L0002', 15, -5, 10, 10, 0, 'OK'],
  ['D3', 'PROD008', 'L0014', 24, 0, 24, 24, 0, 'OK'],
  ['E1', 'PROD008', 'L0018', 0, 50, 50, 50, 0, 'OK'],
  ['E2', 'PROD009', 'L0015', 0, 105, 105, 105, 0, 'OK'],
  ['E3', 'PROD007', 'L0005', 0, 26, 26, 26, 0, 'OK'],
  ['E4', 'PROD006', 'L0120', 0, 60, 60, 60, 0, 'OK'],
  ['F1', 'PROD003', 'L0009', 0, 20, 20, 0, -20, 'UBICACION'],
  ['F2', 'PROD003', 'L0009', 0, 0, 0, 20, 20, 'UBICACION'],
  ['F2', 'PROD005', 'L0100', 80, -80, 0, 0, 0, 'OK'],
  ['F3', 'PROD005', 'L0110', 0, 30, 30, 30, 0, 'OK'],
  ['F4', 'PROD006', 'L0070', 0, 12, 12, 10, -2, 'FALTANTE'],
  ['G1', 'PROD008', 'L0016', 12, -12, 0, 2, 2, 'SOBRANTE'],
  ['G2', 'PROD010', 'L0001', 20, -15, 5, 2, -3, 'FALTANTE'],
  ['G3', 'PROD004', 'L0074', 0, 190, 190, 180, -10, 'FALTANTE'],
  ['G4', 'PROD002', 'L0110', 100, -100, 0, 0, 0, 'OK'],
];

const conciliarCaso = (extra = {}) =>
  conciliar({
    materiales: CASO.materiales,
    stock3009: CASO.stock3009,
    movimientos: CASO.movimientos,
    registros: registrosDesdeStockFisico(CASO.stock1410, POSICIONES, BASE),
    campania: CASO.campania,
    desde: CASO.fechaDesde,
    hasta: CASO.fechaConteo,
    ...extra,
  });

test('la conciliación del caso coincide fila por fila con el resultado esperado', () => {
  const filas = conciliarCaso();
  const obtenido = filas.map((f) => [
    f.posicion,
    f.codigo,
    f.lote,
    f.stockInicial,
    f.ingresos + f.salidas + f.ajustes,
    f.teorico,
    f.fisico,
    f.diferencia,
    f.clasificacion,
  ]);
  assert.deepEqual(obtenido, ESPERADO);
});

test('indicadores del caso: 24 claves, 13 OK, exactitud 54,2 % por clave y 60,7 % por posición', () => {
  const ind = calcularIndicadores(conciliarCaso(), POSICIONES, CASO.materiales);
  assert.equal(ind.claves, 24);
  assert.equal(ind.clavesOk, 13);
  assert.equal(ind.clavesConDiferencia, 11);
  assert.equal(ind.exactitudPorClave.toFixed(3), '0.542');
  assert.equal(ind.posicionesSinDiferencia, 17);
  assert.equal(ind.exactitudPorPosicion.toFixed(3), '0.607');
  assert.equal(ind.teoricoTotal, 1594);
  assert.equal(ind.fisicoTotal, 1569);
  assert.equal(ind.diferenciaNeta, -25);
  assert.equal(ind.unidadesFaltantes, 42);
  assert.equal(ind.unidadesSobrantes, 17);
  assert.deepEqual(ind.porClasificacion, { OK: 13, FALTANTE: 6, SOBRANTE: 3, UBICACION: 2, NO_REGISTRADO: 0 });
});

test('diferencia neta por material', () => {
  const { porMaterial } = calcularIndicadores(conciliarCaso(), POSICIONES, CASO.materiales);
  const neto = Object.fromEntries(porMaterial.map((m) => [m.codigo, m.diferencia]));
  assert.deepEqual(neto, {
    PROD001: 0,
    PROD002: 0,
    PROD003: -2,
    PROD004: -20,
    PROD005: 0,
    PROD006: -2,
    PROD007: 0,
    PROD008: 2,
    PROD009: 0,
    PROD010: -3,
  });
});

test('las 28 posiciones quedan relevadas y 7 de ellas vacías', () => {
  const registros = registrosDesdeStockFisico(CASO.stock1410, POSICIONES, BASE);
  const cob = cobertura(registros, POSICIONES, CASO.campania);
  assert.equal(cob.relevadas.length, 28);
  assert.deepEqual(cob.faltantes, []);
  assert.deepEqual(
    registros.filter((r) => r.vacia).map((r) => r.posicion),
    ['B1', 'C1', 'C2', 'D2', 'D4', 'F1', 'G4'],
  );
});

test('cobertura incompleta lista las posiciones que faltan contar', () => {
  const registros = registrosDesdeStockFisico(CASO.stock1410, POSICIONES, BASE).filter(
    (r) => !['C2', 'G3'].includes(r.posicion),
  );
  assert.deepEqual(cobertura(registros, POSICIONES, CASO.campania).faltantes, ['C2', 'G3']);
});

test('los registros REEMPLAZADO o de otra campaña no suman al físico', () => {
  const registros = registrosDesdeStockFisico(CASO.stock1410, POSICIONES, BASE).map((r) =>
    r.posicion === 'B3' ? { ...r, estado: 'REEMPLAZADO' } : r.posicion === 'G3' ? { ...r, campania: 'OTRA' } : r,
  );
  const filas = conciliar({
    materiales: CASO.materiales,
    stock3009: CASO.stock3009,
    movimientos: CASO.movimientos,
    registros,
    campania: CASO.campania,
    desde: CASO.fechaDesde,
    hasta: CASO.fechaConteo,
  });
  assert.equal(filas.find((f) => f.posicion === 'B3').fisico, 0);
  assert.equal(filas.find((f) => f.posicion === 'G3').fisico, 0);
});

test('después de la transferencia F1 → F2 y los 9 ajustes aprobados no quedan diferencias', () => {
  const ajustes = [
    ['A1', 'PROD003', 'L0003', 5],
    ['A2', 'PROD003', 'L0010', -7],
    ['A4', 'PROD004', 'L0064', -10],
    ['B2', 'PROD001', 'L0005', -10],
    ['B3', 'PROD001', 'L0007', 10],
    ['F4', 'PROD006', 'L0070', -2],
    ['G1', 'PROD008', 'L0016', 2],
    ['G2', 'PROD010', 'L0001', -3],
    ['G3', 'PROD004', 'L0074', -10],
  ].map(([posicion, codigo, lote, cantidad]) => ({
    fecha: '2026-10-14', codigo, lote, cantidad, um: 'UN', tipo: 'Ajuste_Inventario_Ciclico', posicion,
  }));
  const transferencia = [
    { fecha: '2026-10-14', codigo: 'PROD003', lote: 'L0009', cantidad: -20, um: 'UN', tipo: 'Transferencia_Posicion', posicion: 'F1' },
    { fecha: '2026-10-14', codigo: 'PROD003', lote: 'L0009', cantidad: 20, um: 'UN', tipo: 'Transferencia_Posicion', posicion: 'F2' },
  ];
  const movimientos = [...CASO.movimientos, ...ajustes, ...transferencia];
  assert.equal(movimientos.length, 51);

  const filas = conciliarCaso({ movimientos });
  assert.ok(filas.every((f) => f.clasificacion === 'OK'), 'todas las claves quedan OK');
  assert.equal(calcularIndicadores(filas, POSICIONES).exactitudPorPosicion, 1);
});

test('la tolerancia por material convierte una diferencia chica en OK', () => {
  const materiales = CASO.materiales.map((m) => (m.codigo === 'PROD006' ? { ...m, tolerancia: 2 } : m));
  const f4 = conciliarCaso({ materiales }).find((f) => f.posicion === 'F4');
  assert.equal(f4.diferencia, -2);
  assert.equal(f4.clasificacion, 'OK');
});

test('un lote que el sistema no conoce se clasifica como NO_REGISTRADO', () => {
  const registros = [
    ...registrosDesdeStockFisico(CASO.stock1410, POSICIONES, BASE).filter((r) => r.posicion !== 'D2'),
    { id: 'x', campania: CASO.campania, estado: 'VALIDO', vacia: false, posicion: 'D2', codigo: 'PROD009', lote: 'L0099', cantidad: 7 },
  ];
  const fila = conciliarCaso({ registros }).find((f) => f.posicion === 'D2');
  assert.equal(fila.teorico, 0);
  assert.equal(fila.diferencia, 7);
  assert.equal(fila.clasificacion, 'NO_REGISTRADO');
});

test('los movimientos fuera del período no entran en el teórico', () => {
  const movimientos = [
    ...CASO.movimientos,
    { fecha: '2026-09-29', codigo: 'PROD001', lote: 'L0006', cantidad: 999, tipo: 'Ingreso_Orden_Compra', posicion: 'B4' },
    { fecha: '2026-10-15', codigo: 'PROD001', lote: 'L0006', cantidad: 999, tipo: 'Ingreso_Orden_Compra', posicion: 'B4' },
  ];
  assert.equal(conciliarCaso({ movimientos }).find((f) => f.posicion === 'B4').teorico, 100);
});

test('cada tipo de movimiento cae en su columna', () => {
  assert.equal(categoriaMovimiento('Ingreso_Orden_Compra'), 'ingresos');
  assert.equal(categoriaMovimiento('Retorno_Venta'), 'ingresos');
  assert.equal(categoriaMovimiento('Salida_Venta'), 'salidas');
  assert.equal(categoriaMovimiento('Consumo_Orden_Producción'), 'salidas');
  assert.equal(categoriaMovimiento('Ajuste_Inventario_Ciclico'), 'ajustes');
  assert.equal(categoriaMovimiento('Ajuste_Inventario_Anual'), 'ajustes');
  assert.equal(categoriaMovimiento('Transferencia_Posicion'), 'ajustes');
});
