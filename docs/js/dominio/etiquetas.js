// Lectura de etiquetas (QR o Code 128) y del texto cargado a mano.
// El prefijo dice qué se escaneó, así la app rechaza una etiqueta de producto leída donde
// se esperaba una posición. Acá solo se reconoce el formato: si la posición o el material
// existen lo decide validaciones.js contra los maestros.

export const PREFIJO_POSICION = 'POS:';
export const PREFIJO_PRODUCTO = 'MAT:';
export const PREFIJO_CONFIG = 'CFG:';

const RE_POSICION = /^POS:([A-Z]{1,2}\d{1,2})$/;
const RE_PRODUCTO = /^MAT:([A-Z0-9]+)\|([A-Z0-9]*)$/;

export const textoPosicion = (posicion) => `${PREFIJO_POSICION}${posicion}`;
export const textoProducto = (codigo, lote) => `${PREFIJO_PRODUCTO}${codigo}|${lote}`;
export const textoConfig = (url, token) => `${PREFIJO_CONFIG}${JSON.stringify({ url, token })}`;

/**
 * Interpreta el texto leído por la cámara o escrito a mano.
 * Devuelve { tipo: 'POSICION', posicion } | { tipo: 'PRODUCTO', codigo, lote }
 *        | { tipo: 'CONFIG', url, token } | { tipo: 'DESCONOCIDA', texto }.
 */
export function leerEtiqueta(texto) {
  const crudo = String(texto ?? '').trim();
  if (crudo.toUpperCase().startsWith(PREFIJO_CONFIG)) {
    try {
      const { url, token } = JSON.parse(crudo.slice(PREFIJO_CONFIG.length));
      if (typeof url === 'string' && url) return { tipo: 'CONFIG', url, token: String(token ?? '') };
    } catch {
      // cae en DESCONOCIDA
    }
    return { tipo: 'DESCONOCIDA', texto: crudo };
  }

  const limpio = crudo.toUpperCase().replace(/\s+/g, '');
  let m = RE_POSICION.exec(limpio);
  if (m) return { tipo: 'POSICION', posicion: m[1] };
  m = RE_PRODUCTO.exec(limpio);
  if (m) return { tipo: 'PRODUCTO', codigo: m[1], lote: m[2] };
  return { tipo: 'DESCONOCIDA', texto: crudo };
}

const tienePrefijo = (t) => [PREFIJO_POSICION, PREFIJO_PRODUCTO, PREFIJO_CONFIG].some((p) => t.startsWith(p));

/**
 * Ingreso manual cuando la pantalla espera una posición: acepta "POS:B2" o solo "B2".
 * Si el texto trae otro prefijo se interpreta tal cual, para poder avisar que es otro tipo de etiqueta.
 */
export function leerPosicionManual(texto) {
  const limpio = String(texto ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return leerEtiqueta(tienePrefijo(limpio) ? limpio : PREFIJO_POSICION + limpio);
}

/**
 * Ingreso manual cuando la pantalla espera un producto: acepta "MAT:PROD001|L0005",
 * "PROD001|L0005" o "PROD001 L0005". Sin lote devuelve lote vacío, para que la validación
 * pueda decir qué falta.
 */
export function leerProductoManual(texto) {
  let limpio = String(texto ?? '').trim().toUpperCase();
  if (!tienePrefijo(limpio)) limpio = PREFIJO_PRODUCTO + limpio;
  if (limpio.startsWith(PREFIJO_PRODUCTO)) {
    limpio = limpio.replace(/^MAT:\s*(\S+)\s+(\S+)$/, 'MAT:$1|$2');
    if (!limpio.includes('|')) limpio += '|';
  }
  return leerEtiqueta(limpio);
}
