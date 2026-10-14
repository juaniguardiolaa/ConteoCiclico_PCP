// Conteo cíclico TP6: Web App y menú de la planilla de Google Sheets.
//
// La app del celular nunca escribe directo en la planilla: llama a este Web App, que vuelve a
// validar con las mismas reglas que la app (Dominio.gs se genera desde docs/js/dominio) y recién
// ahí escribe. Respuesta siempre { ok, codigo, mensaje, datos }.
//
// Este archivo se edita acá. Datos.gs y Dominio.gs se generan con npm run apps-script, que también
// arma conteo-ciclico.gs: el archivo único que se pega en el editor de Apps Script.

const VERSION_SERVIDOR = '0.7.0';
const ZONA = 'America/Argentina/Buenos_Aires';

// Configuración regional de la planilla. Google interpreta las fórmulas que escribe el script
// (setFormula o setValues) con la configuración de la planilla: en es_AR los argumentos van con «;»
// y las fórmulas de este archivo, escritas con «,», quedan en #ERROR!. Con en_US se leen bien.
// Las fechas igual se ven como dd/mm/aaaa porque cada columna tiene su formato.
const CONFIGURACION_REGIONAL = 'en_US';

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

// Listas desplegables de la hoja Conciliacion (análisis de diferencias, Hoja 2 del diagrama).
const CAUSAS = [
  'Error de conteo',
  'Error de ubicación',
  'Movimiento sin registrar',
  'Movimiento mal cargado',
  'Merma o rotura',
  'Retorno no ubicado',
  'Otra',
];
const ACCIONES_DIFERENCIA = ['Reconteo', 'Transferencia', 'Corrección de movimiento', 'Ajuste'];

// Colores de cada clasificación (los mismos de la app).
const COLORES_CLASIFICACION = {
  OK: '#e1f2e8',
  FALTANTE: '#fbe4e2',
  SOBRANTE: '#e2ecf8',
  UBICACION: '#fdebdd',
  NO_REGISTRADO: '#efe8f8',
};

// ---------------------------------------------------------------------------------------------
// Menú de la planilla. setupHojas va primera: es la que el editor elige por defecto en «Ejecutar».

/**
 * Crea las 10 hojas y carga los datos del caso. Se puede correr de nuevo sin duplicar nada:
 * solo carga una hoja de datos si está vacía y conserva el token.
 */
function setupHojas() {
  const libro = SpreadsheetApp.getActive();
  libro.setSpreadsheetTimeZone(ZONA);
  asegurarConfiguracionRegional_();

  Object.values(HOJAS).forEach((nombre) => prepararHoja_(libro, nombre));

  cargarSiVacia_(HOJAS.MATERIALES, DATOS_CASO.materiales.map((m) => [m.codigo, m.descripcion, m.um, 'A', 0]));
  cargarSiVacia_(HOJAS.POSICIONES, DATOS_CASO.posiciones.map((p) => [p.posicion, p.bloque, p.columna, p.nivel]));
  cargarSiVacia_(HOJAS.STOCK, DATOS_CASO.stock3009.map((s) => [s.codigo, s.descripcion, s.lote, s.posicion, s.stock]));
  cargarSiVacia_(HOJAS.MOVIMIENTOS, movimientosDelCaso_());
  completarParametros_();

  escribirMaestroLotes_();

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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Inventario')
    .addItem('Configurar hojas del caso', 'setupHojas')
    .addItem('Ver token para la app', 'mostrarToken')
    .addSeparator()
    .addItem('Ejecutar conciliación', 'ejecutarConciliacion')
    .addItem('Registrar ajustes y transferencias aprobados', 'registrarAjustesAprobados')
    .addItem('Guardar foto de la conciliación', 'guardarFotoConciliacion')
    .addItem('Cerrar la campaña', 'cerrarCampania')
    .addSeparator()
    .addItem('Cargar el conteo del enunciado (prueba)', 'cargarConteoDePrueba')
    .addItem('Reiniciar la simulación (borra conteos)', 'reiniciarSimulacion')
    .addToUi();
}

/**
 * Diagrama, Hoja 2, fase 4: «Registrar el ajuste en Movimientos» y «Registrar transferencia entre
 * posiciones». Toma de Conciliacion las filas con Accion Ajuste o Transferencia y Aprobado_por
 * completo, y agrega a Movimientos un movimiento por la diferencia, con fecha del conteo. Como
 * Conciliacion son fórmulas, esas claves pasan a OK enseguida; correrlo de nuevo no duplica nada.
 */
