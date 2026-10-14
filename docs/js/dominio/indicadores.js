// Indicadores del cierre (hoja Resumen) y control de cobertura del conteo.

/**
 * @param {object[]} filas       resultado de conciliar()
 * @param {string[]} posiciones  las posiciones del alcance (A1–G4)
 * @param {{codigo:string, descripcion:string}[]} [materiales] para listar también los materiales sin diferencia
 */
export function calcularIndicadores(filas, posiciones, materiales = []) {
  const suma = (lista, campo) => lista.reduce((t, f) => t + f[campo], 0);
  const conDiferencia = filas.filter((f) => f.clasificacion !== 'OK');
  const posicionesConDiferencia = new Set(conDiferencia.map((f) => f.posicion));
  const posicionesSinDiferencia = posiciones.filter((p) => !posicionesConDiferencia.has(p)).length;

  // Faltantes y sobrantes reales: el error de ubicación suma cero y se informa aparte.
  const reales = conDiferencia.filter((f) => f.clasificacion !== 'UBICACION');

  const porClasificacion = Object.fromEntries(
    ['OK', 'FALTANTE', 'SOBRANTE', 'UBICACION', 'NO_REGISTRADO'].map((c) => [c, 0]),
  );
  for (const f of filas) porClasificacion[f.clasificacion] += 1;

  const porMaterial = new Map(
    materiales.map((m) => [m.codigo, { codigo: m.codigo, descripcion: m.descripcion, teorico: 0, fisico: 0, diferencia: 0 }]),
  );
  for (const f of filas) {
    if (!porMaterial.has(f.codigo)) {
      porMaterial.set(f.codigo, { codigo: f.codigo, descripcion: f.descripcion, teorico: 0, fisico: 0, diferencia: 0 });
    }
    const m = porMaterial.get(f.codigo);
    m.teorico += f.teorico;
    m.fisico += f.fisico;
    m.diferencia += f.diferencia;
  }

  return {
    claves: filas.length,
    clavesOk: porClasificacion.OK,
    clavesConDiferencia: conDiferencia.length,
    exactitudPorClave: filas.length ? porClasificacion.OK / filas.length : 1,
    posiciones: posiciones.length,
    posicionesSinDiferencia,
    exactitudPorPosicion: posiciones.length ? posicionesSinDiferencia / posiciones.length : 1,
    teoricoTotal: suma(filas, 'teorico'),
    fisicoTotal: suma(filas, 'fisico'),
    diferenciaNeta: suma(filas, 'diferencia'),
    unidadesFaltantes: -suma(reales.filter((f) => f.diferencia < 0), 'diferencia'),
    unidadesSobrantes: suma(reales.filter((f) => f.diferencia > 0), 'diferencia'),
    porClasificacion,
    porMaterial: [...porMaterial.values()].sort((a, b) => a.codigo.localeCompare(b.codigo)),
  };
}

/**
 * Decisión «¿Se relevaron todas las posiciones del alcance?» (Hoja 2 del diagrama).
 * Una posición está relevada si tiene un registro VALIDO en la campaña, aunque sea vacía.
 */
export function cobertura(registros, posiciones, campania) {
  const relevadas = new Set(
    registros.filter((r) => r.estado === 'VALIDO' && r.campania === campania).map((r) => r.posicion),
  );
  return {
    total: posiciones.length,
    relevadas: posiciones.filter((p) => relevadas.has(p)),
    faltantes: posiciones.filter((p) => !relevadas.has(p)),
  };
}
