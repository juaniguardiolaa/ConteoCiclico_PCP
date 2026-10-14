// Simulador mínimo de los servicios de Google que usa apps-script/Code.gs (SpreadsheetApp,
// Utilities, LockService, ContentService), para probar el servidor en Node sin publicarlo.
// Las fórmulas se calculan con tests/formulas-simuladas.js (solo las funciones que usa Code.gs).
// Los formatos (colores, negrita, anchos, etc.) no hacen nada.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

import { esError, esFormulaMatricial, evaluarFormula } from './formulas-simuladas.js';

const DESFASE = '-03:00'; // America/Argentina/Buenos_Aires, sin horario de verano

/** Objeto que acepta cualquier método de formato y devuelve el mismo objeto (para encadenar). */
function conFormatoLibre(objeto) {
  return new Proxy(objeto, {
    get(destino, prop) {
      if (prop in destino) return destino[prop];
      if (typeof prop === 'symbol') return undefined;
      return () => conFormatoLibre(destino);
    },
  });
}

/** Configuraciones regionales con coma decimal: en ellas los argumentos de las fórmulas van con «;». */
const usaPuntoYComa = (locale) => !/^en/.test(locale);

function tieneComaFueraDeTexto(formula) {
  let enTexto = false;
  for (const c of formula) {
    if (c === '"') enTexto = !enTexto;
    else if (c === ',' && !enTexto) return true;
  }
  return false;
}

const indiceColumna = (letras) => [...letras].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);
const letraColumna = (n) => (n > 26 ? letraColumna(Math.floor((n - 1) / 26)) : '') + String.fromCharCode(65 + ((n - 1) % 26));

class Rango {
  constructor(hoja, fila, columna, filas, columnas) {
    Object.assign(this, { hoja, fila, columna, filas, columnas });
  }
  getValues() {
    return Array.from({ length: this.filas }, (_, i) =>
      Array.from({ length: this.columnas }, (_, j) => this.hoja.leerCelda(this.fila + i, this.columna + j)),
    );
  }
  getValue() {
    return this.getValues()[0][0];
  }
  /** Como en Apps Script: un texto que empieza con «=» se toma como fórmula. */
  setValues(valores) {
    valores.forEach((fila, i) => fila.forEach((v, j) => this.hoja.escribir(this.fila + i, this.columna + j, v)));
    return conFormatoLibre(this);
  }
  setValue(valor) {
    return this.setValues([[valor]]);
  }
  setFormulas(formulas) {
    return this.setValues(formulas);
  }
  setFormula(formula) {
    return this.setFormulas([[formula]]);
  }
  getFormula() {
    return this.hoja.formulas.get(`${this.fila},${this.columna}`) ?? '';
  }
  getFormulas() {
    return Array.from({ length: this.filas }, (_, i) =>
      Array.from({ length: this.columnas }, (_, j) => this.hoja.formulas.get(`${this.fila + i},${this.columna + j}`) ?? ''),
    );
  }
  clearContent() {
    for (let i = 0; i < this.filas; i++) for (let j = 0; j < this.columnas; j++) this.hoja.escribir(this.fila + i, this.columna + j, '');
    return conFormatoLibre(this);
  }
  getA1Notation() {
    return `${letraColumna(this.columna)}${this.fila}:${letraColumna(this.columna + this.columnas - 1)}${this.fila + this.filas - 1}`;
  }
  getSheet() {
    return this.hoja;
  }
  setDataValidation(regla) {
    this.hoja.validaciones.push({ rango: this.getA1Notation(), regla });
    return conFormatoLibre(this);
  }
}

