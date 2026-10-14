// Servidor (Apps Script) probado con la planilla simulada: configuración de hojas, validaciones,
// idempotencia, reconteo, log y conciliación, y la app hablando con él por el mismo contrato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { generarDominio, generarPaquete } from '../scripts/generar-apps-script.mjs';
import { almacenEnMemoria } from '../docs/js/almacen.js';
import { crearBackendAppsScript, probarConexion } from '../docs/js/backend/appsscript.js';
import { CASO } from '../docs/js/datos/caso.js';
import { crearCola } from '../docs/js/dominio/cola.js';
import { crearRegistro, registrosDesdeStockFisico } from '../docs/js/dominio/registros.js';
import { cargarServidor } from './simulador-google.js';

const CAMPANIA = 'CC-2026-10-14';
const URL_WEB_APP = 'https://script.google.com/macros/s/AKfyc-prueba_123/exec';

function servidorConfigurado() {
  const s = cargarServidor();
  s.contexto.setupHojas();
  const token = s.hoja('Parametros').filasDeDatos().find((f) => f[0] === 'TOKEN')[1];
  const registrar = (registro) => s.post({ accion: 'registrar', token, registro });
  return { ...s, token, registrar };
}

const registro = (posicion, extra = {}) =>
  crearRegistro({
    id: `id-${posicion}-${extra.tipo ?? 'CONTEO'}-${extra.cantidad ?? 120}`,
    fechaHora: '2026-10-14T10:15:00',
    usuario: 'Operario 1',
    rol: 'OPERARIO',
    campania: CAMPANIA,
    posicion,
    codigo: 'PROD001',
    lote: 'L0005',
    cantidad: 120,
    dispositivo: 'Android Chrome',
    ...extra,
  });

test('el archivo para pegar en Apps Script está al día con docs/js/dominio y apps-script/*.gs', () => {
  const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(leer('apps-script/Dominio.gs'), generarDominio(), 'correr npm run apps-script');
  assert.equal(leer('apps-script/conteo-ciclico.gs'), generarPaquete(), 'correr npm run apps-script');
});

