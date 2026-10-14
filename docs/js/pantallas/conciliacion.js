// Diagrama, Hoja 2: «¿Se relevaron todas las posiciones del alcance?», cálculo del teórico,
// cruce contra el físico y «Reporte de conciliación por posición, material y lote».
// Conectada a la planilla, la conciliación se escribe con fórmulas en la hoja Conciliacion y el
// servidor verifica que la hoja dé lo mismo que este cálculo.
import { rackHTML } from '../componentes/rack.js';
import { cobertura } from '../dominio/indicadores.js';
import { conSigno, entero, fechaCorta, html, pintar, porcentaje } from '../ui.js';

const NOMBRES = {
  OK: 'OK',
  FALTANTE: 'Faltante',
  SOBRANTE: 'Sobrante',
  UBICACION: 'Error de ubicación',
  NO_REGISTRADO: 'No registrado',
};
// La clasificación que «pesa» más define el color de la posición en el mapa.
const PRIORIDAD = ['NO_REGISTRADO', 'UBICACION', 'FALTANTE', 'SOBRANTE', 'OK'];

export async function mostrar(contenedor, app) {
  await app.refrescar();
  const p = app.parametros;
  const enPlanilla = app.backend.modo !== 'demo';
  const posiciones = app.maestros.posiciones.map((x) => x.posicion);
  const cob = cobertura(app.estado.registros, posiciones, app.sesion.campania);
  const pendientes = app.cola.pendientes().length;
  const textoBoton = enPlanilla ? 'Ejecutar la conciliación en la planilla' : 'Ejecutar la conciliación';

  pintar(
    contenedor,
    html`
      <section class="pantalla conciliacion">
        <h1 tabindex="-1">Conciliación al ${fechaCorta(p.fechaConteo)}</h1>
        <p class="bajada">
          Teórico = stock al ${fechaCorta(p.fechaStockInicial)} + movimientos del ${fechaCorta(p.fechaDesde)} al
          ${fechaCorta(p.fechaConteo)}. Físico = lo contado con la app. Diferencia = físico − teórico, por posición,
          material y lote.
        </p>

        ${pendientes
          ? html`<div class="mensaje advertencia">
              <p><strong>Hay ${pendientes} registro(s) en este celular sin enviar.</strong> La conciliación usa lo que llegó al
              servidor: conviene esperar a que se envíen o tocar «Reintentar ahora» en la ruta.</p>
            </div>`
          : ''}

        ${cob.faltantes.length
          ? html`<div class="mensaje advertencia">
              <p><strong>Faltan relevar ${cob.faltantes.length} de ${cob.total} posiciones:</strong> ${cob.faltantes.join(', ')}.</p>
              <p>Para cerrar la conciliación hay que contarlas. Se puede conciliar igual con lo que ya se relevó.</p>
              <div class="mensaje-acciones">
                <a class="boton primario" href="#/ruta">Contar las faltantes</a>
                <button class="boton secundario" type="button" data-accion="parcial">Conciliar con lo relevado</button>
              </div>
            </div>`
          : html`<div class="mensaje ok"><p>Las ${cob.total} posiciones del alcance están relevadas.</p></div>
            <button class="boton primario" type="button" data-accion="conciliar">${textoBoton}</button>`}

        <div id="resultado-conciliacion" aria-live="polite"></div>
      </section>`,
  );

  const zona = contenedor.querySelector('#resultado-conciliacion');

  const ejecutar = async (forzar, boton) => {
    if (boton) {
      boton.disabled = true;
      boton.textContent = enPlanilla ? 'Escribiendo la conciliación en la planilla…' : 'Conciliando…';
    }
    let r;
    try {
      r = await app.backend.conciliar(app.sesion.campania, { forzar });
    } catch (error) {
      r = { ok: false, mensaje: `No se pudo conciliar: ${error.message} La conciliación necesita conexión con la planilla.` };
    }
    if (boton) {
      boton.disabled = false;
      boton.textContent = forzar ? 'Conciliar con lo relevado' : textoBoton;
    }
    if (!r.ok) {
      pintar(zona, html`<div class="mensaje error"><p>${r.mensaje}</p>${r.codigo ? html`<p class="mensaje-codigo">${r.codigo}</p>` : ''}</div>`);
      return;
    }
    pintarResultado(zona, r, app);
    zona.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  contenedor.querySelector('[data-accion="conciliar"]')?.addEventListener('click', (e) => ejecutar(false, e.currentTarget));
  contenedor.querySelector('[data-accion="parcial"]')?.addEventListener('click', (e) => ejecutar(true, e.currentTarget));
}

function verificacionHTML({ verificacion, mensaje }) {
  if (!verificacion) return html`<p class="nota">${mensaje}</p>`;
  if (verificacion.coinciden) {
    return html`<div class="mensaje ok">
      <p><strong>La planilla coincide con este cálculo.</strong> Se compararon las ${verificacion.revisadas} claves de la
      hoja Conciliacion, valor por valor. Cada número de la hoja es una fórmula que se puede revisar.</p>
    </div>`;
  }
  return html`<div class="mensaje advertencia">
    <p><strong>Hay ${verificacion.diferencias.length} valores de la hoja que no coinciden con este cálculo.</strong>
    Revisar las fórmulas de la hoja Conciliacion:</p>
    <ul>${verificacion.diferencias.slice(0, 6).map(
      (d) => html`<li>${d.clave}, ${d.campo}: hoja ${d.hoja}, app ${String(d.app)}</li>`,
    )}</ul>
  </div>`;
}

function pintarResultado(zona, resultado, app) {
  const { filas, indicadores: ind } = resultado;
  const porPosicion = new Map();
  for (const f of filas) {
    if (!porPosicion.has(f.posicion)) porPosicion.set(f.posicion, []);
    porPosicion.get(f.posicion).push(f);
  }
  const celda = (posicion) => {
    const lista = porPosicion.get(posicion);
    if (!lista) return { clase: 'sin-stock', descripcion: 'sin stock teórico ni físico' };
    const peor = PRIORIDAD.find((c) => lista.some((f) => f.clasificacion === c));
    const diferencia = lista.reduce((t, f) => t + f.diferencia, 0);
    return {
      clase: `clasif-${peor.toLowerCase()}`,
      texto: peor === 'OK' ? 'ok' : conSigno(diferencia),
      descripcion: `${NOMBRES[peor]}, diferencia ${conSigno(diferencia)}`,
    };
  };

  const conDiferencia = filas.filter((f) => f.clasificacion !== 'OK');

  pintar(
    zona,
    html`
      ${verificacionHTML(resultado)}

      <dl class="indicadores">
        <div>
          <dt>Exactitud por clave</dt>
          <dd>${porcentaje(ind.exactitudPorClave)}</dd>
          <dd class="indicador-detalle">${ind.clavesOk} de ${ind.claves} claves sin diferencia</dd>
        </div>
        <div>
          <dt>Exactitud por posición</dt>
          <dd>${porcentaje(ind.exactitudPorPosicion)}</dd>
          <dd class="indicador-detalle">${ind.posicionesSinDiferencia} de ${ind.posiciones} posiciones</dd>
        </div>
        <div>
          <dt>Diferencia neta</dt>
          <dd>${conSigno(ind.diferenciaNeta)} u.</dd>
          <dd class="indicador-detalle">${entero(ind.unidadesFaltantes)} faltantes, ${entero(ind.unidadesSobrantes)} sobrantes</dd>
        </div>
      </dl>

      ${rackHTML(app.maestros.posiciones, celda, 'Mapa del rack con el resultado de la conciliación')}

      <ul class="leyenda" aria-label="Referencias del mapa">
        ${['OK', 'FALTANTE', 'SOBRANTE', 'UBICACION', 'NO_REGISTRADO']
          .filter((c) => c === 'OK' || ind.porClasificacion[c])
          .map((c) => html`<li><span class="muestra clasif-${c.toLowerCase()}"></span>${NOMBRES[c]} (${ind.porClasificacion[c]})</li>`)}
      </ul>

      <div class="filtro" role="radiogroup" aria-label="Qué claves mostrar">
        <label><input type="radio" name="filtro" value="diferencias" checked> Con diferencia (${conDiferencia.length})</label>
        <label><input type="radio" name="filtro" value="todas"> Todas (${filas.length})</label>
      </div>
      <ul class="filas-conciliacion" id="filas"></ul>`,
  );

  const lista = zona.querySelector('#filas');
  const pintarFilas = (soloDiferencias) => {
    const visibles = soloDiferencias ? conDiferencia : filas;
    pintar(
      lista,
      visibles.length
        ? html`${visibles.map(filaHTML)}`
        : html`<li class="nota">No hay diferencias: el físico coincide con el teórico en todas las claves.</li>`,
    );
  };
  zona.querySelectorAll('input[name="filtro"]').forEach((radio) =>
    radio.addEventListener('change', () => pintarFilas(radio.value === 'diferencias' && radio.checked)),
  );
  pintarFilas(true);
}

function filaHTML(f) {
  return html`
    <li class="fila-conciliacion clasif-${f.clasificacion.toLowerCase()}">
      <details>
        <summary>
          <span class="fc-posicion">${f.posicion}</span>
          <span class="fc-material"><strong>${f.codigo}</strong> ${f.lote}<span class="fc-descripcion">${f.descripcion}</span></span>
          <span class="fc-cantidades">Teórico ${entero(f.teorico)}<br>Físico ${entero(f.fisico)}</span>
          <span class="fc-diferencia">${conSigno(f.diferencia)}<span class="fc-clasificacion">${NOMBRES[f.clasificacion]}</span></span>
        </summary>
        <p class="fc-calculo">
          Teórico = stock 30/09 ${entero(f.stockInicial)} + ingresos ${entero(f.ingresos)} + salidas ${entero(f.salidas)}
          + ajustes ${entero(f.ajustes)} = <strong>${entero(f.teorico)}</strong>.
          Diferencia = ${entero(f.fisico)} − ${entero(f.teorico)} = <strong>${conSigno(f.diferencia)}</strong>
          (tolerancia ${entero(f.tolerancia)}).
        </p>
      </details>
    </li>`;
}