class Hoja {
  constructor(nombre, libro) {
    this.nombre = nombre;
    this.libro = libro;
    this.celdas = []; // celdas[fila-1][columna-1]
    this.formulas = new Map(); // "fila,columna" -> fórmula
    this.malInterpretadas = new Set(); // fórmulas con «,» escritas con la planilla en una configuración que usa «;»
    this.protecciones = [];
    this.reglasFormato = [];
    this.validaciones = [];
  }
  getName() {
    return this.nombre;
  }
  /**
   * Como en la planilla real: setValues y setFormula interpretan la fórmula con la configuración
   * regional de la planilla. En es_AR los argumentos van con «;», así que una fórmula con «,» queda
   * en #ERROR! (y sigue así aunque después se cambie la configuración, hasta que se vuelva a escribir).
   */
  escribir(fila, columna, valor) {
    const clave = `${fila},${columna}`;
    this.libro.version++;
    this.malInterpretadas.delete(clave);
    if (typeof valor === 'string' && valor.startsWith('=')) {
      this.formulas.set(clave, valor);
      if (usaPuntoYComa(this.libro.locale) && tieneComaFueraDeTexto(valor)) this.malInterpretadas.add(clave);
      valor = '';
    } else {
      this.formulas.delete(clave);
    }
    while (this.celdas.length < fila) this.celdas.push([]);
    this.celdas[fila - 1][columna - 1] = valor;
  }
  /** Valor visible de una celda: el resultado de su fórmula, el derrame de una fórmula vecina o lo escrito. */
  leerCelda(fila, columna) {
    if (this.malInterpretadas.has(`${fila},${columna}`)) return '#ERROR!';
    const formula = this.formulas.get(`${fila},${columna}`);
    if (formula) {
      const v = this.libro.evaluar(this, fila, columna, formula);
      if (esError(v)) return v.error;
      return Array.isArray(v) ? (v[0]?.[0] ?? '') : v;
    }
    for (const [clave, f] of this.formulas) {
      if (!esFormulaMatricial(f)) continue;
      const [ff, fc] = clave.split(',').map(Number);
      if (ff > fila || fc > columna) continue;
      const v = this.libro.evaluar(this, ff, fc, f);
      if (Array.isArray(v) && fila - ff < v.length && columna - fc < v[0].length) return v[fila - ff][columna - fc];
    }
    return this.celdas[fila - 1]?.[columna - 1] ?? '';
  }
  getLastRow() {
    for (let i = this.celdas.length; i > 0; i--) if (this.celdas[i - 1].some((v) => v !== '' && v !== undefined)) return i;
    return 0;
  }
  getLastColumn() {
    return Math.max(0, ...this.celdas.map((f) => f.length));
  }
  getMaxColumns() {
    return Math.max(26, this.getLastColumn());
  }
  getRange(a, b, c = 1, d = 1) {
    if (typeof a === 'string') {
      const [, c1, f1, c2, f2] = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?$/.exec(a);
      const col1 = indiceColumna(c1);
      const col2 = c2 ? indiceColumna(c2) : col1;
      const fila2 = c2 ? (f2 ? Number(f2) : 1000) : Number(f1);
      return conFormatoLibre(new Rango(this, Number(f1), col1, fila2 - Number(f1) + 1, col2 - col1 + 1));
    }
    return conFormatoLibre(new Rango(this, a, b, c, d));
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(1, this.libro.ultimaFila(this)), Math.max(1, this.getLastColumn()));
  }
  appendRow(fila) {
    const n = this.getLastRow() + 1;
    fila.forEach((v, j) => this.escribir(n, j + 1, v));
    return conFormatoLibre(this);
  }
  protect() {
    const proteccion = conFormatoLibre({});
    this.protecciones.push(proteccion);
    return proteccion;
  }
  getProtections() {
    return this.protecciones;
  }
  setConditionalFormatRules(reglas) {
    this.reglasFormato = reglas;
  }
  getConditionalFormatRules() {
    return this.reglasFormato;
  }
  /** Para los tests: filas de datos (valores calculados) sin el encabezado. */
  filasDeDatos() {
    return this.getDataRange().getValues().slice(1);
  }
}

