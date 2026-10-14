// Arranque y navegación de la app. Cada pantalla de docs/js/pantallas/ es un nodo del
// diagrama de flujo y exporta mostrar(contenedor, app), que puede devolver una función de
// limpieza (por ejemplo, para apagar la cámara al salir).
import { almacen } from './almacen.js';
import { crearBackend } from './backend/index.js';
import { crearCola } from './dominio/cola.js';
import { combinarPendientes } from './dominio/registros.js';
import { crearContexto } from './dominio/validaciones.js';
import { ROLES, puedeConciliar } from './roles.js';
import { avisar, fechaCorta, html, pintar } from './ui.js';

import * as inicio from './pantallas/inicio.js';
import * as ruta from './pantallas/ruta.js';
import * as escanearPosicion from './pantallas/escanear-posicion.js';
import * as escanearProducto from './pantallas/escanear-producto.js';
import * as cantidad from './pantallas/cantidad.js';
import * as resumen from './pantallas/resumen.js';
import * as conciliacion from './pantallas/conciliacion.js';
import * as ajustes from './pantallas/ajustes.js';

// `puede` decide si se puede entrar con el borrador actual; si no, se vuelve a la ruta.
const PANTALLAS = {
  inicio: { modulo: inicio },
  ruta: { modulo: ruta, pestania: 'ruta' },
  posicion: { modulo: escanearPosicion, pestania: 'ruta' },
  producto: { modulo: escanearProducto, pestania: 'ruta', puede: (b) => Boolean(b?.posicion) },
  cantidad: { modulo: cantidad, pestania: 'ruta', puede: (b) => Boolean(b?.posicion && b.codigo) },
  resumen: { modulo: resumen, pestania: 'ruta', puede: (b) => Boolean(b?.posicion && (b.vacia || b.cantidad !== undefined)) },
  conciliacion: { modulo: conciliacion, pestania: 'conciliacion', roles: puedeConciliar },
  ajustes: { modulo: ajustes, pestania: 'ajustes' },
};

const SINCRONIZAR_CADA_MS = 5000;

const app = {
  sesion: almacen.leer('sesion'),
  config: almacen.leer('config', { modo: 'demo' }),
  backend: null,
  cola: null,
  parametros: null,
  maestros: null,
  /** Último estado conocido del servidor (sirve sin conexión). */
  estadoServidor: null,
  /** Lo que ve el celular: servidor + registros en cola sin enviar. */
  estado: { registros: [], reconteos: [] },
  /** Registro que se está armando paso a paso: { tipo, posicion, codigo, lote, cantidad, vacia, advertencia } */
  borrador: null,
  pantalla: null,

  ir(pantalla) {
    const destino = `#/${pantalla}`;
    if (location.hash === destino) mostrarPantalla();
    else location.hash = destino;
  },

  /** Contexto para las validaciones con los maestros y lo ya registrado en la campaña. */
  contexto() {
    return crearContexto({
      posiciones: this.maestros.posiciones,
      materiales: this.maestros.materiales,
      lotes: this.maestros.lotes,
      registros: this.estado.registros,
      campania: this.sesion.campania,
      reconteos: this.estado.reconteos,
    });
  },

  /** Trae el estado de la campaña. Sin conexión usa el último conocido; siempre suma la cola. */
  async refrescar() {
    const campania = this.sesion.campania;
    const clave = `estadoCache-${this.backend.modo}`;
    try {
      this.estadoServidor = await this.backend.estado(campania);
      almacen.guardar(clave, { campania, ...this.estadoServidor });
    } catch {
      const cache = almacen.leer(clave);
      this.estadoServidor ??=
        cache?.campania === campania ? { registros: cache.registros, reconteos: cache.reconteos } : { registros: [], reconteos: [] };
    }
    this.estado = {
      registros: combinarPendientes(this.estadoServidor.registros, this.cola.pendientes(), campania),
      reconteos: this.estadoServidor.reconteos,
    };
  },

  /** Envía la cola. Con `forzar` no espera el próximo reintento (botón «Reintentar» o al volver la red). */
  async sincronizar(forzar = false) {
    if (!this.cola.pendientes().length) return;
    const r = await this.cola.procesar({ forzar });
    if (r.enviados.length) avisar(`Se enviaron ${r.enviados.length} registro(s) que estaban sin enviar.`);
    if (r.rechazados.length) avisar(`${r.rechazados.length} registro(s) rechazados: revisalos en la ruta.`, 'error');
    if ((r.enviados.length || r.rechazados.length) && this.pantalla === 'ruta') mostrarPantalla();
  },

  sinConexion() {
    return navigator.onLine === false || Boolean(this.backend?.sinConexionSimulada?.());
  },

  iniciarSesion(sesion) {
    this.sesion = sesion;
    almacen.guardar('sesion', sesion);
    almacen.guardar('ultimoUsuario', sesion.usuario);
  },

  cerrarSesion() {
    this.sesion = null;
    this.borrador = null;
    almacen.borrar('sesion');
  },

  material(codigo) {
    return this.maestros.materiales.find((m) => m.codigo === codigo);
  },

  /** Guarda la conexión elegida en Ajustes y reinicia la app con ese backend. */
  cambiarConexion(config) {
    almacen.guardar('config', config);
    location.reload();
  },

  avisar,
  pintarEncabezado,
};

