// Conteo cíclico TP6: código completo del Web App y del menú de la planilla.
// Archivo generado: pegarlo entero en el editor de Apps Script (Extensiones > Apps Script).
// Las partes se editan por separado en apps-script/ del repositorio y se juntan con npm run apps-script.

// ==========================================================================================
// Datos.gs
// ==========================================================================================

// Generado por scripts/exportar-datos.mjs desde data/Historico_Transacciones_TP6_2026.xlsx. No editar a mano: correr npm run datos.
// stock1410 no se carga en el Sheet: es lo que se captura con la app.
const DATOS_CASO = {
  campania: "CC-2026-10-14",
  fechaStockInicial: "2026-09-30",
  fechaDesde: "2026-10-01",
  fechaConteo: "2026-10-14",
  materiales: [
    {"codigo":"PROD001","descripcion":"Pack de Medias x 3 Negro","um":"UN"},
    {"codigo":"PROD002","descripcion":"Pack de Medias x 3 Blanco","um":"UN"},
    {"codigo":"PROD003","descripcion":"Bolso 40cm largo Negro","um":"UN"},
    {"codigo":"PROD004","descripcion":"Remera Entrenamiento S Azul","um":"UN"},
    {"codigo":"PROD005","descripcion":"Remera Entrenamiento M Azul","um":"UN"},
    {"codigo":"PROD006","descripcion":"Remera Entrenamiento L Azul","um":"UN"},
    {"codigo":"PROD007","descripcion":"Remera Entrenamiento XL Azul","um":"UN"},
    {"codigo":"PROD008","descripcion":"Botella 0.5L entrenamiento","um":"UN"},
    {"codigo":"PROD009","descripcion":"Botella 0.75L entrenamiento","um":"UN"},
    {"codigo":"PROD010","descripcion":"Muñequera Negra","um":"UN"},
  ],
  posiciones: [
    {"posicion":"A1","bloque":1,"columna":"A","nivel":1},
    {"posicion":"A2","bloque":1,"columna":"A","nivel":2},
    {"posicion":"A3","bloque":1,"columna":"A","nivel":3},
    {"posicion":"A4","bloque":1,"columna":"A","nivel":4},
    {"posicion":"B1","bloque":1,"columna":"B","nivel":1},
    {"posicion":"B2","bloque":1,"columna":"B","nivel":2},
    {"posicion":"B3","bloque":1,"columna":"B","nivel":3},
    {"posicion":"B4","bloque":1,"columna":"B","nivel":4},
    {"posicion":"C1","bloque":1,"columna":"C","nivel":1},
    {"posicion":"C2","bloque":1,"columna":"C","nivel":2},
    {"posicion":"C3","bloque":1,"columna":"C","nivel":3},
    {"posicion":"C4","bloque":1,"columna":"C","nivel":4},
    {"posicion":"D1","bloque":1,"columna":"D","nivel":1},
    {"posicion":"D2","bloque":1,"columna":"D","nivel":2},
    {"posicion":"D3","bloque":1,"columna":"D","nivel":3},
    {"posicion":"D4","bloque":1,"columna":"D","nivel":4},
    {"posicion":"E1","bloque":2,"columna":"E","nivel":1},
    {"posicion":"E2","bloque":2,"columna":"E","nivel":2},
    {"posicion":"E3","bloque":2,"columna":"E","nivel":3},
    {"posicion":"E4","bloque":2,"columna":"E","nivel":4},
    {"posicion":"F1","bloque":2,"columna":"F","nivel":1},
    {"posicion":"F2","bloque":2,"columna":"F","nivel":2},
    {"posicion":"F3","bloque":2,"columna":"F","nivel":3},
    {"posicion":"F4","bloque":2,"columna":"F","nivel":4},
    {"posicion":"G1","bloque":2,"columna":"G","nivel":1},
    {"posicion":"G2","bloque":2,"columna":"G","nivel":2},
    {"posicion":"G3","bloque":2,"columna":"G","nivel":3},
    {"posicion":"G4","bloque":2,"columna":"G","nivel":4},
  ],
  tiposMovimiento: ["Ingreso_Orden_Compra","Ajuste_Inventario_Ciclico","Ajuste_Inventario_Anual","Consumo_Orden_Producción","Salida_Venta","Retorno_Venta"],
  stock3009: [
    {"codigo":"PROD001","descripcion":"Pack de Medias x 3 Negro","lote":"L0005","posicion":"B2","stock":300},
    {"codigo":"PROD002","descripcion":"Pack de Medias x 3 Blanco","lote":"L0110","posicion":"G4","stock":100},
    {"codigo":"PROD003","descripcion":"Bolso 40cm largo Negro","lote":"L0003","posicion":"A1","stock":20},
    {"codigo":"PROD003","descripcion":"Bolso 40cm largo Negro","lote":"L0009","posicion":"C4","stock":40},
    {"codigo":"PROD004","descripcion":"Remera Entrenamiento S Azul","lote":"L0064","posicion":"A4","stock":400},
    {"codigo":"PROD005","descripcion":"Remera Entrenamiento M Azul","lote":"L0100","posicion":"F2","stock":80},
    {"codigo":"PROD006","descripcion":"Remera Entrenamiento L Azul","lote":"","posicion":"","stock":0},
    {"codigo":"PROD007","descripcion":"Remera Entrenamiento XL Azul","lote":"","posicion":"","stock":0},
    {"codigo":"PROD008","descripcion":"Botella 0.5L entrenamiento","lote":"L0016","posicion":"G1","stock":12},
    {"codigo":"PROD008","descripcion":"Botella 0.5L entrenamiento","lote":"L0014","posicion":"D3","stock":24},
    {"codigo":"PROD009","descripcion":"Botella 0.75L entrenamiento","lote":"","posicion":"","stock":0},
    {"codigo":"PROD010","descripcion":"Muñequera Negra","lote":"L0001","posicion":"G2","stock":20},
    {"codigo":"PROD010","descripcion":"Muñequera Negra","lote":"L0002","posicion":"D1","stock":15},
  ],
  movimientos: [
    {"fecha":"2026-10-02","codigo":"PROD001","lote":"L0007","cantidad":560,"um":"UN","tipo":"Ingreso_Orden_Compra","posicion":"B3"},
    {"fecha":"2026-10-03","codigo":"PROD002","lote":"L0150","cantidad":230,"um":"UN","tipo":"Ingreso_Orden_Compra","posicion":"C3"},
    {"fecha":"2026-10-04","codigo":"PROD003","lote":"L0010","cantidad":60,"um":"UN","tipo":"Ingreso_Orden_Compra","posicion":"A2"},
    {"fecha":"2026-10-04","codigo":"PROD004","lote":"L0064","cantidad":-250,"um":"UN","tipo":"Salida_Venta","posicion":"A4"},
    {"fecha":"2026-10-04","codigo":"PROD005","lote":"L0110","cantidad":50,"um":"UN","tipo":"Ingreso_Orden_Compra","posicion":"F3"},
    {"fecha":"2026-10-04","codigo":"PROD006","lote":"L0120","cantidad":120,"um":"UN","tipo":"Ingreso_Orden_Compra","posicion":"E4"},
    {"fecha":"2026-10-05","codigo":"PROD010","lote":"L0003","cantidad":50,"um":"UN","tipo":"Ingreso_Orden_Compra","posicion":"A3"},
    {"fecha":"2026-10-05","codigo":"PROD010","lote":"L0001","cantidad":-10,"um":"UN","tipo":"Salida_Venta","posicion":"G2"},
    {"fecha":"2026-10-05","codigo":"PROD007","lote":"L0005","cantidad":25,"um":"UN","tipo":"Ingreso_Orden_Compra","posicion":"E3"},
    {"fecha":"2026-10-06","codigo":"PROD004","lote":"L0074","cantidad":200,"um":"UN","tipo":"Ingreso_Orden_Compra","posicion":"G3"},
    {"fecha":"2026-10-06","codigo":"PROD002","lote":"L0110","cantidad":-100,"um":"UN","tipo":"Salida_Venta","posicion":"G4"},
    {"fecha":"2026-10-06","codigo":"PROD003","lote":"L0010","cantidad":-12,"um":"UN","tipo":"Salida_Venta","posicion":"A2"},
    {"fecha":"2026-10-06","codigo":"PROD009","lote":"L0015","cantidad":100,"um":"UN","tipo":"Ingreso_Orden_Compra","posicion":"E2"},
    {"fecha":"2026-10-06","codigo":"PROD008","lote":"L0018","cantidad":50,"um":"UN","tipo":"Ingreso_Orden_Compra","posicion":"E1"},
    {"fecha":"2026-10-06","codigo":"PROD005","lote":"L0100","cantidad":-40,"um":"UN","tipo":"Salida_Venta","posicion":"F2"},
    {"fecha":"2026-10-07","codigo":"PROD001","lote":"L0005","cantidad":130,"um":"UN","tipo":"Retorno_Venta","posicion":"B2"},
    {"fecha":"2026-10-07","codigo":"PROD002","lote":"L0110","cantidad":100,"um":"UN","tipo":"Ajuste_Inventario_Ciclico","posicion":"G4"},
    {"fecha":"2026-10-07","codigo":"PROD003","lote":"L0010","cantidad":4,"um":"UN","tipo":"Ajuste_Inventario_Ciclico","posicion":"A2"},
    {"fecha":"2026-10-07","codigo":"PROD004","lote":"L0074","cantidad":-10,"um":"UN","tipo":"Salida_Venta","posicion":"G3"},
    {"fecha":"2026-10-07","codigo":"PROD005","lote":"L0100","cantidad":-40,"um":"UN","tipo":"Ajuste_Inventario_Ciclico","posicion":"F2"},
    {"fecha":"2026-10-07","codigo":"PROD006","lote":"L0070","cantidad":12,"um":"UN","tipo":"Ajuste_Inventario_Ciclico","posicion":"F4"},
    {"fecha":"2026-10-07","codigo":"PROD007","lote":"L0005","cantidad":1,"um":"UN","tipo":"Ajuste_Inventario_Ciclico","posicion":"E3"},
    {"fecha":"2026-10-07","codigo":"PROD008","lote":"L0016","cantidad":-2,"um":"UN","tipo":"Ajuste_Inventario_Ciclico","posicion":"G1"},
    {"fecha":"2026-10-07","codigo":"PROD009","lote":"L0015","cantidad":5,"um":"UN","tipo":"Ajuste_Inventario_Ciclico","posicion":"E2"},
    {"fecha":"2026-10-07","codigo":"PROD010","lote":"L0001","cantidad":-10,"um":"UN","tipo":"Ajuste_Inventario_Ciclico","posicion":"G2"},
    {"fecha":"2026-10-09","codigo":"PROD004","lote":"L0064","cantidad":-120,"um":"UN","tipo":"Salida_Venta","posicion":"A4"},
    {"fecha":"2026-10-09","codigo":"PROD010","lote":"L0001","cantidad":5,"um":"UN","tipo":"Retorno_Venta","posicion":"G2"},
    {"fecha":"2026-10-09","codigo":"PROD003","lote":"L0003","cantidad":-20,"um":"UN","tipo":"Salida_Venta","posicion":"A1"},
    {"fecha":"2026-10-09","codigo":"PROD001","lote":"L0005","cantidad":-260,"um":"UN","tipo":"Salida_Venta","posicion":"B2"},
    {"fecha":"2026-10-10","codigo":"PROD010","lote":"L0002","cantidad":-5,"um":"UN","tipo":"Salida_Venta","posicion":"D1"},
    {"fecha":"2026-10-10","codigo":"PROD002","lote":"L0110","cantidad":-100,"um":"UN","tipo":"Salida_Venta","posicion":"G4"},
    {"fecha":"2026-10-10","codigo":"PROD006","lote":"L0120","cantidad":-60,"um":"UN","tipo":"Salida_Venta","posicion":"E4"},
    {"fecha":"2026-10-10","codigo":"PROD003","lote":"L0009","cantidad":20,"um":"UN","tipo":"Retorno_Venta","posicion":"F1"},
    {"fecha":"2026-10-11","codigo":"PROD001","lote":"L0006","cantidad":100,"um":"UN","tipo":"Ingreso_Orden_Compra","posicion":"B4"},
    {"fecha":"2026-10-11","codigo":"PROD001","lote":"L0005","cantidad":-40,"um":"UN","tipo":"Salida_Venta","posicion":"B2"},
    {"fecha":"2026-10-11","codigo":"PROD001","lote":"L0007","cantidad":-60,"um":"UN","tipo":"Salida_Venta","posicion":"B3"},
    {"fecha":"2026-10-11","codigo":"PROD002","lote":"L0150","cantidad":-50,"um":"UN","tipo":"Salida_Venta","posicion":"C3"},
    {"fecha":"2026-10-12","codigo":"PROD008","lote":"L0016","cantidad":-10,"um":"UN","tipo":"Salida_Venta","posicion":"G1"},
    {"fecha":"2026-10-12","codigo":"PROD005","lote":"L0110","cantidad":-20,"um":"UN","tipo":"Salida_Venta","posicion":"F3"},
    {"fecha":"2026-10-13","codigo":"PROD001","lote":"L0007","cantidad":-20,"um":"UN","tipo":"Ajuste_Inventario_Ciclico","posicion":"B3"},
  ],
  stock1410: [
    {"codigo":"PROD001","descripcion":"Pack de Medias x 3 Negro","lote":"L0005","posicion":"B2","stock":120},
    {"codigo":"PROD001","descripcion":"Pack de Medias x 3 Negro","lote":"L0007","posicion":"B3","stock":490},
    {"codigo":"PROD001","descripcion":"Pack de Medias x 3 Negro","lote":"L0006","posicion":"B4","stock":100},
    {"codigo":"PROD002","descripcion":"Pack de Medias x 3 Blanco","lote":"L0110","posicion":"","stock":0},
    {"codigo":"PROD002","descripcion":"Pack de Medias x 3 Blanco","lote":"L0150","posicion":"C3","stock":180},
    {"codigo":"PROD003","descripcion":"Bolso 40cm largo Negro","lote":"L0003","posicion":"A1","stock":5},
    {"codigo":"PROD003","descripcion":"Bolso 40cm largo Negro","lote":"L0009","posicion":"C4","stock":40},
    {"codigo":"PROD003","descripcion":"Bolso 40cm largo Negro","lote":"L0009","posicion":"F2","stock":20},
    {"codigo":"PROD003","descripcion":"Bolso 40cm largo Negro","lote":"L0010","posicion":"A2","stock":45},
    {"codigo":"PROD004","descripcion":"Remera Entrenamiento S Azul","lote":"L0064","posicion":"A4","stock":20},
    {"codigo":"PROD004","descripcion":"Remera Entrenamiento S Azul","lote":"L0074","posicion":"G3","stock":180},
    {"codigo":"PROD005","descripcion":"Remera Entrenamiento M Azul","lote":"L0100","posicion":"","stock":0},
    {"codigo":"PROD005","descripcion":"Remera Entrenamiento M Azul","lote":"L0110","posicion":"F3","stock":30},
    {"codigo":"PROD006","descripcion":"Remera Entrenamiento L Azul","lote":"L0070","posicion":"F4","stock":10},
    {"codigo":"PROD006","descripcion":"Remera Entrenamiento L Azul","lote":"L0120","posicion":"E4","stock":60},
    {"codigo":"PROD007","descripcion":"Remera Entrenamiento XL Azul","lote":"L0005","posicion":"E3","stock":26},
    {"codigo":"PROD008","descripcion":"Botella 0.5L entrenamiento","lote":"L0016","posicion":"G1","stock":2},
    {"codigo":"PROD008","descripcion":"Botella 0.5L entrenamiento","lote":"L0018","posicion":"E1","stock":50},
    {"codigo":"PROD008","descripcion":"Botella 0.5L entrenamiento","lote":"L0014","posicion":"D3","stock":24},
    {"codigo":"PROD009","descripcion":"Botella 0.75L entrenamiento","lote":"L0015","posicion":"E2","stock":105},
    {"codigo":"PROD010","descripcion":"Muñequera Negra","lote":"L0001","posicion":"G2","stock":2},
    {"codigo":"PROD010","descripcion":"Muñequera Negra","lote":"L0002","posicion":"D1","stock":10},
    {"codigo":"PROD010","descripcion":"Muñequera Negra","lote":"L0003","posicion":"A3","stock":50},
  ],
};

