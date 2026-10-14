// QR como SVG propio (módulos negros sobre blanco, con zona de silencio de 4 módulos), a partir de
// qrcode-generator. Lo usan la hoja de etiquetas y el QR de configuración de Ajustes.
import { crudo } from '../ui.js';

export const URL_QRCODE_GENERATOR = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';

/** Carga una librería de CDN cuando hace falta (la pantalla de captura no la necesita). */
export function cargarScript(src) {
  if ([...document.scripts].some((s) => s.src === src)) return Promise.resolve();
  return new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolver;
    script.onerror = () => rechazar(new Error('No se pudo cargar el generador de QR (¿sin conexión?).'));
    document.head.append(script);
  });
}

export function qrSVG(texto, clase = 'qr') {
  const qr = window.qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const borde = 4;
  let trazo = '';
  for (let fila = 0; fila < n; fila++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(fila, col)) trazo += `M${col + borde} ${fila + borde}h1v1h-1z`;
    }
  }
  const lado = n + borde * 2;
  return crudo(
    `<svg class="${clase}" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" aria-hidden="true">` +
      `<rect width="${lado}" height="${lado}" fill="#fff"/><path d="${trazo}" fill="#000"/></svg>`,
  );
}
