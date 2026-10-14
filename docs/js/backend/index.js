// Elige el backend según la configuración del celular. Por ahora solo existe el modo demo;
// en H5 se suma el Web App de Apps Script (backend/appsscript.js).
import { crearBackendDemo } from './demo.js';

export function crearBackend(_config, almacen) {
  return crearBackendDemo(almacen);
}
