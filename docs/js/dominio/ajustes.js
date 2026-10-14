// Análisis de diferencias y ajustes (Hoja 2 del diagrama, fase 4): de las filas de la conciliación
// con Acción «Ajuste» o «Transferencia» y Aprobado_por completo, arma los movimientos que dejan el
// teórico igual al físico. La cantidad de cada movimiento es la diferencia (físico − teórico).
//
//   Ajuste         -> Ajuste_Inventario_Ciclico en esa posición
//   Transferencia  -> Transferencia_Posicion: sale de la posición donde falta y entra donde sobra;
//                     las filas del mismo material-lote tienen que sumar cero (error de ubicación).

export const TIPO_POR_ACCION = {
  Ajuste: 'Ajuste_Inventario_Ciclico',
  Transferencia: 'Transferencia_Posicion',
};

const lleno = (v) => String(v ?? '').trim() !== '';

/**
 * @param {{codigo:string, lote:string, posicion:string, diferencia:number, causa?:string,
 *          accion?:string, aprobadoPor?:string}[]} filas  filas de la hoja Conciliacion
 * @param {{fecha:string, campania:string}} datos  fecha del movimiento (la del conteo) y campaña
 * @returns {{movimientos:object[], sinAprobar:object[], errores:string[]}}
 */
export function movimientosDeAjuste(filas, { fecha, campania }) {
  const candidatas = filas.filter((f) => f.accion in TIPO_POR_ACCION && Number(f.diferencia) !== 0);
  const sinAprobar = candidatas.filter((f) => !lleno(f.aprobadoPor));
  const aprobadas = candidatas.filter((f) => lleno(f.aprobadoPor));

  const errores = [];
  const descartadas = new Set();
  const transferencias = new Map();
  for (const f of aprobadas.filter((x) => x.accion === 'Transferencia')) {
    const par = `${f.codigo}|${f.lote}`;
    transferencias.set(par, [...(transferencias.get(par) ?? []), f]);
  }
  for (const [par, grupo] of transferencias) {
    const neto = grupo.reduce((t, f) => t + Number(f.diferencia), 0);
    if (grupo.length < 2 || neto !== 0) {
      errores.push(
        `La transferencia de ${par} no cierra: las posiciones ${grupo.map((f) => f.posicion).join(', ')} suman ${neto}. ` +
          'Marcá como Transferencia y aprobá las dos posiciones (la que falta y la que sobra).',
      );
      grupo.forEach((f) => descartadas.add(f));
    }
  }

  const movimientos = aprobadas
    .filter((f) => !descartadas.has(f))
    .map((f) => ({
      fecha,
      codigo: f.codigo,
      lote: f.lote,
      cantidad: Number(f.diferencia),
      tipo: TIPO_POR_ACCION[f.accion],
      posicion: f.posicion,
      motivo: `${lleno(f.causa) ? f.causa : 'Sin causa'}. Aprobó ${String(f.aprobadoPor).trim()}. Conteo ${campania}.`,
      origen: f.accion === 'Transferencia' ? 'TRANSFERENCIA' : 'AJUSTE_CONTEO',
    }));

  return { movimientos, sinAprobar, errores };
}