// ==========================================================================================
// Dominio.gs
// ==========================================================================================

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

// ==========================================================================================
// Code.gs
// ==========================================================================================

// Conteo cíclico TP6: Web App y menú de la planilla de Google Sheets.
//
// La app del celular nunca escribe directo en la planilla: llama a este Web App, que vuelve a
// validar con las mismas reglas que la app (Dominio.gs se genera desde docs/js/dominio) y recién
// ahí escribe. Respuesta siempre { ok, codigo, mensaje, datos }.
//
// Este archivo se edita acá. Datos.gs y Dominio.gs se generan con npm run apps-script, que también
// arma conteo-ciclico.gs: el archivo único que se pega en el editor de Apps Script.

const VERSION_SERVIDOR = '0.5.1';
const ZONA = 'America/Argentina/Buenos_Aires';

const HOJAS = {
  PARAMETROS: 'Parametros',
  MATERIALES: 'Maestro_Materiales',
  POSICIONES: 'Maestro_Posiciones',
  LOTES: 'Maestro_Lotes',
  STOCK: 'Stock_3009',
  MOVIMIENTOS: 'Movimientos',
  CONTEO: 'Conteo_1410',
  CONCILIACION: 'Conciliacion',
  RESUMEN: 'Resumen',
  LOG: 'Log_API',
};

