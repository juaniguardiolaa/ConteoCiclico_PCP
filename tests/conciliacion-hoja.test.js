// H6: la conciliación escrita en la hoja con fórmulas. El simulador calcula las fórmulas
// (tests/formulas-simuladas.js), así que se puede comprobar que dan la tabla esperada del plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CASO } from '../docs/js/datos/caso.js';
import { registrosDesdeStockFisico } from '../docs/js/dominio/registros.js';
import { cargarServidor } from './simulador-google.js';

const CAMPANIA = 'CC-2026-10-14';

// Posición, código, lote, stock 30/09, ingresos, salidas, ajustes, teórico, físico, diferencia, clasificación
const ESPERADO = [
  ['A1', 'PROD003', 'L0003', 20, 0, -20, 0, 0, 5, 5, 'SOBRANTE'],
  ['A2', 'PROD003', 'L0010', 0, 60, -12, 4, 52, 45, -7, 'FALTANTE'],
  ['A3', 'PROD010', 'L0003', 0, 50, 0, 0, 50, 50, 0, 'OK'],
  ['A4', 'PROD004', 'L0064', 400, 0, -370, 0, 30, 20, -10, 'FALTANTE'],
  ['B2', 'PROD001', 'L0005', 300, 130, -300, 0, 130, 120, -10, 'FALTANTE'],
  ['B3', 'PROD001', 'L0007', 0, 560, -60, -20, 480, 490, 10, 'SOBRANTE'],
  ['B4', 'PROD001', 'L0006', 0, 100, 0, 0, 100, 100, 0, 'OK'],
  ['C3', 'PROD002', 'L0150', 0, 230, -50, 0, 180, 180, 0, 'OK'],
  ['C4', 'PROD003', 'L0009', 40, 0, 0, 0, 40, 40, 0, 'OK'],
  ['D1', 'PROD010', 'L0002', 15, 0, -5, 0, 10, 10, 0, 'OK'],
  ['D3', 'PROD008', 'L0014', 24, 0, 0, 0, 24, 24, 0, 'OK'],
  ['E1', 'PROD008', 'L0018', 0, 50, 0, 0, 50, 50, 0, 'OK'],
  ['E2', 'PROD009', 'L0015', 0, 100, 0, 5, 105, 105, 0, 'OK'],
  ['E3', 'PROD007', 'L0005', 0, 25, 0, 1, 26, 26, 0, 'OK'],
  ['E4', 'PROD006', 'L0120', 0, 120, -60, 0, 60, 60, 0, 'OK'],
  ['F1', 'PROD003', 'L0009', 0, 20, 0, 0, 20, 0, -20, 'UBICACION'],
  ['F2', 'PROD003', 'L0009', 0, 0, 0, 0, 0, 20, 20, 'UBICACION'],
  ['F2', 'PROD005', 'L0100', 80, 0, -40, -40, 0, 0, 0, 'OK'],
  ['F3', 'PROD005', 'L0110', 0, 50, -20, 0, 30, 30, 0, 'OK'],
  ['F4', 'PROD006', 'L0070', 0, 0, 0, 12, 12, 10, -2, 'FALTANTE'],
  ['G1', 'PROD008', 'L0016', 12, 0, -10, -2, 0, 2, 2, 'SOBRANTE'],
  ['G2', 'PROD010', 'L0001', 20, 5, -10, -10, 5, 2, -3, 'FALTANTE'],
  ['G3', 'PROD004', 'L0074', 0, 200, -10, 0, 190, 180, -10, 'FALTANTE'],
  ['G4', 'PROD002', 'L0110', 100, 0, -200, 100, 0, 0, 0, 'OK'],
];