function pintarEncabezado() {
  const encabezado = document.getElementById('encabezado');
  const p = app.parametros;
  const pendientes = app.cola?.pendientes().length ?? 0;
  pintar(
    encabezado,
    html`
      <div class="encabezado-campania">
        <span class="encabezado-titulo">${p ? p.campania : 'Conteo cíclico'}</span>
        ${p ? html`<span class="encabezado-fecha">Conteo al ${fechaCorta(p.fechaConteo)}</span>` : ''}
      </div>
      <div class="encabezado-estado">
        <span class="encabezado-chips">
          ${app.backend && app.sinConexion() ? html`<span class="chip-modo" data-modo="sin-conexion">Sin conexión</span>` : ''}
          ${pendientes ? html`<span class="chip-modo" data-modo="pendientes">${pendientes} sin enviar</span>` : ''}
          ${app.backend ? html`<span class="chip-modo" data-modo="${app.backend.modo}">${app.backend.nombre}</span>` : ''}
        </span>
        ${app.sesion ? html`<span class="encabezado-usuario">${app.sesion.usuario} (${ROLES[app.sesion.rol]?.corto ?? ''})</span>` : ''}
      </div>`,
  );
}

function pintarNavegacion(pestania) {
  const nav = document.getElementById('navegacion');
  nav.hidden = !app.sesion;
  if (!app.sesion) return;
  const pestanias = [
    ['ruta', 'Contar'],
    ...(puedeConciliar(app.sesion.rol) ? [['conciliacion', 'Conciliar']] : []),
    ['ajustes', 'Ajustes'],
  ];
  pintar(
    nav,
    html`${pestanias.map(
      ([id, nombre]) =>
        html`<a href="#/${id}" class="pestania" ${id === pestania ? html`aria-current="page"` : ''}>${nombre}</a>`,
    )}`,
  );
}

let limpiar = null;

async function mostrarPantalla() {
  let nombre = location.hash.replace(/^#\/?/, '') || 'ruta';
  if (!PANTALLAS[nombre]) nombre = 'ruta';
  if (!app.sesion) nombre = 'inicio';
  else if (nombre === 'inicio') nombre = 'ruta';
  const definicion = PANTALLAS[nombre];
  if ((definicion.puede && !definicion.puede(app.borrador)) || (definicion.roles && !definicion.roles(app.sesion.rol))) {
    nombre = 'ruta';
  }
  if (`#/${nombre}` !== location.hash) history.replaceState(null, '', `#/${nombre}`);

  if (limpiar) {
    const anterior = limpiar;
    limpiar = null;
    await anterior();
  }

  app.pantalla = nombre;
  pintarEncabezado();
  pintarNavegacion(PANTALLAS[nombre].pestania);
  const principal = document.getElementById('principal');
  window.scrollTo(0, 0);
  try {
    limpiar = (await PANTALLAS[nombre].modulo.mostrar(principal, app)) ?? null;
  } catch (error) {
    console.error(error);
    pintar(
      principal,
      html`<section class="pantalla">
        <h1 tabindex="-1">Algo salió mal</h1>
        <div class="mensaje error"><p>${error.message}</p></div>
        <a class="boton secundario" href="#/ruta">Volver a la ruta</a>
      </section>`,
    );
  }
  principal.querySelector('h1')?.focus({ preventScroll: true });
}

/** Maestros y parámetros: del servidor si hay conexión; si no, los últimos que se guardaron. */
async function cargarMaestros() {
  try {
    app.parametros = await app.backend.parametros();
    app.maestros = await app.backend.maestros();
    almacen.guardar('maestrosCache', { modo: app.backend.modo, parametros: app.parametros, maestros: app.maestros });
  } catch (error) {
    const cache = almacen.leer('maestrosCache');
    if (cache?.modo !== app.backend.modo) throw error;
    app.parametros = cache.parametros;
    app.maestros = cache.maestros;
  }
}

async function arrancar() {
  app.backend = crearBackend(app.config, almacen);
  app.cola = crearCola({
    almacen,
    nombre: app.backend.modo,
    enviar: (registro) => app.backend.registrar(registro),
    alCambiar: pintarEncabezado,
  });
  const principal = document.getElementById('principal');
  try {
    await cargarMaestros();
    if (app.sesion && app.sesion.campania !== app.parametros.campania) app.cerrarSesion();
    if (app.sesion) await app.refrescar();
  } catch (error) {
    console.error(error);
    pintarEncabezado();
    pintar(
      principal,
      html`<section class="pantalla">
        <h1 tabindex="-1">No se pudieron cargar los datos</h1>
        <div class="mensaje error"><p>${error.message}</p></div>
        <button class="boton primario" type="button" onclick="location.reload()">Reintentar</button>
      </section>`,
    );
    return;
  }

  window.addEventListener('hashchange', mostrarPantalla);
  window.addEventListener('online', () => {
    pintarEncabezado();
    app.sincronizar(true);
  });
  window.addEventListener('offline', pintarEncabezado);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') app.sincronizar();
  });
  setInterval(() => app.sincronizar(), SINCRONIZAR_CADA_MS);

  mostrarPantalla();
  app.sincronizar(true);
}

// Guarda la app en el celular para poder abrirla y recargarla sin conexión (docs/sw.js).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Service worker no registrado:', error));
}

arrancar();
