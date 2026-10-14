// Mapa del rack visto de frente, como en el layout del enunciado: bloque A–D y bloque E–G,
// nivel 4 arriba y nivel 1 abajo. Parantes azules y largueros naranjas.
// Lo usan la pantalla de ruta (avance del conteo) y la de conciliación (resultado por posición).
import { html } from '../ui.js';

/**
 * @param {{posicion:string, bloque:number, columna:string, nivel:number}[]} posiciones
 * @param {(posicion:string) => {clase:string, texto?:string, descripcion:string}} celda
 * @param {string} titulo  descripción del mapa para lectores de pantalla
 */
export function rackHTML(posiciones, celda, titulo) {
  const bloques = [...new Set(posiciones.map((p) => p.bloque))].sort();
  return html`
    <div class="rack" role="group" aria-label="${titulo}">
      ${bloques.map((bloque) => {
        const delBloque = posiciones.filter((p) => p.bloque === bloque);
        const columnas = [...new Set(delBloque.map((p) => p.columna))].sort();
        const niveles = [...new Set(delBloque.map((p) => p.nivel))].sort((a, b) => b - a);
        return html`
          <div class="rack-bloque" style="--columnas: ${columnas.length}">
            ${niveles.map((nivel) =>
              columnas.map((columna) => {
                const posicion = `${columna}${nivel}`;
                const c = celda(posicion);
                return html`
                  <div class="rack-celda ${c.clase}" data-posicion="${posicion}" role="img"
                       aria-label="${posicion}: ${c.descripcion}" title="${posicion}: ${c.descripcion}">
                    <span class="rack-codigo">${posicion}</span>
                    ${c.texto ? html`<span class="rack-dato">${c.texto}</span>` : ''}
                  </div>`;
              }),
            )}
          </div>`;
      })}
    </div>`;
}