function registrarAjustesAprobados() {
  const ui = SpreadsheetApp.getUi();
  const p = leerParametros_();
  const filas = leerTablaSinCache_(HOJAS.CONCILIACION).map((f) => ({
    codigo: texto_(f.Codigo),
    lote: texto_(f.Lote),
    posicion: texto_(f.Posicion),
    diferencia: Number(f.Diferencia) || 0,
    causa: texto_(f.Causa),
    accion: texto_(f.Accion),
    aprobadoPor: texto_(f.Aprobado_por),
  }));
  const { movimientos, sinAprobar, errores } = movimientosDeAjuste(filas, { fecha: p.FECHA_CONTEO, campania: p.CAMPANIA_ACTIVA });

  const avisos = [
    ...errores,
    ...(sinAprobar.length
      ? [`Sin aprobar (falta Aprobado_por): ${sinAprobar.map((f) => `${f.posicion} ${f.codigo} ${f.lote}`).join(', ')}.`]
      : []),
  ];
  if (!movimientos.length) {
    avisarEnPlanilla_(['No hay ajustes ni transferencias aprobados para registrar.', ...avisos].join('\n\n'));
    return;
  }
  const detalle = movimientos.map((m) => `${m.posicion} ${m.codigo} ${m.lote}: ${m.cantidad > 0 ? '+' : ''}${m.cantidad} (${m.tipo})`);
  const respuesta = ui.alert(
    'Registrar ajustes y transferencias',
    `Se agregan ${movimientos.length} movimientos a Movimientos con fecha ${p.FECHA_CONTEO}:\n\n${detalle.join('\n')}` +
      (avisos.length ? `\n\nNo se registran:\n${avisos.join('\n')}` : '') +
      '\n\n¿Seguir?',
    ui.ButtonSet.YES_NO,
  );
  if (respuesta !== ui.Button.YES) return;

  const hoja = hoja_(HOJAS.MOVIMIENTOS);
  const um = new Map(leerMateriales_().map((m) => [m.codigo, m.um]));
  const sello = Utilities.formatDate(new Date(), ZONA, 'yyyyMMdd-HHmmss');
  const nuevas = movimientos.map((m, i) => [
    `${m.origen === 'TRANSFERENCIA' ? 'TR' : 'AJ'}-${sello}-${i + 1}`,
    deIso_(m.fecha),
    m.codigo,
    m.lote,
    m.cantidad,
    um.get(m.codigo) || 'UN',
    m.tipo,
    m.posicion,
    m.motivo,
    m.origen,
  ]);
  hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, nuevas[0].length).setValues(nuevas);
  avisarEnPlanilla_(
    `Se registraron ${nuevas.length} movimientos. La hoja Conciliacion ya se recalculó: esas claves tienen que estar en OK.`,
  );
}

/** Guarda en una hoja nueva los valores de Conciliacion y Resumen, para comparar el antes y el después. */
function guardarFotoConciliacion() {
  const nombre = guardarFoto_('');
  avisarEnPlanilla_(`Se guardó la foto en la hoja «${nombre}».`);
}

function guardarFoto_(etiqueta) {
  const libro = SpreadsheetApp.getActive();
  let nombre = `Foto ${Utilities.formatDate(new Date(), ZONA, 'dd-MM HH.mm')}${etiqueta ? ` ${etiqueta}` : ''}`;
  for (let n = 2; libro.getSheetByName(nombre); n++) nombre = `${nombre.replace(/ \(\d+\)$/, '')} (${n})`;
  const foto = libro.insertSheet(nombre);
  const conciliacion = hoja_(HOJAS.CONCILIACION).getDataRange().getValues();
  const resumen = hoja_(HOJAS.RESUMEN).getDataRange().getValues();
  foto.getRange(1, 1, conciliacion.length, conciliacion[0].length).setValues(conciliacion);
  const columnaResumen = conciliacion[0].length + 2;
  foto.getRange(1, columnaResumen, resumen.length, resumen[0].length).setValues(resumen);
  foto.getRange(1, 1, 1, conciliacion[0].length + 2 + resumen[0].length).setFontWeight('bold');
  return nombre;
}

/**
 * Diagrama, Hoja 2, fase 5: «Revisar y aprobar el cierre del conteo». Guarda la foto final, deja
 * la campaña CERRADA en Parametros con quién la aprobó y desde ahí la app ya no acepta registros.
 */
