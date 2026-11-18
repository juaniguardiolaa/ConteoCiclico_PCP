// Sección A, preparar: roles de la app (A1) y cómo lee las etiquetas (A2), con leerEtiqueta() y las
// validaciones reales contra los maestros del caso.
import { qrSVG } from '../../js/componentes/qr.js';
import { CASO } from '../../js/datos/caso.js';
import { leerEtiqueta, textoPosicion, textoProducto } from '../../js/dominio/etiquetas.js';
import { crearContexto, validarPosicion, validarProducto } from '../../js/dominio/validaciones.js';
import { ROLES } from '../../js/roles.js';
import { crudo, html, pintar } from '../../js/ui.js';
import { CAMPANIA, estado, material } from './estado.js';
import { pitido } from './sonido.js';

// ------------------------------------------------------------------------------- A1 roles
const PESTANIAS = ['Ruta', 'Conciliación', 'Ajustes'];
const QUE_VE = {
  OPERARIO: { pestanias: ['Ruta', 'Ajustes'], ademas: 'Nunca ve el stock teórico: el conteo es ciego.' },
  CONTROL: { pestanias: PESTANIAS, ademas: 'Desde Conciliación pide reconteos. En la planilla completa Causa y Acción.' },
  SUPERVISOR: { pestanias: PESTANIAS, ademas: 'En la planilla firma Aprobado_por y cierra la campaña.' },
};

function iniciarRoles() {
  const botones = document.querySelector('[data-zona="roles"]');
  const detalle = document.querySelector('[data-zona="rol-detalle"]');
  pintar(
    botones,
    html`${Object.entries(ROLES).map(
      ([clave, rol]) => html`<button type="button" class="rol" data-rol="${clave}" aria-pressed="false">${rol.nombre}</button>`,
    )}`,
  );
  const elegir = (clave) => {
    botones.querySelectorAll('.rol').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rol === clave)));
    const { pestanias, ademas } = QUE_VE[clave];
    pintar(
      detalle,
      html`<p class="rol-tarea">${ROLES[clave].tarea}</p>
        <ul class="pestanias">
          ${PESTANIAS.map((p) => html`<li class="${pestanias.includes(p) ? 've' : 'no-ve'}">${p}</li>`)}
        </ul>
        <p class="rol-ademas">${ademas}</p>`,
    );
  };
  botones.addEventListener('click', (e) => {
    const boton = e.target.closest('.rol');
    if (boton) elegir(boton.dataset.rol);
  });
  elegir('OPERARIO');

  const nombre = document.querySelector('[data-zona="nombre"]');
  nombre.value = estado.usuario;
  nombre.addEventListener('change', () => estado.ponerUsuario(nombre.value));
}

// ------------------------------------------------------------------------------- A2 etiquetas
const PRUEBAS_LECTOR = [
  'POS:B2',
  'pos: b2',
  'POS:Z9',
  'MAT:PROD001|L0005',
  'MAT:PROD001|L005',
  'MAT:PROD011|L0001',
  'MAT:PROD009|L0099',
  'hola',
];

