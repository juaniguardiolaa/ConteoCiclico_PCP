// Guardado local en el navegador (localStorage). Puede fallar en modo privado o con el
// almacenamiento bloqueado: en ese caso la app sigue andando, pero sin recordar nada.
const PREFIJO = 'tp6.';

export const almacen = {
  leer(clave, porDefecto = null) {
    try {
      const valor = localStorage.getItem(PREFIJO + clave);
      return valor === null ? porDefecto : JSON.parse(valor);
    } catch {
      return porDefecto;
    }
  },
  guardar(clave, valor) {
    try {
      localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
      return true;
    } catch {
      return false;
    }
  },
  borrar(clave) {
    try {
      localStorage.removeItem(PREFIJO + clave);
    } catch {
      // nada que hacer
    }
  },
};

/** Almacén en memoria con la misma forma, para los tests. */
export function almacenEnMemoria() {
  const datos = new Map();
  return {
    leer: (clave, porDefecto = null) => (datos.has(clave) ? structuredClone(datos.get(clave)) : porDefecto),
    guardar: (clave, valor) => (datos.set(clave, structuredClone(valor)), true),
    borrar: (clave) => datos.delete(clave),
  };
}
