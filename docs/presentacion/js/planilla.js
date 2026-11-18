// Sección E, la planilla: el viaje de un registro del celular a Conteo_1410 (E1, paso a paso con el
// clicker) y un recorrido por las diez hojas con los datos de esta demo (E2). Las fórmulas que se
// muestran son las mismas que escribe apps-script/Code.gs.
import { CASO } from '../../js/datos/caso.js';
import { paresMaterialLote } from '../../js/dominio/conciliacion.js';
import { entero, fechaCorta, horaCorta, html, pintar, porcentaje } from '../../js/ui.js';
import { registrarDiapo, volverAlPaso } from './deck.js';
import { CAMPANIA, estado } from './estado.js';

// ------------------------------------------------------------------------------- E1 viaje
const EJEMPLO = {
  id: '9f3c2a71-5d1e-4c8a-b0f2-6e4d7a1c3b90',
  fechaHora: '2026-10-14T10:02:15',
  usuario: 'Operario 1',
  rol: 'OPERARIO',
  campania: CAMPANIA,
  tipo: 'CONTEO',
  posicion: 'B2',
  codigo: 'PROD001',
  lote: 'L0005',
  cantidad: 120,
  vacia: false,
  estado: 'VALIDO',
  dispositivo: 'Android Chrome',
};

let viaje = { registro: EJEMPLO, previas: [] };

/** El último registro que se cargó en vivo; si todavía no hay, uno de ejemplo. */
function elegirRegistro() {
  const registros = estado.registros.filter((r) => r.campania === CAMPANIA && r.tipo === 'CONTEO' && r.dispositivo === 'Presentación');
  const registro = registros.at(-1) ?? EJEMPLO;
  const indice = estado.registros.indexOf(registro);
  const previas = (indice >= 0 ? estado.registros.slice(0, indice) : estado.registros).filter((r) => r.campania === CAMPANIA).slice(-3);
  return { registro, previas };
}

const filaConteo = (r, clase = '') =>
  html`<tr class="${clase}"><td class="mono">${r.id.slice(0, 6)}…</td><td>${horaCorta(r.fechaHora)}</td>
    <td><b>${r.posicion}</b></td><td>${r.codigo}</td><td>${r.lote}</td><td class="num">${r.vacia ? 0 : r.cantidad}</td><td>VALIDO</td></tr>`;

function pintarViaje() {
  const { registro, previas } = viaje;
  const pedido = { accion: 'registrar', token: '••••••••••••', usuario: registro.usuario, rol: registro.rol, registro };
  pintar(document.querySelector('[data-zona="viaje-pedido"]'), html`${JSON.stringify(pedido, null, 2)}`);
  pintar(
    document.querySelector('[data-zona="viaje-respuesta"]'),
    html`${JSON.stringify({ ok: true, codigo: 'REGISTRADO', mensaje: `Posición ${registro.posicion} registrada.` }, null, 2)}`,
  );
  pintar(
    document.querySelector('[data-zona="viaje-filas"]'),
    html`${previas.map((r) => filaConteo(r))}${filaConteo(registro, 'nueva')}`,
  );
  pintar(
    document.querySelector('[data-zona="viaje-log"]'),
    html`<span class="mono">${horaCorta(registro.fechaHora)}</span> <b>registrar</b> ${registro.usuario} <span class="log-resultado">REGISTRADO</span> ${registro.posicion}`,
  );
  document.querySelector('[data-zona="viaje-origen"]').textContent =
    registro === EJEMPLO ? 'Registro de ejemplo (todavía no se cargó ninguno en vivo)' : `El último registro que cargamos en vivo: ${registro.posicion}`;
}

