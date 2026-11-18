// Rack visto de frente, como en el enunciado y en la app: bloque A–D y bloque E–G, nivel 4 arriba.
// Cada diapositiva decide qué va dentro de cada posición.
import { CASO } from '../../js/datos/caso.js';
import { html } from '../../js/ui.js';

const BLOQUES = [...new Set(CASO.posiciones.map((p) => p.bloque))].sort();

/**
 * @param {(posicion:string) => {clase?:string, contenido?:object}} celda  contenido: plantilla `html`
 * @param {string} [clase]  clase extra del rack (tamaño)
 */
export function rackHTML(celda, clase = '') {
  return html`
    <div class="rack ${clase}">
      ${BLOQUES.map((bloque) => {
        const delBloque = CASO.posiciones.filter((p) => p.bloque === bloque);
        const columnas = [...new Set(delBloque.map((p) => p.columna))].sort();
        const niveles = [...new Set(delBloque.map((p) => p.nivel))].sort((a, b) => b - a);
        return html`
          <div class="rack-bloque" style="--columnas: ${columnas.length}">
            ${niveles.map((nivel) =>
              columnas.map((columna) => {
                const posicion = `${columna}${nivel}`;
                const c = celda(posicion);
                return html`<div class="celda ${c.clase ?? ''}" data-posicion="${posicion}">${c.contenido ?? ''}</div>`;
              }),
            )}
          </div>`;
      })}
    </div>`;
}