class Libro {
  /** Una planilla nueva de una cuenta argentina arranca en es_AR, como la del grupo. */
  constructor(hojasIniciales = ['Hoja 1'], locale = 'es_AR') {
    this.locale = locale;
    this.version = 0;
    this.cache = new Map();
    this.enCurso = new Set();
    this.nombres = new Map(); // rango con nombre -> { hoja, desde, hasta }
    this.hojas = hojasIniciales.map((n) => conFormatoLibre(new Hoja(n, this)));
    this.zona = 'America/Argentina/Buenos_Aires';
  }
  getSheetByName(nombre) {
    return this.hojas.find((h) => h.getName() === nombre) ?? null;
  }
  insertSheet(nombre) {
    const hoja = conFormatoLibre(new Hoja(nombre, this));
    this.hojas.push(hoja);
    return hoja;
  }
  getSheets() {
    return [...this.hojas];
  }
  deleteSheet(hoja) {
    this.hojas = this.hojas.filter((h) => h !== hoja);
  }
  setActiveSheet(hoja) {
    return hoja;
  }
  setSpreadsheetTimeZone(zona) {
    this.zona = zona;
  }
  getSpreadsheetTimeZone() {
    return this.zona;
  }
  setSpreadsheetLocale(locale) {
    this.locale = locale;
    this.version++;
  }
  getSpreadsheetLocale() {
    return this.locale;
  }
  setNamedRange(nombre, rango) {
    const [desde, hasta] = rango.getA1Notation().split(':');
    // Un rango que llega a la fila 1000 se toma abierto (A2:A), como lo crea Code.gs.
    const abierto = rango.fila + rango.filas - 1 >= 1000;
    this.nombres.set(nombre, {
      hoja: rango.getSheet().getName(),
      desde,
      hasta: abierto ? hasta.replace(/\d+$/, '') : desde === hasta ? null : hasta,
    });
  }
  rangoConNombre(nombre) {
    return this.nombres.get(nombre) ?? null;
  }
  getRangeByName(nombre) {
    return this.nombres.has(nombre) ? conFormatoLibre({ nombre }) : null;
  }
  removeNamedRange(nombre) {
    this.nombres.delete(nombre);
  }
  getNamedRanges() {
    return [...this.nombres.keys()].map((n) => ({ getName: () => n }));
  }
  /** Última fila con algo: valores, fórmulas o derrames. */
  ultimaFila(hoja) {
    let ultima = hoja.getLastRow();
    for (const [clave, f] of hoja.formulas) {
      const [fila, columna] = clave.split(',').map(Number);
      ultima = Math.max(ultima, fila);
      if (esFormulaMatricial(f)) {
        const v = this.evaluar(hoja, fila, columna, f);
        if (Array.isArray(v)) ultima = Math.max(ultima, fila + v.length - 1);
      }
    }
    return ultima;
  }
  evaluar(hoja, fila, columna, formula) {
    const clave = `${hoja.nombre}!${fila},${columna}`;
    if (this.versionCache !== this.version) {
      this.cache.clear();
      this.versionCache = this.version;
    }
    if (this.cache.has(clave)) return this.cache.get(clave);
    if (this.enCurso.has(clave)) return { error: '#REF!' }; // referencia circular
    this.enCurso.add(clave);
    let v;
    try {
      v = evaluarFormula(formula, { libro: this, hoja });
    } finally {
      this.enCurso.delete(clave);
    }
    this.cache.set(clave, v);
    return v;
  }
}

/** Constructor de reglas encadenable, como SpreadsheetApp.newConditionalFormatRule(). */
function constructorDeRegla() {
  const regla = {};
  const c = new Proxy(regla, {
    get(destino, prop) {
      if (prop === 'build') return () => ({ ...destino });
      return (...args) => {
        destino[prop] = args.length > 1 ? args : args[0];
        return c;
      };
    },
  });
  return c;
}

function formatearFecha(fecha, _zona, formato) {
  const local = new Date(fecha.getTime() - 3 * 3600 * 1000);
  const dos = (n) => String(n).padStart(2, '0');
  const partes = {
    yyyy: String(local.getUTCFullYear()),
    MM: dos(local.getUTCMonth() + 1),
    dd: dos(local.getUTCDate()),
    HH: dos(local.getUTCHours()),
    mm: dos(local.getUTCMinutes()),
    ss: dos(local.getUTCSeconds()),
  };
  return formato.replace(/'([^']*)'|yyyy|MM|dd|HH|mm|ss/g, (m, literal) => literal ?? partes[m]);
}