registrarDiapo('viaje', {
  pasos: 6,
  alEntrar() {
    viaje = elegirRegistro();
    pintarViaje();
  },
  // 1 llega al Web App · 2 token · 3 candado · 4 validación · 5 fila en Conteo_1410 · 6 Log_API y respuesta
  alPaso(n) {
    const contenedor = document.querySelector('.viaje');
    contenedor.dataset.paso = String(n);
    contenedor.querySelectorAll('[data-desde]').forEach((li) => li.classList.toggle('hecho', n >= Number(li.dataset.desde)));
  },
});

// ------------------------------------------------------------------------------- E2 hojas
const letra = (i) => String.fromCharCode(65 + i);
const siNo = (v) => (v ? 'SI' : 'NO');

function formulasConciliacion(r) {
  const clave = (p) => `${p}_CODIGO,$B${r}, ${p}_LOTE,$D${r}, ${p}_POSICION,$E${r}`;
  const periodo = 'MOV_FECHA,">="&FECHA_DESDE, MOV_FECHA,"<="&FECHA_CONTEO';
  const mov = (tipo) => `SUMIFS(MOV_CANTIDAD, ${clave('MOV')}, ${periodo}${tipo ? `, MOV_TIPO,"${tipo}"` : ''})`;
  return [
    `=B${r}&"|"&D${r}&"|"&E${r}`,
    null,
    `=IFERROR(VLOOKUP($B${r}, Maestro_Materiales!$A:$B, 2, FALSE), "")`,
    null,
    null,
    `=SUMIFS(STOCK_CANTIDAD, ${clave('STOCK')})`,
    `=${mov('Ingreso_Orden_Compra')} + ${mov('Retorno_Venta')}`,
    `=${mov('Salida_Venta')} + ${mov('Consumo_Orden_Producción')}`,
    `=${mov('')} - G${r} - H${r}`,
    `=F${r}+G${r}+H${r}+I${r}`,
    `=SUMIFS(CONTEO_CANTIDAD, ${clave('CONTEO')}, CONTEO_ESTADO,"VALIDO", CONTEO_CAMPANIA,CAMPANIA)`,
    `=K${r}-J${r}`,
    `=IFERROR(VLOOKUP($B${r}, Maestro_Materiales!$A:$E, 5, FALSE), TOLERANCIA_DEFECTO)`,
    `=IF(ABS(L${r})<=M${r}, "OK", IF(COUNTIFS(Maestro_Lotes!$A:$A,$B${r}, Maestro_Lotes!$B:$B,$D${r})=0, "NO_REGISTRADO", ` +
      `IF(ABS(SUMIFS($L:$L, $B:$B,$B${r}, $D:$D,$D${r}))<=M${r}, "UBICACION", IF(L${r}<0, "FALTANTE", "SOBRANTE"))))`,
  ];
}