const ENCABEZADOS = {
  Parametros: ['Clave', 'Valor', 'Descripcion'],
  Maestro_Materiales: ['Codigo', 'Descripcion', 'UM', 'Clase_ABC', 'Tolerancia'],
  Maestro_Posiciones: ['Posicion', 'Bloque', 'Columna', 'Nivel'],
  Maestro_Lotes: ['Codigo', 'Lote'],
  Stock_3009: ['Codigo', 'Descripcion', 'Lote', 'Posicion', 'Stock'],
  Movimientos: ['ID', 'Fecha', 'Codigo', 'Lote', 'Cantidad', 'UM', 'Tipo_Movimiento', 'Posicion', 'Motivo', 'Origen'],
  Conteo_1410: ['ID', 'Fecha_Hora', 'Usuario', 'Rol', 'Campania', 'Tipo', 'Posicion', 'Codigo', 'Lote', 'Cantidad', 'Vacia', 'Estado', 'Dispositivo', 'Recibido'],
  Conciliacion: ['Clave', 'Codigo', 'Descripcion', 'Lote', 'Posicion', 'Stock_3009', 'Ingresos', 'Salidas', 'Ajustes', 'Teorico_1410', 'Fisico_1410', 'Diferencia', 'Tolerancia', 'Clasificacion', 'Causa', 'Accion', 'Aprobado_por'],
  Resumen: ['Indicador', 'Valor', 'Detalle'],
  Log_API: ['Fecha_Hora', 'Accion', 'Usuario', 'Resultado', 'Detalle'],
};

