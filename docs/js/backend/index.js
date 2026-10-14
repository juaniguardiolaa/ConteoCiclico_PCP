// Elige el backend según la configuración del celular (pantalla Ajustes): la planilla de Google
// Sheets si hay URL y token cargados, o el modo demo.
import { crearBackendAppsScript } from './appsscript.js';
import { crearBackendDemo } from './demo.js';

export function crearBackend(config, almacen) {
  if (config?.modo === 'sheets' && config.url && config.token) return crearBackendAppsScript(config, almacen);
  return crearBackendDemo(almacen);
}