/** Cada hoja: columnas, filas (valores) y, si corresponde, la fórmula de cada celda. */
const HOJAS = {
  Parametros: () => ({
    grupo: 'Configuración',
    nota: 'Campaña, fechas de corte y token. Las fórmulas leen estas celdas por nombre (FECHA_DESDE, CAMPANIA…).',
    columnas: ['Clave', 'Valor', 'Descripcion'],
    filas: [
      ['CAMPANIA_ACTIVA', CAMPANIA, 'Campaña de conteo que acepta la app'],
      ['FECHA_CONTEO', fechaCorta(CASO.fechaConteo), 'Fecha de corte del conteo físico'],
      ['FECHA_STOCK_INICIAL', fechaCorta(CASO.fechaStockInicial), 'Foto de stock de partida'],
      ['FECHA_DESDE', fechaCorta(CASO.fechaDesde), 'Primer día de movimientos que suman al teórico'],
      ['TOKEN', '••••••••••••', 'Clave que manda la app en cada llamada'],
      ['TOLERANCIA_DEFECTO', 0, 'Unidades de tolerancia si el material no tiene una propia'],
      ['ALCANCE', 'A1 a G4 (28 posiciones)', 'Posiciones que se relevan en la campaña'],
      ['ESTADO_CAMPANIA', estado.cerrada ? 'CERRADA' : 'ABIERTA', 'ABIERTA: la app acepta registros. CERRADA: ya no.'],
    ],
  }),
  Maestro_Materiales: () => ({
    grupo: 'Maestros',
    nota: 'Los 10 materiales del caso. Sin costos, todos se tratan como clase A, con tolerancia 0.',
    columnas: ['Codigo', 'Descripcion', 'UM', 'Clase_ABC', 'Tolerancia'],
    filas: CASO.materiales.map((m) => [m.codigo, m.descripcion, m.um, 'A', 0]),
  }),
  Maestro_Posiciones: () => ({
    grupo: 'Maestros',
    nota: 'Las 28 posiciones del rack: la validación 1 controla contra esta lista.',
    columnas: ['Posicion', 'Bloque', 'Columna', 'Nivel'],
    filas: CASO.posiciones.map((p) => [p.posicion, p.bloque, p.columna, p.nivel]),
  }),
  Maestro_Lotes: () => ({
    grupo: 'Maestros',
    nota: 'Los pares material-lote que aparecen en el stock o en los movimientos. Es una fórmula: se arma sola.',
    columnas: ['Codigo', 'Lote'],
    filas: [...paresMaterialLote(CASO.stock3009, CASO.movimientos)].sort().map((p) => p.split('|')),
    formula: (fila, col) =>
      fila === 0 && col === 0
        ? '=SORT(UNIQUE(FILTER({Stock_3009!A2:A, Stock_3009!C2:C; Movimientos!C2:C, Movimientos!D2:D}, {Stock_3009!C2:C; Movimientos!D2:D} <> "")))'
        : null,
  }),
  Stock_3009: () => ({
    grupo: 'Datos del caso',
    nota: 'La foto de stock al 30/09/2026, tal como vino en el Excel del caso.',
    columnas: ['Codigo', 'Descripcion', 'Lote', 'Posicion', 'Stock'],
    filas: CASO.stock3009.map((s) => [s.codigo, s.descripcion, s.lote, s.posicion, s.stock]),
  }),
  Movimientos: () => ({
    grupo: 'Datos del caso',
    nota: `Los 40 movimientos del 01 al 14/10${estado.ajustes.length ? `, más ${estado.ajustes.length} ajustes y transferencias aprobados en la demo` : ''}. Ya traen signo.`,
    columnas: ['ID', 'Fecha', 'Codigo', 'Lote', 'Cantidad', 'UM', 'Tipo_Movimiento', 'Posicion', 'Motivo', 'Origen'],
    filas: estado.movimientos().map((m, i) => [
      `MOV-${String(i + 1).padStart(3, '0')}`, fechaCorta(m.fecha), m.codigo, m.lote, m.cantidad, m.um ?? 'UN', m.tipo, m.posicion, m.motivo ?? '', m.origen ?? 'CASO',
    ]),
  }),
  Conteo_1410: () => ({
    grupo: 'Captura',
    nota: 'Una fila por cada registro que llega desde la app. Nunca se borra: un reconteo deja la anterior en REEMPLAZADO.',
    columnas: ['ID', 'Fecha_Hora', 'Usuario', 'Rol', 'Campania', 'Tipo', 'Posicion', 'Codigo', 'Lote', 'Cantidad', 'Vacia', 'Estado', 'Dispositivo', 'Recibido'],
    filas: estado.registros.map((r) => [
      r.id, r.fechaHora.replace('T', ' '), r.usuario, r.rol, r.campania, r.tipo, r.posicion, r.codigo, r.lote, r.cantidad, siNo(r.vacia), r.estado, r.dispositivo, r.fechaHora.replace('T', ' '),
    ]),
  }),
  Log_API: () => ({
    grupo: 'Captura',
    nota: 'Cada llamada al Web App, con quién la hizo y qué respondió el servidor.',
    columnas: ['Fecha_Hora', 'Accion', 'Usuario', 'Resultado', 'Detalle'],
    filas: estado.log.map((l) => [l.fechaHora.replace('T', ' '), l.accion, l.usuario, l.resultado, l.detalle]),
  }),
  Conciliacion: () => {
    const filas = estado.conciliacion();
    const faltan = estado.cobertura().faltantes.length;
    return {
      grupo: 'Resultados',
      nota: `Teórico contra físico por clave, todo con fórmulas: tocá una celda para ver la suya.${faltan ? ` Faltan relevar ${faltan} posiciones.` : ''}`,
      columnas: ['Clave', 'Codigo', 'Descripcion', 'Lote', 'Posicion', 'Stock_3009', 'Ingresos', 'Salidas', 'Ajustes', 'Teorico_1410', 'Fisico_1410', 'Diferencia', 'Tolerancia', 'Clasificacion', 'Causa', 'Accion', 'Aprobado_por'],
      filas: filas.map((f) => [f.clave, f.codigo, f.descripcion, f.lote, f.posicion, f.stockInicial, f.ingresos, f.salidas, f.ajustes, f.teorico, f.fisico, f.diferencia, f.tolerancia, f.clasificacion, '', '', '']),
      formula: (fila, col) => formulasConciliacion(fila + 2)[col] ?? null,
      inicial: [0, 6],
      claseFila: (fila) => filas[fila]?.clasificacion,
    };
  },
  Resumen: () => {
    const ind = estado.indicadores();
    const C = 'Conciliacion';
    const filas = [
      ['Claves conciliadas', ind.claves, `=COUNTA(${C}!A2:A)`],
      ['Claves sin diferencia', ind.clavesOk, `=COUNTIF(${C}!N2:N,"OK")`],
      ['Claves con diferencia', ind.clavesConDiferencia, '=B2-B3'],
      ['Exactitud por clave', porcentaje(ind.exactitudPorClave), '=IFERROR(B3/B2,0)'],
      ['Posiciones del alcance', ind.posiciones, '=COUNTA(Maestro_Posiciones!A2:A)'],
      ['Posiciones con diferencia', ind.posiciones - ind.posicionesSinDiferencia, `=IFERROR(COUNTUNIQUE(FILTER(${C}!E2:E,${C}!N2:N<>"OK",${C}!N2:N<>"")),0)`],
      ['Exactitud por posición', porcentaje(ind.exactitudPorPosicion), '=IFERROR((B6-B7)/B6,0)'],
      [
        'Posiciones relevadas',
        estado.cobertura().relevadas.length,
        '=IFERROR(COUNTUNIQUE(FILTER(CONTEO_POSICION,CONTEO_ESTADO="VALIDO",CONTEO_CAMPANIA=CAMPANIA)),0)',
      ],
      ['Teórico total (u.)', entero(ind.teoricoTotal), `=SUM(${C}!J2:J)`],
      ['Físico total (u.)', entero(ind.fisicoTotal), `=SUM(${C}!K2:K)`],
      ['Diferencia neta (u.)', entero(ind.diferenciaNeta), '=B11-B10'],
      ['Unidades faltantes', entero(ind.unidadesFaltantes), `=-SUMIFS(${C}!L2:L,${C}!L2:L,"<0",${C}!N2:N,"<>UBICACION",${C}!N2:N,"<>OK")`],
      ['Unidades sobrantes', entero(ind.unidadesSobrantes), `=SUMIFS(${C}!L2:L,${C}!L2:L,">0",${C}!N2:N,"<>UBICACION",${C}!N2:N,"<>OK")`],
    ];
    return {
      grupo: 'Resultados',
      nota: 'Los indicadores del cierre, también con fórmulas sobre Conciliacion.',
      columnas: ['Indicador', 'Valor'],
      filas: filas.map(([a, b]) => [a, b]),
      formula: (fila, col) => (col === 1 ? filas[fila][2] : null),
      inicial: [3, 1],
    };
  },
};

