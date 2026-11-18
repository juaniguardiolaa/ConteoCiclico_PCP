// B1, contar una posición: un celular con los cuatro pasos de la app y el rack del 14/10 con sus
// etiquetas. Tocar una etiqueta es escanearla. Cada lectura pasa por leerEtiqueta() y las
// validaciones reales, y el registro confirmado entra al estado compartido (la «planilla»).
import { ETIQUETAS_DE_PRUEBA, leerEtiqueta, leerPosicionManual, leerProductoManual, textoPosicion, textoProducto } from '../../js/dominio/etiquetas.js';
import { crearRegistro } from '../../js/dominio/registros.js';
import { validarCantidad, validarLecturaPosicion, validarLecturaProducto } from '../../js/dominio/validaciones.js';
import { fechaHoraLocal, horaCorta, html, nuevoId, pintar } from '../../js/ui.js';
import { registrarDiapo } from './deck.js';
import { CAMPANIA, FISICO, POSICIONES, estado, material } from './estado.js';
import { rackHTML } from './rack.js';
import { pitido } from './sonido.js';

const PASOS = [
  ['posicion', 'Posición'],
  ['producto', 'Producto'],
  ['cantidad', 'Cantidad'],
  ['resumen', 'Confirmar'],
];

let paso = 'posicion';
/** Registro que se arma paso a paso: { posicion, codigo, lote, cantidad, vacia, advertencia } */
let borrador = null;
/** Aviso debajo del visor: { clase: 'mal' | 'aviso', codigo, mensaje } */
let mensaje = null;
/** Lectura con lote desconocido que espera que el operario confirme. */
let pendiente = null;
let celular;
let deposito;

const registradas = () =>
  new Map(estado.registros.filter((r) => r.estado === 'VALIDO' && r.campania === CAMPANIA).map((r) => [r.posicion, r]));

// ------------------------------------------------------------------------------- lecturas
function escanear(texto, { manual = false } = {}) {
  if (paso === 'cantidad' || paso === 'resumen') {
    mensaje = { clase: 'aviso', codigo: 'TERMINAR_POSICION', mensaje: `Primero terminá la posición ${borrador.posicion} o tocá Editar.` };
    pitido('aviso');
    pintarCelular();
    return;
  }
  if (!manual) destello();
  const ctx = estado.contexto();
  pendiente = null;

  if (paso === 'posicion') {
    const lectura = manual ? leerPosicionManual(texto) : leerEtiqueta(texto);
    const v = validarLecturaPosicion(lectura, ctx);
    if (!v.ok) return rechazar(v);
    borrador = { posicion: lectura.posicion };
    avanzar('producto');
    return;
  }

  const lectura = manual ? leerProductoManual(texto) : leerEtiqueta(texto);
  const v = validarLecturaProducto(lectura, ctx);
  if (!v.ok) return rechazar(v);
  if (v.advertencia) {
    pendiente = lectura;
    mensaje = { clase: 'aviso', ...v.advertencia };
    pitido('aviso');
    pintarCelular();
    return;
  }
  usarProducto(lectura);
}

function usarProducto(lectura) {
  Object.assign(borrador, { codigo: lectura.codigo, lote: lectura.lote, cantidad: '', vacia: false, advertencia: Boolean(pendiente) });
  pendiente = null;
  avanzar('cantidad');
}

function rechazar({ codigo, mensaje: texto }) {
  mensaje = { clase: 'mal', codigo, mensaje: texto };
  pitido('error');
  pintarCelular();
}

function avanzar(destino) {
  paso = destino;
  mensaje = null;
  if (destino !== 'cantidad') pitido('ok');
  pintarCelular();
  pintarRack();
}

