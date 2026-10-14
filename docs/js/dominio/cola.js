// Cola de envío sin conexión. Diagrama, Hoja 1: «¿Envío confirmado? No: cola offline, reintenta».
//
// Cada registro confirmado entra a la cola y se intenta enviar enseguida. Si no hay red, queda
// guardado en el celular y se reintenta con espera creciente (2 s, 4 s, 8 s… hasta 1 min), al volver
// la conexión o cuando el operario toca «Reintentar». Como el ID es el UUID que generó el celular,
// un reintento nunca duplica: si el servidor ya lo tenía, responde YA_REGISTRADO.
//
// Si el servidor rechaza el registro por una regla de negocio (por ejemplo, otro operario ya contó
// esa posición mientras este estaba sin red), no se reintenta: pasa a «rechazados» para avisarle.

/**
 * Respuestas del servidor que no son culpa del registro y conviene reintentar. Con el token mal
 * cargado tampoco se descarta nada: se corrige en Ajustes y la cola se envía sola.
 */
const TRANSITORIOS = new Set(['SIN_CONEXION', 'ERROR_SERVIDOR', 'OCUPADO', 'TIEMPO_AGOTADO', 'TOKEN_INVALIDO']);

/**
 * @param {object} opciones
 * @param {{leer:Function, guardar:Function}} opciones.almacen  dónde se guarda la cola (localStorage)
 * @param {string} [opciones.nombre='demo']  una cola por backend: lo cargado en modo demo nunca llega a la planilla
 * @param {(registro:object) => Promise<{ok:boolean, codigo:string, mensaje:string}>} opciones.enviar
 * @param {() => number} [opciones.ahora]          reloj en ms (se reemplaza en los tests)
 * @param {number} [opciones.esperaBase=2000]      espera después del primer fallo
 * @param {number} [opciones.esperaMaxima=60000]   tope de la espera
 * @param {() => void} [opciones.alCambiar]        aviso para actualizar la pantalla
 */
export function crearCola({
  almacen,
  nombre = 'demo',
  enviar,
  ahora = () => Date.now(),
  esperaBase = 2000,
  esperaMaxima = 60000,
  alCambiar = () => {},
}) {
  const CLAVE_COLA = `cola-${nombre}`;
  const CLAVE_RECHAZOS = `cola-${nombre}-rechazados`;
  const leerCola = () => almacen.leer(CLAVE_COLA, []);
  const leerRechazos = () => almacen.leer(CLAVE_RECHAZOS, []);
  const guardarCola = (cola) => {
    almacen.guardar(CLAVE_COLA, cola);
    alCambiar();
  };
  const sin = (cola, id) => cola.filter((e) => e.registro.id !== id);

  // La cola se vuelve a leer en cada paso: mientras se espera la respuesta, el operario puede
  // haber confirmado otro registro y no hay que pisarlo.
  async function vaciar(forzar) {
    const enviados = [];
    const rechazados = [];

    for (;;) {
      const entrada = leerCola()[0];
      if (!entrada || (!forzar && entrada.proximoIntento > ahora())) break;
      const { id } = entrada.registro;

      let respuesta;
      try {
        respuesta = await enviar(entrada.registro);
      } catch (error) {
        respuesta = { ok: false, codigo: 'SIN_CONEXION', mensaje: error?.message || 'Sin conexión' };
      }

      if (respuesta.ok) {
        guardarCola(sin(leerCola(), id));
        enviados.push({ registro: entrada.registro, respuesta });
        continue;
      }

      if (TRANSITORIOS.has(respuesta.codigo)) {
        const intentos = entrada.intentos + 1;
        const proximoIntento = ahora() + Math.min(esperaMaxima, esperaBase * 2 ** (intentos - 1));
        guardarCola(
          leerCola().map((e) => (e.registro.id === id ? { ...e, intentos, proximoIntento, ultimoError: respuesta.mensaje } : e)),
        );
        break; // sin red, los que siguen también van a fallar
      }

      const rechazo = { registro: entrada.registro, codigo: respuesta.codigo, mensaje: respuesta.mensaje };
      rechazados.push(rechazo);
      almacen.guardar(CLAVE_RECHAZOS, [...leerRechazos(), rechazo]);
      guardarCola(sin(leerCola(), id));
    }

    return { enviados, rechazados, pendientes: leerCola().length };
  }

  let enCurso = null;

  /**
   * Envía lo que corresponda, en orden de llegada (un RECONTEO no puede llegar antes que el conteo
   * que reemplaza). Con `forzar` no respeta la espera: al volver la red o con «Reintentar».
   * Nunca hay dos envíos a la vez: si ya hay uno en curso, este arranca cuando termina.
   */
  function procesar({ forzar = false } = {}) {
    if (enCurso) return enCurso.then(() => procesar({ forzar }));
    enCurso = vaciar(forzar).finally(() => {
      enCurso = null;
    });
    return enCurso;
  }

  return {
    /** Agrega un registro ya validado al final de la cola. */
    encolar(registro) {
      guardarCola([...leerCola(), { registro, intentos: 0, proximoIntento: 0, ultimoError: '' }]);
    },

    procesar,

    pendientes: () => leerCola(),
    rechazados: () => leerRechazos(),

    /** Estado de un registro puntual: 'enviado' | 'pendiente' | 'rechazado'. */
    estadoDe(id) {
      if (leerRechazos().some((r) => r.registro.id === id)) return 'rechazado';
      if (leerCola().some((e) => e.registro.id === id)) return 'pendiente';
      return 'enviado';
    },

    /** El operario ya vio el aviso de un registro rechazado. */
    descartarRechazo(id) {
      almacen.guardar(
        CLAVE_RECHAZOS,
        leerRechazos().filter((r) => r.registro.id !== id),
      );
      alCambiar();
    },

    /** Momento del próximo reintento automático, o null si no hay pendientes. */
    proximoIntento() {
      const cola = leerCola();
      return cola.length ? cola[0].proximoIntento : null;
    },
  };
}
