// H7: análisis de diferencias y cierre (Hoja 2 del diagrama, fases 4 y 5), con la planilla simulada.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CASO } from '../docs/js/datos/caso.js';
import { crearRegistro, registrosDesdeStockFisico } from '../docs/js/dominio/registros.js';
import { cargarServidor } from './simulador-google.js';

const CAMPANIA = 'CC-2026-10-14';

function servidorConciliado() {
  const s = cargarServidor();
  s.contexto.setupHojas();
  const token = s.hoja('Parametros').filasDeDatos().find((f) => f[0] === 'TOKEN')[1];
  const posiciones = CASO.posiciones.map((p) => p.posicion);
  for (const r of registrosDesdeStockFisico(CASO.stock1410, posiciones, {
    campania: CAMPANIA, usuario: 'Operario 1', rol: 'OPERARIO', fechaHora: '2026-10-14T10:00:00',
  })) {
    s.post({ accion: 'registrar', token, registro: r });
  }
  const post = (cuerpo) => s.post({ token, usuario: 'Control', rol: 'CONTROL', ...cuerpo });
  assert.equal(post({ accion: 'conciliar' }).codigo, 'CONCILIADO');
  const conciliacion = s.hoja('Conciliacion');
  /** Completa Causa, Accion y Aprobado_por de la fila de esa posición (y código, si hay dos). */
  const decidir = (posicion, causa, accion, aprobo, codigo) => {
    const i = conciliacion.filasDeDatos().findIndex((f) => f[4] === posicion && (!codigo || f[1] === codigo));
    conciliacion.getRange(i + 2, 15, 1, 3).setValues([[causa, accion, aprobo]]);
  };
  const clasificaciones = () => conciliacion.filasDeDatos().map((f) => f[13]);
  return { ...s, token, post, decidir, clasificaciones };
}

test('transferencia F1 → F2 y 9 ajustes aprobados: Movimientos pasa a 51 filas y todo queda en OK', () => {
  const s = servidorConciliado();
  s.decidir('F1', 'Error de ubicación', 'Transferencia', 'Jefe de almacén');
  s.decidir('F2', 'Error de ubicación', 'Transferencia', 'Jefe de almacén', 'PROD003');
  for (const p of ['A1', 'A2', 'A4', 'B2', 'B3', 'F4', 'G1', 'G2', 'G3']) s.decidir(p, 'Error de conteo', 'Ajuste', 'Jefe de almacén');

  const [aviso] = s.desdeMenu('registrarAjustesAprobados');
  assert.match(aviso, /Se registraron 11 movimientos/);
  const movimientos = s.hoja('Movimientos').filasDeDatos();
  assert.equal(movimientos.length, 51);
  const transferencias = movimientos.filter((m) => m[6] === 'Transferencia_Posicion').map((m) => [m[7], m[4], m[9]]);
  assert.deepEqual(transferencias, [['F1', -20, 'TRANSFERENCIA'], ['F2', 20, 'TRANSFERENCIA']]);
  assert.match(movimientos.find((m) => m[7] === 'B3' && m[9] === 'AJUSTE_CONTEO')[8], /Error de conteo\. Aprobó Jefe de almacén/);

  // Las fórmulas se recalculan solas: sin volver a conciliar, ya está todo en OK.
  assert.ok(s.clasificaciones().every((c) => c === 'OK'), s.clasificaciones().join(','));
  const r = s.post({ accion: 'conciliar' });
  assert.equal(r.datos.indicadores.clavesConDiferencia, 0);
  assert.equal(r.datos.verificacion.coinciden, true);

  // Correrlo de nuevo no duplica: ya no hay diferencias que ajustar.
  const [segunda] = s.desdeMenu('registrarAjustesAprobados');
  assert.match(segunda, /No hay ajustes ni transferencias aprobados/);
  assert.equal(s.hoja('Movimientos').filasDeDatos().length, 51);
});

test('sin Aprobado_por no se registra; una transferencia de una sola posición tampoco', () => {
  const s = servidorConciliado();
  s.decidir('A1', 'Error de conteo', 'Ajuste', '');
  s.decidir('F1', 'Error de ubicación', 'Transferencia', 'Jefe');
  const [aviso] = s.desdeMenu('registrarAjustesAprobados');
  assert.match(aviso, /No hay ajustes ni transferencias aprobados/);
  assert.match(aviso, /PROD003\|L0009 no cierra/);
  assert.match(aviso, /Sin aprobar.*A1 PROD003 L0003/);
  assert.equal(s.hoja('Movimientos').filasDeDatos().length, 40);
});

