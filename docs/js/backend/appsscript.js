// Backend real: el Web App de Apps Script vinculado a la planilla (apps-script/Code.gs).
// Todas las llamadas van por POST con el cuerpo en JSON y Content-Type text/plain: es una
// «petición simple» para el navegador, así no hay preflight de CORS que Apps Script no contesta.
// Responde con la misma forma que el backend demo, así las pantallas no notan la diferencia.

async function llamarWebApp(url, cuerpo, fetchFn) {
  let respuesta;
  try {
    respuesta = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo),
      redirect: 'follow',
    });
  } catch {
    throw new Error('No hay conexión con la planilla.');
  }
  if (!respuesta.ok) throw new Error(`La planilla respondió con error ${respuesta.status}.`);
  try {
    return await respuesta.json();
  } catch {
    throw new Error('La respuesta no es la esperada: revisá que el Web App esté implementado con acceso «Cualquier usuario».');
  }
}

export function crearBackendAppsScript({ url, token }, almacen, fetchFn = (...a) => globalThis.fetch(...a)) {
  const usuario = () => almacen.leer('sesion')?.usuario ?? '';
  const llamar = (accion, datos = {}) => llamarWebApp(url, { accion, token, usuario: usuario(), ...datos }, fetchFn);

  /** Para consultas: si el servidor responde con error, se lanza (la app usa lo último guardado). */
  const datosDe = async (accion, extra) => {
    const r = await llamar(accion, extra);
    if (!r.ok) throw new Error(`${r.mensaje} (${r.codigo})`);
    return r.datos;
  };

  return {
    modo: 'sheets',
    nombre: 'Google Sheets',

    parametros: () => datosDe('parametros'),
    maestros: () => datosDe('maestros'),
    estado: (campania) => datosDe('estado', { campania }),

    /** Sin red lanza (la cola reintenta); un rechazo del servidor vuelve como { ok: false, codigo, mensaje }. */
    registrar: (registro) => llamar('registrar', { registro }),

    async conciliar(campania) {
      const r = await llamar('conciliacion', { campania });
      return r.ok ? { ok: true, ...r.datos } : r;
    },
  };
}

/**
 * Prueba una URL y un token antes de guardarlos (pantalla Ajustes).
 * Devuelve { ok, mensaje, parametros? }.
 */
export async function probarConexion(url, token, fetchFn = (...a) => globalThis.fetch(...a)) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
    return {
      ok: false,
      mensaje: 'La URL tiene que ser la del Web App: empieza con https://script.google.com/macros/s/ y termina en /exec.',
    };
  }
  try {
    const ping = await llamarWebApp(url, { accion: 'ping', token }, fetchFn);
    if (!ping.ok) return { ok: false, mensaje: ping.mensaje };
    if (!ping.datos.tokenValido) {
      return { ok: false, mensaje: 'El Web App responde, pero el token no coincide con el de la hoja Parametros.' };
    }
    const parametros = await llamarWebApp(url, { accion: 'parametros', token }, fetchFn);
    if (!parametros.ok) return { ok: false, mensaje: parametros.mensaje };
    return {
      ok: true,
      mensaje: `Conectado. Servidor versión ${ping.datos.version}, campaña ${parametros.datos.campania}.`,
      parametros: parametros.datos,
    };
  } catch (error) {
    return {
      ok: false,
      mensaje: `${error.message} Si la URL es correcta, revisá que la implementación tenga acceso «Cualquier usuario».`,
    };
  }
}
