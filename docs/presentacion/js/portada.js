// Portada y cierre: el rack del 14/10 que se llena caja por caja y el QR para abrir la app.
import { qrSVG } from '../../js/componentes/qr.js';
import { html, pintar } from '../../js/ui.js';
import { registrarDiapo } from './deck.js';
import { FISICO, URL_APP, estado } from './estado.js';
import { rackHTML } from './rack.js';

/** @param {Promise<boolean>} hayQR  si cargó qrcode-generator */
export async function iniciarPortada(hayQR) {
  let orden = 0;
  pintar(
    document.querySelector('[data-zona="rack-portada"]'),
    rackHTML((posicion) => {
      const fisico = FISICO.get(posicion);
      return {
        clase: fisico ? 'ocupada' : 'vacia',
        contenido: html`<span class="celda-codigo">${posicion}</span>
          ${fisico ? html`<span class="caja" style="--i: ${orden++}"></span>` : ''}`,
      };
    }, 'rack-portada'),
  );

  document.querySelector('[data-accion="reiniciar"]').addEventListener('click', () => {
    if (!confirm('¿Borrar lo que se cargó en vivo y empezar la demostración de cero?')) return;
    estado.reiniciar();
    const aviso = document.querySelector('[data-zona="reiniciado"]');
    aviso.textContent = 'Listo: la demostración volvió a cero.';
    setTimeout(() => (aviso.textContent = ''), 4000);
  });

  // El QR necesita la librería de CDN: sin conexión queda la dirección escrita.
  const zonas = document.querySelectorAll('[data-zona="qr-app"]');
  if (await hayQR) zonas.forEach((zona) => pintar(zona, qrSVG(URL_APP, 'qr')));
  else zonas.forEach((zona) => zona.classList.add('sin-qr'));
}

// Las cajas vuelven a caer cada vez que se entra a la portada.
registrarDiapo('portada', {
  alEntrar() {
    const rack = document.querySelector('.rack-portada');
    rack?.classList.remove('animar');
    void rack?.offsetWidth;
    rack?.classList.add('animar');
  },
});
