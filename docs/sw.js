// Service worker: guarda la app en el celular para poder abrirla y recargarla sin conexión.
//
// - Archivos propios: primero la red (así siempre se ve la última versión publicada) y, si no hay
//   conexión, la copia guardada.
// - Librerías y fuentes de CDN: tienen versión fija, así que primero la copia guardada.
// - Las llamadas al Web App de Apps Script (script.google.com) no se tocan: de eso se encarga la cola.
//
// Si se agrega un archivo a docs/, hay que sumarlo a ARCHIVOS (tests/sw.test.js lo controla).

const CACHE = 'tp6-conteo-v1';

const ARCHIVOS = [
  "./",
  "index.html",
  "etiquetas.html",
  "diagrama/index.html",
  "css/app.css",
  "css/etiquetas.css",
  "js/almacen.js",
  "js/app.js",
  "js/backend/appsscript.js",
  "js/backend/demo.js",
  "js/backend/index.js",
  "js/componentes/lector.js",
  "js/componentes/pasos.js",
  "js/componentes/qr.js",
  "js/componentes/rack.js",
  "js/componentes/resultado.js",
  "js/datos/caso.js",
  "js/dominio/ajustes.js",
  "js/dominio/cola.js",
  "js/dominio/conciliacion.js",
  "js/dominio/etiquetas.js",
  "js/dominio/indicadores.js",
  "js/dominio/registros.js",
  "js/dominio/validaciones.js",
  "js/etiquetas.js",
  "js/pantallas/ajustes.js",
  "js/pantallas/cantidad.js",
  "js/pantallas/conciliacion.js",
  "js/pantallas/escanear-posicion.js",
  "js/pantallas/escanear-producto.js",
  "js/pantallas/inicio.js",
  "js/pantallas/resumen.js",
  "js/pantallas/ruta.js",
  "js/roles.js",
  "js/ui.js",
  "js/version.js"
];

const LIBRERIAS = [
  'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
];

const SERVIDORES_CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(ARCHIVOS);
      // Las librerías se piden igual que las pide la página (sin CORS): si alguna falla, no frena la instalación.
      await Promise.allSettled(LIBRERIAS.map((url) => cache.add(new Request(url, { mode: 'no-cors' }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n.startsWith('tp6-') && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) evento.respondWith(primeroLaRed(request));
  else if (SERVIDORES_CDN.includes(url.hostname)) evento.respondWith(primeroLaCopia(request));
});

async function primeroLaRed(request) {
  const cache = await caches.open(CACHE);
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) cache.put(request, respuesta.clone());
    return respuesta;
  } catch {
    const copia = await cache.match(request, { ignoreSearch: true });
    if (copia) return copia;
    if (request.mode === 'navigate') return (await cache.match('index.html')) ?? Response.error();
    return Response.error();
  }
}

async function primeroLaCopia(request) {
  const copia = await caches.match(request);
  if (copia) return copia;
  const respuesta = await fetch(request);
  if (respuesta.ok || respuesta.type === 'opaque') {
    const cache = await caches.open(CACHE);
    cache.put(request, respuesta.clone());
  }
  return respuesta;
}
