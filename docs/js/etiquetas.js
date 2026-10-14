// Hoja de etiquetas (etiquetas.html). Diagrama, Hoja 1: «Generar etiquetas QR de posición y
// de producto-lote», que lee los maestros. QR con qrcode-generator y Code 128 con JsBarcode.
import { almacen } from './almacen.js';
import { crearBackend } from './backend/index.js';
import { CASO } from './datos/caso.js';
import { ETIQUETAS_DE_PRUEBA, etiquetasDeSimulacion, textoPosicion, textoProducto } from './dominio/etiquetas.js';
import { crudo, entero, html, pintar } from './ui.js';

/** QR como SVG propio (módulos negros sobre blanco, con zona de silencio de 4 módulos). */
function qrSVG(texto) {
  const qr = window.qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const borde = 4;
  let trazo = '';
  for (let fila = 0; fila < n; fila++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(fila, col)) trazo += `M${col + borde} ${fila + borde}h1v1h-1z`;
    }
  }
  const lado = n + borde * 2;
  return crudo(
    `<svg class="qr" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" aria-hidden="true">` +
      `<rect width="${lado}" height="${lado}" fill="#fff"/><path d="${trazo}" fill="#000"/></svg>`,
  );
}

/** Code 128 como SVG que se estira al ancho de la etiqueta (las barras mantienen su proporción). */
function barrasSVG(texto) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  window.JsBarcode(svg, texto, {
    format: 'CODE128',
    width: 1,
    height: 30,
    margin: 10,
    displayValue: false,
    background: '#ffffff',
    lineColor: '#000000',
  });
  const ancho = parseFloat(svg.getAttribute('width'));
  const alto = parseFloat(svg.getAttribute('height'));
  svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('style');
  svg.setAttribute('class', 'barras');
  svg.setAttribute('aria-hidden', 'true');
  return crudo(svg.outerHTML);
}

function etiquetaPosicion({ posicion, bloque, nivel }) {
  const texto = textoPosicion(posicion);
  return html`
    <article class="etiqueta etiqueta-posicion" aria-label="Etiqueta de la posición ${posicion}">
      <div class="etiqueta-arriba">
        <div>
          <span class="etiqueta-rotulo">${posicion}</span>
          <span class="etiqueta-dato">Bloque ${bloque}, nivel ${nivel}</span>
        </div>
        ${qrSVG(texto)}
      </div>
      ${barrasSVG(texto)}
      <span class="etiqueta-texto">${texto}</span>
    </article>`;
}

function etiquetaProducto({ codigo, descripcion, lote, posicion, cantidad }) {
  const texto = textoProducto(codigo, lote);
  return html`
    <article class="etiqueta etiqueta-producto" aria-label="Etiqueta de ${codigo} lote ${lote}">
      <div class="etiqueta-arriba">
        ${qrSVG(texto)}
        <div class="etiqueta-material">
          <span class="etiqueta-codigo">${codigo}</span>
          <span class="etiqueta-descripcion">${descripcion}</span>
          <span class="etiqueta-lote">Lote ${lote}</span>
        </div>
      </div>
      ${barrasSVG(texto)}
      <span class="etiqueta-texto">${texto}</span>
      ${posicion
        ? html`<p class="etiqueta-simulacion">
            Simulación: va en <strong>${posicion}</strong>. Cantidad física <strong>${entero(cantidad)} u.</strong>
          </p>`
        : ''}
    </article>`;
}

function etiquetaPrueba({ texto, titulo, control }) {
  return html`
    <article class="etiqueta etiqueta-prueba" aria-label="Etiqueta de prueba: ${titulo}">
      <div class="etiqueta-arriba">
        ${qrSVG(texto)}
        <div class="etiqueta-material">
          <span class="etiqueta-codigo">Prueba</span>
          <span class="etiqueta-descripcion">${titulo}</span>
          <span class="etiqueta-lote">Control esperado: ${control}</span>
        </div>
      </div>
      ${barrasSVG(texto)}
      <span class="etiqueta-texto">${texto}</span>
    </article>`;
}

async function iniciar() {
  const hojas = document.getElementById('hojas');
  const opciones = document.getElementById('opciones');
  document.getElementById('imprimir').addEventListener('click', () => window.print());

  if (!window.qrcode || !window.JsBarcode) {
    pintar(
      hojas,
      html`<div class="mensaje error"><p>No cargaron los generadores de QR y de código de barras. Revisá la conexión y recargá la página.</p></div>`,
    );
    return;
  }

  const backend = crearBackend(almacen.leer('config', { modo: 'demo' }), almacen);
  const maestros = await backend.maestros();
  const material = new Map(maestros.materiales.map((m) => [m.codigo, m]));
  const catalogo = maestros.lotes.map((par) => {
    const [codigo, lote] = par.split('|');
    return { codigo, lote, descripcion: material.get(codigo)?.descripcion ?? '' };
  });
  const simulacion = etiquetasDeSimulacion(CASO.stock1410);

  const dibujar = () => {
    const ver = (nombre) => opciones.elements[nombre].checked;
    const productos = opciones.modo.value === 'simulacion' ? simulacion : catalogo;
    pintar(
      hojas,
      html`
        ${ver('posiciones')
          ? html`<section class="grupo-etiquetas">
              <h2>Posiciones (${maestros.posiciones.length})</h2>
              <div class="grilla grilla-posiciones">${maestros.posiciones.map(etiquetaPosicion)}</div>
            </section>`
          : ''}
        ${ver('productos')
          ? html`<section class="grupo-etiquetas">
              <h2>${opciones.modo.value === 'simulacion'
                ? `Productos para la simulación (${productos.length}, una por posición ocupada)`
                : `Productos y lotes (${productos.length})`}</h2>
              <div class="grilla grilla-productos">${productos.map(etiquetaProducto)}</div>
            </section>`
          : ''}
        ${ver('pruebas')
          ? html`<section class="grupo-etiquetas">
              <h2>Prueba de los controles (${ETIQUETAS_DE_PRUEBA.length})</h2>
              <div class="grilla grilla-productos">${ETIQUETAS_DE_PRUEBA.map(etiquetaPrueba)}</div>
            </section>`
          : ''}`,
    );
  };

  opciones.addEventListener('change', dibujar);
  dibujar();
}

iniciar();
