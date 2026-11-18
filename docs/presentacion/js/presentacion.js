// Arranque de la presentación interactiva. Cada sección vive en su módulo y usa la lógica de
// docs/js/dominio: lo que se muestra en clase es lo mismo que hace la app.
import { URL_QRCODE_GENERATOR, cargarScript } from '../../js/componentes/qr.js';
import { iniciarConciliar } from './conciliar.js';
import { iniciarControles } from './controles.js';
import { iniciarDeck } from './deck.js';
import { iniciarPlanilla } from './planilla.js';
import { iniciarPortada } from './portada.js';
import { iniciarPreparar } from './preparar.js';
import { iniciarSimulador } from './simulador.js';
import { iniciarSinSenal } from './sinsenal.js';

const URL_JSBARCODE = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';

// Las librerías de CDN solo dibujan QR y códigos de barras: si no cargan, la presentación sigue.
const hayQR = cargarScript(URL_QRCODE_GENERATOR).then(() => true, () => false);
const hayBarras = cargarScript(URL_JSBARCODE).then(() => true, () => false);

iniciarSimulador();
iniciarControles();
iniciarSinSenal();
iniciarPlanilla();
iniciarConciliar();
iniciarPortada(hayQR);
iniciarPreparar(hayQR, hayBarras);
iniciarDeck();