function cerrarCampania() {
  const ui = SpreadsheetApp.getUi();
  const p = leerParametros_();
  const pendientes = leerTablaSinCache_(HOJAS.CONCILIACION).filter((f) => texto_(f.Clasificacion) !== 'OK');
  if (pendientes.length) {
    const seguir = ui.alert(
      'Cerrar la campaña',
      `Quedan ${pendientes.length} claves con diferencia fuera de tolerancia ` +
        `(${pendientes.map((f) => texto_(f.Clave)).slice(0, 8).join(', ')}${pendientes.length > 8 ? '…' : ''}). ¿Cerrar igual?`,
      ui.ButtonSet.YES_NO,
    );
    if (seguir !== ui.Button.YES) return;
  }
  const pregunta = ui.prompt('Cerrar la campaña', 'Nombre de quien aprueba el cierre (Jefe de almacén):', ui.ButtonSet.OK_CANCEL);
  if (pregunta.getSelectedButton() !== ui.Button.OK || !texto_(pregunta.getResponseText())) return;
  const aprobo = texto_(pregunta.getResponseText());

  const foto = guardarFoto_('cierre');
  escribirParametro_('ESTADO_CAMPANIA', 'CERRADA', 'ABIERTA: la app acepta registros. CERRADA: ya no.');
  escribirParametro_('CIERRE_FECHA', new Date(), 'Cuándo se cerró la campaña');
  escribirParametro_('CIERRE_APROBADO_POR', aprobo, 'Quién aprobó el cierre');
  avisarEnPlanilla_(`Campaña ${p.CAMPANIA_ACTIVA} cerrada por ${aprobo}. Foto final en la hoja «${foto}». La app ya no acepta registros.`);
}

/** Cambia (o agrega) un valor de la hoja Parametros. */
function escribirParametro_(clave, valor, descripcion) {
  const hoja = hoja_(HOJAS.PARAMETROS);
  const claves = hoja.getRange(1, 1, Math.max(1, hoja.getLastRow()), 1).getValues().map((f) => texto_(f[0]));
  const i = claves.indexOf(clave);
  if (i >= 0) hoja.getRange(i + 1, 2).setValue(valor);
  else hoja.getRange(hoja.getLastRow() + 1, 1, 1, 3).setValues([[clave, valor, descripcion]]);
}

/**
 * Diagrama, Hoja 2: «¿Se relevaron todas las posiciones?» y, si sí (o si se acepta conciliar con lo
 * relevado), conciliación con fórmulas en la hoja Conciliacion y resumen en la hoja Resumen.
 */
function ejecutarConciliacion() {
  const ui = SpreadsheetApp.getUi();
  const p = leerParametros_();
  const posiciones = leerPosiciones_().map((x) => x.posicion);
  const cob = cobertura(leerRegistros_(), posiciones, p.CAMPANIA_ACTIVA);
  let forzar = false;
  if (cob.faltantes.length) {
    const respuesta = ui.alert(
      'Faltan posiciones por relevar',
      `Faltan ${cob.faltantes.length} de ${cob.total} posiciones: ${cob.faltantes.join(', ')}.\n\n¿Conciliar igual con lo relevado hasta ahora?`,
      ui.ButtonSet.YES_NO,
    );
    if (respuesta !== ui.Button.YES) return;
    forzar = true;
  }
  const resultado = conciliarEnHoja_({ forzar, usuario: 'Planilla (menú Inventario)' });
  SpreadsheetApp.getActive().setActiveSheet(hoja_(HOJAS.CONCILIACION));
  avisarEnPlanilla_(resultado.mensaje);
}

/**
 * Carga en Conteo_1410 el stock físico del 14/10 del enunciado, como si lo hubieran contado con la app.
 * Sirve para verificar la conciliación antes de la simulación. Reemplaza los conteos que haya.
 */
function cargarConteoDePrueba() {
  const ui = SpreadsheetApp.getUi();
  const respuesta = ui.alert(
    'Cargar el conteo del enunciado',
    'Se borran los conteos de Conteo_1410 y se cargan las 28 posiciones con el stock físico del 14/10 del enunciado. ¿Seguir?',
    ui.ButtonSet.YES_NO,
  );
  if (respuesta !== ui.Button.YES) return;
  const p = leerParametros_();
  const hoja = hoja_(HOJAS.CONTEO);
  if (hoja.getLastRow() > 1) hoja.getRange(2, 1, hoja.getLastRow() - 1, hoja.getMaxColumns()).clearContent();
  const registros = registrosDesdeStockFisico(
    DATOS_CASO.stock1410,
    leerPosiciones_().map((x) => x.posicion),
    {
      campania: p.CAMPANIA_ACTIVA,
      usuario: 'Prueba con Stock 1410',
      rol: 'CONTROL',
      fechaHora: aIso_(new Date(), true),
      dispositivo: 'Planilla (prueba)',
    },
  );
  hoja.getRange(2, 1, registros.length, ENCABEZADOS.Conteo_1410.length).setValues(registros.map(filaDeRegistro_));
  avisarEnPlanilla_(`Se cargaron las ${registros.length} posiciones del enunciado. Ahora: Inventario → Ejecutar conciliación.`);
}

