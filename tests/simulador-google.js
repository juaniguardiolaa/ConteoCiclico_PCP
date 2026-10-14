// Simulador mínimo de los servicios de Google que usa apps-script/Code.gs (SpreadsheetApp,
// Utilities, LockService, ContentService), para probar el servidor en Node sin publicarlo.
// No calcula fórmulas: solo las guarda. Los formatos (colores, negrita, etc.) no hacen nada.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

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

const indiceColumna = (letras) => [...letras].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);

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
  setValues(valores) {
    valores.forEach((fila, i) => fila.forEach((v, j) => this.hoja.escribirCelda(this.fila + i, this.columna + j, v)));
    return conFormatoLibre(this);
  }
  setValue(valor) {
    return this.setValues([[valor]]);
  }
  setFormula(formula) {
    this.hoja.formulas.set(`${this.fila},${this.columna}`, formula);
    return conFormatoLibre(this);
  }
  getFormula() {
    return this.hoja.formulas.get(`${this.fila},${this.columna}`) ?? '';
  }
  clearContent() {
    for (let i = 0; i < this.filas; i++) for (let j = 0; j < this.columnas; j++) this.hoja.escribirCelda(this.fila + i, this.columna + j, '');
    return conFormatoLibre(this);
  }
}

class Hoja {
  constructor(nombre) {
    this.nombre = nombre;
    this.celdas = []; // celdas[fila-1][columna-1]
    this.formulas = new Map();
    this.protecciones = [];
  }
  getName() {
    return this.nombre;
  }
  leerCelda(fila, columna) {
    return this.celdas[fila - 1]?.[columna - 1] ?? '';
  }
  escribirCelda(fila, columna, valor) {
    while (this.celdas.length < fila) this.celdas.push([]);
    this.celdas[fila - 1][columna - 1] = valor;
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
    return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
  }
  appendRow(fila) {
    const n = this.getLastRow() + 1;
    fila.forEach((v, j) => this.escribirCelda(n, j + 1, v));
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
  /** Para los tests: filas de datos sin el encabezado. */
  filasDeDatos() {
    return this.getDataRange().getValues().slice(1);
  }
}

class Libro {
  constructor(hojasIniciales = ['Hoja 1']) {
    this.hojas = hojasIniciales.map((n) => conFormatoLibre(new Hoja(n)));
    this.zona = 'America/Argentina/Buenos_Aires';
  }
  getSheetByName(nombre) {
    return this.hojas.find((h) => h.getName() === nombre) ?? null;
  }
  insertSheet(nombre) {
    const hoja = conFormatoLibre(new Hoja(nombre));
    this.hojas.push(hoja);
    return hoja;
  }
  getSheets() {
    return [...this.hojas];
  }
  deleteSheet(hoja) {
    this.hojas = this.hojas.filter((h) => h !== hoja);
  }
  setSpreadsheetTimeZone(zona) {
    this.zona = zona;
  }
  getSpreadsheetTimeZone() {
    return this.zona;
  }
  setSpreadsheetLocale() {}
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
  const libro = new Libro(hojasIniciales);
  const contexto = vm.createContext({ console });
  // Las fechas tienen que ser del mismo «mundo» que el código del servidor, si no falla `instanceof Date`.
  const FechaServidor = vm.runInContext('Date', contexto);
  const interpretarFecha = (texto, _zona, formato) => {
    if (formato === 'yyyy-MM-dd') return new FechaServidor(`${texto}T00:00:00${DESFASE}`);
    if (formato === 'yyyy-MM-dd HH:mm:ss') return new FechaServidor(`${texto.replace(' ', 'T')}${DESFASE}`);
    throw new Error(`Formato no simulado: ${formato}`);
  };
  Object.assign(contexto, {
    SpreadsheetApp: {
      getActive: () => libro,
      getActiveSpreadsheet: () => libro,
      getUi: () => {
        throw new Error('Sin interfaz (simulador)');
      },
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
  return { contexto, libro, hoja: (n) => libro.getSheetByName(n), post, get, fetch };
}
