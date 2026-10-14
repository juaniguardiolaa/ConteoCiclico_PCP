// Indicador de los pasos de captura de una posición (Hoja 1 del diagrama).
import { crudo, html } from '../ui.js';

const PASOS = ['Posición', 'Producto', 'Cantidad', 'Confirmar'];

/** @param {number} actual índice del paso actual (0 a 3) @param {boolean} vacia la posición está vacía */
export function pasosHTML(actual, vacia = false) {
  return html`
    <ol class="pasos" aria-label="Pasos de la captura">
      ${PASOS.map((nombre, i) => {
        const omitido = vacia && (i === 1 || i === 2);
        const estado = omitido ? 'omitido' : i < actual ? 'hecho' : i === actual ? 'actual' : 'pendiente';
        return html`<li class="paso ${estado}" ${i === actual ? crudo('aria-current="step"') : ''}>${nombre}</li>`;
      })}
    </ol>`;
}

/** Rótulo grande de la posición, como el cartel pintado en el larguero del rack. */
export function rotuloPosicion(posicion, tipo = 'CONTEO') {
  return html`
    <div class="rotulo" aria-label="Posición ${posicion}">
      <span class="rotulo-texto">${posicion}</span>
      ${tipo === 'RECONTEO' ? html`<span class="rotulo-tipo">Reconteo</span>` : ''}
    </div>`;
}