/** Deja la planilla en en_US (ver CONFIGURACION_REGIONAL) antes de escribir fórmulas. */
function asegurarConfiguracionRegional_() {
  const libro = SpreadsheetApp.getActive();
  if (libro.getSpreadsheetLocale() !== CONFIGURACION_REGIONAL) {
    libro.setSpreadsheetLocale(CONFIGURACION_REGIONAL);
    SpreadsheetApp.flush();
  }
}

/** Maestro_Lotes es una fórmula: los pares material-lote que aparecen en el stock o en movimientos. */
function escribirMaestroLotes_() {
  hoja_(HOJAS.LOTES)
    .getRange('A2')
    .setFormula(
      '=SORT(UNIQUE(FILTER({Stock_3009!A2:A, Stock_3009!C2:C; Movimientos!C2:C, Movimientos!D2:D}, ' +
        '{Stock_3009!C2:C; Movimientos!D2:D} <> "")))',
    );
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
    'Se borran los conteos, la conciliación, el resumen y el log, Movimientos vuelve a los 40 del caso ' +
      'y la campaña queda abierta. Las hojas «Foto …» no se tocan. ¿Seguir?',
    ui.ButtonSet.YES_NO,
  );
  if (respuesta !== ui.Button.YES) return;
  [HOJAS.CONTEO, HOJAS.CONCILIACION, HOJAS.RESUMEN, HOJAS.LOG, HOJAS.MOVIMIENTOS].forEach((nombre) => {
    const h = hoja_(nombre);
    if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, h.getMaxColumns()).clearContent();
  });
  cargarSiVacia_(HOJAS.MOVIMIENTOS, movimientosDelCaso_());
  escribirParametro_('ESTADO_CAMPANIA', 'ABIERTA', 'ABIERTA: la app acepta registros. CERRADA: ya no.');
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
  conciliar: { lectura: false, atender: accionConciliar_ },
  pedirReconteo: { lectura: false, atender: accionPedirReconteo_ },
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
    estadoCampania: campaniaCerrada_(p) ? 'CERRADA' : 'ABIERTA',
    cierreAprobadoPor: texto_(p.CIERRE_APROBADO_POR),
  });
}

const campaniaCerrada_ = (p) => texto_(p.ESTADO_CAMPANIA).toUpperCase() === 'CERRADA';

/**
 * Diagrama, Hoja 2: «Solicitar el reconteo de la posición». Desde la app (Control o Jefe de almacén)
 * marca Accion = Reconteo en las filas con diferencia de esa posición en Conciliacion.
 */
function accionPedirReconteo_(datos) {
  if (!['CONTROL', 'SUPERVISOR'].includes(texto_(datos.rol))) {
    return falla_('ROL_NO_AUTORIZADO', 'Solo Control de inventarios o el Jefe de almacén pueden pedir un reconteo.');
  }
  const posicion = texto_(datos.posicion).toUpperCase();
  const filas = leerTablaSinCache_(HOJAS.CONCILIACION).filter((f) => texto_(f.Posicion) === posicion);
  if (!filas.length) return falla_('SIN_CONCILIACION', `La posición ${posicion} no está en la hoja Conciliacion: primero hay que conciliar.`);
  const conDiferencia = filas.filter((f) => texto_(f.Clasificacion) !== 'OK');
  const columnaAccion = ENCABEZADOS.Conciliacion.indexOf('Accion') + 1;
  (conDiferencia.length ? conDiferencia : filas).forEach((f) =>
    hoja_(HOJAS.CONCILIACION).getRange(f._fila, columnaAccion).setValue('Reconteo'),
  );
  return { ok: true, codigo: 'RECONTEO_PEDIDO', mensaje: `Reconteo pedido para ${posicion}. Aparece en la ruta de los operarios.` };
}

function accionMaestros_() {
  return exito_({ posiciones: leerPosiciones_(), materiales: leerMateriales_(), lotes: leerLotes_() });
}

