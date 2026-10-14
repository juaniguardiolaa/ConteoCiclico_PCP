// Generado por scripts/generar-apps-script.mjs desde docs/js/dominio. No editar a mano: correr npm run apps-script.
// Son las mismas funciones que usa la app, para que el servidor valide y concilie igual.

// ---- docs/js/dominio/conciliacion.js ----

// Conciliación de inventarios: stock teórico al 14/10 contra el conteo físico, por
// Codigo|Lote|Posicion. Funciones puras: las usan los tests, el modo demo y la pantalla de
// resultados. El Sheet hace la misma cuenta con fórmulas SUMIFS (apps-script/Code.gs).
//
//   Teórico = Stock 30/09 + Σ movimientos entre `desde` y `hasta` (ya traen signo)
//   Físico  = Σ registros de conteo VALIDO de la campaña
//   Diferencia = Físico − Teórico

const SIN_LOTE = 'SIN_LOTE';
const SIN_POS = 'SIN_POS';

const CLASIFICACIONES = ['OK', 'FALTANTE', 'SOBRANTE', 'UBICACION', 'NO_REGISTRADO'];

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
function categoriaMovimiento(tipo) {
  return CATEGORIA_POR_TIPO[sinTildes(tipo)] ?? 'ajustes';
}

function claveDe(codigo, lote, posicion) {
  return `${codigo}|${lote || SIN_LOTE}|${posicion || SIN_POS}`;
}