/** Code 128 como SVG estirable, igual que en la hoja de etiquetas. */
function barrasSVG(texto) {
  if (!window.JsBarcode) return crudo('<div class="barras sin-barras"></div>');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  window.JsBarcode(svg, texto, { format: 'CODE128', width: 1, height: 30, margin: 0, displayValue: false, background: '#ffffff', lineColor: '#000000' });
  svg.setAttribute('viewBox', `0 0 ${parseFloat(svg.getAttribute('width'))} ${parseFloat(svg.getAttribute('height'))}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  ['width', 'height', 'style'].forEach((a) => svg.removeAttribute(a));
  svg.setAttribute('class', 'barras');
  svg.setAttribute('aria-hidden', 'true');
  return crudo(svg.outerHTML);
}

const qr = (texto, hayQR) => (hayQR ? qrSVG(texto, 'qr') : crudo('<div class="qr sin-qr"></div>'));

function contextoMaestros() {
  return crearContexto({
    posiciones: CASO.posiciones,
    materiales: CASO.materiales,
    stock3009: CASO.stock3009,
    movimientos: CASO.movimientos,
    registros: [],
    campania: CAMPANIA,
  });
}

/** Qué entiende la app de un texto leído: tipo, datos y veredicto contra los maestros. */
function interpretar(texto) {
  const lectura = leerEtiqueta(texto);
  const ctx = contextoMaestros();
  if (lectura.tipo === 'POSICION') {
    const p = CASO.posiciones.find((x) => x.posicion === lectura.posicion);
    const v = validarPosicion(lectura.posicion, ctx);
    return {
      tipo: 'Posición',
      campos: [['Prefijo', 'POS:'], ['Posición', lectura.posicion]],
      veredicto: v.ok
        ? { clase: 'bien', codigo: 'OK', mensaje: `Existe en el maestro: bloque ${p.bloque}, columna ${p.columna}, nivel ${p.nivel}.` }
        : { clase: 'mal', codigo: v.codigo, mensaje: v.mensaje },
    };
  }
  if (lectura.tipo === 'PRODUCTO') {
    const v = validarProducto(lectura.codigo, lectura.lote, ctx);
    const descripcion = material(lectura.codigo)?.descripcion;
    return {
      tipo: 'Producto y lote',
      campos: [['Prefijo', 'MAT:'], ['Material', lectura.codigo || '(vacío)'], ['Lote', lectura.lote || '(vacío)']],
      veredicto: !v.ok
        ? { clase: 'mal', codigo: v.codigo, mensaje: v.mensaje }
        : v.advertencia
          ? { clase: 'aviso', codigo: v.advertencia.codigo, mensaje: v.advertencia.mensaje }
          : { clase: 'bien', codigo: 'OK', mensaje: `${descripcion}. El par material-lote figura en el stock o en los movimientos.` },
    };
  }
  if (lectura.tipo === 'CONFIG') {
    return {
      tipo: 'Configuración',
      campos: [['Prefijo', 'CFG:'], ['Web App', lectura.url], ['Token', '••••••']],
      veredicto: { clase: 'bien', codigo: 'OK', mensaje: 'Conecta la app con la planilla. Se escanea desde Ajustes.' },
    };
  }
  return {
    tipo: 'Desconocida',
    campos: [['Prefijo', 'ninguno']],
    veredicto: { clase: 'mal', codigo: 'ETIQUETA_INVALIDA', mensaje: `No se reconoce la etiqueta «${lectura.texto}».` },
  };
}

function iniciarLector(hayQR) {
  const entrada = document.querySelector('[data-zona="lector-texto"]');
  const resultado = document.querySelector('[data-zona="lector-resultado"]');
  const mostrar = (sonar) => {
    const { tipo, campos, veredicto } = interpretar(entrada.value);
    if (sonar) pitido(veredicto.clase === 'mal' ? 'error' : veredicto.clase === 'aviso' ? 'aviso' : 'ok');
    pintar(
      resultado,
      html`<p class="lectura-tipo">Tipo: <b>${tipo}</b></p>
        <dl class="lectura-campos">${campos.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
        <p class="veredicto ${veredicto.clase}"><span class="veredicto-codigo">${veredicto.codigo}</span>${veredicto.mensaje}</p>`,
    );
  };
  entrada.addEventListener('input', () => mostrar(false));

  const leer = (texto) => {
    entrada.value = texto;
    const lector = document.querySelector('.lector-prueba');
    lector.classList.remove('leyendo');
    void lector.offsetWidth;
    lector.classList.add('leyendo');
    mostrar(true);
  };
  const chips = document.querySelector('[data-zona="lector-chips"]');
  pintar(chips, html`${PRUEBAS_LECTOR.map((t) => html`<button type="button" class="chip" data-texto="${t}">${t}</button>`)}`);
  chips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-texto]');
    if (chip) leer(chip.dataset.texto);
  });

  // Dos etiquetas reales del caso: tocarlas es como escanearlas.
  const posicion = CASO.posiciones.find((p) => p.posicion === 'B2');
  const textoPos = textoPosicion('B2');
  const textoProd = textoProducto('PROD001', 'L0005');
  const muestras = document.querySelector('[data-zona="muestras"]');
  pintar(
    muestras,
    html`
      <button type="button" class="etiqueta etiqueta-posicion" data-texto="${textoPos}" title="Tocá para escanear">
        <span class="etiqueta-arriba">
          <span><span class="etiqueta-rotulo">B2</span><span class="etiqueta-dato">Bloque ${posicion.bloque}, nivel ${posicion.nivel}</span></span>
          ${qr(textoPos, hayQR)}
        </span>
        ${barrasSVG(textoPos)}
        <span class="etiqueta-texto">${textoPos}</span>
      </button>
      <button type="button" class="etiqueta etiqueta-producto" data-texto="${textoProd}" title="Tocá para escanear">
        <span class="etiqueta-arriba">
          ${qr(textoProd, hayQR)}
          <span class="etiqueta-material">
            <span class="etiqueta-codigo">PROD001</span>
            <span class="etiqueta-descripcion">${material('PROD001').descripcion}</span>
            <span class="etiqueta-lote">Lote L0005</span>
          </span>
        </span>
        ${barrasSVG(textoProd)}
        <span class="etiqueta-texto">${textoProd}</span>
      </button>`,
  );
  muestras.addEventListener('click', (e) => {
    const etiqueta = e.target.closest('[data-texto]');
    if (etiqueta) leer(etiqueta.dataset.texto);
  });
  mostrar(false);
}

/**
 * @param {Promise<boolean>} hayQR     si cargó qrcode-generator
 * @param {Promise<boolean>} hayBarras si cargó JsBarcode
 */
export async function iniciarPreparar(hayQR, hayBarras) {
  iniciarRoles();
  const [conQR] = await Promise.all([hayQR, hayBarras]);
  iniciarLector(conQR);
  const ejemplo = 'CFG:{"url":"https://script.google.com/macros/s/…/exec","token":"…"}';
  pintar(document.querySelector('[data-zona="qr-config"]'), qr(ejemplo, conQR));
}