// Hojas con datos que no se deberían tocar a mano: avisan antes de editar.
const HOJAS_PROTEGIDAS = [HOJAS.STOCK, HOJAS.MOVIMIENTOS, HOJAS.CONTEO, HOJAS.LOG];

// ---------------------------------------------------------------------------------------------
// Menú de la planilla

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Inventario')
    .addItem('Configurar hojas del caso', 'setupHojas')
    .addItem('Ver token para la app', 'mostrarToken')
    .addSeparator()
    .addItem('Reiniciar la simulación (borra conteos)', 'reiniciarSimulacion')
    .addToUi();
}

/**
 * Crea las 10 hojas y carga los datos del caso. Se puede correr de nuevo sin duplicar nada:
 * solo carga una hoja de datos si está vacía y conserva el token.
 */
function setupHojas() {
  const libro = SpreadsheetApp.getActive();
  libro.setSpreadsheetTimeZone(ZONA);
  libro.setSpreadsheetLocale('es_AR');

  Object.values(HOJAS).forEach((nombre) => prepararHoja_(libro, nombre));

  cargarSiVacia_(HOJAS.MATERIALES, DATOS_CASO.materiales.map((m) => [m.codigo, m.descripcion, m.um, 'A', 0]));
  cargarSiVacia_(HOJAS.POSICIONES, DATOS_CASO.posiciones.map((p) => [p.posicion, p.bloque, p.columna, p.nivel]));
  cargarSiVacia_(HOJAS.STOCK, DATOS_CASO.stock3009.map((s) => [s.codigo, s.descripcion, s.lote, s.posicion, s.stock]));
  cargarSiVacia_(HOJAS.MOVIMIENTOS, movimientosDelCaso_());
  completarParametros_();

  // Maestro_Lotes es una fórmula: los pares material-lote que aparecen en el stock o en movimientos.
  hoja_(HOJAS.LOTES)
    .getRange('A2')
    .setFormula(
      '=SORT(UNIQUE(FILTER({Stock_3009!A2:A, Stock_3009!C2:C; Movimientos!C2:C, Movimientos!D2:D}, ' +
        '{Stock_3009!C2:C; Movimientos!D2:D} <> "")))',
    );

  hoja_(HOJAS.MOVIMIENTOS).getRange('B2:B').setNumberFormat('dd/mm/yyyy');
  hoja_(HOJAS.CONTEO).getRange('B2:B').setNumberFormat('dd/mm/yyyy hh:mm:ss');
  hoja_(HOJAS.CONTEO).getRange('N2:N').setNumberFormat('dd/mm/yyyy hh:mm:ss');
  hoja_(HOJAS.LOG).getRange('A2:A').setNumberFormat('dd/mm/yyyy hh:mm:ss');
  hoja_(HOJAS.PARAMETROS).getRange('B3:B5').setNumberFormat('dd/mm/yyyy');

  HOJAS_PROTEGIDAS.forEach((nombre) => {
    const h = hoja_(nombre);
    if (!h.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
      h.protect().setDescription('Datos de la app: no editar a mano').setWarningOnly(true);
    }
  });

  // La hoja vacía que trae un archivo nuevo ya no hace falta.
  libro.getSheets().forEach((h) => {
    if (!Object.values(HOJAS).includes(h.getName()) && h.getLastRow() === 0 && libro.getSheets().length > 1) {
      libro.deleteSheet(h);
    }
  });

  const resumen =
    `Listo. Stock_3009: ${hoja_(HOJAS.STOCK).getLastRow() - 1} filas, Movimientos: ${hoja_(HOJAS.MOVIMIENTOS).getLastRow() - 1}, ` +
    `materiales: ${hoja_(HOJAS.MATERIALES).getLastRow() - 1}, posiciones: ${hoja_(HOJAS.POSICIONES).getLastRow() - 1}.`;
  avisarEnPlanilla_(resumen);
  return resumen;
}

