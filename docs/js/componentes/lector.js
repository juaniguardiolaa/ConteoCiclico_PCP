// Lector de QR y Code 128 con la cámara trasera (html5-qrcode), más ingreso manual de respaldo.
// Después de cada lectura la cámara queda en pausa hasta que la pantalla pida reanudar:
// así una misma etiqueta no se registra dos veces por accidente.
import { html, pintar, vibrar } from '../ui.js';

const ID_CAMARA = 'lector-camara';

function mensajeCamara(error) {
  const texto = String(error?.name ?? error ?? '');
  if (/NotAllowed|Permission/i.test(texto)) {
    return 'No hay permiso para usar la cámara. Habilitalo en el navegador o escribí el código abajo.';
  }
  if (/NotFound|Requested device not found|no camera/i.test(texto)) {
    return 'No se encontró una cámara. Escribí el código abajo.';
  }
  if (/secure|https/i.test(texto)) return 'La cámara solo funciona con https o en localhost. Escribí el código abajo.';
  return 'No se pudo abrir la cámara. Escribí el código abajo.';
}

/**
 * @param {HTMLElement} contenedor
 * @param {object} opciones
 * @param {string} opciones.etiquetaManual  texto del campo manual
 * @param {string} opciones.ejemplo         ejemplo que se muestra en el campo
 * @param {(texto:string, origen:'camara'|'manual') => void} opciones.alLeer
 */
export function montarLector(contenedor, { etiquetaManual, ejemplo, alLeer }) {
  pintar(
    contenedor,
    html`
      <div class="lector">
        <div class="lector-camara" id="${ID_CAMARA}"></div>
        <p class="lector-estado" aria-live="polite">Abriendo la cámara…</p>
      </div>
      <form class="lector-manual" autocomplete="off">
        <label for="lector-texto">${etiquetaManual}</label>
        <div class="lector-fila">
          <input id="lector-texto" name="texto" placeholder="${ejemplo}" autocapitalize="characters"
                 spellcheck="false" enterkeyhint="go">
          <button class="boton secundario" type="submit">Usar</button>
        </div>
      </form>`,
  );

  const estado = contenedor.querySelector('.lector-estado');
  const formulario = contenedor.querySelector('.lector-manual');
  let lector = null;
  let escuchando = true;
  let detenido = false;

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const texto = formulario.texto.value.trim();
    if (!texto) return;
    escuchando = false;
    pausar();
    alLeer(texto, 'manual');
  });

  function pausar() {
    try {
      lector?.pause(true);
    } catch {
      // ya estaba en pausa o todavía no arrancó
    }
  }

  async function iniciar() {
    const { Html5Qrcode, Html5QrcodeSupportedFormats: formatos } = window;
    if (!Html5Qrcode) {
      estado.textContent = 'El lector de códigos no cargó (¿sin conexión?). Escribí el código abajo.';
      return;
    }
    const instancia = new Html5Qrcode(ID_CAMARA, {
      verbose: false,
      formatsToSupport: [formatos.QR_CODE, formatos.CODE_128],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    });
    try {
      await instancia.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          aspectRatio: 4 / 3,
          // Recuadro ancho: sirve para el QR y para el código de barras.
          qrbox: (ancho, alto) => ({ width: Math.floor(ancho * 0.8), height: Math.floor(Math.min(alto * 0.6, ancho * 0.8)) }),
        },
        (texto) => {
          if (!escuchando) return;
          escuchando = false;
          pausar();
          vibrar(40);
          alLeer(texto, 'camara');
        },
        () => {},
      );
    } catch (error) {
      estado.textContent = mensajeCamara(error);
      return;
    }
    lector = instancia;
    if (detenido) {
      await detener();
      return;
    }
    estado.textContent = 'Apuntá la cámara a la etiqueta.';
  }

  async function detener() {
    detenido = true;
    escuchando = false;
    const instancia = lector;
    lector = null;
    if (!instancia) return;
    try {
      await instancia.stop();
    } catch {
      // ya estaba detenida
    }
    try {
      instancia.clear();
    } catch {
      // el elemento ya no está en la pantalla
    }
  }

  iniciar();

  return {
    /** Vuelve a escuchar la cámara después de un error de validación. */
    reanudar() {
      escuchando = true;
      formulario.texto.value = '';
      try {
        lector?.resume();
      } catch {
        // no estaba en pausa
      }
    },
    detener,
  };
}