/** Crea los servicios simulados y carga apps-script/conteo-ciclico.gs. Devuelve el contexto con las funciones globales. */
export function cargarServidor({ hojasIniciales } = {}) {
  const libro = conFormatoLibre(new Libro(hojasIniciales));
  const contexto = vm.createContext({ console });
  // Las fechas tienen que ser del mismo «mundo» que el código del servidor, si no falla `instanceof Date`.
  const FechaServidor = vm.runInContext('Date', contexto);
  const interpretarFecha = (texto, _zona, formato) => {
    if (formato === 'yyyy-MM-dd') return new FechaServidor(`${texto}T00:00:00${DESFASE}`);
    if (formato === 'yyyy-MM-dd HH:mm:ss') return new FechaServidor(`${texto.replace(' ', 'T')}${DESFASE}`);
    throw new Error(`Formato no simulado: ${formato}`);
  };
  const ui = {
    respuestas: [],
    preguntas: [],
    alertas: [],
    Button: { YES: 'YES', NO: 'NO', OK: 'OK', CANCEL: 'CANCEL' },
    ButtonSet: { YES_NO: 'YES_NO', OK: 'OK', OK_CANCEL: 'OK_CANCEL' },
    /** prompt: la próxima respuesta es el texto que se escribe; null es «Cancelar». */
    prompt(_titulo, texto) {
      this.preguntas.push(texto);
      const r = this.respuestas.shift();
      return { getSelectedButton: () => (r === null ? 'CANCEL' : 'OK'), getResponseText: () => r ?? '' };
    },
    /** alert(titulo, texto, botones) es una pregunta; alert(texto) es un aviso. */
    alert(...args) {
      if (args.length >= 3) {
        this.preguntas.push(args[1]);
        return this.respuestas.shift() ?? 'YES';
      }
      this.alertas.push(args[0]);
      return 'OK';
    },
    createMenu: () => conFormatoLibre({}),
  };
  let conInterfaz = false;
  Object.assign(contexto, {
    SpreadsheetApp: {
      getActive: () => libro,
      getActiveSpreadsheet: () => libro,
      getUi: () => {
        if (!conInterfaz) throw new Error('Sin interfaz (simulador)');
        return ui;
      },
      flush: () => {},
      newConditionalFormatRule: constructorDeRegla,
      newDataValidation: constructorDeRegla,
      ProtectionType: { SHEET: 'SHEET' },
    },
    Utilities: { formatDate: formatearFecha, parseDate: interpretarFecha, getUuid: randomUUID },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (contenido) => ({ setMimeType() { return this; }, getContent: () => contenido }),
    },
  });
  const codigo = readFileSync(new URL('../apps-script/conteo-ciclico.gs', import.meta.url), 'utf8');
  new vm.Script(codigo, { filename: 'conteo-ciclico.gs' }).runInContext(contexto);

  const post = (cuerpo) => JSON.parse(contexto.doPost({ postData: { contents: JSON.stringify(cuerpo) } }).getContent());
  const get = (parametros) => JSON.parse(contexto.doGet({ parameter: parametros }).getContent());
  /** fetch simulado: lo que haría el navegador contra la URL del Web App. */
  const fetch = async (_url, opciones) => {
    const respuesta = contexto.doPost({ postData: { contents: opciones.body } }).getContent();
    return { ok: true, status: 200, json: async () => JSON.parse(respuesta) };
  };
  /**
   * Corre una función del menú como si la tocara alguien en la planilla, con las respuestas dadas a
   * las preguntas (Sí por defecto). Devuelve los avisos que se mostraron.
   */
  const desdeMenu = (funcion, respuestas = []) => {
    conInterfaz = true;
    ui.respuestas = [...respuestas];
    ui.preguntas = [];
    ui.alertas = [];
    try {
      contexto[funcion]();
    } finally {
      conInterfaz = false;
    }
    return ui.alertas;
  };
  return { contexto, libro, hoja: (n) => libro.getSheetByName(n), post, get, fetch, desdeMenu };
}
