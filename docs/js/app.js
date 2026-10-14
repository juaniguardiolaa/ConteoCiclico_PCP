// Arranque y navegación de la app. Cada pantalla de docs/js/pantallas/ es un nodo del
// diagrama de flujo y exporta mostrar(contenedor, app), que puede devolver una función de
// limpieza (por ejemplo, para apagar la cámara al salir).
import { almacen } from './almacen.js';
import { crearBackend } from './backend/index.js';
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

const app = {
  sesion: almacen.leer('sesion'),
  config: almacen.leer('config', { modo: 'demo' }),
  backend: null,
  parametros: null,
  maestros: null,
  estado: { registros: [], reconteos: [] },
  /** Registro que se está armando paso a paso: { tipo, posicion, codigo, lote, cantidad, vacia, advertencia } */
  borrador: null,

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

  async refrescar() {
    this.estado = await this.backend.estado(this.sesion.campania);
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

  avisar,
};

function pintarEncabezado() {
  const encabezado = document.getElementById('encabezado');
  const p = app.parametros;
  pintar(
    encabezado,
    html`
      <div class="encabezado-campania">
        <span class="encabezado-titulo">${p ? p.campania : 'Conteo cíclico'}</span>
        ${p ? html`<span class="encabezado-fecha">Conteo al ${fechaCorta(p.fechaConteo)}</span>` : ''}
      </div>
      <div class="encabezado-estado">
        ${app.backend ? html`<span class="chip-modo" data-modo="${app.backend.modo}">${app.backend.nombre}</span>` : ''}
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

async function arrancar() {
  app.backend = crearBackend(app.config, almacen);
  const principal = document.getElementById('principal');
  try {
    app.parametros = await app.backend.parametros();
    app.maestros = await app.backend.maestros();
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
  mostrarPantalla();
}

arrancar();
