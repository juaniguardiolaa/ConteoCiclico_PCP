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

import { paresMaterialLote } from './conciliacion.js';
import { posicionesRegistradas } from './registros.js';

export const CANTIDAD_MAXIMA = 9999;
const RE_LOTE = /^L\d{4}$/;

const bien = (extra = {}) => ({ ok: true, ...extra });
const mal = (codigo, mensaje) => ({ ok: false, codigo, mensaje });

/**
 * Reúne los maestros y el estado de la campaña que necesitan las validaciones.
 * `lotes` es Maestro_Lotes ('PROD001|L0005'); si no viene, se arma con stock3009 y movimientos.
 */
export function crearContexto({
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
export function validarPosicion(posicion, ctx, tipo = 'CONTEO') {
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
export function validarProducto(codigo, lote, ctx) {
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
export function validarLecturaPosicion(lectura, ctx, tipo = 'CONTEO') {
  if (lectura.tipo === 'PRODUCTO') {
    return mal('ETIQUETA_EQUIVOCADA', 'Se leyó una etiqueta de producto. Escaneá la etiqueta de la posición.');
  }
  if (lectura.tipo !== 'POSICION') return mal('ETIQUETA_INVALIDA', `No se reconoce la etiqueta «${lectura.texto ?? ''}».`);
  return validarPosicion(lectura.posicion, ctx, tipo);
}

/** Valida lo que devolvió leerEtiqueta() cuando la pantalla espera un producto-lote. */
export function validarLecturaProducto(lectura, ctx) {
  if (lectura.tipo === 'POSICION') {
    return mal('ETIQUETA_EQUIVOCADA', 'Se leyó una etiqueta de posición. Escaneá la etiqueta del producto.');
  }
  if (lectura.tipo !== 'PRODUCTO') return mal('ETIQUETA_INVALIDA', `No se reconoce la etiqueta «${lectura.texto ?? ''}».`);
  return validarProducto(lectura.codigo, lectura.lote, ctx);
}

/** Validación 5. Acepta número o texto; si es válida devuelve también `valor` numérico. */
export function validarCantidad(entrada) {
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
export function validarRegistro(registro, ctx) {
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