function confirmar() {
  const registro = crearRegistro({
    id: nuevoId(),
    fechaHora: fechaHoraLocal(),
    usuario: estado.usuario,
    rol: 'OPERARIO',
    campania: CAMPANIA,
    tipo: 'CONTEO',
    posicion: borrador.posicion,
    codigo: borrador.codigo,
    lote: borrador.lote,
    cantidad: borrador.vacia ? 0 : borrador.cantidad,
    vacia: borrador.vacia,
    dispositivo: 'Presentación',
  });
  const respuesta = estado.registrar(registro);
  if (!respuesta.ok) return rechazar(respuesta);
  pitido('ok');
  const posicion = borrador.posicion;
  borrador = null;
  paso = 'posicion';
  mensaje = null;
  pintarCelular();
  pintarRack();
  avisar(`Posición ${posicion} registrada y enviada a la planilla.`);
  deposito.querySelector(`[data-posicion="${posicion}"]`)?.classList.add('recien');
}

function avisar(texto) {
  const aviso = celular.querySelector('.cel-aviso');
  aviso.textContent = texto;
  aviso.classList.remove('visible');
  void aviso.offsetWidth;
  aviso.classList.add('visible');
}

function destello() {
  const visor = celular.querySelector('.visor');
  visor?.classList.remove('lee');
  void visor?.offsetWidth;
  visor?.classList.add('lee');
}

// ------------------------------------------------------------------------------- cantidad
function teclear(caracter) {
  if (paso !== 'cantidad') return;
  const actual = String(borrador.cantidad);
  if (caracter === 'borrar') borrador.cantidad = actual.slice(0, -1);
  else if (actual.length < 6) borrador.cantidad = actual + caracter;
  pintarCelular();
}

function cantidadValida() {
  return validarCantidad(borrador?.cantidad);
}

// ------------------------------------------------------------------------------- pantallas
function pasosHTML() {
  const indice = PASOS.findIndex(([clave]) => clave === paso);
  return html`<ol class="cel-pasos">
    ${PASOS.map(([clave, nombre], i) => html`<li class="${i < indice ? 'hecho' : i === indice ? 'actual' : ''}"><b>${i + 1}</b> ${nombre}</li>`)}
  </ol>`;
}

function mensajeHTML() {
  if (!mensaje) return '';
  return html`<div class="cel-mensaje ${mensaje.clase}" role="alert">
    <p>${mensaje.mensaje}</p><span class="cel-codigo">${mensaje.codigo}</span>
    ${pendiente ? html`<button type="button" class="cel-boton secundario" data-accion="seguir">Está en la posición: registrarlo igual</button>` : ''}
  </div>`;
}

// Con un aviso en pantalla el visor se achica, así entran el aviso y los botones de abajo.
const visorHTML = (ayuda) =>
  html`<div class="visor ${mensaje ? 'compacto' : ''}"><span class="visor-esquinas"></span><span class="visor-laser"></span><p>${ayuda}</p></div>`;

function rotuloHTML() {
  return html`<div class="cel-rotulo"><span class="cel-rotulo-pos">${borrador.posicion}</span>
    ${borrador.codigo ? html`<span class="cel-rotulo-mat"><b>${borrador.codigo}</b> ${material(borrador.codigo)?.descripcion ?? ''}<br>Lote ${borrador.lote}</span>` : ''}
  </div>`;
}