/** Pares Codigo|Lote que el sistema conoce (Maestro_Lotes): los del stock inicial y los de movimientos. */
function paresMaterialLote(stock3009, movimientos) {
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
function conciliar({
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

// ---- docs/js/dominio/registros.js ----

// Registros de conteo (hoja Conteo_1410): alta idempotente y reconteos.
// Nunca se borra una fila: un reconteo deja la anterior en REEMPLAZADO.

const TIPOS_REGISTRO = ['CONTEO', 'RECONTEO'];

/** Posiciones que ya tienen un registro VALIDO en la campaña (validación 2). */
function posicionesRegistradas(registros, campania) {
  return new Set(
    registros.filter((r) => r.estado === 'VALIDO' && r.campania === campania).map((r) => r.posicion),
  );
}

/** Arma un registro con todas las columnas de Conteo_1410. Una posición vacía va con cantidad 0. */
function crearRegistro({
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
function agregarRegistro(registros, registro) {
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
 * Lo que ve el celular: los registros del servidor más los que todavía están en la cola sin enviar
 * (marcados con `pendiente: true`). Así el mapa muestra la posición como contada y la validación 2
 * detecta un duplicado aunque el primer registro no haya llegado al servidor.
 */
function combinarPendientes(registros, pendientes, campania) {
  let combinados = registros;
  for (const { registro } of pendientes) {
    if (registro.campania !== campania) continue;
    combinados = agregarRegistro(combinados, { ...registro, pendiente: true }).registros;
  }
  return combinados;
}

/**
 * Convierte una foto de stock físico (la hoja Stock 1410 del enunciado) en los registros que
 * cargaría un operario: una lectura por posición ocupada y una lectura «vacía» por cada posición
 * sin stock. Se usa en los tests y en el botón «Precargar el conteo del caso» del modo demo.
 */
function registrosDesdeStockFisico(stockFisico, posiciones, base) {
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

// ---- docs/js/dominio/validaciones.js ----

// Validaciones del conteo, en el mismo orden que el diagrama de flujo (Hoja 1).
// La app las aplica para responder al instante y Apps Script las repite antes de escribir.
//
//   1 la posición existe              5 cantidad entera entre 0 y 9999
//   2 la posición no está registrada  6 ningún campo obligatorio vacío
//   3 material existe, lote L####     7 ID único (se resuelve en agregarRegistro)
//   4 par material-lote conocido (solo advertencia)
//
// Cada función devuelve { ok: true } o { ok: false, codigo, mensaje }. La regla 4 devuelve
// ok: true con una `advertencia`, porque bloquearla impediría detectar stock no registrado.


const CANTIDAD_MAXIMA = 9999;
const RE_LOTE = /^L\d{4}$/;

const bien = (extra = {}) => ({ ok: true, ...extra });
const mal = (codigo, mensaje) => ({ ok: false, codigo, mensaje });

/**
 * Reúne los maestros y el estado de la campaña que necesitan las validaciones.
 * `lotes` es Maestro_Lotes ('PROD001|L0005'); si no viene, se arma con stock3009 y movimientos.
 */
function crearContexto({
  posiciones,
  materiales,
  lotes,
  stock3009 = [],
  movimientos = [],
  registros = [],
  campania,
  reconteos = [],
}) {
  return {
    posiciones: new Set(posiciones.map((p) => p.posicion ?? p)),
    materiales: new Set(materiales.map((m) => m.codigo ?? m)),
    lotesConocidos: lotes ? new Set(lotes) : paresMaterialLote(stock3009, movimientos),
    registradas: posicionesRegistradas(registros, campania),
    reconteosPedidos: new Set(reconteos),
  };
}

/** Validaciones 1 y 2. `tipo` es CONTEO o RECONTEO. */
function validarPosicion(posicion, ctx, tipo = 'CONTEO') {
  if (!posicion) return mal('CAMPO_VACIO', 'Falta la posición.');
  if (!ctx.posiciones.has(posicion)) {
    return mal('POSICION_INEXISTENTE', `La posición ${posicion} no existe en el maestro. Volvé a escanear.`);
  }
  if (tipo === 'RECONTEO') {
    if (!ctx.reconteosPedidos.has(posicion)) {
      return mal('RECONTEO_NO_PEDIDO', `Control no pidió reconteo de la posición ${posicion}.`);
    }
    return bien();
  }
  if (ctx.registradas.has(posicion)) {
    return mal(
      'POSICION_DUPLICADA',
      `La posición ${posicion} ya se registró en esta campaña. Pasá a la siguiente; ` +
        'si hay que volver a contarla, Control tiene que pedir un reconteo.',
    );
  }
  return bien();
}

/** Validaciones 3 y 4. */
function validarProducto(codigo, lote, ctx) {
  if (!codigo) return mal('CAMPO_VACIO', 'Falta el código de material.');
  if (!ctx.materiales.has(codigo)) {
    return mal('MATERIAL_INEXISTENTE', `El material ${codigo} no existe en el maestro. Volvé a escanear.`);
  }
  if (!lote) return mal('CAMPO_VACIO', 'Falta el lote.');
  if (!RE_LOTE.test(lote)) {
    return mal('LOTE_FORMATO', `El lote ${lote} no tiene el formato L más 4 dígitos (por ejemplo L0005).`);
  }
  if (!ctx.lotesConocidos.has(`${codigo}|${lote}`)) {
    return bien({
      advertencia: {
        codigo: 'LOTE_DESCONOCIDO',
        mensaje:
          `El lote ${lote} no figura para ${codigo} en el stock ni en los movimientos. ` +
          'Si está físicamente en la posición, confirmá para registrarlo: la conciliación lo va a marcar como NO_REGISTRADO.',
      },
    });
  }
  return bien();
}

/** Valida lo que devolvió leerEtiqueta() cuando la pantalla espera una posición. */
function validarLecturaPosicion(lectura, ctx, tipo = 'CONTEO') {
  if (lectura.tipo === 'PRODUCTO') {
    return mal('ETIQUETA_EQUIVOCADA', 'Se leyó una etiqueta de producto. Escaneá la etiqueta de la posición.');
  }
  if (lectura.tipo !== 'POSICION') return mal('ETIQUETA_INVALIDA', `No se reconoce la etiqueta «${lectura.texto ?? ''}».`);
  return validarPosicion(lectura.posicion, ctx, tipo);
}

/** Valida lo que devolvió leerEtiqueta() cuando la pantalla espera un producto-lote. */
function validarLecturaProducto(lectura, ctx) {
  if (lectura.tipo === 'POSICION') {
    return mal('ETIQUETA_EQUIVOCADA', 'Se leyó una etiqueta de posición. Escaneá la etiqueta del producto.');
  }
  if (lectura.tipo !== 'PRODUCTO') return mal('ETIQUETA_INVALIDA', `No se reconoce la etiqueta «${lectura.texto ?? ''}».`);
  return validarProducto(lectura.codigo, lectura.lote, ctx);
}

/** Validación 5. Acepta número o texto; si es válida devuelve también `valor` numérico. */
function validarCantidad(entrada) {
  const texto = String(entrada ?? '').trim();
  if (texto === '') return mal('CAMPO_VACIO', 'Falta la cantidad.');
  if (!/^[+-]?\d+([.,]\d+)?$/.test(texto)) return mal('CANTIDAD_INVALIDA', 'La cantidad tiene que ser un número.');
  const valor = Number(texto.replace(',', '.'));
  if (valor < 0) return mal('CANTIDAD_INVALIDA', 'La cantidad no puede ser negativa.');
  if (!Number.isInteger(valor)) return mal('CANTIDAD_INVALIDA', 'La cantidad tiene que ser un número entero.');
  if (valor > CANTIDAD_MAXIMA) {
    return mal('CANTIDAD_FUERA_DE_RANGO', `La cantidad supera el máximo de ${CANTIDAD_MAXIMA}. Revisá el conteo.`);
  }
  return bien({ valor });
}

/**
 * Validación completa de un registro antes de enviarlo o de escribirlo (reglas 1, 2, 3, 5 y 6).
 * La advertencia de la regla 4 no bloquea: se confirma en la pantalla del producto.
 */
function validarRegistro(registro, ctx) {
  const obligatorios = [
    ['id', 'el identificador del registro'],
    ['usuario', 'el usuario'],
    ['campania', 'la campaña'],
    ['tipo', 'el tipo de registro'],
    ['posicion', 'la posición'],
  ];
  for (const [campo, nombre] of obligatorios) {
    if (!String(registro[campo] ?? '').trim()) return mal('CAMPO_VACIO', `Falta ${nombre}.`);
  }
  if (!['CONTEO', 'RECONTEO'].includes(registro.tipo)) {
    return mal('TIPO_INVALIDO', `El tipo ${registro.tipo} no es CONTEO ni RECONTEO.`);
  }

  const posicion = validarPosicion(registro.posicion, ctx, registro.tipo);
  if (!posicion.ok) return posicion;

  if (registro.vacia) {
    if (registro.codigo || registro.lote || Number(registro.cantidad) !== 0) {
      return mal('VACIA_CON_DATOS', 'Una posición vacía no lleva material, lote ni cantidad.');
    }
    return bien();
  }

  const producto = validarProducto(registro.codigo, registro.lote, ctx);
  if (!producto.ok) return producto;

  const cantidad = validarCantidad(registro.cantidad);
  if (!cantidad.ok) return cantidad;

  return producto.advertencia ? bien({ advertencia: producto.advertencia }) : bien();
}

// ---- docs/js/dominio/indicadores.js ----

// Indicadores del cierre (hoja Resumen) y control de cobertura del conteo.

/**
 * @param {object[]} filas       resultado de conciliar()
 * @param {string[]} posiciones  las posiciones del alcance (A1–G4)
 * @param {{codigo:string, descripcion:string}[]} [materiales] para listar también los materiales sin diferencia
 */
function calcularIndicadores(filas, posiciones, materiales = []) {
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
function cobertura(registros, posiciones, campania) {
  const relevadas = new Set(
    registros.filter((r) => r.estado === 'VALIDO' && r.campania === campania).map((r) => r.posicion),
  );
  return {
    total: posiciones.length,
    relevadas: posiciones.filter((p) => relevadas.has(p)),
    faltantes: posiciones.filter((p) => !relevadas.has(p)),
  };
}
