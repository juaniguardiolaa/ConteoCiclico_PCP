// E1, la planilla: las últimas filas de Conteo_1410 tal como llegan desde el celular. Se actualiza
// sola cuando se cuenta en B1 o se confirma en D1, así se ve que nadie copia datos a mano.
import { horaCorta, html, pintar } from '../../js/ui.js';
import { registrarDiapo } from './deck.js';
import { CAMPANIA, estado } from './estado.js';

const FILAS_VISIBLES = 7;

function pintarPlanilla() {
  const registros = estado.registros.filter((r) => r.campania === CAMPANIA);
  const desde = Math.max(0, registros.length - FILAS_VISIBLES);
  const ultimas = registros.slice(desde);
  document.querySelector('[data-zona="conteo-total"]').textContent = registros.length
    ? `${registros.length} ${registros.length === 1 ? 'fila' : 'filas'}`
    : '';
  pintar(
    document.querySelector('[data-zona="conteo-filas"]'),
    ultimas.length
      ? html`${ultimas.map(
          (r, i) => html`<tr class="${r.estado === 'REEMPLAZADO' ? 'reemplazada' : ''} ${i === ultimas.length - 1 ? 'nueva' : ''}">
            <th>${desde + i + 2}</th>
            <td>${horaCorta(r.fechaHora)}</td>
            <td>${r.usuario}</td>
            <td><b>${r.posicion}</b></td>
            <td>${r.vacia ? 'vacía' : r.codigo}</td>
            <td>${r.lote}</td>
            <td class="num">${r.vacia ? 0 : r.cantidad}</td>
          </tr>`,
        )}`
      : html`<tr><td colspan="7" class="hoja-vacia">Todavía no llegó ningún conteo. Las filas aparecen apenas se confirma una posición en el celular (B1).</td></tr>`,
  );
}

export function iniciarPlanilla() {
  estado.alCambiar(pintarPlanilla);
  pintarPlanilla();
}

registrarDiapo('planilla', { alEntrar: pintarPlanilla });
