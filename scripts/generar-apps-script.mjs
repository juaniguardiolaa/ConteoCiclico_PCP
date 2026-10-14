// Arma el código del servidor a partir de la misma lógica de la app: npm run apps-script
//
//   apps-script/Dominio.gs         docs/js/dominio sin import/export (Apps Script no usa módulos)
//   apps-script/conteo-ciclico.gs  Datos.gs + Dominio.gs + Code.gs: el archivo único que se pega
//                                  en el editor de Apps Script
//
// Así las validaciones y la conciliación son las mismas en el celular y en la planilla.
// tests/apps-script.test.js falla si alguien cambia el dominio y se olvida de regenerar.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = (ruta) => fileURLToPath(new URL(`../${ruta}`, import.meta.url));
const leer = (ruta) => readFileSync(raiz(ruta), 'utf8').replace(/\r\n/g, '\n');

// En orden de dependencia. etiquetas.js y cola.js son solo del celular.
const MODULOS_DOMINIO = ['conciliacion', 'registros', 'validaciones', 'indicadores', 'ajustes'];

export function generarDominio() {
  const partes = MODULOS_DOMINIO.map((nombre) => {
    const codigo = leer(`docs/js/dominio/${nombre}.js`)
      .replace(/^import [^;]+;\n/gm, '')
      .replace(/^export (const|let|function|async function|class) /gm, '$1 ');
    if (/^\s*(import|export)\b/m.test(codigo)) throw new Error(`Quedó un import/export sin convertir en ${nombre}.js`);
    return `// ---- docs/js/dominio/${nombre}.js ----\n\n${codigo.trim()}\n`;
  });
  return (
    '// Generado por scripts/generar-apps-script.mjs desde docs/js/dominio. No editar a mano: correr npm run apps-script.\n' +
    '// Son las mismas funciones que usa la app, para que el servidor valide y concilie igual.\n\n' +
    partes.join('\n')
  );
}

// Code.gs va primero para que setupHojas sea la primera función del archivo: es la que el editor de
// Apps Script ofrece por defecto en «Ejecutar». El orden no afecta: lo de Dominio.gs y Datos.gs solo
// se usa cuando se llama a una función, cuando ya está todo cargado.
export function generarPaquete(dominio = generarDominio()) {
  const separador = (nombre) => `\n// ${'='.repeat(90)}\n// ${nombre}\n// ${'='.repeat(90)}\n\n`;
  return (
    '// Conteo cíclico TP6: código completo del Web App y del menú de la planilla.\n' +
    '// Archivo generado: pegarlo entero en el editor de Apps Script (Extensiones > Apps Script).\n' +
    '// Las partes se editan por separado en apps-script/ del repositorio y se juntan con npm run apps-script.\n' +
    separador('Code.gs') +
    leer('apps-script/Code.gs') +
    separador('Dominio.gs') +
    dominio +
    separador('Datos.gs') +
    leer('apps-script/Datos.gs')
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dominio = generarDominio();
  writeFileSync(raiz('apps-script/Dominio.gs'), dominio);
  writeFileSync(raiz('apps-script/conteo-ciclico.gs'), generarPaquete(dominio));
  console.log('Generados apps-script/Dominio.gs y apps-script/conteo-ciclico.gs');
}
