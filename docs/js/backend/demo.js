// Backend de demostración: guarda todo en el navegador y calcula con la misma lógica de
// dominio que usa el Sheet. Responde con la misma forma que el Web App de Apps Script
// ({ ok, codigo, mensaje, ... }), así las pantallas no saben cuál de los dos está activo.
import { CASO } from '../datos/caso.js';
import { conciliar, paresMaterialLote } from '../dominio/conciliacion.js';
import { calcularIndicadores, cobertura } from '../dominio/indicadores.js';
import { agregarRegistro, registrosDesdeStockFisico } from '../dominio/registros.js';
import { crearContexto, validarRegistro } from '../dominio/validaciones.js';

const CLAVE = 'demo';
const CLAVE_SIN_CONEXION = 'demoSinConexion';
const vacio = () => ({ registros: [], reconteos: [] });

export function crearBackendDemo(almacen) {
  const cargar = () => almacen.leer(CLAVE, null) ?? vacio();
  const persistir = (datos) => almacen.guardar(CLAVE, datos);
  const posiciones = CASO.posiciones.map((p) => p.posicion);
  const lotes = [...paresMaterialLote(CASO.stock3009, CASO.movimientos)].sort();

  // El «servidor» demo vive en el navegador, pero se comporta como uno remoto: con el celular en
  // modo avión (o con la simulación de Ajustes) no responde, para poder mostrar la cola sin conexión.
  const sinConexion = () => globalThis.navigator?.onLine === false || almacen.leer(CLAVE_SIN_CONEXION, false);
  const exigirConexion = () => {
    if (sinConexion()) throw new Error('Sin conexión con el servidor.');
  };

  return {
    modo: 'demo',
    nombre: 'Modo demo',

    sinConexionSimulada: () => almacen.leer(CLAVE_SIN_CONEXION, false),
    simularSinConexion: (valor) => almacen.guardar(CLAVE_SIN_CONEXION, Boolean(valor)),

    async parametros() {
      return {
        campania: CASO.campania,
        fechaConteo: CASO.fechaConteo,
        fechaStockInicial: CASO.fechaStockInicial,
        fechaDesde: CASO.fechaDesde,
      };
    },

    async maestros() {
      return { posiciones: CASO.posiciones, materiales: CASO.materiales, lotes };
    },

    async estado(campania) {
      exigirConexion();
      const datos = cargar();
      return { registros: datos.registros.filter((r) => r.campania === campania), reconteos: datos.reconteos };
    },

    /** Mismo orden que el servidor: ID repetido (regla 7), validaciones, alta. */
    async registrar(registro) {
      exigirConexion();
      const datos = cargar();
      if (datos.registros.some((r) => r.id === registro.id)) {
        return { ok: true, codigo: 'YA_REGISTRADO', mensaje: 'El registro ya estaba cargado; no se duplicó.' };
      }
      const contexto = crearContexto({
        posiciones,
        materiales: CASO.materiales,
        lotes,
        registros: datos.registros,
        campania: registro.campania,
        reconteos: datos.reconteos,
      });
      const validacion = validarRegistro(registro, contexto);
      if (!validacion.ok) return validacion;

      const { registros, resultado } = agregarRegistro(datos.registros, registro);
      const reconteos =
        registro.tipo === 'RECONTEO' ? datos.reconteos.filter((p) => p !== registro.posicion) : datos.reconteos;
      persistir({ registros, reconteos });
      return resultado;
    },

    /** En modo demo no hay hoja: se calcula acá con la misma función que usa el servidor. */
    async conciliar(campania) {
      exigirConexion();
      const { registros } = cargar();
      const filas = conciliar({
        materiales: CASO.materiales,
        stock3009: CASO.stock3009,
        movimientos: CASO.movimientos,
        registros,
        campania,
        desde: CASO.fechaDesde,
        hasta: CASO.fechaConteo,
      });
      return {
        ok: true,
        mensaje: 'Conciliación calculada en este navegador (modo demo).',
        filas,
        indicadores: calcularIndicadores(filas, posiciones, CASO.materiales),
        cobertura: cobertura(registros, posiciones, campania),
        verificacion: null,
      };
    },

    /** Carga las 28 posiciones con el stock físico del enunciado, para probar la conciliación sin recorrer el rack. */
    async precargarCaso(sesion, fechaHora) {
      const registros = registrosDesdeStockFisico(CASO.stock1410, posiciones, {
        campania: sesion.campania,
        usuario: sesion.usuario,
        rol: sesion.rol,
        fechaHora,
        dispositivo: 'Precarga del caso',
      });
      persistir({ registros, reconteos: [] });
      return { ok: true, codigo: 'PRECARGADO', mensaje: `Se cargaron las ${registros.length} posiciones del caso.` };
    },

    async reiniciar() {
      persistir(vacio());
      return { ok: true, codigo: 'REINICIADO', mensaje: 'Se borraron los datos de demo.' };
    },
  };
}