function accionEstado_(datos) {
  const p = leerParametros_();
  const campania = datos.campania || p.CAMPANIA_ACTIVA;
  const registros = leerRegistros_();
  return exito_({
    registros: registros.filter((r) => r.campania === campania).map(sinFila_),
    reconteos: leerReconteos_(registros),
    estadoCampania: campaniaCerrada_(p) ? 'CERRADA' : 'ABIERTA',
    cierreAprobadoPor: texto_(p.CIERRE_APROBADO_POR),
  });
}

/** Desde la app (pantalla Conciliación): escribe la conciliación en la hoja. Solo Control o Jefe de almacén. */
function accionConciliar_(datos) {
  if (!['CONTROL', 'SUPERVISOR'].includes(texto_(datos.rol))) {
    return falla_('ROL_NO_AUTORIZADO', 'Solo Control de inventarios o el Jefe de almacén pueden ejecutar la conciliación.');
  }
  const candado = LockService.getScriptLock();
  if (!candado.tryLock(20000)) return falla_('OCUPADO', 'La planilla está ocupada; probá de nuevo en unos segundos.');
  try {
    return conciliarEnHoja_({ forzar: datos.forzar === true, usuario: texto_(datos.usuario) });
  } finally {
    candado.releaseLock();
  }
}

/** Conciliación calculada con la misma función que la app, sin escribir la hoja (consulta). */
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
    const parametros = leerParametros_();
    const campania = parametros.CAMPANIA_ACTIVA;
    if (campaniaCerrada_(parametros)) {
      return falla_('CAMPANIA_CERRADA', `La campaña ${campania} está cerrada: ya no se aceptan registros.`);
    }
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
    hoja.appendRow(filaDeRegistro_(registro));
    return { ok: true, codigo: 'REGISTRADO', mensaje: `Posición ${registro.posicion} enviada a la planilla.` };
  } finally {
    candado.releaseLock();
  }
}

/** Fila de Conteo_1410 para un registro, en el orden de ENCABEZADOS.Conteo_1410. */
function filaDeRegistro_(registro) {
  return [
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
  ];
}

// ---------------------------------------------------------------------------------------------
// Conciliación en la hoja (H6)
//
// Las claves (Codigo|Lote|Posicion) salen de conciliar(), la misma función que usa la app. Cada
// número se escribe como fórmula SUMIFS sobre rangos con nombre, para que se pueda verificar
// haciendo clic en la celda. Al final se lee lo que calculó la hoja y se compara con la app.

/**
 * @param {{forzar?:boolean, usuario?:string}} opciones  forzar: conciliar aunque falten posiciones
 * @returns {{ok:boolean, codigo:string, mensaje:string, datos?:object}}
 */
function conciliarEnHoja_({ forzar = false, usuario = '' } = {}) {
  const p = leerParametros_();
  const campania = p.CAMPANIA_ACTIVA;
  const registros = leerRegistros_();
  const posiciones = leerPosiciones_().map((x) => x.posicion);
  const cob = cobertura(registros, posiciones, campania);
  if (cob.faltantes.length && !forzar) {
    return {
      ok: false,
      codigo: 'COBERTURA_INCOMPLETA',
      mensaje: `Faltan relevar ${cob.faltantes.length} de ${cob.total} posiciones: ${cob.faltantes.join(', ')}.`,
      datos: { faltantes: cob.faltantes },
    };
  }

  const materiales = leerMateriales_();
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

  // Si la planilla quedó en otra configuración regional, las fórmulas (también las de Maestro_Lotes)
  // se reescriben después de pasarla a en_US.
  asegurarConfiguracionRegional_();
  escribirMaestroLotes_();
  definirRangosConNombre_();
  escribirConciliacion_(filas);
  escribirResumen_(materiales, usuario || 'Sin usuario');
  SpreadsheetApp.flush();

  const verificacion = verificarConciliacion_(filas);
  const indicadores = calcularIndicadores(filas, posiciones, materiales);
  const porcentaje = (x) => `${(x * 100).toFixed(1).replace('.', ',')} %`;
  const mensaje =
    `Conciliación lista: ${indicadores.claves} claves, ${indicadores.clavesOk} OK y ${indicadores.clavesConDiferencia} con diferencia. ` +
    `Exactitud ${porcentaje(indicadores.exactitudPorClave)} por clave y ${porcentaje(indicadores.exactitudPorPosicion)} por posición. ` +
    (verificacion.coinciden
      ? 'Las fórmulas de la hoja coinciden con el cálculo de la app.'
      : `Atención: ${verificacion.diferencias.length} valores de la hoja no coinciden con el cálculo de la app.`) +
    (forzar && cob.faltantes.length ? ` Parcial: faltan ${cob.faltantes.length} posiciones.` : '');

  return { ok: true, codigo: 'CONCILIADO', mensaje, datos: { filas, indicadores, cobertura: cob, verificacion } };
}

