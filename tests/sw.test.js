// El service worker tiene que guardar todos los archivos de la app: si falta uno, la app no abre
// sin conexión. Este test avisa si alguien agrega un archivo a docs/ y no lo suma a la lista.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = fileURLToPath(new URL('../docs', import.meta.url));

function archivosDe(carpeta) {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivosDe(join(carpeta, e.name)) : [join(carpeta, e.name)],
  );
}

test('docs/sw.js guarda todos los archivos html, css y js de la app', () => {
  const sw = readFileSync(join(DOCS, 'sw.js'), 'utf8');
  const lista = JSON.parse(/const ARCHIVOS = (\[[\s\S]*?\]);/.exec(sw)[1]);
  const enDisco = archivosDe(DOCS)
    .map((f) => relative(DOCS, f).split(sep).join('/'))
    .filter((f) => /\.(html|css|js)$/.test(f) && f !== 'sw.js');

  const faltan = enDisco.filter((f) => !lista.includes(f));
  const sobran = lista.filter((f) => f !== './' && !enDisco.includes(f));
  assert.deepEqual(faltan, [], 'archivos de docs/ que no están en ARCHIVOS de sw.js');
  assert.deepEqual(sobran, [], 'entradas de ARCHIVOS que ya no existen');
});