function mostrarToken() {
  avisarEnPlanilla_(
    `Token para la app: ${leerParametros_().TOKEN}\n\n` +
      'En la app: Ajustes, Conexión con Google Sheets. Pegá la URL del Web App (termina en /exec) y este token.',
  );
}

/** Deja la planilla como al principio de la simulación: sin conteos, sin conciliación y con los 40 movimientos del caso. */
function reiniciarSimulacion() {
  const ui = SpreadsheetApp.getUi();
  const respuesta = ui.alert(
    'Reiniciar la simulación',
    'Se borran los conteos, la conciliación, el resumen y el log, y Movimientos vuelve a los 40 del caso. ¿Seguir?',
    ui.ButtonSet.YES_NO,
  );
  if (respuesta !== ui.Button.YES) return;
  [HOJAS.CONTEO, HOJAS.CONCILIACION, HOJAS.RESUMEN, HOJAS.LOG, HOJAS.MOVIMIENTOS].forEach((nombre) => {
    const h = hoja_(nombre);
    if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, h.getMaxColumns()).clearContent();
  });
  cargarSiVacia_(HOJAS.MOVIMIENTOS, movimientosDelCaso_());
  avisarEnPlanilla_('Simulación reiniciada.');
}

// ---------------------------------------------------------------------------------------------
// Web App

const ACCIONES = {
  ping: { lectura: true, sinToken: true, atender: accionPing_ },
  parametros: { lectura: true, atender: accionParametros_ },
  maestros: { lectura: true, atender: accionMaestros_ },
  estado: { lectura: true, atender: accionEstado_ },
  conciliacion: { lectura: true, atender: accionConciliacion_ },
  registrar: { lectura: false, atender: accionRegistrar_ },
};

/** GET: ping y consultas (útil para probar desde el navegador o con curl). La app usa POST. Sin acción, es un ping. */
function doGet(e) {
  const parametros = Object.assign({}, (e && e.parameter) || {});
  if (!parametros.accion) parametros.accion = 'ping';
  return responder_(atender_(parametros, 'GET'));
}

