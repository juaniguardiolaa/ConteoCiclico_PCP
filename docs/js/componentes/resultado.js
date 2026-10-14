// Caja de resultado de una validación, con las acciones que corresponden a cada rama del diagrama
// (por ejemplo «Volver a escanear» o «Pasar a la siguiente»).
import { html, pintar } from '../ui.js';

/**
 * @param {HTMLElement} elemento
 * @param {{tipo:'error'|'advertencia'|'ok', mensaje:string, codigo?:string,
 *          acciones?:{texto:string, primaria?:boolean, alHacer:() => void}[]}} resultado
 */
export function mostrarResultado(elemento, { tipo, mensaje, codigo, acciones = [] }) {
  pintar(
    elemento,
    html`
      <div class="mensaje ${tipo}" role="${tipo === 'ok' ? 'status' : 'alert'}">
        <p>${mensaje}</p>
        ${codigo ? html`<p class="mensaje-codigo">Control: ${codigo}</p>` : ''}
        ${acciones.length
          ? html`<div class="mensaje-acciones">
              ${acciones.map(
                (a, i) => html`<button type="button" class="boton ${a.primaria ? 'primario' : 'secundario'}" data-i="${i}">${a.texto}</button>`,
              )}
            </div>`
          : ''}
      </div>`,
  );
  elemento.querySelectorAll('[data-i]').forEach((boton) => {
    boton.addEventListener('click', () => acciones[Number(boton.dataset.i)].alHacer());
  });
  elemento.querySelector('button')?.focus();
}

export function limpiarResultado(elemento) {
  elemento.replaceChildren();
}