function servidorConConteoDelEnunciado({ quitar = [] } = {}) {
  const s = cargarServidor();
  s.contexto.setupHojas();
  const token = s.hoja('Parametros').filasDeDatos().find((f) => f[0] === 'TOKEN')[1];
  const posiciones = CASO.posiciones.map((p) => p.posicion);
  const registros = registrosDesdeStockFisico(CASO.stock1410, posiciones, {
    campania: CAMPANIA, usuario: 'Operario 1', rol: 'OPERARIO', fechaHora: '2026-10-14T10:00:00',
  }).filter((r) => !quitar.includes(r.posicion));
  for (const r of registros) assert.equal(s.post({ accion: 'registrar', token, registro: r }).codigo, 'REGISTRADO');
  const conciliar = (extra = {}) => s.post({ accion: 'conciliar', token, rol: 'CONTROL', usuario: 'Control', ...extra });
  return { ...s, token, conciliar };
}

test('las fórmulas de la hoja Conciliacion dan exactamente la tabla esperada', () => {
  const s = servidorConConteoDelEnunciado();
  const r = s.conciliar();
  assert.equal(r.codigo, 'CONCILIADO', r.mensaje);

  const filas = s.hoja('Conciliacion').filasDeDatos();
  const obtenido = filas.map((f) => [f[4], f[1], f[3], f[5], f[6], f[7], f[8], f[9], f[10], f[11], f[13]]);
  assert.deepEqual(obtenido, ESPERADO);
  assert.equal(filas[0][0], 'PROD003|L0003|A1', 'la clave también es fórmula');
  assert.equal(filas[0][2], 'Bolso 40cm largo Negro');
});

test('el servidor compara lo que calculó la hoja con la app y avisa que coinciden', () => {
  const r = servidorConConteoDelEnunciado().conciliar();
  assert.deepEqual(r.datos.verificacion, { coinciden: true, revisadas: 24, diferencias: [] });
  assert.match(r.mensaje, /24 claves, 13 OK y 11 con diferencia/);
  assert.match(r.mensaje, /54,2 % por clave y 60,7 % por posición/);
  assert.match(r.mensaje, /coinciden con el cálculo de la app/);
});

