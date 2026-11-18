// Secciones F y G: la conciliación en vivo sobre el rack (F1), con el detalle de cada clave y el
// reconteo, y el análisis de diferencias con ajustes y transferencias aprobados (G1). Todo con
// conciliar(), calcularIndicadores() y movimientosDeAjuste(), las funciones de la app.
import { CASO } from '../../js/datos/caso.js';
import { movimientosDeAjuste } from '../../js/dominio/ajustes.js';
import { crearRegistro } from '../../js/dominio/registros.js';
import { conSigno, entero, fechaCorta, fechaHoraLocal, horaCorta, html, nuevoId, pintar, porcentaje } from '../../js/ui.js';
import { registrarDiapo } from './deck.js';
import { CAMPANIA, estado, material } from './estado.js';
import { rackHTML } from './rack.js';
import { pitido } from './sonido.js';

const NOMBRE = { OK: 'OK', FALTANTE: 'Faltante', SOBRANTE: 'Sobrante', UBICACION: 'Ubicación', NO_REGISTRADO: 'No registrado' };
// La peor clasificación de la posición manda el color de la celda.
const GRAVEDAD = ['UBICACION', 'NO_REGISTRADO', 'FALTANTE', 'SOBRANTE', 'OK'];

const TIPO_CORTO = {
  Ingreso_Orden_Compra: 'Ingreso por OC',
  Retorno_Venta: 'Retorno de venta',
  Salida_Venta: 'Venta',
  Consumo_Orden_Produccion: 'Consumo de OP',
  Ajuste_Inventario_Ciclico: 'Ajuste cíclico',
  Ajuste_Inventario_Anual: 'Ajuste anual',
  Transferencia_Posicion: 'Transferencia',
};

let conciliado = false;
let seleccionada = 'A2';
let reconteoAbierto = false;

const validos = () => estado.registros.filter((r) => r.estado === 'VALIDO' && r.campania === CAMPANIA);

function porPosicion(filas) {
  const mapa = new Map();
  for (const f of filas) {
    const actual = mapa.get(f.posicion);
    const clase = !actual || GRAVEDAD.indexOf(f.clasificacion) < GRAVEDAD.indexOf(actual.clase) ? f.clasificacion : actual.clase;
    mapa.set(f.posicion, { clase, diferencia: (actual?.diferencia ?? 0) + f.diferencia });
  }
  return mapa;
}

// ------------------------------------------------------------------------------- F1 conciliar
function pintarCobertura() {
  const { faltantes, relevadas } = estado.cobertura();
  const zona = document.querySelector('[data-zona="conc-cobertura"]');
  pintar(
    zona,
    faltantes.length
      ? html`<b>${relevadas.length} de 28</b> posiciones relevadas. Faltan ${faltantes.length}: la app avisa antes de conciliar.`
      : html`<b>28 de 28</b> posiciones relevadas: se puede conciliar.`,
  );
  zona.classList.toggle('incompleta', faltantes.length > 0);
  document.querySelector('[data-accion="completar"]').disabled = !faltantes.length;
  document.querySelector('[data-accion="conciliar"]').textContent = faltantes.length ? 'Conciliar con lo relevado' : 'Conciliar';
}

function pintarRackConciliacion(animar = false) {
  const filas = estado.conciliacion();
  const resultado = porPosicion(filas);
  const contadas = new Set(validos().map((r) => r.posicion));
  let orden = 0;
  pintar(
    document.querySelector('[data-zona="conc-rack"]'),
    rackHTML((posicion) => {
      const r = resultado.get(posicion);
      const clase = conciliado && r ? `res-${r.clase}` : contadas.has(posicion) ? 'contada' : 'sin-contar';
      let dato = contadas.has(posicion) ? '✓' : '';
      if (conciliado && r) dato = r.clase === 'OK' ? 'ok' : conSigno(r.diferencia);
      else if (conciliado && contadas.has(posicion)) dato = 'vacía'; // vacía en el sistema y en el rack: no hay clave
      return {
        clase: `${clase} ${posicion === seleccionada ? 'elegida' : ''} ${animar ? 'aparece' : ''}`,
        contenido: html`<button type="button" class="conc-celda" data-elegir="${posicion}" style="--i: ${orden++}">
          <span class="celda-codigo">${posicion}</span><span class="celda-dato">${dato}</span></button>`,
      };
    }, 'rack-conciliar'),
  );
}