/** POST con el cuerpo en JSON y Content-Type text/plain (así el navegador no hace preflight de CORS). */
function doPost(e) {
  let datos;
  try {
    datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    return responder_(atender_({ accion: '' }, 'POST', { ok: false, codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo no es JSON válido.' }));
  }
  return responder_(atender_(datos, 'POST'));
}

function atender_(datos, metodo, respuestaPrevia) {
  let respuesta = respuestaPrevia;
  lecturas_ = {}; // cada llamada lee cada hoja una sola vez
  if (!respuesta) {
    const accion = ACCIONES[datos.accion];
    try {
      if (!accion) respuesta = falla_('ACCION_DESCONOCIDA', `No existe la acción «${datos.accion || ''}».`);
      else if (metodo === 'GET' && !accion.lectura) respuesta = falla_('METODO_INVALIDO', `«${datos.accion}» se llama con POST.`);
      else if (!accion.sinToken && !tokenValido_(datos.token)) {
        respuesta = falla_('TOKEN_INVALIDO', 'El token no coincide con el de la hoja Parametros.');
      } else respuesta = accion.atender(datos);
    } catch (error) {
      respuesta = falla_('ERROR_SERVIDOR', String((error && error.message) || error));
    }
  }
  lecturas_ = null;
  registrarLog_(datos, respuesta);
  return respuesta;
}

function responder_(respuesta) {
  return ContentService.createTextOutput(JSON.stringify(respuesta)).setMimeType(ContentService.MimeType.JSON);
}

const exito_ = (datos, mensaje) => ({ ok: true, codigo: 'OK', mensaje: mensaje || '', datos });
const falla_ = (codigo, mensaje) => ({ ok: false, codigo, mensaje });

/** Responde aunque falten las hojas, para poder diagnosticar la instalación. */
function accionPing_(datos) {
  let hojasListas = true;
  let tokenValido = false;
  try {
    tokenValido = tokenValido_(datos.token);
  } catch (error) {
    hojasListas = false;
  }
  return {
    ok: true,
    codigo: 'PONG',
    mensaje: hojasListas
      ? 'El Web App responde.'
      : 'El Web App responde, pero la planilla no tiene las hojas: ejecutá setupHojas en el editor de Apps Script.',
    datos: { version: VERSION_SERVIDOR, hora: aIso_(new Date(), true), hojasListas, tokenValido },
  };
}

function accionParametros_() {
  const p = leerParametros_();
  return exito_({
    campania: p.CAMPANIA_ACTIVA,
    fechaConteo: p.FECHA_CONTEO,
    fechaStockInicial: p.FECHA_STOCK_INICIAL,
    fechaDesde: p.FECHA_DESDE,
  });
}

function accionMaestros_() {
  return exito_({ posiciones: leerPosiciones_(), materiales: leerMateriales_(), lotes: leerLotes_() });
}

function accionEstado_(datos) {
  const campania = datos.campania || leerParametros_().CAMPANIA_ACTIVA;
  const registros = leerRegistros_();
  return exito_({
    registros: registros.filter((r) => r.campania === campania).map(sinFila_),
    reconteos: leerReconteos_(registros),
  });
}

/** Conciliación calculada con la misma función que la app (las fórmulas de la hoja llegan en H6). */
function accionConciliacion_(datos) {
  const p = leerParametros_();
  const campania = datos.campania || p.CAMPANIA_ACTIVA;
  const registros = leerRegistros_();
  const materiales = leerMateriales_();
  const posiciones = leerPosiciones_().map((x) => x.posicion);
  const filas = conciliar({
    materiales,
    stock3009: leerStock_(),
    movimientos: leerMovimientos_(),
    registros,
    campania,
    desde: p.FECHA_DESDE,
    hasta: p.FECHA_CONTEO,
    toleranciaDefecto: Number(p.TOLERANCIA_DEFECTO) || 0,
  });
  return exito_({
    filas,
    indicadores: calcularIndicadores(filas, posiciones, materiales),
    cobertura: cobertura(registros, posiciones, campania),
  });
}

/**
 * Validaciones del servidor: 7 (ID único), campaña activa, y después 1, 2, 3, 5 y 6 con
 * validarRegistro(), la misma función que usa la app. Con LockService, dos operarios que envían
 * a la vez no se pisan.
 */
function accionRegistrar_(datos) {
  const registro = normalizarRegistro_(datos.registro || {});
  const candado = LockService.getScriptLock();
  if (!candado.tryLock(10000)) {
    return falla_('OCUPADO', 'La planilla está ocupada con otro envío; se reintenta solo.');
  }
  try {
    const registros = leerRegistros_();
    if (registro.id && registros.some((r) => r.id === registro.id)) {
      return { ok: true, codigo: 'YA_REGISTRADO', mensaje: 'El registro ya estaba en la planilla; no se duplicó.' };
    }
    const campania = leerParametros_().CAMPANIA_ACTIVA;
    if (registro.campania !== campania) {
      return falla_('CAMPANIA_INVALIDA', `La campaña activa es ${campania}, no ${registro.campania || '(vacía)'}.`);
    }

    const contexto = crearContexto({
      posiciones: leerPosiciones_(),
      materiales: leerMateriales_(),
      lotes: leerLotes_(),
      registros,
      campania,
      reconteos: leerReconteos_(registros),
    });
    const validacion = validarRegistro(registro, contexto);
    if (!validacion.ok) return validacion;

    const hoja = hoja_(HOJAS.CONTEO);
    if (registro.tipo === 'RECONTEO') {
      const columnaEstado = ENCABEZADOS.Conteo_1410.indexOf('Estado') + 1;
      registros
        .filter((r) => r.estado === 'VALIDO' && r.campania === campania && r.posicion === registro.posicion)
        .forEach((r) => hoja.getRange(r._fila, columnaEstado).setValue('REEMPLAZADO'));
    }
    hoja.appendRow([
      registro.id,
      deIso_(registro.fechaHora),
      registro.usuario,
      registro.rol,
      registro.campania,
      registro.tipo,
      registro.posicion,
      registro.codigo,
      registro.lote,
      registro.cantidad,
      registro.vacia ? 'SI' : 'NO',
      'VALIDO',
      registro.dispositivo,
      new Date(),
    ]);
    return { ok: true, codigo: 'REGISTRADO', mensaje: `Posición ${registro.posicion} enviada a la planilla.` };
  } finally {
    candado.releaseLock();
  }
}

// ---------------------------------------------------------------------------------------------
// Lectura de la planilla

function hoja_(nombre) {
  const libro = SpreadsheetApp.getActive();
  if (!libro) {
    throw new Error('El script no está vinculado a una planilla: hay que crearlo desde la planilla, con Extensiones → Apps Script.');
  }
  const h = libro.getSheetByName(nombre);
  if (!h) throw new Error(`Falta la hoja ${nombre}: corré «Inventario → Configurar hojas del caso».`);
  return h;
}

let lecturas_ = null;

/** Filas de una hoja como objetos con el nombre de cada columna; `_fila` es el número de fila en la hoja. */
function leerTabla_(nombre) {
  if (lecturas_ && lecturas_[nombre]) return lecturas_[nombre];
  const tabla = leerTablaSinCache_(nombre);
  if (lecturas_) lecturas_[nombre] = tabla;
  return tabla;
}

function leerTablaSinCache_(nombre) {
  const [encabezado, ...filas] = hoja_(nombre).getDataRange().getValues();
  return filas
    .map((fila, i) => {
      const objeto = { _fila: i + 2 };
      encabezado.forEach((columna, j) => (objeto[columna] = fila[j]));
      return objeto;
    })
    .filter((objeto) => encabezado.some((columna) => objeto[columna] !== '' && objeto[columna] !== null));
}

const texto_ = (valor) => (valor === null || valor === undefined ? '' : String(valor).trim());
const sinFila_ = ({ _fila, ...resto }) => resto;

function aIso_(valor, conHora) {
  if (valor instanceof Date) return Utilities.formatDate(valor, ZONA, conHora ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
  return texto_(valor);
}

function deIso_(iso) {
  const t = texto_(iso);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(t)) return Utilities.parseDate(t.replace('T', ' '), ZONA, 'yyyy-MM-dd HH:mm:ss');
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return Utilities.parseDate(t, ZONA, 'yyyy-MM-dd');
  return t;
}

function leerParametros_() {
  const parametros = {};
  leerTabla_(HOJAS.PARAMETROS).forEach((f) => (parametros[texto_(f.Clave)] = f.Valor instanceof Date ? aIso_(f.Valor) : f.Valor));
  return parametros;
}

function tokenValido_(token) {
  const esperado = texto_(leerParametros_().TOKEN);
  return Boolean(esperado) && texto_(token) === esperado;
}

function leerPosiciones_() {
  return leerTabla_(HOJAS.POSICIONES).map((f) => ({
    posicion: texto_(f.Posicion),
    bloque: Number(f.Bloque),
    columna: texto_(f.Columna),
    nivel: Number(f.Nivel),
  }));
}

function leerMateriales_() {
  const defecto = Number(leerParametros_().TOLERANCIA_DEFECTO) || 0;
  return leerTabla_(HOJAS.MATERIALES).map((f) => ({
    codigo: texto_(f.Codigo),
    descripcion: texto_(f.Descripcion),
    um: texto_(f.UM),
    claseAbc: texto_(f.Clase_ABC),
    tolerancia: f.Tolerancia === '' ? defecto : Number(f.Tolerancia),
  }));
}

function leerStock_() {
  return leerTabla_(HOJAS.STOCK).map((f) => ({
    codigo: texto_(f.Codigo),
    descripcion: texto_(f.Descripcion),
    lote: texto_(f.Lote),
    posicion: texto_(f.Posicion),
    stock: Number(f.Stock) || 0,
  }));
}

function leerMovimientos_() {
  return leerTabla_(HOJAS.MOVIMIENTOS).map((f) => ({
    id: texto_(f.ID),
    fecha: aIso_(f.Fecha),
    codigo: texto_(f.Codigo),
    lote: texto_(f.Lote),
    cantidad: Number(f.Cantidad) || 0,
    um: texto_(f.UM),
    tipo: texto_(f.Tipo_Movimiento),
    posicion: texto_(f.Posicion),
    motivo: texto_(f.Motivo),
    origen: texto_(f.Origen),
  }));
}

/** Pares material-lote conocidos. Se calculan acá (igual que la fórmula de Maestro_Lotes) para no depender del recálculo. */
function leerLotes_() {
  return [...paresMaterialLote(leerStock_(), leerMovimientos_())].sort();
}

function leerRegistros_() {
  return leerTabla_(HOJAS.CONTEO).map((f) => ({
    _fila: f._fila,
    id: texto_(f.ID),
    fechaHora: aIso_(f.Fecha_Hora, true),
    usuario: texto_(f.Usuario),
    rol: texto_(f.Rol),
    campania: texto_(f.Campania),
    tipo: texto_(f.Tipo),
    posicion: texto_(f.Posicion),
    codigo: texto_(f.Codigo),
    lote: texto_(f.Lote),
    cantidad: f.Cantidad === '' ? '' : Number(f.Cantidad),
    vacia: texto_(f.Vacia).toUpperCase() === 'SI',
    estado: texto_(f.Estado),
    dispositivo: texto_(f.Dispositivo),
  }));
}

/** Posiciones con reconteo pedido (Accion = Reconteo en Conciliacion) que todavía no se recontaron. */
function leerReconteos_(registros) {
  const recontadas = new Set(
    registros.filter((r) => r.estado === 'VALIDO' && r.tipo === 'RECONTEO').map((r) => r.posicion),
  );
  return [
    ...new Set(
      leerTabla_(HOJAS.CONCILIACION)
        .filter((f) => texto_(f.Accion).toLowerCase() === 'reconteo')
        .map((f) => texto_(f.Posicion))
        .filter((p) => p && !recontadas.has(p)),
    ),
  ];
}

/** Tipos y valores por defecto del registro que manda la app, sin confiar en lo que venga. */
function normalizarRegistro_(r) {
  const vacia = r.vacia === true || texto_(r.vacia).toUpperCase() === 'SI';
  const cantidad = r.cantidad === '' || r.cantidad === null || r.cantidad === undefined ? '' : Number(r.cantidad);
  return {
    id: texto_(r.id),
    fechaHora: texto_(r.fechaHora) || aIso_(new Date(), true),
    usuario: texto_(r.usuario),
    rol: texto_(r.rol),
    campania: texto_(r.campania),
    tipo: texto_(r.tipo) || 'CONTEO',
    posicion: texto_(r.posicion).toUpperCase(),
    codigo: vacia ? '' : texto_(r.codigo).toUpperCase(),
    lote: vacia ? '' : texto_(r.lote).toUpperCase(),
    cantidad: vacia ? 0 : cantidad,
    vacia,
    estado: 'VALIDO',
    dispositivo: texto_(r.dispositivo).slice(0, 80),
  };
}

// ---------------------------------------------------------------------------------------------
// Escritura y formato

function prepararHoja_(libro, nombre) {
  const hoja = libro.getSheetByName(nombre) || libro.insertSheet(nombre);
  const encabezado = ENCABEZADOS[nombre];
  hoja
    .getRange(1, 1, 1, encabezado.length)
    .setValues([encabezado])
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#1f4f8f');
  hoja.setFrozenRows(1);
  return hoja;
}

function cargarSiVacia_(nombre, filas) {
  const hoja = hoja_(nombre);
  if (hoja.getLastRow() > 1 || !filas.length) return;
  hoja.getRange(2, 1, filas.length, filas[0].length).setValues(filas);
}

function movimientosDelCaso_() {
  return DATOS_CASO.movimientos.map((m, i) => [
    `MOV-${String(i + 1).padStart(3, '0')}`,
    deIso_(m.fecha),
    m.codigo,
    m.lote,
    m.cantidad,
    m.um,
    m.tipo,
    m.posicion,
    '',
    'CASO',
  ]);
}

function completarParametros_() {
  const hoja = hoja_(HOJAS.PARAMETROS);
  const existentes = leerParametros_();
  const iniciales = [
    ['CAMPANIA_ACTIVA', DATOS_CASO.campania, 'Campaña de conteo que acepta la app'],
    ['FECHA_CONTEO', deIso_(DATOS_CASO.fechaConteo), 'Fecha de corte del conteo físico'],
    ['FECHA_STOCK_INICIAL', deIso_(DATOS_CASO.fechaStockInicial), 'Foto de stock de partida'],
    ['FECHA_DESDE', deIso_(DATOS_CASO.fechaDesde), 'Primer día de movimientos que suman al teórico'],
    ['TOKEN', Utilities.getUuid().replace(/-/g, '').slice(0, 12), 'Clave que manda la app en cada llamada; si se filtra, cambiala'],
    ['TOLERANCIA_DEFECTO', 0, 'Unidades de tolerancia si el material no tiene una propia. El caso no trae costos: todos se tratan como clase A'],
    ['ALCANCE', 'A1 a G4 (28 posiciones)', 'Posiciones que se relevan en la campaña'],
  ];
  const faltantes = iniciales.filter(([clave]) => !(clave in existentes));
  if (faltantes.length) hoja.getRange(hoja.getLastRow() + 1, 1, faltantes.length, 3).setValues(faltantes);
}

function registrarLog_(datos, respuesta) {
  try {
    const registro = datos.registro || {};
    const detalle =
      datos.accion === 'registrar'
        ? `${registro.posicion || ''} ${registro.vacia ? 'vacía' : `${registro.codigo || ''} ${registro.lote || ''} ${registro.cantidad ?? ''}`} id=${registro.id || ''}`
        : respuesta.ok
          ? ''
          : respuesta.mensaje;
    hoja_(HOJAS.LOG).appendRow([
      new Date(),
      texto_(datos.accion) || '(sin acción)',
      texto_(datos.usuario || registro.usuario),
      respuesta.codigo,
      texto_(detalle).slice(0, 300),
    ]);
  } catch (error) {
    // Si el log falla (por ejemplo, antes de configurar las hojas), la respuesta igual sale.
  }
}

function avisarEnPlanilla_(mensaje) {
  console.log(mensaje); // queda en el registro de ejecución del editor
  try {
    SpreadsheetApp.getUi().alert(mensaje);
  } catch (error) {
    // corrido desde el editor: no hay interfaz de planilla
  }
}