const letraDeColumna_ = (n) => (n > 26 ? letraDeColumna_(Math.floor((n - 1) / 26)) : '') + String.fromCharCode(65 + ((n - 1) % 26));

/** Rangos con nombre que usan las fórmulas: hacen que se lean como texto (MOV_CANTIDAD, FECHA_DESDE…). */
function definirRangosConNombre_() {
  const libro = SpreadsheetApp.getActive();
  const nombrar = (nombre, rango) => {
    if (libro.getRangeByName(nombre)) libro.removeNamedRange(nombre);
    libro.setNamedRange(nombre, rango);
  };

  const parametros = hoja_(HOJAS.PARAMETROS);
  const claves = parametros.getRange(1, 1, parametros.getLastRow(), 1).getValues().map((f) => texto_(f[0]));
  const celdaParametro = (clave) => {
    const i = claves.indexOf(clave);
    if (i < 0) throw new Error(`Falta ${clave} en la hoja Parametros: corré «Configurar hojas del caso».`);
    return parametros.getRange(i + 1, 2);
  };
  nombrar('CAMPANIA', celdaParametro('CAMPANIA_ACTIVA'));
  nombrar('FECHA_DESDE', celdaParametro('FECHA_DESDE'));
  nombrar('FECHA_CONTEO', celdaParametro('FECHA_CONTEO'));
  nombrar('TOLERANCIA_DEFECTO', celdaParametro('TOLERANCIA_DEFECTO'));

  const columnas = [
    [HOJAS.STOCK, 'STOCK', { Codigo: 'CODIGO', Lote: 'LOTE', Posicion: 'POSICION', Stock: 'CANTIDAD' }],
    [HOJAS.MOVIMIENTOS, 'MOV', { Fecha: 'FECHA', Codigo: 'CODIGO', Lote: 'LOTE', Cantidad: 'CANTIDAD', Tipo_Movimiento: 'TIPO', Posicion: 'POSICION' }],
    [HOJAS.CONTEO, 'CONTEO', { Campania: 'CAMPANIA', Posicion: 'POSICION', Codigo: 'CODIGO', Lote: 'LOTE', Cantidad: 'CANTIDAD', Estado: 'ESTADO' }],
  ];
  columnas.forEach(([nombreHoja, prefijo, campos]) => {
    Object.entries(campos).forEach(([encabezado, sufijo]) => {
      const letra = letraDeColumna_(ENCABEZADOS[nombreHoja].indexOf(encabezado) + 1);
      nombrar(`${prefijo}_${sufijo}`, hoja_(nombreHoja).getRange(`${letra}2:${letra}`));
    });
  });
}

/** Fórmulas de una fila de Conciliacion (columnas A a N). */
function formulasConciliacion_(r) {
  const clave = (prefijo) => `${prefijo}_CODIGO,$B${r}, ${prefijo}_LOTE,$D${r}, ${prefijo}_POSICION,$E${r}`;
  const periodo = 'MOV_FECHA,">="&FECHA_DESDE, MOV_FECHA,"<="&FECHA_CONTEO';
  const movimientos = (tipo) => `SUMIFS(MOV_CANTIDAD, ${clave('MOV')}, ${periodo}${tipo ? `, MOV_TIPO,"${tipo}"` : ''})`;
  return {
    clave: `=B${r}&"|"&D${r}&"|"&E${r}`,
    descripcion: `=IFERROR(VLOOKUP($B${r}, Maestro_Materiales!$A:$B, 2, FALSE), "")`,
    stock: `=SUMIFS(STOCK_CANTIDAD, ${clave('STOCK')})`,
    ingresos: `=${movimientos('Ingreso_Orden_Compra')} + ${movimientos('Retorno_Venta')}`,
    salidas: `=${movimientos('Salida_Venta')} + ${movimientos('Consumo_Orden_Producción')}`,
    // Todo lo que no es ingreso ni salida: ajustes de inventario y transferencias.
    ajustes: `=${movimientos('')} - G${r} - H${r}`,
    teorico: `=F${r}+G${r}+H${r}+I${r}`,
    fisico: `=SUMIFS(CONTEO_CANTIDAD, ${clave('CONTEO')}, CONTEO_ESTADO,"VALIDO", CONTEO_CAMPANIA,CAMPANIA)`,
    diferencia: `=K${r}-J${r}`,
    tolerancia: `=IFERROR(VLOOKUP($B${r}, Maestro_Materiales!$A:$E, 5, FALSE), TOLERANCIA_DEFECTO)`,
    clasificacion:
      `=IF(ABS(L${r})<=M${r}, "OK", ` +
      `IF(COUNTIFS(Maestro_Lotes!$A:$A,$B${r}, Maestro_Lotes!$B:$B,$D${r})=0, "NO_REGISTRADO", ` +
      `IF(ABS(SUMIFS($L:$L, $B:$B,$B${r}, $D:$D,$D${r}))<=M${r}, "UBICACION", ` +
      `IF(L${r}<0, "FALTANTE", "SOBRANTE"))))`,
  };
}