function animarNumero(elemento, final, formato) {
  const inicio = performance.now();
  const duracion = 900;
  const paso = (t) => {
    const avance = Math.min(1, (t - inicio) / duracion);
    const suave = 1 - (1 - avance) ** 3;
    elemento.textContent = formato(final * suave);
    if (avance < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function pintarIndicadores(animar = false) {
  const zona = document.querySelector('[data-zona="conc-indicadores"]');
  if (!conciliado) {
    pintar(zona, html`<p class="conc-espera">Tocá <b>Conciliar</b> para cruzar el teórico con lo contado.</p>`);
    return;
  }
  const ind = estado.indicadores();
  const tarjetas = [
    [ind.claves, (n) => entero(Math.round(n)), 'claves conciliadas', ''],
    [ind.clavesOk, (n) => entero(Math.round(n)), 'sin diferencia', 'bien'],
    [ind.clavesConDiferencia, (n) => entero(Math.round(n)), 'con diferencia', ind.clavesConDiferencia ? 'mal' : 'bien'],
    [ind.exactitudPorClave, (n) => porcentaje(n), 'exactitud por clave', 'fuerte'],
    [ind.exactitudPorPosicion, (n) => porcentaje(n), 'exactitud por posición', 'fuerte'],
    [ind.diferenciaNeta, (n) => `${conSigno(Math.round(n))} u.`, `neto (${entero(ind.unidadesFaltantes)} faltan, ${entero(ind.unidadesSobrantes)} sobran)`, 'fuerte'],
  ];
  pintar(
    zona,
    html`${tarjetas.map(
      ([valor, formato, etiqueta, clase], i) => html`<div class="indicador ${clase}"><b data-indicador="${i}">${formato(valor)}</b><span>${etiqueta}</span></div>`,
    )}`,
  );
  if (animar) tarjetas.forEach(([valor, formato], i) => animarNumero(zona.querySelector(`[data-indicador="${i}"]`), valor, formato));
}

function porQue(f, filas) {
  if (f.clasificacion === 'OK') return `La diferencia está dentro de la tolerancia (${f.tolerancia} u.).`;
  if (f.clasificacion === 'NO_REGISTRADO') return `El par ${f.codigo}|${f.lote} no figura en Maestro_Lotes: el sistema no conoce ese lote.`;
  const mismoLote = filas.filter((x) => x.codigo === f.codigo && x.lote === f.lote && x.diferencia !== 0);
  if (f.clasificacion === 'UBICACION') {
    return `El mismo lote suma cero entre posiciones (${mismoLote.map((x) => `${x.posicion} ${conSigno(x.diferencia)}`).join(', ')}): está, pero en otra posición.`;
  }
  const cuanto = Math.abs(f.diferencia);
  return f.clasificacion === 'FALTANTE'
    ? `Hay ${cuanto} u. menos de lo que dice el sistema y el lote no aparece de más en otra posición.`
    : `Hay ${cuanto} u. más de lo que dice el sistema y el lote no falta en otra posición.`;
}

function claveHTML(f, filas) {
  const movimientos = estado
    .movimientos()
    .filter((m) => m.codigo === f.codigo && m.lote === f.lote && m.posicion === f.posicion && m.fecha >= CASO.fechaDesde && m.fecha <= CASO.fechaConteo);
  const conteos = validos().filter((r) => r.posicion === f.posicion && r.codigo === f.codigo && r.lote === f.lote);
  return html`
    <article class="clave res-${f.clasificacion}">
      <header>
        <h4>${f.codigo} · ${f.lote}</h4>
        <span class="pastilla res-${f.clasificacion}">${NOMBRE[f.clasificacion]}</span>
      </header>
      <p class="clave-desc">${material(f.codigo)?.descripcion ?? ''}</p>
      <table class="cuenta">
        <tr><td>Stock al ${fechaCorta(CASO.fechaStockInicial)}</td><td class="num">${entero(f.stockInicial)}</td></tr>
        ${movimientos.map(
          (m) => html`<tr class="mov"><td>${TIPO_CORTO[m.tipo] ?? m.tipo} (${fechaCorta(m.fecha).slice(0, 5)})</td><td class="num">${conSigno(m.cantidad)}</td></tr>`,
        )}
        <tr class="total"><td>Teórico al 14/10</td><td class="num">${entero(f.teorico)}</td></tr>
        <tr><td>Físico contado${conteos.length ? ` (${conteos.map((r) => `${r.tipo === 'RECONTEO' ? 'reconteo' : r.usuario}, ${horaCorta(r.fechaHora)}`).join('; ')})` : ''}</td><td class="num">${entero(f.fisico)}</td></tr>
        <tr class="total dif"><td>Diferencia</td><td class="num">${conSigno(f.diferencia)}</td></tr>
      </table>
      <p class="clave-porque">${porQue(f, filas)}</p>
    </article>`;
}

function pintarDetalle() {
  const zona = document.querySelector('[data-zona="conc-detalle"]');
  const filas = estado.conciliacion();
  const deLaPosicion = filas.filter((f) => f.posicion === seleccionada);
  const registro = validos().find((r) => r.posicion === seleccionada);
  const pedido = estado.reconteos.includes(seleccionada);

  let reconteo = '';
  if (registro && !registro.vacia) {
    reconteo = reconteoAbierto || pedido
      ? html`<form class="reconteo" data-accion="recontar">
          <label>Cantidad recontada en ${seleccionada}<input name="cantidad" inputmode="numeric" autocomplete="off" required></label>
          <button class="boton">Registrar reconteo</button>
          <p class="reconteo-nota">El conteo anterior no se borra: pasa a REEMPLAZADO.</p>
        </form>`
      : html`<button type="button" class="boton secundario" data-accion="pedir-reconteo">Control pide reconteo de ${seleccionada}</button>`;
  }

  pintar(
    zona,
    html`
      <h3>Posición ${seleccionada}</h3>
      ${deLaPosicion.length
        ? html`${!conciliado ? html`<p class="conc-espera chica">Todavía sin conciliar: estos números se calculan igual, clave por clave.</p>` : ''}
            ${deLaPosicion.map((f) => claveHTML(f, filas))}`
        : html`<p class="conc-vacia">Sin stock en el sistema ni en el rack: la posición vacía no genera clave.</p>`}
      ${reconteo}`,
  );
}

function recontar(cantidad) {
  const anterior = validos().find((r) => r.posicion === seleccionada);
  if (!estado.reconteos.includes(seleccionada)) estado.pedirReconteo(seleccionada);
  const respuesta = estado.registrar(
    crearRegistro({
      id: nuevoId(),
      fechaHora: fechaHoraLocal(),
      usuario: estado.usuario,
      rol: 'OPERARIO',
      campania: CAMPANIA,
      tipo: 'RECONTEO',
      posicion: seleccionada,
      codigo: anterior.codigo,
      lote: anterior.lote,
      cantidad,
      dispositivo: 'Presentación',
    }),
  );
  const aviso = document.querySelector('[data-zona="conc-aviso"]');
  aviso.textContent = respuesta.ok ? `Reconteo de ${seleccionada} registrado: el conteo anterior quedó REEMPLAZADO.` : `${respuesta.codigo}: ${respuesta.mensaje}`;
  aviso.className = `conc-aviso ${respuesta.ok ? 'bien' : 'mal'}`;
  pitido(respuesta.ok ? 'ok' : 'error');
  reconteoAbierto = !respuesta.ok;
  refrescarF1();
}

function refrescarF1(animar = false) {
  pintarCobertura();
  pintarRackConciliacion(animar);
  pintarIndicadores(animar);
  pintarDetalle();
}

// ------------------------------------------------------------------------------- G1 ajustes
const SUGERENCIA = {
  UBICACION: ['Transferencia', 'El lote está en otra posición'],
  FALTANTE: ['Ajuste', 'Diferencia confirmada, sin movimiento que la explique'],
  SOBRANTE: ['Ajuste', 'Diferencia confirmada, sin movimiento que la explique'],
  NO_REGISTRADO: ['Ajuste', 'Lote que el sistema no tenía registrado'],
};

/** Causa, Acción y Aprobado_por que se completan en la hoja Conciliacion, por clave. */
let decisiones = new Map();

function pintarAjustes() {
  const zona = document.querySelector('[data-zona="ajustes"]');
  const { faltantes } = estado.cobertura();
  if (faltantes.length) {
    pintar(
      zona,
      html`<div class="ajustes-espera"><p>Faltan relevar ${faltantes.length} posiciones. Primero hay que terminar el conteo y conciliar.</p>
        <button type="button" class="boton" data-accion="completar-g">Completar el conteo y conciliar</button></div>`,
    );
    pintarAntesDespues();
    return;
  }
  const filas = estado.conciliacion().filter((f) => f.clasificacion !== 'OK');
  if (!filas.length) {
    pintar(
      zona,
      html`<div class="ajustes-listo"><p><b>Ninguna diferencia fuera de tolerancia.</b> Las ${estado.indicadores().claves} claves quedaron en OK.</p>
        ${estado.ajustes.length
          ? html`<table class="tabla-ajustes movimientos-nuevos">
              <thead><tr><th>Movimiento agregado</th><th>Pos.</th><th>Código</th><th>Lote</th><th class="num">Cantidad</th><th>Origen</th></tr></thead>
              <tbody>${estado.ajustes.map(
                (m) => html`<tr><td class="mono">${m.tipo}</td><td><b>${m.posicion}</b></td><td>${m.codigo}</td><td>${m.lote}</td>
                  <td class="num dif">${conSigno(m.cantidad)}</td><td>${m.origen}</td></tr>`,
              )}</tbody>
            </table>`
          : ''}
        ${estado.cerrada
          ? html`<p class="cerrada">Campaña ${CAMPANIA} <b>cerrada</b>: la planilla ya no acepta registros nuevos (responde CAMPANIA_CERRADA).</p>`
          : html`<button type="button" class="boton" data-accion="cerrar">El Jefe de almacén cierra la campaña</button>`}
      </div>`,
    );
    pintarAntesDespues();
    return;
  }
  pintar(
    zona,
    html`<table class="tabla-ajustes">
      <thead><tr><th>Pos.</th><th>Código</th><th>Lote</th><th class="num">Teórico</th><th class="num">Físico</th><th class="num">Dif.</th><th>Clasificación</th><th>Causa</th><th>Acción</th><th>Aprobado_por</th></tr></thead>
      <tbody>${filas.map((f) => {
        const d = decisiones.get(f.clave) ?? {};
        return html`<tr data-clave="${f.clave}">
          <td><b>${f.posicion}</b></td><td>${f.codigo}</td><td>${f.lote}</td>
          <td class="num">${f.teorico}</td><td class="num">${f.fisico}</td><td class="num dif">${conSigno(f.diferencia)}</td>
          <td><span class="pastilla res-${f.clasificacion}">${NOMBRE[f.clasificacion]}</span></td>
          <td class="causa">${d.causa ?? ''}</td>
          <td><select data-campo="accion" aria-label="Acción para ${f.posicion}">
            ${['', 'Ajuste', 'Transferencia'].map((a) => html`<option value="${a}" ${d.accion === a ? 'selected' : ''}>${a || '—'}</option>`)}
          </select></td>
          <td class="firma">${d.aprobadoPor ?? ''}</td>
        </tr>`;
      })}</tbody>
    </table>`,
  );
  pintarAntesDespues();
}

function pintarAntesDespues() {
  const zona = document.querySelector('[data-zona="antes-despues"]');
  const ahora = { ...estado.indicadores(), movimientos: estado.movimientos().length };
  const antes = estado.antes ?? ahora;
  const filas = [
    ['Exactitud por clave', porcentaje(antes.exactitudPorClave), porcentaje(ahora.exactitudPorClave)],
    ['Exactitud por posición', porcentaje(antes.exactitudPorPosicion), porcentaje(ahora.exactitudPorPosicion)],
    ['Claves con diferencia', entero(antes.clavesConDiferencia), entero(ahora.clavesConDiferencia)],
    ['Filas en Movimientos', entero(antes.movimientos), entero(ahora.movimientos)],
  ];
  pintar(
    zona,
    html`<table class="antes-despues">
      <thead><tr><th></th><th>Antes</th><th>Ahora</th></tr></thead>
      <tbody>${filas.map(([k, a, b]) => html`<tr><th>${k}</th><td>${a}</td><td class="${a === b ? '' : 'cambio'}">${b}</td></tr>`)}</tbody>
    </table>`,
  );
}

function sugerir() {
  for (const f of estado.conciliacion().filter((x) => x.clasificacion !== 'OK')) {
    const [accion, causa] = SUGERENCIA[f.clasificacion];
    decisiones.set(f.clave, { ...decisiones.get(f.clave), accion, causa });
  }
  pintarAjustes();
}

function firmar() {
  for (const [clave, d] of decisiones) if (d.accion) decisiones.set(clave, { ...d, aprobadoPor: 'Jefe de almacén' });
  pintarAjustes();
}

function registrarAprobados() {
  const filas = estado
    .conciliacion()
    .filter((f) => f.clasificacion !== 'OK')
    .map((f) => ({ ...f, ...decisiones.get(f.clave) }));
  const { movimientos, sinAprobar, errores } = movimientosDeAjuste(filas, { fecha: CASO.fechaConteo, campania: CAMPANIA });
  const aviso = document.querySelector('[data-zona="ajustes-aviso"]');
  const partes = [];
  if (movimientos.length) {
    estado.registrarAjustes(movimientos);
    partes.push(`${movimientos.length} movimientos agregados a Movimientos.`);
  }
  if (sinAprobar.length) partes.push(`${sinAprobar.length} sin Aprobado_por: no se registran.`);
  partes.push(...errores);
  if (!movimientos.length && !sinAprobar.length && !errores.length) partes.push('Completá la Acción de cada diferencia.');
  aviso.textContent = partes.join(' ');
  aviso.className = `ajustes-aviso ${errores.length || !movimientos.length ? 'mal' : 'bien'}`;
  pitido(movimientos.length ? 'ok' : 'error');
  pintarAjustes();
}

// ------------------------------------------------------------------------------- arranque
export function iniciarConciliar() {
  const f1 = document.getElementById('conciliar');
  f1.addEventListener('click', (e) => {
    const celda = e.target.closest('[data-elegir]');
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (celda) {
      seleccionada = celda.dataset.elegir;
      reconteoAbierto = false;
      pintarRackConciliacion();
      pintarDetalle();
    } else if (accion === 'completar') {
      estado.completarConteo();
    } else if (accion === 'conciliar') {
      conciliado = true;
      pitido('ok');
      refrescarF1(true);
    } else if (accion === 'pedir-reconteo') {
      estado.pedirReconteo(seleccionada);
      reconteoAbierto = true;
      pintarDetalle();
      f1.querySelector('.reconteo input')?.focus();
    }
  });
  f1.addEventListener('submit', (e) => {
    e.preventDefault();
    recontar(new FormData(e.target).get('cantidad'));
  });

  const g1 = document.getElementById('ajustes');
  g1.addEventListener('click', (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'sugerir') sugerir();
    else if (accion === 'firmar') firmar();
    else if (accion === 'registrar-ajustes') registrarAprobados();
    else if (accion === 'completar-g') {
      estado.completarConteo();
      conciliado = true;
    } else if (accion === 'cerrar') {
      estado.cerrarCampania();
      pitido('ok');
    }
  });
  g1.addEventListener('change', (e) => {
    const fila = e.target.closest('[data-clave]');
    if (!fila) return;
    const clave = fila.dataset.clave;
    decisiones.set(clave, { ...decisiones.get(clave), accion: e.target.value });
    pintarAjustes();
  });

  let reinicios = estado.reinicios;
  estado.alCambiar(() => {
    if (estado.reinicios !== reinicios) {
      reinicios = estado.reinicios;
      conciliado = false;
      decisiones = new Map();
    }
    if (document.getElementById('conciliar').classList.contains('activa')) refrescarF1();
    if (g1.classList.contains('activa')) pintarAjustes();
  });
}

registrarDiapo('conciliar', {
  alEntrar() {
    document.querySelector('[data-zona="conc-aviso"]').textContent = '';
    refrescarF1();
  },
});

registrarDiapo('ajustes', {
  alEntrar() {
    document.querySelector('[data-zona="ajustes-aviso"]').textContent = '';
    pintarAjustes();
  },
});
