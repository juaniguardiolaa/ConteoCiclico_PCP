// Exporta los datos del caso desde el Excel de la cátedra: npm run datos
// Genera docs/js/datos/caso.js (app y tests) y apps-script/Datos.gs (Google Sheets).
// Los valores se copian tal cual; solo se normalizan fechas (AAAA-MM-DD) y textos (sin espacios de más).
import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const raiz = (ruta) => fileURLToPath(new URL(`../${ruta}`, import.meta.url));
const ORIGEN = 'data/Historico_Transacciones_TP6_2026.xlsx';

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());
const fecha = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : texto(v));

// Devuelve las filas de una hoja a partir de la fila de encabezados que empieza con `primerEncabezado`.
function leerTabla(hoja, primerEncabezado) {
  const filas = [];
  let encabezado = null;
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const valores = fila.values.slice(1).map((v) => (v && typeof v === 'object' && 'result' in v ? v.result : v));
    if (!encabezado) {
      if (texto(valores[0]).toUpperCase() === primerEncabezado.toUpperCase()) encabezado = valores.map(texto);
      return;
    }
    if (valores.every((v) => texto(v) === '')) return;
    filas.push(valores);
  });
  if (!encabezado) throw new Error(`No se encontró el encabezado "${primerEncabezado}" en la hoja ${hoja.name}`);
  return filas;
}

const libro = new ExcelJS.Workbook();
await libro.xlsx.readFile(raiz(ORIGEN));
const hoja = (nombre) => {
  const h = libro.getWorksheet(nombre);
  if (!h) throw new Error(`Falta la hoja "${nombre}" en ${ORIGEN}`);
  return h;
};

const fotoStock = (filas) =>
  filas.map(([codigo, descripcion, lote, posicion, stock]) => ({
    codigo: texto(codigo),
    descripcion: texto(descripcion),
    lote: texto(lote),
    posicion: texto(posicion),
    stock: Number(stock),
  }));

const stock3009 = fotoStock(leerTabla(hoja('Stock 3009'), 'CODIGO'));
const stock1410 = fotoStock(leerTabla(hoja('Stock 1410'), 'CODIGO'));

const movimientos = leerTabla(hoja('Transacciones'), 'Fecha').map(
  ([f, codigo, lote, cantidad, um, tipo, posicion]) => ({
    fecha: fecha(f),
    codigo: texto(codigo),
    lote: texto(lote),
    cantidad: Number(cantidad),
    um: texto(um),
    tipo: texto(tipo),
    posicion: texto(posicion),
  }),
);

// Maestro de materiales: los 10 códigos aparecen en la foto del 30/09, con su descripción.
const umPorCodigo = new Map(movimientos.map((m) => [m.codigo, m.um]));
const materiales = [...new Map(stock3009.map((s) => [s.codigo, s.descripcion])).entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([codigo, descripcion]) => ({ codigo, descripcion, um: umPorCodigo.get(codigo) || 'UN' }));

// Maestro de posiciones: sale del layout "Pos Inicial" (vista de frente, nivel 4 arriba).
// Las columnas A–D forman el bloque 1 y E–G el bloque 2 (separadas por una columna vacía).
const posiciones = [];
hoja('Pos Inicial').eachRow({ includeEmpty: false }, (fila) => {
  fila.values.slice(1).forEach((v) => {
    const p = texto(v);
    if (/^[A-Z][0-9]+$/.test(p)) {
      const columna = p[0];
      posiciones.push({ posicion: p, bloque: columna <= 'D' ? 1 : 2, columna, nivel: Number(p.slice(1)) });
    }
  });
});
posiciones.sort((a, b) => a.posicion.localeCompare(b.posicion));

const tiposMovimiento = leerTabla(hoja('TipoMov'), 'Seleccionar').map(([t]) => texto(t));

const caso = {
  campania: 'CC-2026-10-14',
  fechaStockInicial: fecha(hoja('Stock 3009').getCell('E1').value),
  fechaDesde: '2026-10-01',
  fechaConteo: fecha(hoja('Stock 1410').getCell('E2').value),
  materiales,
  posiciones,
  tiposMovimiento,
  stock3009,
  movimientos,
  stock1410,
};

// Un registro por línea, para que el archivo se pueda revisar a ojo contra el Excel.
const formatear = (objeto) =>
  '{\n' +
  Object.entries(objeto)
    .map(([clave, valor]) =>
      Array.isArray(valor) && typeof valor[0] === 'object'
        ? `  ${clave}: [\n${valor.map((v) => `    ${JSON.stringify(v)},`).join('\n')}\n  ]`
        : `  ${clave}: ${JSON.stringify(valor)}`,
    )
    .join(',\n') +
  ',\n}';
const json = formatear(caso);
const aviso = `Generado por scripts/exportar-datos.mjs desde ${ORIGEN}. No editar a mano: correr npm run datos.`;

await writeFile(
  raiz('docs/js/datos/caso.js'),
  `// ${aviso}\n// stock1410 es el conteo físico del enunciado: solo se usa en tests y en el modo demo.\nexport const CASO = ${json};\n`,
);
await writeFile(
  raiz('apps-script/Datos.gs'),
  `// ${aviso}\n// stock1410 no se carga en el Sheet: es lo que se captura con la app.\nconst DATOS_CASO = ${json};\n`,
);

console.log(
  `Exportado: ${materiales.length} materiales, ${posiciones.length} posiciones, ` +
    `${stock3009.length} filas de stock al ${caso.fechaStockInicial}, ${movimientos.length} movimientos, ` +
    `${stock1410.length} filas de stock al ${caso.fechaConteo}.`,
);
