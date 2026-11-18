// Estado compartido de la demostración: hace las veces de la planilla. Las diapositivas registran
// conteos, reconteos y ajustes acá, con las mismas funciones de dominio que usan la app y Apps Script.
// Se guarda en el navegador (otra clave que la app) para que un F5 en plena clase no borre lo cargado.
import { CASO } from '../../js/datos/caso.js';
import { conciliar } from '../../js/dominio/conciliacion.js';
import { calcularIndicadores, cobertura } from '../../js/dominio/indicadores.js';
import { agregarRegistro, registrosDesdeStockFisico } from '../../js/dominio/registros.js';
import { crearContexto, validarRegistro } from '../../js/dominio/validaciones.js';
import { fechaHoraLocal } from '../../js/ui.js';

const CLAVE = 'tp6-presentacion.estado';

export const CAMPANIA = CASO.campania;
export const POSICIONES = CASO.posiciones.map((p) => p.posicion);
export const URL_APP = 'https://juaniguardiolaa.github.io/ConteoCiclico_PCP/';
export const URL_REPO = 'https://github.com/juaniguardiolaa/ConteoCiclico_PCP';

/** Lo que hay físicamente en cada posición el 14/10 (la foto Stock 1410 del enunciado). */
export const FISICO = new Map(CASO.stock1410.filter((s) => s.posicion).map((s) => [s.posicion, s]));

export const material = (codigo) => CASO.materiales.find((m) => m.codigo === codigo);

const vacio = () => ({ registros: [], reconteos: [], ajustes: [], antes: null, log: [], cerrada: false, usuario: 'Operario 1' });

function cargar() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    if (guardado && Array.isArray(guardado.registros)) return { ...vacio(), ...guardado };
  } catch {
    // modo privado o almacenamiento bloqueado: se arranca de cero
  }
  return vacio();
}

let datos = cargar();
const oyentes = new Set();

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // sin almacenamiento la demo sigue andando, solo que no sobrevive a un F5
  }
  oyentes.forEach((f) => f());
}

const falla = (codigo, mensaje) => ({ ok: false, codigo, mensaje });

function anotar(accion, resultado, detalle, usuario = datos.usuario) {
  datos.log.push({ fechaHora: fechaHoraLocal(), accion, usuario, resultado, detalle });
}

export const estado = {
  get registros() {
    return datos.registros;
  },
  get reconteos() {
    return datos.reconteos;
  },
  get ajustes() {
    return datos.ajustes;
  },
  get log() {
    return datos.log;
  },
  get cerrada() {
    return datos.cerrada;
  },
  get usuario() {
    return datos.usuario;
  },

  alCambiar(funcion) {
    oyentes.add(funcion);
  },

  ponerUsuario(nombre) {
    datos.usuario = String(nombre ?? '').trim() || 'Operario 1';
    guardar();
  },

  /** Movimientos del caso más los ajustes y transferencias que se aprobaron en la demo. */
  movimientos() {
    return [...CASO.movimientos, ...datos.ajustes];
  },

  /** El mismo contexto que arma la app (y el servidor) para validar. */
  contexto() {
    return crearContexto({
      posiciones: CASO.posiciones,
      materiales: CASO.materiales,
      stock3009: CASO.stock3009,
      movimientos: CASO.movimientos,
      registros: datos.registros,
      campania: CAMPANIA,
      reconteos: datos.reconteos,
    });
  },

  /** Lo que hace accionRegistrar_ en Code.gs: campaña abierta, ID único, validación completa y alta. */
  registrar(registro) {
    if (datos.registros.some((r) => r.id === registro.id)) {
      const r = { ok: true, codigo: 'YA_REGISTRADO', mensaje: 'El registro ya estaba en la planilla; no se duplicó.' };
      anotar('registrar', r.codigo, `${registro.posicion} · reenvío del mismo ID`, registro.usuario);
      guardar();
      return r;
    }
    let respuesta;
    if (datos.cerrada) {
      respuesta = falla('CAMPANIA_CERRADA', `La campaña ${CAMPANIA} está cerrada: ya no se aceptan registros.`);
    } else {
      const validacion = validarRegistro(registro, this.contexto());
      if (!validacion.ok) respuesta = validacion;
      else {
        const { registros, resultado } = agregarRegistro(datos.registros, registro);
        datos.registros = registros;
        if (registro.tipo === 'RECONTEO') datos.reconteos = datos.reconteos.filter((p) => p !== registro.posicion);
        respuesta = resultado;
      }
    }
    const detalle = registro.vacia
      ? `${registro.posicion} · vacía`
      : `${registro.posicion} · ${registro.codigo} ${registro.lote} · ${registro.cantidad}`;
    anotar('registrar', respuesta.codigo, detalle, registro.usuario);
    guardar();
    return respuesta;
  },

  pedirReconteo(posicion) {
    if (!datos.reconteos.includes(posicion)) datos.reconteos.push(posicion);
    anotar('pedirReconteo', 'OK', posicion, 'Control');
    guardar();
  },

  /** Carga lo que falta relevar con la foto física del 14/10 (como «Cargar el conteo del enunciado»). */
  completarConteo() {
    const { faltantes } = this.cobertura();
    if (!faltantes.length) return 0;
    const nuevos = registrosDesdeStockFisico(CASO.stock1410, faltantes, {
      fechaHora: fechaHoraLocal(),
      usuario: 'Operario 2',
      rol: 'OPERARIO',
      campania: CAMPANIA,
      dispositivo: 'Carga del enunciado',
    });
    for (const registro of nuevos) datos.registros = agregarRegistro(datos.registros, registro).registros;
    anotar('registrar', 'REGISTRADO', `${nuevos.length} posiciones cargadas con el conteo del enunciado`, 'Operario 2');
    guardar();
    return nuevos.length;
  },

  cobertura() {
    return cobertura(datos.registros, POSICIONES, CAMPANIA);
  },

  conciliacion() {
    return conciliar({
      materiales: CASO.materiales,
      stock3009: CASO.stock3009,
      movimientos: this.movimientos(),
      registros: datos.registros,
      campania: CAMPANIA,
      desde: CASO.fechaDesde,
      hasta: CASO.fechaConteo,
    });
  },

  indicadores(filas = this.conciliacion()) {
    return calcularIndicadores(filas, POSICIONES, CASO.materiales);
  },

  /** Foto de los indicadores antes de registrar los primeros ajustes (la «foto antes» del cierre). */
  get antes() {
    return datos.antes ?? null;
  },

  registrarAjustes(movimientos) {
    if (!datos.antes) {
      const ind = this.indicadores();
      datos.antes = {
        exactitudPorClave: ind.exactitudPorClave,
        exactitudPorPosicion: ind.exactitudPorPosicion,
        clavesConDiferencia: ind.clavesConDiferencia,
        movimientos: this.movimientos().length,
      };
    }
    datos.ajustes.push(...movimientos);
    anotar('registrarAjustes', 'OK', `${movimientos.length} movimientos agregados a Movimientos`, 'Jefe de almacén');
    guardar();
  },

  cerrarCampania() {
    datos.cerrada = true;
    anotar('cerrarCampania', 'OK', `${CAMPANIA} cerrada`, 'Jefe de almacén');
    guardar();
  },

  /** Cuántas veces se reinició la demo en esta pestaña: las diapositivas con estado propio lo miran. */
  reinicios: 0,

  reiniciar() {
    datos = { ...vacio(), usuario: datos.usuario };
    this.reinicios += 1;
    guardar();
  },
};