test('si se responde que no, no se agrega nada', () => {
  const s = servidorConciliado();
  s.decidir('B3', 'Error de conteo', 'Ajuste', 'Jefe');
  assert.deepEqual(s.desdeMenu('registrarAjustesAprobados', ['NO']), []);
  assert.equal(s.hoja('Movimientos').filasDeDatos().length, 40);
});

test('reconteo pedido desde la app: aparece en la ruta, el nuevo conteo reemplaza al anterior y se reconcilia', () => {
  const s = servidorConciliado();
  assert.equal(s.post({ accion: 'pedirReconteo', posicion: 'B3', rol: 'OPERARIO' }).codigo, 'ROL_NO_AUTORIZADO');
  assert.equal(s.post({ accion: 'pedirReconteo', posicion: 'B3' }).codigo, 'RECONTEO_PEDIDO');
  assert.deepEqual(s.post({ accion: 'estado' }).datos.reconteos, ['B3']);
  const filaB3 = s.hoja('Conciliacion').filasDeDatos().find((f) => f[4] === 'B3');
  assert.equal(filaB3[15], 'Reconteo');

  // El operario recuenta B3 y le da 480: era un error de conteo.
  const reconteo = crearRegistro({
    id: 'reconteo-b3', fechaHora: '2026-10-14T11:00:00', usuario: 'Operario 2', rol: 'OPERARIO', campania: CAMPANIA,
    tipo: 'RECONTEO', posicion: 'B3', codigo: 'PROD001', lote: 'L0007', cantidad: 480,
  });
  assert.equal(s.post({ accion: 'registrar', registro: reconteo }).codigo, 'REGISTRADO');
  assert.deepEqual(s.post({ accion: 'estado' }).datos.reconteos, []);
  const b3 = s.hoja('Conteo_1410').filasDeDatos().filter((f) => f[6] === 'B3').map((f) => [f[5], f[9], f[11]]);
  assert.deepEqual(b3, [['CONTEO', 490, 'REEMPLAZADO'], ['RECONTEO', 480, 'VALIDO']]);

  // La hoja ya muestra el reconteo (las fórmulas leen solo los VALIDO).
  assert.equal(s.hoja('Conciliacion').filasDeDatos().find((f) => f[4] === 'B3')[13], 'OK');
});

test('foto de la conciliación: copia los valores de Conciliacion y Resumen en una hoja nueva', () => {
  const s = servidorConciliado();
  const [aviso] = s.desdeMenu('guardarFotoConciliacion');
  const nombre = /«(.+)»/.exec(aviso)[1];
  const foto = s.hoja(nombre);
  assert.ok(foto, nombre);
  const valores = foto.getDataRange().getValues();
  assert.equal(valores[1][0], 'PROD003|L0003|A1');
  assert.equal(valores[1][13], 'SOBRANTE');
  assert.equal(foto.getRange('B2').getFormula(), '', 'son valores, no fórmulas');
  // Una segunda foto en el mismo minuto no pisa la primera.
  const [otro] = s.desdeMenu('guardarFotoConciliacion');
  assert.notEqual(/«(.+)»/.exec(otro)[1], nombre);
});

test('cierre: lo aprueba el Jefe de almacén, guarda la foto final y la app ya no acepta registros', () => {
  const s = servidorConciliado();
  // Quedan diferencias: pregunta si cerrar igual. Se responde que no.
  assert.deepEqual(s.desdeMenu('cerrarCampania', ['NO']), []);
  // Ahora sí, y se cancela el nombre: tampoco cierra.
  assert.deepEqual(s.desdeMenu('cerrarCampania', ['YES', null]), []);
  assert.equal(s.post({ accion: 'parametros' }).datos.estadoCampania, 'ABIERTA');

  const [aviso] = s.desdeMenu('cerrarCampania', ['YES', 'Jefe de almacén']);
  assert.match(aviso, /cerrada por Jefe de almacén/);
  const p = s.post({ accion: 'parametros' }).datos;
  assert.equal(p.estadoCampania, 'CERRADA');
  assert.equal(p.cierreAprobadoPor, 'Jefe de almacén');
  assert.ok(s.libro.getSheets().some((h) => /^Foto .* cierre$/.test(h.getName())));

  const tarde = crearRegistro({
    id: 'tarde', fechaHora: '2026-10-14T18:00:00', usuario: 'Operario 1', campania: CAMPANIA,
    posicion: 'B2', codigo: 'PROD001', lote: 'L0005', cantidad: 1, tipo: 'RECONTEO',
  });
  assert.equal(s.post({ accion: 'registrar', registro: tarde }).codigo, 'CAMPANIA_CERRADA');

  // Reiniciar la simulación vuelve a abrirla.
  s.desdeMenu('reiniciarSimulacion');
  assert.equal(s.post({ accion: 'parametros' }).datos.estadoCampania, 'ABIERTA');
});
