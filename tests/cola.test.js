// Cola sin conexión: no se pierde ningún registro y ningún reintento duplica.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { almacenEnMemoria } from '../docs/js/almacen.js';
import { crearBackendDemo } from '../docs/js/backend/demo.js';
import { crearCola } from '../docs/js/dominio/cola.js';
import { combinarPendientes, crearRegistro } from '../docs/js/dominio/registros.js';
import { crearContexto, validarPosicion } from '../docs/js/dominio/validaciones.js';
import { CASO } from '../docs/js/datos/caso.js';

const CAMPANIA = 'CC-2026-10-14';
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

/** Servidor (backend demo) detrás de una "red" que se puede cortar. */
function escenario() {
  const servidor = crearBackendDemo(almacenEnMemoria());
  const red = { hay: true, llamadas: 0, perderRespuesta: false };
  let reloj = 0;
  const enviar = async (r) => {
    red.llamadas += 1;
    if (!red.hay) throw new Error('Sin conexión');
    const respuesta = await servidor.registrar(r);
    if (red.perderRespuesta) {
      red.perderRespuesta = false;
      throw new Error('Se cortó antes de recibir la respuesta');
    }
    return respuesta;
  };
  const cola = crearCola({ almacen: almacenEnMemoria(), enviar, ahora: () => reloj });
  return { servidor, red, cola, avanzar: (ms) => (reloj += ms) };
}

test('con conexión, el registro se envía enseguida y la cola queda vacía', async () => {
  const { servidor, cola } = escenario();
  cola.encolar(registro('B2'));
  const r = await cola.procesar();
  assert.equal(r.enviados.length, 1);
  assert.equal(r.pendientes, 0);
  assert.equal(cola.estadoDe('id-B2-CONTEO'), 'enviado');
  assert.equal((await servidor.estado(CAMPANIA)).registros.length, 1);
});

test('modo avión: 3 posiciones quedan pendientes y al volver la red se envían sin duplicar', async () => {
  const { servidor, red, cola } = escenario();
  red.hay = false;
  for (const p of ['A1', 'A2', 'A3']) {
    cola.encolar(registro(p));
    await cola.procesar();
  }
  assert.equal(cola.pendientes().length, 3);
  assert.equal((await servidor.estado(CAMPANIA)).registros.length, 0);

  red.hay = true;
  const r = await cola.procesar({ forzar: true });
  assert.equal(r.enviados.length, 3);
  assert.equal(cola.pendientes().length, 0);
  const enServidor = (await servidor.estado(CAMPANIA)).registros.map((x) => x.posicion);
  assert.deepEqual(enServidor, ['A1', 'A2', 'A3']);
});

test('espera creciente entre reintentos: 2 s, 4 s, 8 s… con tope de 1 minuto', async () => {
  const { red, cola } = escenario();
  red.hay = false;
  cola.encolar(registro('B2'));
  const esperas = [];
  for (let i = 0; i < 7; i++) {
    await cola.procesar({ forzar: true });
    esperas.push(cola.proximoIntento()); // el reloj está quieto en 0: el próximo intento es la espera
  }
  assert.deepEqual(esperas, [2000, 4000, 8000, 16000, 32000, 60000, 60000]);
});

test('antes de que venza la espera no se reintenta; después sí', async () => {
  const { red, cola, avanzar } = escenario();
  red.hay = false;
  cola.encolar(registro('B2'));
  await cola.procesar();
  assert.equal(red.llamadas, 1);

  red.hay = true;
  avanzar(1999);
  await cola.procesar();
  assert.equal(red.llamadas, 1, 'todavía no tocaba');
  avanzar(1);
  const r = await cola.procesar();
  assert.equal(red.llamadas, 2);
  assert.equal(r.enviados.length, 1);
});

test('si la respuesta se pierde, el reintento con el mismo ID no duplica (validación 7)', async () => {
  const { servidor, red, cola } = escenario();
  red.perderRespuesta = true;
  cola.encolar(registro('B2'));
  await cola.procesar();
  assert.equal(cola.pendientes().length, 1, 'el celular no sabe que llegó');
  assert.equal((await servidor.estado(CAMPANIA)).registros.length, 1, 'pero el servidor ya lo tiene');

  const r = await cola.procesar({ forzar: true });
  assert.equal(r.enviados[0].respuesta.codigo, 'YA_REGISTRADO');
  assert.equal((await servidor.estado(CAMPANIA)).registros.length, 1);
});