function pantallaHTML() {
  if (paso === 'posicion') {
    const ultimos = estado.registros.filter((r) => r.campania === CAMPANIA).slice(-3).reverse();
    return html`
      <h3>Escaneá la posición</h3>
      ${visorHTML('Tocá una etiqueta de posición en el rack')}
      ${mensajeHTML()}
      <form class="cel-manual" data-accion="manual"><label>O escribí la posición<input name="texto" placeholder="Por ejemplo B2" autocomplete="off"></label><button class="cel-boton chico">Usar</button></form>
      <h4>Últimos registros</h4>
      <ul class="cel-ultimos">
        ${ultimos.length
          ? ultimos.map((r) => html`<li><b>${r.posicion}</b><span>${r.vacia ? 'vacía' : `${r.codigo} ${r.lote}`}</span><span>${r.vacia ? '0' : r.cantidad}</span><span class="tenue">${horaCorta(r.fechaHora)}</span></li>`)
          : html`<li class="tenue">Todavía no hay registros.</li>`}
      </ul>`;
  }
  if (paso === 'producto') {
    return html`
      ${rotuloHTML()}
      <h3>Escaneá el producto</h3>
      ${visorHTML('Tocá la caja de esta posición en el rack')}
      ${mensajeHTML()}
      <form class="cel-manual" data-accion="manual"><label>O escribí material y lote<input name="texto" placeholder="Por ejemplo PROD001 L0005" autocomplete="off"></label><button class="cel-boton chico">Usar</button></form>
      <button type="button" class="cel-boton secundario" data-accion="vacia">La posición está vacía</button>
      <button type="button" class="cel-enlace" data-accion="cancelar">Cancelar</button>`;
  }
  if (paso === 'cantidad') {
    const v = cantidadValida();
    const mostrarError = !v.ok && String(borrador.cantidad) !== '';
    return html`
      ${rotuloHTML()}
      <h3>Contá las unidades</h3>
      <p class="cel-ciego">La app nunca muestra el stock teórico: el conteo es ciego.</p>
      <output class="cel-display ${mostrarError ? 'invalida' : ''}">${borrador.cantidad || ' '}<small>UN</small></output>
      ${mostrarError ? html`<p class="cel-error">${v.mensaje}</p>` : ''}
      <div class="teclado">
        ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => html`<button type="button" data-tecla="${n}">${n}</button>`)}
        <button type="button" data-tecla="borrar" aria-label="Borrar">⌫</button>
        <button type="button" data-tecla="0">0</button>
        <button type="button" class="tecla-ok" data-accion="continuar" ${v.ok ? '' : 'disabled'}>OK</button>
      </div>
      <button type="button" class="cel-enlace" data-accion="editar">Volver al producto</button>`;
  }
  const filas = borrador.vacia
    ? [['Posición', borrador.posicion], ['Estado', 'Vacía'], ['Cantidad', '0 UN']]
    : [['Posición', borrador.posicion], ['Material', `${borrador.codigo} · ${material(borrador.codigo)?.descripcion ?? ''}`], ['Lote', borrador.lote], ['Cantidad', `${borrador.cantidad} UN`]];
  return html`
    ${rotuloHTML()}
    <h3>Revisá y confirmá</h3>
    <dl class="cel-resumen">${filas.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
    ${borrador.advertencia ? html`<p class="cel-nota-aviso">Lote no registrado: la conciliación lo va a marcar como NO_REGISTRADO.</p>` : ''}
    ${mensajeHTML()}
    <button type="button" class="cel-boton" data-accion="confirmar">Confirmar y enviar</button>
    <button type="button" class="cel-boton secundario" data-accion="editar">Editar</button>`;
}

function pintarCelular() {
  const relevadas = registradas().size;
  pintar(
    celular.querySelector('.cel-pantalla'),
    html`
      <div class="cel-cabeza">
        <div><b>${CAMPANIA}</b><span>${estado.usuario} · Operario</span></div>
        <span class="cel-pastilla">${estado.cerrada ? 'Campaña cerrada' : 'Simulación'}</span>
      </div>
      <div class="cel-avance"><b>${relevadas}</b> de ${POSICIONES.length} posiciones relevadas<span style="--avance: ${relevadas / POSICIONES.length}"></span></div>
      ${pasosHTML()}
      <div class="cel-cuerpo">${pantallaHTML()}</div>`,
  );
}