test('cada número de Conciliacion es una fórmula SUMIFS sobre rangos con nombre, no un valor pegado', () => {
  const s = servidorConConteoDelEnunciado();
  s.conciliar();
  const [fila] = s.hoja('Conciliacion').getRange(2, 1, 1, 14).getFormulas();
  assert.match(fila[5], /^=SUMIFS\(STOCK_CANTIDAD, STOCK_CODIGO,\$B2, STOCK_LOTE,\$D2, STOCK_POSICION,\$E2\)$/);
  assert.match(fila[6], /MOV_FECHA,">="&FECHA_DESDE, MOV_FECHA,"<="&FECHA_CONTEO, MOV_TIPO,"Ingreso_Orden_Compra"/);
  assert.match(fila[7], /MOV_TIPO,"Salida_Venta"/);
  assert.equal(fila[9], '=F2+G2+H2+I2');
  assert.match(fila[10], /CONTEO_ESTADO,"VALIDO", CONTEO_CAMPANIA,CAMPANIA/);
  assert.equal(fila[11], '=K2-J2');
  assert.match(fila[13], /^=IF\(ABS\(L2\)<=M2, "OK"/);
  for (const j of [0, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13]) assert.ok(fila[j].startsWith('='), `columna ${j + 1}`);

  const nombres = s.libro.getNamedRanges().map((n) => n.getName()).sort();
  assert.deepEqual(nombres, [
    'CAMPANIA', 'CONTEO_CAMPANIA', 'CONTEO_CANTIDAD', 'CONTEO_CODIGO', 'CONTEO_ESTADO', 'CONTEO_LOTE', 'CONTEO_POSICION',
    'FECHA_CONTEO', 'FECHA_DESDE', 'MOV_CANTIDAD', 'MOV_CODIGO', 'MOV_FECHA', 'MOV_LOTE', 'MOV_POSICION', 'MOV_TIPO',
    'STOCK_CANTIDAD', 'STOCK_CODIGO', 'STOCK_LOTE', 'STOCK_POSICION', 'TOLERANCIA_DEFECTO',
  ]);
});

test('la hoja Resumen calcula los indicadores con fórmulas', () => {
  const s = servidorConConteoDelEnunciado();
  s.conciliar();
  const resumen = Object.fromEntries(s.hoja('Resumen').filasDeDatos().filter((f) => f[0]).map((f) => [f[0], f[1]]));
  assert.equal(resumen['Claves conciliadas'], 24);
  assert.equal(resumen['Claves sin diferencia'], 13);
  assert.equal(resumen['Claves con diferencia'], 11);
  assert.equal(resumen['Exactitud por clave'].toFixed(3), '0.542');
  assert.equal(resumen['Posiciones del alcance'], 28);
  assert.equal(resumen['Posiciones con diferencia'], 11);
  assert.equal(resumen['Exactitud por posición'].toFixed(3), '0.607');
  assert.equal(resumen['Posiciones relevadas'], 28);
  assert.equal(resumen['Teórico total (u.)'], 1594);
  assert.equal(resumen['Físico total (u.)'], 1569);
  assert.equal(resumen['Diferencia neta (u.)'], -25);
  assert.equal(resumen['Unidades faltantes'], 42);
  assert.equal(resumen['Unidades sobrantes'], 17);
  assert.deepEqual(
    ['OK', 'FALTANTE', 'SOBRANTE', 'UBICACION', 'NO_REGISTRADO'].map((c) => resumen[c]),
    [13, 6, 3, 2, 0],
  );
  assert.deepEqual(
    ['PROD001', 'PROD003', 'PROD004', 'PROD006', 'PROD008', 'PROD010'].map((c) => resumen[c]),
    [0, -2, -20, -2, 2, -3],
  );
  assert.equal(s.hoja('Resumen').getRange('B2').getFormula(), '=COUNTA(Conciliacion!A2:A)');
});

test('si faltan posiciones avisa y no concilia, salvo que se pida conciliar con lo relevado', () => {
  const s = servidorConConteoDelEnunciado({ quitar: ['C2', 'G3'] });
  const sinForzar = s.conciliar();
  assert.equal(sinForzar.codigo, 'COBERTURA_INCOMPLETA');
  assert.deepEqual(sinForzar.datos.faltantes, ['C2', 'G3']);
  assert.equal(s.hoja('Conciliacion').filasDeDatos().length, 0);

  const forzada = s.conciliar({ forzar: true });
  assert.equal(forzada.codigo, 'CONCILIADO');
  assert.match(forzada.mensaje, /Parcial: faltan 2 posiciones/);
  assert.equal(forzada.datos.verificacion.coinciden, true);
});

test('solo Control o el Jefe de almacén pueden conciliar desde la app', () => {
  const s = servidorConConteoDelEnunciado();
  assert.equal(s.conciliar({ rol: 'OPERARIO' }).codigo, 'ROL_NO_AUTORIZADO');
  assert.equal(s.conciliar({ rol: 'SUPERVISOR' }).codigo, 'CONCILIADO');
});

test('una nueva conciliación conserva Causa, Accion y Aprobado_por de las claves que siguen', () => {
  const s = servidorConConteoDelEnunciado();
  s.conciliar();
  const hoja = s.hoja('Conciliacion');
  const filaB3 = hoja.filasDeDatos().findIndex((f) => f[4] === 'B3') + 2;
  hoja.getRange(filaB3, 15, 1, 3).setValues([['Error de conteo', 'Reconteo', 'Jefe de almacén']]);

  s.conciliar();
  const b3 = hoja.filasDeDatos().find((f) => f[4] === 'B3');
  assert.deepEqual(b3.slice(14), ['Error de conteo', 'Reconteo', 'Jefe de almacén']);
  assert.deepEqual(s.post({ accion: 'estado', token: s.token }).datos.reconteos, ['B3']);
});

test('formato condicional por clasificación y listas desplegables en Causa y Accion', () => {
  const s = servidorConConteoDelEnunciado();
  s.conciliar();
  const hoja = s.hoja('Conciliacion');
  // JSON: los arreglos creados dentro del servidor simulado son de otro «mundo» de JavaScript.
  const comoDatos = (x) => JSON.parse(JSON.stringify(x));
  const reglas = hoja.getConditionalFormatRules();
  assert.deepEqual(
    comoDatos(reglas.map((r) => r.whenFormulaSatisfied)),
    ['=$N2="OK"', '=$N2="FALTANTE"', '=$N2="SOBRANTE"', '=$N2="UBICACION"', '=$N2="NO_REGISTRADO"'],
  );
  assert.equal(reglas[0].setRanges[0].getA1Notation(), 'A2:Q25', 'pinta la fila completa');
  const listas = comoDatos(hoja.validaciones.map((v) => [v.rango, v.regla.requireValueInList[0]]));
  assert.equal(listas[0][0], 'O2:O25');
  assert.ok(listas[0][1].includes('Error de ubicación'));
  assert.deepEqual(listas[1], ['P2:P25', ['Reconteo', 'Transferencia', 'Corrección de movimiento', 'Ajuste']]);
});

test('menú: cargar el conteo del enunciado y ejecutar la conciliación desde la planilla', () => {
  const s = cargarServidor();
  s.contexto.setupHojas();
  const [cargado] = s.desdeMenu('cargarConteoDePrueba');
  assert.match(cargado, /28 posiciones/);
  assert.equal(s.hoja('Conteo_1410').filasDeDatos().length, 28);

  const [resultado] = s.desdeMenu('ejecutarConciliacion');
  assert.match(resultado, /24 claves, 13 OK y 11 con diferencia/);
  assert.match(resultado, /coinciden con el cálculo de la app/);

  // Si alguien dice que no a cargar el conteo, no se toca nada.
  assert.deepEqual(s.desdeMenu('cargarConteoDePrueba', ['NO']), []);
  assert.equal(s.hoja('Conteo_1410').filasDeDatos().length, 28);
});

test('después de la transferencia y los ajustes en Movimientos, la hoja queda toda en OK', () => {
  const s = servidorConConteoDelEnunciado();
  const movimientos = s.hoja('Movimientos');
  const fecha = s.contexto.Utilities.parseDate('2026-10-14', '', 'yyyy-MM-dd');
  const nuevos = [
    ['A1', 'PROD003', 'L0003', 5], ['A2', 'PROD003', 'L0010', -7], ['A4', 'PROD004', 'L0064', -10],
    ['B2', 'PROD001', 'L0005', -10], ['B3', 'PROD001', 'L0007', 10], ['F4', 'PROD006', 'L0070', -2],
    ['G1', 'PROD008', 'L0016', 2], ['G2', 'PROD010', 'L0001', -3], ['G3', 'PROD004', 'L0074', -10],
  ].map(([pos, cod, lote, cant], i) => [`AJ-${i + 1}`, fecha, cod, lote, cant, 'UN', 'Ajuste_Inventario_Ciclico', pos, 'Prueba', 'AJUSTE_CONTEO']);
  nuevos.push(['TR-1', fecha, 'PROD003', 'L0009', -20, 'UN', 'Transferencia_Posicion', 'F1', 'Prueba', 'TRANSFERENCIA']);
  nuevos.push(['TR-2', fecha, 'PROD003', 'L0009', 20, 'UN', 'Transferencia_Posicion', 'F2', 'Prueba', 'TRANSFERENCIA']);
  nuevos.forEach((f) => movimientos.appendRow(f));
  assert.equal(movimientos.filasDeDatos().length, 51);

  const r = s.conciliar();
  assert.equal(r.datos.verificacion.coinciden, true);
  const clasificaciones = s.hoja('Conciliacion').filasDeDatos().map((f) => f[13]);
  assert.ok(clasificaciones.every((c) => c === 'OK'), clasificaciones.join(','));
});