test('un rechazo por regla de negocio no se reintenta y queda para avisar', async () => {
  const { servidor, cola } = escenario();
  await servidor.registrar({ ...registro('B2'), id: 'de-otro-operario' });
  cola.encolar(registro('B2'));
  const r = await cola.procesar();
  assert.equal(r.rechazados[0].codigo, 'POSICION_DUPLICADA');
  assert.equal(cola.pendientes().length, 0);
  assert.equal(cola.estadoDe('id-B2-CONTEO'), 'rechazado');

  cola.descartarRechazo('id-B2-CONTEO');
  assert.equal(cola.rechazados().length, 0);
});

test('se envía en orden de llegada y, sin red, no se intentan los que siguen', async () => {
  const { red, cola } = escenario();
  red.hay = false;
  cola.encolar(registro('A1'));
  cola.encolar(registro('A2'));
  cola.encolar(registro('A3'));
  await cola.procesar();
  assert.equal(red.llamadas, 1);
  assert.deepEqual(
    cola.pendientes().map((e) => [e.registro.posicion, e.intentos]),
    [
      ['A1', 1],
      ['A2', 0],
      ['A3', 0],
    ],
  );
});

test('lo que se confirma mientras hay un envío en curso no se pierde ni se manda dos veces', async () => {
  const { servidor, cola } = escenario();
  cola.encolar(registro('A1'));
  const primero = cola.procesar();
  cola.encolar(registro('A2'));
  const segundo = cola.procesar({ forzar: true });
  await Promise.all([primero, segundo]);
  assert.equal(cola.pendientes().length, 0);
  assert.deepEqual(
    (await servidor.estado(CAMPANIA)).registros.map((r) => r.posicion),
    ['A1', 'A2'],
  );
});

test('la cola sobrevive a cerrar la app (queda guardada en el celular)', async () => {
  const almacen = almacenEnMemoria();
  const sinRed = async () => {
    throw new Error('Sin conexión');
  };
  const antes = crearCola({ almacen, enviar: sinRed });
  antes.encolar(registro('B2'));
  await antes.procesar();

  const despues = crearCola({ almacen, enviar: sinRed });
  assert.equal(despues.pendientes().length, 1);
  assert.equal(despues.pendientes()[0].registro.posicion, 'B2');
});

test('lo pendiente cuenta en el celular: la posición se ve contada y un segundo escaneo es duplicado', () => {
  const pendientes = [{ registro: registro('B2'), intentos: 1 }];
  const registros = combinarPendientes([], pendientes, CAMPANIA);
  assert.equal(registros.length, 1);
  assert.equal(registros[0].pendiente, true);
  const ctx = crearContexto({ ...CASO, registros, campania: CAMPANIA });
  assert.equal(validarPosicion('B2', ctx).codigo, 'POSICION_DUPLICADA');
  // Si ya llegó al servidor, no se cuenta dos veces.
  assert.equal(combinarPendientes(registros, pendientes, CAMPANIA).length, 1);
});

test('un reconteo que Control no pidió se rechaza al sincronizar, aunque se haya cargado sin red', async () => {
  const { servidor, red, cola } = escenario();
  await servidor.registrar(registro('G3', { cantidad: 18, codigo: 'PROD004', lote: 'L0074' }));
  red.hay = false;
  cola.encolar(registro('G3', { tipo: 'RECONTEO', cantidad: 180, codigo: 'PROD004', lote: 'L0074' }));
  await cola.procesar();
  red.hay = true;
  const r = await cola.procesar({ forzar: true });
  assert.equal(r.rechazados[0].codigo, 'RECONTEO_NO_PEDIDO');
  assert.equal((await servidor.estado(CAMPANIA)).registros[0].cantidad, 18, 'el conteo original sigue VALIDO');
});