function pintarRack() {
  const hechas = registradas();
  pintar(
    deposito.querySelector('[data-zona="rack-contar"]'),
    rackHTML((posicion) => {
      const fisico = FISICO.get(posicion);
      const registro = hechas.get(posicion);
      const enCurso = borrador?.posicion === posicion;
      const clases = [fisico ? 'ocupada' : 'vacia', registro ? 'contada' : '', enCurso ? 'en-curso' : ''].join(' ');
      return {
        clase: clases,
        contenido: html`
          <button type="button" class="rotulo-pos" data-leer="${textoPosicion(posicion)}" title="Escanear ${textoPosicion(posicion)}">${posicion}</button>
          ${fisico
            ? html`<button type="button" class="caja-prod" data-leer="${textoProducto(fisico.codigo, fisico.lote)}" title="Escanear ${textoProducto(fisico.codigo, fisico.lote)}">
                <span class="cp-codigo">${fisico.codigo}</span><span class="cp-lote">${fisico.lote}</span><span class="cp-cantidad">${fisico.stock} u.</span>
              </button>`
            : html`<span class="hueco-vacio">vacía</span>`}
          ${registro ? html`<span class="sello">✓ ${registro.vacia ? 'vacía' : registro.cantidad}</span>` : ''}`,
      };
    }, 'rack-contar'),
  );
  const relevadas = hechas.size;
  deposito.querySelector('[data-zona="avance"]').textContent = `${relevadas} de ${POSICIONES.length} posiciones relevadas`;
  deposito.classList.toggle('espera-posicion', paso === 'posicion');
  deposito.classList.toggle('espera-producto', paso === 'producto');
}

// ------------------------------------------------------------------------------- arranque
export function iniciarSimulador() {
  celular = document.querySelector('[data-zona="celular"]');
  deposito = document.querySelector('[data-zona="deposito"]');
  celular.innerHTML = '<div class="cel-pantalla"></div><p class="cel-aviso" role="status"></p>';

  pintar(
    document.querySelector('[data-zona="pruebas-contar"]'),
    html`${ETIQUETAS_DE_PRUEBA.map((e) => html`<button type="button" class="chip" data-leer="${e.texto}" title="${e.titulo}">${e.texto}</button>`)}`,
  );

  document.getElementById('contar').addEventListener('click', (e) => {
    const lectura = e.target.closest('[data-leer]');
    if (lectura) {
      escanear(lectura.dataset.leer);
      lectura.blur();
    }
  });

  celular.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = new FormData(e.target).get('texto');
    if (String(texto).trim()) escanear(texto, { manual: true });
  });

  celular.addEventListener('click', (e) => {
    const tecla = e.target.closest('[data-tecla]');
    if (tecla) return teclear(tecla.dataset.tecla);
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'vacia') {
      Object.assign(borrador, { vacia: true, codigo: '', lote: '', cantidad: 0 });
      avanzar('resumen');
    } else if (accion === 'seguir' && pendiente) usarProducto(pendiente);
    else if (accion === 'continuar' && cantidadValida().ok) avanzar('resumen');
    else if (accion === 'editar') {
      Object.assign(borrador, { codigo: '', lote: '', cantidad: '', vacia: false, advertencia: false });
      avanzar('producto');
    } else if (accion === 'cancelar') {
      borrador = null;
      avanzar('posicion');
    } else if (accion === 'confirmar') confirmar();
  });

  estado.alCambiar(() => {
    // Si la demo se reinicia o se completó desde otra diapositiva, el celular vuelve a empezar.
    if (borrador && registradas().has(borrador.posicion) && paso !== 'resumen') {
      borrador = null;
      paso = 'posicion';
    }
    pintarCelular();
    pintarRack();
  });

  pintarCelular();
  pintarRack();
}

registrarDiapo('contar', {
  alEntrar() {
    pintarCelular();
    pintarRack();
  },
  // En el paso de la cantidad se puede tipear con el teclado de la computadora.
  tecla(evento) {
    let accion = null;
    if (paso === 'cantidad') {
      if (/^[0-9.,-]$/.test(evento.key)) accion = () => teclear(evento.key);
      else if (evento.key === 'Backspace') accion = () => teclear('borrar');
      else if (evento.key === 'Enter' && cantidadValida().ok) accion = () => avanzar('resumen');
    } else if (paso === 'resumen' && evento.key === 'Enter') accion = confirmar;
    accion?.();
    return Boolean(accion);
  },
});
