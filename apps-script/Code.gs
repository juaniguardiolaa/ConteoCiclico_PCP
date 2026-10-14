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
