// Evaluador mínimo de fórmulas de Google Sheets para el simulador. Alcanza para las fórmulas que
// escribe apps-script/Code.gs (SUMIFS, COUNTIFS, COUNTIF, SUM, COUNTA, COUNTUNIQUE, IF, IFERROR,
// ABS, VLOOKUP, FILTER, UNIQUE, SORT, matrices {…}, rangos con nombre). No pretende ser completo:
// sirve para comprobar en los tests que las fórmulas dan la conciliación esperada. La prueba final
// es la propia planilla, donde el servidor compara lo que calcula la hoja con el cálculo de la app.

export const ERROR_NA = { error: '#N/A' };
const ERROR_VALOR = { error: '#VALUE!' };
export const esError = (v) => Boolean(v) && typeof v === 'object' && 'error' in v;

/** Número de serie de fecha de Sheets (días desde 30/12/1899), en hora de Argentina. */
export const serialDeFecha = (fecha) => (fecha.getTime() - 3 * 3600e3) / 86400e3 + 25569;
const esFecha = (v) => Object.prototype.toString.call(v) === '[object Date]';

// ---------------------------------------------------------------------------------------------
// Tokens

const RE_REFERENCIA = /^(?:([A-Za-z_][A-Za-z0-9_]*)!)?(\$?[A-Z]{1,3}\$?\d*)(?::(\$?[A-Z]{1,3}\$?\d*))?(?![A-Za-z0-9_(])/;

function tokenizar(texto) {
  const tokens = [];
  let i = 0;
  while (i < texto.length) {
    const resto = texto.slice(i);
    const c = texto[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < texto.length) {
        if (texto[j] === '"') {
          if (texto[j + 1] === '"') {
            s += '"';
            j += 2;
            continue;
          }
          break;
        }
        s += texto[j++];
      }
      tokens.push({ t: 'texto', v: s });
      i = j + 1;
      continue;
    }
    let m = /^\d+(\.\d+)?/.exec(resto);
    if (m) {
      tokens.push({ t: 'numero', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    m = RE_REFERENCIA.exec(resto);
    if (m) {
      tokens.push({ t: 'ref', hoja: m[1] ?? null, desde: m[2], hasta: m[3] ?? null });
      i += m[0].length;
      continue;
    }
    m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(resto);
    if (m) {
      const nombre = m[0].toUpperCase();
      if (texto[i + m[0].length] === '(') tokens.push({ t: 'funcion', v: nombre });
      else if (nombre === 'TRUE' || nombre === 'FALSE') tokens.push({ t: 'logico', v: nombre === 'TRUE' });
      else tokens.push({ t: 'nombre', v: m[0] });
      i += m[0].length;
      continue;
    }
    m = /^(<=|>=|<>|[-+*/&=<>(),;{}])/.exec(resto);
    if (m) {
      tokens.push({ t: 'op', v: m[0] });
      i += m[0].length;
      continue;
    }
    throw new Error(`No se entiende la fórmula cerca de «${resto.slice(0, 15)}»`);
  }
  return tokens;
}

// ---------------------------------------------------------------------------------------------
// Árbol

function analizar(formula) {
  const tokens = tokenizar(formula.replace(/^=/, ''));
  let p = 0;
  const ver = () => tokens[p];
  const es = (v) => ver()?.t === 'op' && ver().v === v;
  const tomar = (v) => {
    if (!es(v)) throw new Error(`Se esperaba «${v}» en ${formula}`);
    p++;
  };

  const binaria = (siguiente, ops) => () => {
    let izq = siguiente();
    while (ver()?.t === 'op' && ops.includes(ver().v)) {
      const op = tokens[p++].v;
      izq = { t: 'bin', op, izq, der: siguiente() };
    }
    return izq;
  };
  const primaria = () => {
    const tok = tokens[p++];
    if (!tok) throw new Error(`Fórmula incompleta: ${formula}`);
    if (tok.t === 'numero' || tok.t === 'texto' || tok.t === 'logico') return { t: 'valor', v: tok.v };
    if (tok.t === 'ref' || tok.t === 'nombre') return tok;
    if (tok.t === 'funcion') {
      tomar('(');
      const args = [];
      if (!es(')')) {
        args.push(expresion());
        while (es(',')) {
          p++;
          args.push(expresion());
        }
      }
      tomar(')');
      return { t: 'llamada', nombre: tok.v, args };
    }
    if (tok.t === 'op' && tok.v === '(') {
      const e = expresion();
      tomar(')');
      return e;
    }
    if (tok.t === 'op' && tok.v === '{') {
      const filas = [[expresion()]];
      while (es(',') || es(';')) {
        if (tokens[p++].v === ';') filas.push([]);
        filas.at(-1).push(expresion());
      }
      tomar('}');
      return { t: 'matriz', filas };
    }
    if (tok.t === 'op' && (tok.v === '-' || tok.v === '+')) return { t: 'unaria', op: tok.v, v: primaria() };
    throw new Error(`Token inesperado en ${formula}`);
  };
  const multiplicativa = binaria(primaria, ['*', '/']);
  const aditiva = binaria(multiplicativa, ['+', '-']);
  const concatenacion = binaria(aditiva, ['&']);
  const expresion = binaria(concatenacion, ['=', '<>', '<', '>', '<=', '>=']);

  const arbol = expresion();
  if (p !== tokens.length) throw new Error(`Sobra texto en la fórmula ${formula}`);
  return arbol;
}

// ---------------------------------------------------------------------------------------------
// Valores

const letrasANumero = (letras) => [...letras].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);

function celdaRef(texto) {
  const [, col, fila] = /^\$?([A-Z]+)\$?(\d*)$/.exec(texto);
  return { col: letrasANumero(col), fila: fila ? Number(fila) : null };
}

function resolverRango(tok, entorno) {
  const hoja = tok.hoja ? entorno.libro.getSheetByName(tok.hoja) : entorno.hoja;
  if (!hoja) throw new Error(`No existe la hoja ${tok.hoja}`);
  const a = celdaRef(tok.desde);
  const b = tok.hasta ? celdaRef(tok.hasta) : a;
  const f1 = a.fila ?? 1;
  const f2 = b.fila ?? Math.max(f1, entorno.libro.ultimaFila(hoja));
  return { rango: true, hoja, f1, c1: a.col, f2, c2: b.col };
}

function matriz(v) {
  if (v?.rango) {
    const filas = [];
    for (let f = v.f1; f <= v.f2; f++) {
      const fila = [];
      for (let c = v.c1; c <= v.c2; c++) fila.push(v.hoja.leerCelda(f, c));
      filas.push(fila);
    }
    return filas;
  }
  if (Array.isArray(v)) return v;
  return [[v]];
}

/** Rango de una celda o valor suelto -> escalar; rango de varias celdas -> matriz. */
function valor(v) {
  if (v?.rango) return v.f1 === v.f2 && v.c1 === v.c2 ? v.hoja.leerCelda(v.f1, v.c1) : matriz(v);
  return v;
}

const plano = (v) => matriz(v).flat();

function aNumero(v) {
  if (typeof v === 'number') return v;
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (esFecha(v)) return serialDeFecha(v);
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return ERROR_VALOR;
}

function aTexto(v) {
  if (esFecha(v)) return String(serialDeFecha(v));
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v === null || v === undefined ? '' : String(v);
}

function comparar(a, b) {
  const numA = typeof a === 'number' || esFecha(a) ? aNumero(a) : null;
  const numB = typeof b === 'number' || esFecha(b) ? aNumero(b) : null;
  if (numA !== null && numB !== null) return numA - numB;
  if (a === '' && numB !== null) return 0 - numB;
  if (b === '' && numA !== null) return numA;
  return aTexto(a).toLowerCase().localeCompare(aTexto(b).toLowerCase());
}

/** Criterio de SUMIFS/COUNTIFS: "OK", "<>OK", ">=46296", "<0", un número o una celda vacía. */
function coincide(celda, criterio) {
  if (typeof criterio === 'number') return aNumero(celda) === criterio && celda !== '';
  if (typeof criterio === 'boolean') return celda === criterio;
  const [, op = '', resto] = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(aTexto(criterio));
  if (/^-?\d+(\.\d+)?$/.test(resto)) {
    const n = Number(resto);
    const esNumero = typeof celda === 'number' || esFecha(celda);
    if (!esNumero) return op === '<>';
    const v = aNumero(celda);
    return { '': v === n, '=': v === n, '<>': v !== n, '<': v < n, '>': v > n, '<=': v <= n, '>=': v >= n }[op];
  }
  const t = aTexto(celda).toLowerCase();
  const r = resto.toLowerCase();
  if (op === '' || op === '=') return r === '' ? celda === '' : t === r;
  if (op === '<>') return r === '' ? celda !== '' : t !== r;
  const d = t.localeCompare(r);
  return { '<': d < 0, '>': d > 0, '<=': d <= 0, '>=': d >= 0 }[op];
}

function elementoAElemento(a, b, fn) {
  if (esError(a)) return a;
  if (esError(b)) return b;
  if (!Array.isArray(a) && !Array.isArray(b)) return fn(a, b);
  const A = Array.isArray(a) ? a : null;
  const B = Array.isArray(b) ? b : null;
  const filas = (A ?? B).length;
  const columnas = (A ?? B)[0].length;
  return Array.from({ length: filas }, (_, i) =>
    Array.from({ length: columnas }, (_, j) => fn(A ? A[i][j] : a, B ? B[i][j] : b)),
  );
}

const OPERADORES = {
  '+': (a, b) => [aNumero(a), aNumero(b)].find(esError) ?? aNumero(a) + aNumero(b),
  '-': (a, b) => [aNumero(a), aNumero(b)].find(esError) ?? aNumero(a) - aNumero(b),
  '*': (a, b) => [aNumero(a), aNumero(b)].find(esError) ?? aNumero(a) * aNumero(b),
  '/': (a, b) => (aNumero(b) === 0 ? { error: '#DIV/0!' } : aNumero(a) / aNumero(b)),
  '&': (a, b) => aTexto(a) + aTexto(b),
  '=': (a, b) => comparar(a, b) === 0,
  '<>': (a, b) => comparar(a, b) !== 0,
  '<': (a, b) => comparar(a, b) < 0,
  '>': (a, b) => comparar(a, b) > 0,
  '<=': (a, b) => comparar(a, b) <= 0,
  '>=': (a, b) => comparar(a, b) >= 0,
};

function sumarSi(rangoSuma, pares) {
  const sumas = plano(rangoSuma);
  const criterios = [];
  for (let i = 0; i < pares.length; i += 2) criterios.push([plano(pares[i]), valor(pares[i + 1])]);
  let total = 0;
  sumas.forEach((v, k) => {
    if (criterios.every(([rango, criterio]) => coincide(rango[k] ?? '', criterio))) {
      const n = aNumero(v);
      if (!esError(n)) total += n;
    }
  });
  return total;
}

function contarSi(pares) {
  const criterios = [];
  for (let i = 0; i < pares.length; i += 2) criterios.push([plano(pares[i]), valor(pares[i + 1])]);
  return criterios[0][0].filter((_, k) => criterios.every(([rango, criterio]) => coincide(rango[k] ?? '', criterio))).length;
}

const FUNCIONES = {
  SUMIFS: ([suma, ...pares]) => sumarSi(suma, pares),
  COUNTIFS: (pares) => contarSi(pares),
  COUNTIF: (pares) => contarSi(pares),
  SUM: (args) => args.flatMap(plano).reduce((t, v) => t + (typeof v === 'number' ? v : 0), 0),
  COUNTA: (args) => args.flatMap(plano).filter((v) => v !== '' && v !== null && v !== undefined).length,
  COUNTUNIQUE: (args) => {
    const vistos = args.flatMap((a) => (esError(a) ? [] : plano(a))).filter((v) => v !== '');
    return new Set(vistos.map((v) => aTexto(v).toLowerCase())).size;
  },
  ABS: ([x]) => {
    const n = aNumero(valor(x));
    return esError(n) ? n : Math.abs(n);
  },
  VLOOKUP: ([clave, tabla, indice]) => {
    const k = valor(clave);
    const fila = matriz(tabla).find((f) => comparar(f[0], k) === 0 && f[0] !== '');
    return fila ? fila[aNumero(valor(indice)) - 1] ?? '' : ERROR_NA;
  },
  FILTER: ([datos, ...condiciones]) => {
    const filas = matriz(datos);
    const conds = condiciones.map((c) => plano(c));
    const quedan = filas.filter((_, i) => conds.every((c) => c[i] === true));
    return quedan.length ? quedan : ERROR_NA;
  },
  UNIQUE: ([datos]) => {
    if (esError(datos)) return datos;
    const vistos = new Set();
    return matriz(datos).filter((f) => {
      const clave = JSON.stringify(f.map(aTexto));
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
  },
  SORT: ([datos]) => {
    if (esError(datos)) return datos;
    return [...matriz(datos)].sort((a, b) => {
      for (let j = 0; j < a.length; j++) {
        const d = comparar(a[j], b[j]);
        if (d) return d;
      }
      return 0;
    });
  },
};

function evaluarNodo(nodo, entorno) {
  switch (nodo.t) {
    case 'valor':
      return nodo.v;
    case 'ref':
      return resolverRango(nodo, entorno);
    case 'nombre': {
      const rango = entorno.libro.rangoConNombre(nodo.v);
      if (!rango) throw new Error(`No existe el rango con nombre ${nodo.v}`);
      return resolverRango(rango, entorno);
    }
    case 'unaria': {
      const v = valor(evaluarNodo(nodo.v, entorno));
      return elementoAElemento(v, 0, (a) => (nodo.op === '-' ? -aNumero(a) : aNumero(a)));
    }
    case 'bin': {
      const izq = valor(evaluarNodo(nodo.izq, entorno));
      const der = valor(evaluarNodo(nodo.der, entorno));
      return elementoAElemento(izq, der, OPERADORES[nodo.op]);
    }
    case 'matriz': {
      const bloques = nodo.filas.map((fila) => {
        const partes = fila.map((e) => matriz(valor(evaluarNodo(e, entorno))));
        return partes[0].map((_, i) => partes.flatMap((p) => p[i]));
      });
      return bloques.flat();
    }
    case 'llamada': {
      if (nodo.nombre === 'IF') {
        const condicion = valor(evaluarNodo(nodo.args[0], entorno));
        if (esError(condicion)) return condicion;
        const rama = condicion === true || (typeof condicion === 'number' && condicion !== 0) ? 1 : 2;
        return nodo.args[rama] ? valor(evaluarNodo(nodo.args[rama], entorno)) : false;
      }
      if (nodo.nombre === 'IFERROR') {
        const v = valor(evaluarNodo(nodo.args[0], entorno));
        return esError(v) ? valor(evaluarNodo(nodo.args[1], entorno)) : v;
      }
      const funcion = FUNCIONES[nodo.nombre];
      if (!funcion) throw new Error(`Función no simulada: ${nodo.nombre}`);
      const args = nodo.args.map((a) => {
        const v = evaluarNodo(a, entorno);
        return v?.rango ? v : valor(v);
      });
      const error = args.find(esError);
      if (error && !['COUNTUNIQUE', 'UNIQUE', 'SORT'].includes(nodo.nombre)) return error;
      return funcion(args);
    }
    default:
      throw new Error(`Nodo desconocido ${nodo.t}`);
  }
}

const arboles = new Map();

/** Evalúa una fórmula. Devuelve un escalar, una matriz (si derrama) o un error {error}. */
export function evaluarFormula(formula, entorno) {
  if (!arboles.has(formula)) arboles.set(formula, analizar(formula));
  return valor(evaluarNodo(arboles.get(formula), entorno));
}

/** Fórmulas que pueden devolver una matriz y derramarse en las celdas vecinas. */
export const esFormulaMatricial = (formula) => /^=\s*(SORT|UNIQUE|FILTER|ARRAYFORMULA)\(|\{/i.test(formula);
