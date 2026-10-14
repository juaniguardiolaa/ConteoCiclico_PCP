// Registros de conteo (hoja Conteo_1410): alta idempotente y reconteos.
// Nunca se borra una fila: un reconteo deja la anterior en REEMPLAZADO.

export const TIPOS_REGISTRO = ['CONTEO', 'RECONTEO'];

/** Posiciones que ya tienen un registro VALIDO en la campaña (validación 2). */
export function posicionesRegistradas(registros, campania) {
  return new Set(
    registros.filter((r) => r.estado === 'VALIDO' && r.campania === campania).map((r) => r.posicion),
  );
}

/** Arma un registro con todas las columnas de Conteo_1410. Una posición vacía va con cantidad 0. */
export function crearRegistro({
  id,
  fechaHora,
  usuario,
  rol = '',
  campania,
  tipo = 'CONTEO',
  posicion,
  codigo = '',
  lote = '',
  cantidad = '',
  vacia = false,
  dispositivo = '',
}) {
  // Una cantidad vacía se deja vacía (no 0) para que la validación 6 la detecte.
  const sinCantidad = cantidad === '' || cantidad === null || cantidad === undefined;
  return {
    id,
    fechaHora,
    usuario: String(usuario ?? '').trim(),
    rol,
    campania,
    tipo,
    posicion,
    codigo: vacia ? '' : codigo,
    lote: vacia ? '' : lote,
    cantidad: vacia ? 0 : sinCantidad ? '' : Number(cantidad),
    vacia: Boolean(vacia),
    estado: 'VALIDO',
    dispositivo,
  };
}

/**
 * Agrega un registro ya validado. Devuelve la lista nueva y el resultado, sin modificar la original.
 * - Mismo ID ya cargado: responde OK sin duplicar (validación 7, envío idempotente).
 * - RECONTEO: el registro VALIDO anterior de esa posición pasa a REEMPLAZADO.
 */
export function agregarRegistro(registros, registro) {
  if (registros.some((r) => r.id === registro.id)) {
    return {
      registros,
      resultado: { ok: true, codigo: 'YA_REGISTRADO', mensaje: 'El registro ya estaba cargado; no se duplicó.' },
    };
  }
  const actualizados = registros.map((r) =>
    registro.tipo === 'RECONTEO' &&
    r.estado === 'VALIDO' &&
    r.campania === registro.campania &&
    r.posicion === registro.posicion
      ? { ...r, estado: 'REEMPLAZADO' }
      : r,
  );
  actualizados.push({ ...registro, estado: 'VALIDO' });
  return {
    registros: actualizados,
    resultado: { ok: true, codigo: 'REGISTRADO', mensaje: `Posición ${registro.posicion} registrada.` },
  };
}

/**
 * Convierte una foto de stock físico (la hoja Stock 1410 del enunciado) en los registros que
 * cargaría un operario: una lectura por posición ocupada y una lectura «vacía» por cada posición
 * sin stock. Se usa en los tests y en el botón «Precargar el conteo del caso» del modo demo.
 */
export function registrosDesdeStockFisico(stockFisico, posiciones, base) {
  const ocupadas = new Map();
  for (const s of stockFisico) {
    if (s.posicion) ocupadas.set(s.posicion, s);
  }
  return posiciones.map((posicion, i) => {
    const s = ocupadas.get(posicion);
    return crearRegistro({
      ...base,
      id: `${base.campania}-${posicion}-${i}`,
      posicion,
      codigo: s?.codigo,
      lote: s?.lote,
      cantidad: s?.stock ?? 0,
      vacia: !s,
    });
  });
}