const ORDEN = ['Parametros', 'Maestro_Materiales', 'Maestro_Posiciones', 'Maestro_Lotes', 'Stock_3009', 'Movimientos', 'Conteo_1410', 'Log_API', 'Conciliacion', 'Resumen'];

let hojaActual = 'Conciliacion';
let seleccion = null;

function pintarHojas() {
  const lista = document.querySelector('[data-zona="hojas-lista"]');
  const grupos = new Map();
  ORDEN.forEach((nombre) => {
    const { grupo, filas } = HOJAS[nombre]();
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo).push([nombre, filas.length]);
  });
  pintar(
    lista,
    html`${[...grupos].map(
      ([grupo, hojas]) => html`<li class="hojas-grupo"><span>${grupo}</span>
        <ul>${hojas.map(
          ([nombre, n]) => html`<li><button type="button" class="hoja-pestania" data-hoja="${nombre}" aria-pressed="${String(nombre === hojaActual)}">
            <span class="mono">${nombre}</span><small>${n} ${n === 1 ? 'fila' : 'filas'}</small></button></li>`,
        )}</ul></li>`,
    )}`,
  );
  pintarHoja();
}

function pintarHoja() {
  const hoja = HOJAS[hojaActual]();
  if (!seleccion) seleccion = hoja.inicial ?? [0, 0];
  const [filaSel, colSel] = seleccion;
  document.querySelector('[data-zona="hoja-nombre"]').textContent = hojaActual;
  document.querySelector('[data-zona="hoja-nota"]').textContent = hoja.nota;
  const valor = hoja.filas[filaSel]?.[colSel];
  const formula = hoja.formula?.(filaSel, colSel);
  document.querySelector('[data-zona="hoja-celda"]').textContent = hoja.filas.length ? `${letra(colSel)}${filaSel + 2}` : '';
  const fx = document.querySelector('[data-zona="hoja-fx"]');
  fx.textContent = formula ?? (valor === undefined ? '' : String(valor));
  fx.classList.toggle('es-formula', Boolean(formula));

  pintar(
    document.querySelector('[data-zona="hoja-grilla"]'),
    html`<table class="grilla">
      <thead>
        <tr><th class="esquina"></th>${hoja.columnas.map((_, i) => html`<th>${letra(i)}</th>`)}</tr>
        <tr class="encabezados"><th>1</th>${hoja.columnas.map((c) => html`<td>${c}</td>`)}</tr>
      </thead>
      <tbody>
        ${hoja.filas.length
          ? hoja.filas.map(
              (fila, f) => html`<tr class="${hoja.claseFila?.(f) ?? ''}"><th>${f + 2}</th>${fila.map(
                (v, c) => html`<td class="${typeof v === 'number' ? 'num' : ''} ${f === filaSel && c === colSel ? 'sel' : ''} ${hoja.formula?.(f, c) ? 'con-formula' : ''}"
                  data-celda="${f},${c}">${v ?? ''}</td>`,
              )}</tr>`,
            )
          : html`<tr><th>2</th><td colspan="${hoja.columnas.length}" class="tenue">Vacía por ahora: se llena desde la app.</td></tr>`}
      </tbody>
    </table>`,
  );
}

export function iniciarPlanilla() {
  document.querySelector('[data-zona="hojas-lista"]').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-hoja]');
    if (!boton) return;
    hojaActual = boton.dataset.hoja;
    seleccion = null;
    pintarHojas();
  });
  document.querySelector('[data-zona="hoja-grilla"]').addEventListener('click', (e) => {
    const celda = e.target.closest('[data-celda]');
    if (!celda) return;
    seleccion = celda.dataset.celda.split(',').map(Number);
    pintarHoja();
  });
  document.querySelector('[data-accion="repetir-viaje"]').addEventListener('click', (e) => {
    e.currentTarget.blur();
    volverAlPaso(0);
  });
}

registrarDiapo('hojas', {
  alEntrar: pintarHojas,
});