function escribirConciliacion_(filas) {
  const hoja = hoja_(HOJAS.CONCILIACION);
  const columnas = ENCABEZADOS.Conciliacion.length;

  // Causa, Accion y Aprobado_por de una corrida anterior se conservan para las claves que siguen.
  const previas = new Map(leerTablaSinCache_(HOJAS.CONCILIACION).map((f) => [texto_(f.Clave), f]));
  const ultima = hoja.getLastRow();
  if (ultima > 1) {
    hoja.getRange(2, 1, ultima - 1, columnas).clearContent();
    hoja.getRange(2, 15, ultima - 1, 3).clearDataValidations();
  }
  if (!filas.length) return;

  // Primero los valores y después las fórmulas, cada cosa con su método: setValues interpreta un
  // texto con «=» como si lo tipeara alguien, con la configuración regional de la planilla (en es_AR
  // los argumentos van con «;») y las fórmulas quedarían en #ERROR!. setFormulas usa siempre la
  // sintaxis estándar: funciones en inglés y argumentos con «,».
  const n = filas.length;
  hoja.getRange(2, 1, n, columnas).setValues(
    filas.map((f) => {
      const previa = previas.get(f.clave) || {};
      return [
        '', f.codigo, '', f.lote, f.posicion,
        '', '', '', '', '', '', '', '', '',
        texto_(previa.Causa), texto_(previa.Accion), texto_(previa.Aprobado_por),
      ];
    }),
  );
  const fx = filas.map((_, i) => formulasConciliacion_(i + 2));
  hoja.getRange(2, 1, n, 1).setFormulas(fx.map((f) => [f.clave]));
  hoja.getRange(2, 3, n, 1).setFormulas(fx.map((f) => [f.descripcion]));
  hoja.getRange(2, 6, n, 9).setFormulas(
    fx.map((f) => [f.stock, f.ingresos, f.salidas, f.ajustes, f.teorico, f.fisico, f.diferencia, f.tolerancia, f.clasificacion]),
  );
  hoja.getRange(2, 6, n, 8).setNumberFormat('0');
  hoja.getRange(2, 14, n, 1).setFontWeight('bold');

  hoja.getRange(2, 15, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CAUSAS, true).setAllowInvalid(true).build(),
  );
  hoja.getRange(2, 16, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ACCIONES_DIFERENCIA, true).setAllowInvalid(false).build(),
  );

  const filasDatos = hoja.getRange(2, 1, n, columnas);
  hoja.setConditionalFormatRules(
    Object.entries(COLORES_CLASIFICACION).map(([clasificacion, color]) =>
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=$N2="${clasificacion}"`)
        .setBackground(color)
        .setRanges([filasDatos])
        .build(),
    ),
  );
}

/** Hoja Resumen: indicadores del cierre, todos con fórmulas sobre Conciliacion. */
function escribirResumen_(materiales, usuario) {
  const hoja = hoja_(HOJAS.RESUMEN);
  if (hoja.getLastRow() > 1) hoja.getRange(2, 1, hoja.getLastRow() - 1, 3).clearContent();

  const C = 'Conciliacion';
  const filas = [
    ['Claves conciliadas', `=COUNTA(${C}!A2:A)`, 'Combinaciones Codigo|Lote|Posicion con stock teórico o físico'],
    ['Claves sin diferencia', `=COUNTIF(${C}!N2:N,"OK")`, 'Dentro de la tolerancia del material'],
    ['Claves con diferencia', '=B2-B3', ''],
    ['Exactitud por clave', '=IFERROR(B3/B2,0)', 'Claves sin diferencia / claves conciliadas'],
    ['Posiciones del alcance', '=COUNTA(Maestro_Posiciones!A2:A)', 'A1 a G4'],
    ['Posiciones con diferencia', `=IFERROR(COUNTUNIQUE(FILTER(${C}!E2:E,${C}!N2:N<>"OK",${C}!N2:N<>"")),0)`, ''],
    ['Exactitud por posición', '=IFERROR((B6-B7)/B6,0)', 'Posiciones sin diferencia / posiciones del alcance'],
    ['Posiciones relevadas', '=IFERROR(COUNTUNIQUE(FILTER(CONTEO_POSICION,CONTEO_ESTADO="VALIDO",CONTEO_CAMPANIA=CAMPANIA)),0)', 'Con registro VALIDO en la campaña, incluidas las vacías'],
    ['Teórico total (u.)', `=SUM(${C}!J2:J)`, 'Stock 30/09 más movimientos del período'],
    ['Físico total (u.)', `=SUM(${C}!K2:K)`, 'Conteo con la app'],
    ['Diferencia neta (u.)', '=B11-B10', 'Físico menos teórico'],
    ['Unidades faltantes', `=-SUMIFS(${C}!L2:L,${C}!L2:L,"<0",${C}!N2:N,"<>UBICACION",${C}!N2:N,"<>OK")`, 'Sin contar los errores de ubicación'],
    ['Unidades sobrantes', `=SUMIFS(${C}!L2:L,${C}!L2:L,">0",${C}!N2:N,"<>UBICACION",${C}!N2:N,"<>OK")`, 'Sin contar los errores de ubicación'],
    ['', '', ''],
    ['Claves por clasificación', '', ''],
  ];
  const descripciones = {
    OK: 'Diferencia dentro de la tolerancia',
    FALTANTE: 'Hay menos de lo que dice el sistema',
    SOBRANTE: 'Hay más de lo que dice el sistema',
    UBICACION: 'El lote está, pero en otra posición',
    NO_REGISTRADO: 'Material-lote que el sistema no conoce',
  };
  Object.keys(COLORES_CLASIFICACION).forEach((c) => {
    filas.push([c, `=COUNTIF(${C}!N2:N,A${filas.length + 2})`, descripciones[c]]);
  });
  filas.push(['', '', ''], ['Diferencia neta por material', '', '']);
  materiales.forEach((m) => {
    filas.push([m.codigo, `=SUMIFS(${C}!L2:L,${C}!B2:B,A${filas.length + 2})`, m.descripcion]);
  });
  filas.push(['', '', ''], ['Conciliación ejecutada', new Date(), usuario]);

  // Valores con setValues y fórmulas con setFormula (ver escribirConciliacion_).
  const esFormula = (v) => typeof v === 'string' && v.startsWith('=');
  hoja.getRange(2, 1, filas.length, 3).setValues(filas.map(([a, b, c]) => [a, esFormula(b) ? '' : b, c]));
  filas.forEach(([, b], i) => {
    if (esFormula(b)) hoja.getRange(i + 2, 2).setFormula(b);
  });
  hoja.getRange('B5').setNumberFormat('0.0%');
  hoja.getRange('B8').setNumberFormat('0.0%');
  hoja.getRange(filas.length + 1, 2).setNumberFormat('dd/mm/yyyy hh:mm:ss');
}

/** Lee lo que calculó la hoja y lo compara, valor por valor, con el cálculo de la app. */
function verificarConciliacion_(filas) {
  if (!filas.length) return { coinciden: true, revisadas: 0, diferencias: [] };
  const valores = hoja_(HOJAS.CONCILIACION).getRange(2, 1, filas.length, 14).getValues();
  const campos = [
    ['clave', 0], ['stockInicial', 5], ['ingresos', 6], ['salidas', 7], ['ajustes', 8],
    ['teorico', 9], ['fisico', 10], ['diferencia', 11], ['tolerancia', 12], ['clasificacion', 13],
  ];
  const diferencias = [];
  filas.forEach((f, i) => {
    campos.forEach(([campo, j]) => {
      const enHoja = valores[i][j];
      if (String(enHoja) !== String(f[campo])) diferencias.push({ clave: f.clave, campo, hoja: String(enHoja), app: f[campo] });
    });
  });
  return { coinciden: diferencias.length === 0, revisadas: filas.length, diferencias: diferencias.slice(0, 20) };
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
    ['ESTADO_CAMPANIA', 'ABIERTA', 'ABIERTA: la app acepta registros. CERRADA: ya no.'],
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
        : !respuesta.ok || datos.accion === 'conciliar'
          ? respuesta.mensaje
          : '';
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