test('setupHojas crea las 10 hojas con los datos del caso y se puede correr de nuevo sin duplicar', () => {
  const s = cargarServidor();
  s.contexto.setupHojas();
  const nombres = s.libro.getSheets().map((h) => h.getName());
  assert.deepEqual(nombres, [
    'Parametros', 'Maestro_Materiales', 'Maestro_Posiciones', 'Maestro_Lotes', 'Stock_3009',
    'Movimientos', 'Conteo_1410', 'Conciliacion', 'Resumen', 'Log_API',
  ]);
  const filas = (n) => s.hoja(n).filasDeDatos().length;
  const conteo = () => ({
    Parametros: filas('Parametros'),
    Maestro_Materiales: filas('Maestro_Materiales'),
    Maestro_Posiciones: filas('Maestro_Posiciones'),
    Stock_3009: filas('Stock_3009'),
    Movimientos: filas('Movimientos'),
  });
  const esperado = { Parametros: 7, Maestro_Materiales: 10, Maestro_Posiciones: 28, Stock_3009: 13, Movimientos: 40 };
  assert.deepEqual(conteo(), esperado);
  assert.match(s.hoja('Maestro_Lotes').getRange('A2').getFormula(), /^=SORT\(UNIQUE\(FILTER\(/);

  const token = s.hoja('Parametros').filasDeDatos().find((f) => f[0] === 'TOKEN')[1];
  assert.match(token, /^[0-9a-f]{12}$/);

  s.contexto.setupHojas();
  assert.deepEqual(conteo(), esperado, 'la segunda corrida no duplica');
  assert.equal(s.hoja('Parametros').filasDeDatos().find((f) => f[0] === 'TOKEN')[1], token, 'conserva el token');
});

test('Movimientos guarda fechas reales, con ID y origen CASO', () => {
  const s = servidorConfigurado();
  const [primera] = s.hoja('Movimientos').filasDeDatos();
  assert.equal(primera[0], 'MOV-001');
  assert.equal(primera[1].constructor.name, 'Date');
  assert.equal(primera[9], 'CASO');
});

test('antes de setupHojas, el ping (o abrir la URL sola) avisa que faltan las hojas', async () => {
  const s = cargarServidor();
  const ping = s.get({});
  assert.equal(ping.codigo, 'PONG');
  assert.equal(ping.datos.hojasListas, false);
  assert.match(ping.mensaje, /setupHojas/);
  const prueba = await probarConexion(URL_WEB_APP, 'cualquiera', s.fetch);
  assert.equal(prueba.ok, false);
  assert.match(prueba.mensaje, /setupHojas/);
});

test('ping responde sin token; el resto exige el token de Parametros', () => {
  const s = servidorConfigurado();
  const ping = s.get({ accion: 'ping' });
  assert.equal(ping.codigo, 'PONG');
  assert.equal(ping.datos.tokenValido, false);
  assert.equal(s.post({ accion: 'ping', token: s.token }).datos.tokenValido, true);
  assert.equal(s.post({ accion: 'maestros', token: 'otro' }).codigo, 'TOKEN_INVALIDO');
  assert.equal(s.post({ accion: 'inventada', token: s.token }).codigo, 'ACCION_DESCONOCIDA');
  assert.equal(s.get({ accion: 'registrar', token: s.token }).codigo, 'METODO_INVALIDO');
});

test('maestros y parámetros salen de la planilla', () => {
  const s = servidorConfigurado();
  const m = s.post({ accion: 'maestros', token: s.token }).datos;
  assert.equal(m.posiciones.length, 28);
  assert.equal(m.materiales.length, 10);
  assert.equal(m.lotes.length, 22);
  assert.deepEqual(s.post({ accion: 'parametros', token: s.token }).datos, {
    campania: CAMPANIA,
    fechaConteo: '2026-10-14',
    fechaStockInicial: '2026-09-30',
    fechaDesde: '2026-10-01',
  });
});

test('registrar: válido entra, mismo ID no duplica, Z9 y -12 se rechazan, B2 dos veces es duplicado', () => {
  const s = servidorConfigurado();
  assert.equal(s.registrar(registro('B2')).codigo, 'REGISTRADO');
  assert.equal(s.registrar(registro('B2')).codigo, 'YA_REGISTRADO');
  assert.equal(s.registrar({ ...registro('B2'), id: 'otro' }).codigo, 'POSICION_DUPLICADA');
  assert.equal(s.registrar(registro('Z9')).codigo, 'POSICION_INEXISTENTE');
  assert.equal(s.registrar(registro('B3', { cantidad: -12 })).codigo, 'CANTIDAD_INVALIDA');
  assert.equal(s.registrar(registro('B3', { lote: 'L005' })).codigo, 'LOTE_FORMATO');
  assert.equal(s.registrar(registro('B3', { usuario: '' })).codigo, 'CAMPO_VACIO');
  assert.equal(s.registrar({ ...registro('B3'), campania: 'OTRA' }).codigo, 'CAMPANIA_INVALIDA');

  const filas = s.hoja('Conteo_1410').filasDeDatos();
  assert.equal(filas.length, 1);
  const [id, fechaHora, usuario, rol, campania, tipo, posicion, codigo, lote, cantidad, vacia, estado, dispositivo, recibido] = filas[0];
  assert.deepEqual([id, usuario, rol, campania, tipo, posicion, codigo, lote, cantidad, vacia, estado, dispositivo], [
    'id-B2-CONTEO-120', 'Operario 1', 'OPERARIO', CAMPANIA, 'CONTEO', 'B2', 'PROD001', 'L0005', 120, 'NO', 'VALIDO', 'Android Chrome',
  ]);
  assert.equal(fechaHora.toISOString(), '2026-10-14T13:15:00.000Z', 'hora del celular, en Argentina');
  assert.equal(recibido.constructor.name, 'Date');
});

test('una posición vacía se guarda con Vacia = SI y cantidad 0', () => {
  const s = servidorConfigurado();
  assert.equal(s.registrar(registro('B1', { vacia: true })).codigo, 'REGISTRADO');
  const [fila] = s.hoja('Conteo_1410').filasDeDatos();
  assert.deepEqual([fila[6], fila[7], fila[8], fila[9], fila[10]], ['B1', '', '', 0, 'SI']);
});

test('estado devuelve los registros de la campaña con sus tipos', () => {
  const s = servidorConfigurado();
  s.registrar(registro('B2'));
  const { registros, reconteos } = s.post({ accion: 'estado', token: s.token, campania: CAMPANIA }).datos;
  assert.deepEqual(reconteos, []);
  assert.equal(registros.length, 1);
  assert.equal(registros[0].fechaHora, '2026-10-14T10:15:00');
  assert.equal(registros[0].cantidad, 120);
  assert.equal(registros[0].vacia, false);
});

test('reconteo pedido en Conciliacion: entra como RECONTEO y deja el anterior REEMPLAZADO', () => {
  const s = servidorConfigurado();
  s.registrar(registro('G3', { codigo: 'PROD004', lote: 'L0074', cantidad: 18 }));
  const reconteo = registro('G3', { tipo: 'RECONTEO', codigo: 'PROD004', lote: 'L0074', cantidad: 180 });
  assert.equal(s.registrar(reconteo).codigo, 'RECONTEO_NO_PEDIDO');

  // Control pide el reconteo desde la hoja Conciliacion (columna Accion).
  const conciliacion = s.hoja('Conciliacion');
  conciliacion.getRange(2, 1, 1, 17).setValues([['PROD004|L0074|G3', 'PROD004', '', 'L0074', 'G3', 0, 200, -10, 0, 190, 18, -172, 0, 'FALTANTE', '', 'Reconteo', '']]);
  assert.deepEqual(s.post({ accion: 'estado', token: s.token }).datos.reconteos, ['G3']);

  assert.equal(s.registrar(reconteo).codigo, 'REGISTRADO');
  const filas = s.hoja('Conteo_1410').filasDeDatos();
  assert.deepEqual(filas.map((f) => [f[5], f[9], f[11]]), [
    ['CONTEO', 18, 'REEMPLAZADO'],
    ['RECONTEO', 180, 'VALIDO'],
  ]);
  assert.deepEqual(s.post({ accion: 'estado', token: s.token }).datos.reconteos, [], 'ya no figura como pendiente');
});

test('cada llamada queda en Log_API con acción, usuario y resultado', () => {
  const s = servidorConfigurado();
  s.registrar(registro('B2'));
  s.registrar(registro('Z9'));
  s.post({ accion: 'maestros', token: 'mal' });
  const log = s.hoja('Log_API').filasDeDatos();
  assert.deepEqual(log.map((f) => [f[1], f[2], f[3]]), [
    ['registrar', 'Operario 1', 'REGISTRADO'],
    ['registrar', 'Operario 1', 'POSICION_INEXISTENTE'],
    ['maestros', '', 'TOKEN_INVALIDO'],
  ]);
  assert.match(log[0][4], /^B2 PROD001 L0005 120 id=/);
});

test('conciliación en el servidor con el conteo del enunciado: 24 claves, 11 diferencias, neto −25', () => {
  const s = servidorConfigurado();
  const posiciones = CASO.posiciones.map((p) => p.posicion);
  const registros = registrosDesdeStockFisico(CASO.stock1410, posiciones, {
    campania: CAMPANIA, usuario: 'Operario 1', rol: 'OPERARIO', fechaHora: '2026-10-14T10:00:00',
  });
  for (const r of registros) assert.equal(s.registrar(r).codigo, 'REGISTRADO', r.posicion);

  const { filas, indicadores, cobertura } = s.post({ accion: 'conciliacion', token: s.token }).datos;
  assert.equal(cobertura.faltantes.length, 0);
  assert.equal(filas.length, 24);
  assert.equal(indicadores.clavesConDiferencia, 11);
  assert.equal(indicadores.diferenciaNeta, -25);
  assert.equal(filas.find((f) => f.posicion === 'F1').clasificacion, 'UBICACION');
});

test('la app habla con el servidor: probar conexión, maestros, cola y conciliación', async () => {
  const s = servidorConfigurado();

  const mal = await probarConexion(URL_WEB_APP, 'otro', s.fetch);
  assert.equal(mal.ok, false);
  assert.match(mal.mensaje, /token no coincide/);
  assert.equal((await probarConexion('https://ejemplo.com', s.token, s.fetch)).ok, false);
  const bien = await probarConexion(URL_WEB_APP, s.token, s.fetch);
  assert.equal(bien.ok, true, bien.mensaje);

  const almacen = almacenEnMemoria();
  almacen.guardar('sesion', { usuario: 'Operario 1' });
  const backend = crearBackendAppsScript({ url: URL_WEB_APP, token: s.token }, almacen, s.fetch);
  assert.equal((await backend.maestros()).posiciones.length, 28);

  const cola = crearCola({ almacen, nombre: backend.modo, enviar: (r) => backend.registrar(r) });
  cola.encolar(registro('B2'));
  cola.encolar({ ...registro('B2'), id: 'repetido' });
  const r = await cola.procesar();
  assert.equal(r.enviados.length, 1);
  assert.equal(r.rechazados[0].codigo, 'POSICION_DUPLICADA');
  assert.equal((await backend.estado(CAMPANIA)).registros.length, 1);

  const conciliacion = await backend.conciliar(CAMPANIA);
  assert.equal(conciliacion.ok, true);
  assert.equal(conciliacion.cobertura.relevadas.length, 1);
});

test('con el token mal cargado, la cola guarda los registros en vez de descartarlos', async () => {
  const s = servidorConfigurado();
  const almacen = almacenEnMemoria();
  const backend = crearBackendAppsScript({ url: URL_WEB_APP, token: 'equivocado' }, almacen, s.fetch);
  const cola = crearCola({ almacen, nombre: 'sheets', enviar: (r) => backend.registrar(r) });
  cola.encolar(registro('B2'));
  await cola.procesar();
  assert.equal(cola.pendientes().length, 1);
  assert.equal(cola.rechazados().length, 0);
});
