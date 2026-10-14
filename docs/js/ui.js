// Utilidades de interfaz: plantillas HTML con escape, formatos y avisos.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Marca un fragmento como HTML ya armado, para que `html` no lo escape. */
export const crudo = (texto) => ({ __crudo: String(texto) });

/**
 * Plantilla con escape automático: html`<p>${texto}</p>`.
 * Los arreglos se concatenan; los fragmentos de otras plantillas `html` no se vuelven a escapar.
 */
export function html(partes, ...valores) {
  const convertir = (v) => {
    if (v === null || v === undefined || v === false) return '';
    if (Array.isArray(v)) return v.map(convertir).join('');
    if (typeof v === 'object' && '__crudo' in v) return v.__crudo;
    return escapar(v);
  };
  return crudo(partes.reduce((salida, parte, i) => salida + parte + (i < valores.length ? convertir(valores[i]) : ''), ''));
}

/** Escribe una plantilla `html` dentro de un elemento. */
export function pintar(elemento, plantilla) {
  elemento.innerHTML = plantilla.__crudo ?? escapar(plantilla);
}

const formatoEntero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const formatoPorcentaje = new Intl.NumberFormat('es-AR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const entero = (n) => formatoEntero.format(n).replace('-', '−');
/** Diferencia con signo explícito: +5, −10, 0. */
export const conSigno = (n) => (n > 0 ? `+${entero(n)}` : entero(n));
export const porcentaje = (x) => formatoPorcentaje.format(x).replace(/\s?%/, ' %');

/** Fecha y hora local en formato AAAA-MM-DDTHH:MM:SS (la planilla la guarda así). */
export function fechaHoraLocal(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`
  );
}

export const horaCorta = (fechaHora) => String(fechaHora ?? '').slice(11, 16);

/** 2026-10-14 -> 14/10/2026 */
export const fechaCorta = (iso) => String(iso ?? '').split('-').reverse().join('/');

export function nuevoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Descripción corta del equipo para la columna Dispositivo. */
export function describirDispositivo() {
  const ua = navigator.userAgent;
  const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Otro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  return `${so} ${nav}`;
}

export function vibrar(patron) {
  try {
    navigator.vibrate?.(patron);
  } catch {
    // algunos navegadores no lo permiten
  }
}

let temporizadorAviso;
/** Aviso breve abajo de la pantalla. tipo: 'ok' | 'error' | 'info' */
export function avisar(mensaje, tipo = 'ok') {
  const aviso = document.getElementById('aviso');
  if (!aviso) return;
  aviso.textContent = mensaje;
  aviso.dataset.tipo = tipo;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (aviso.hidden = true), tipo === 'error' ? 6000 : 3000);
}
