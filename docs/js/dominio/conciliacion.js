// Conciliación de inventarios: stock teórico al 14/10 contra el conteo físico, por
// Codigo|Lote|Posicion. Funciones puras: las usan los tests, el modo demo y la pantalla de
// resultados. El Sheet hace la misma cuenta con fórmulas SUMIFS (apps-script/Code.gs).
//
//   Teórico = Stock 30/09 + Σ movimientos entre `desde` y `hasta` (ya traen signo)
//   Físico  = Σ registros de conteo VALIDO de la campaña
//   Diferencia = Físico − Teórico

export const SIN_LOTE = 'SIN_LOTE';
export const SIN_POS = 'SIN_POS';

export const CLASIFICACIONES = ['OK', 'FALTANTE', 'SOBRANTE', 'UBICACION', 'NO_REGISTRADO'];

// Columna de la conciliación en la que suma cada tipo de movimiento.
// Transferencia_Posicion no está en el caso: la agrega el análisis de diferencias.
const CATEGORIA_POR_TIPO = {
  Ingreso_Orden_Compra: 'ingresos',
  Retorno_Venta: 'ingresos',
  Salida_Venta: 'salidas',
  Consumo_Orden_Produccion: 'salidas',
  Ajuste_Inventario_Ciclico: 'ajustes',
  Ajuste_Inventario_Anual: 'ajustes',
  Transferencia_Posicion: 'ajustes',
};

const sinTildes = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

/** 'ingresos' | 'salidas' | 'ajustes'. Un tipo desconocido se toma como ajuste. */
export function categoriaMovimiento(tipo) {
  return CATEGORIA_POR_TIPO[sinTildes(tipo)] ?? 'ajustes';
}

export function claveDe(codigo, lote, posicion) {
  return `${codigo}|${lote || SIN_LOTE}|${posicion || SIN_POS}`;
}

/** Pares Codigo|Lote que el sistema conoce (Maestro_Lotes): los del stock inicial y los de movimientos. */
export function paresMaterialLote(stock3009, movimientos) {
  const pares = new Set();
  for (const fila of [...stock3009, ...movimientos]) {
    if (fila.lote) pares.add(`${fila.codigo}|${fila.lote}`);
  }
  return pares;
}

/**
 * @param {object} datos
 * @param {{codigo:string, descripcion:string, tolerancia?:number}[]} datos.materiales
 * @param {{codigo:string, lote:string, posicion:string, stock:number}[]} datos.stock3009
 * @param {{fecha:string, codigo:string, lote:string, posicion:string, cantidad:number, tipo:string}[]} datos.movimientos
 * @param {{codigo:string, lote:string, posicion:string, cantidad:number, vacia:boolean, estado:string, campania:string}[]} datos.registros
 * @param {string} datos.campania    campaña de conteo que se concilia
 * @param {string} datos.desde       primer día de movimientos (AAAA-MM-DD), inclusive
 * @param {string} datos.hasta       fecha de corte del conteo (AAAA-MM-DD), inclusive
 * @param {number} [datos.toleranciaDefecto=0]
 * @returns {object[]} una fila por clave, ordenada por posición, código y lote
 */
export function conciliar({
  materiales,
  stock3009,
  movimientos,
  registros,
  campania,
  desde,
  hasta,
  toleranciaDefecto = 0,
}) {
  const filas = new Map();
  const filaDe = (codigo, lote, posicion) => {
    const clave = claveDe(codigo, lote, posicion);
    if (!filas.has(clave)) {
      filas.set(clave, {
        clave,
        codigo,
        lote: lote || SIN_LOTE,
        posicion: posicion || SIN_POS,
        stockInicial: 0,
        ingresos: 0,
        salidas: 0,
        ajustes: 0,
        fisico: 0,
      });
    }
    return filas.get(clave);
  };

  for (const s of stock3009) {
    // Una fila sin lote ni posición y en cero solo dice que el material existe: no genera clave.
    if (!s.lote && !s.posicion && !Number(s.stock)) continue;
    filaDe(s.codigo, s.lote, s.posicion).stockInicial += Number(s.stock);
  }

  for (const m of movimientos) {
    if (m.fecha < desde || m.fecha > hasta) continue;
    filaDe(m.codigo, m.lote, m.posicion)[categoriaMovimiento(m.tipo)] += Number(m.cantidad);
  }

  for (const r of registros) {
    // Las posiciones vacías prueban que se recorrieron, pero no generan clave.
    if (r.estado !== 'VALIDO' || r.campania !== campania || r.vacia) continue;
    filaDe(r.codigo, r.lote, r.posicion).fisico += Number(r.cantidad);
  }

  const material = new Map(materiales.map((m) => [m.codigo, m]));
  const conocidos = paresMaterialLote(stock3009, movimientos);
  const resultado = [...filas.values()].map((f) => {
    const teorico = f.stockInicial + f.ingresos + f.salidas + f.ajustes;
    const tolerancia = material.get(f.codigo)?.tolerancia ?? toleranciaDefecto;
    return {
      ...f,
      descripcion: material.get(f.codigo)?.descripcion ?? '',
      teorico,
      diferencia: f.fisico - teorico,
      tolerancia,
    };
  });

  // Diferencia neta de cada Codigo|Lote sumando todas sus posiciones: si da dentro de la
  // tolerancia, el stock está pero en otra posición (error de ubicación).
  const netoPorLote = new Map();
  for (const f of resultado) {
    const par = `${f.codigo}|${f.lote}`;
    netoPorLote.set(par, (netoPorLote.get(par) ?? 0) + f.diferencia);
  }

  for (const f of resultado) {
    const par = `${f.codigo}|${f.lote}`;
    if (Math.abs(f.diferencia) <= f.tolerancia) f.clasificacion = 'OK';
    else if (!conocidos.has(par)) f.clasificacion = 'NO_REGISTRADO';
    else if (Math.abs(netoPorLote.get(par)) <= f.tolerancia) f.clasificacion = 'UBICACION';
    else f.clasificacion = f.diferencia < 0 ? 'FALTANTE' : 'SOBRANTE';
  }

  return resultado.sort(
    (a, b) =>
      a.posicion.localeCompare(b.posicion) || a.codigo.localeCompare(b.codigo) || a.lote.localeCompare(b.lote),
  );
}
