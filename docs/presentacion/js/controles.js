// C1, los siete controles: cada tarjeta corre la validación real con una entrada mala y muestra el
// mensaje exacto que ve el operario. Usa maestros limpios, así el resultado no depende de lo que se
// haya contado en vivo.
import { CASO } from '../../js/datos/caso.js';
import { leerEtiqueta } from '../../js/dominio/etiquetas.js';
import { agregarRegistro, crearRegistro } from '../../js/dominio/registros.js';
import {
  crearContexto,
  validarCantidad,
  validarLecturaPosicion,
  validarLecturaProducto,
  validarRegistro,
} from '../../js/dominio/validaciones.js';
import { html, pintar } from '../../js/ui.js';
import { registrarDiapo } from './deck.js';
import { CAMPANIA } from './estado.js';
import { pitido } from './sonido.js';

const registroB2 = (extra = {}) =>
  crearRegistro({
    id: 'demo-b2',
    fechaHora: '2026-10-14T10:02:15',
    usuario: 'Operario 1',
    campania: CAMPANIA,
    posicion: 'B2',
    codigo: 'PROD001',
    lote: 'L0005',
    cantidad: 120,
    ...extra,
  });

const contexto = (registros = []) =>
  crearContexto({
    posiciones: CASO.posiciones,
    materiales: CASO.materiales,
    stock3009: CASO.stock3009,
    movimientos: CASO.movimientos,
    registros,
    campania: CAMPANIA,
  });

/** Cada prueba devuelve la respuesta de la función de dominio, tal cual. */
const CONTROLES = [
  {
    regla: 'La posición existe en el maestro',
    pruebas: [['POS:Z9', () => validarLecturaPosicion(leerEtiqueta('POS:Z9'), contexto())]],
  },
  {
    regla: 'No se cuenta dos veces en la campaña',
    pruebas: [['POS:B2 otra vez', () => validarLecturaPosicion(leerEtiqueta('POS:B2'), contexto([registroB2()]))]],
  },
  {
    regla: 'El material existe y el lote es L más 4 dígitos',
    pruebas: [
      ['MAT:PROD001|L005', () => validarLecturaProducto(leerEtiqueta('MAT:PROD001|L005'), contexto())],
      ['MAT:PROD011|L0001', () => validarLecturaProducto(leerEtiqueta('MAT:PROD011|L0001'), contexto())],
    ],
  },
  {
    regla: 'El par material-lote es conocido (solo avisa)',
    pruebas: [['MAT:PROD009|L0099', () => validarLecturaProducto(leerEtiqueta('MAT:PROD009|L0099'), contexto())]],
  },
  {
    regla: 'Cantidad entera de 0 a 9999',
    cantidad: true,
    pruebas: [],
  },
  {
    regla: 'Ningún campo obligatorio vacío',
    pruebas: [['B2 sin cantidad', () => validarRegistro(registroB2({ cantidad: '' }), contexto())]],
  },
  {
    regla: 'ID único: un reenvío no duplica',
    pruebas: [
      ['1.er envío', () => agregarRegistro([], registroB2()).resultado],
      ['mismo ID otra vez', () => agregarRegistro(agregarRegistro([], registroB2()).registros, registroB2()).resultado],
    ],
  },
];

const CANTIDADES = ['-12', '1,5', '10000', '120'];

function clase(r) {
  if (!r.ok) return 'mal';
  return r.advertencia ? 'aviso' : 'bien';
}

/** `entrada` solo se muestra cuando la tarjeta prueba más de un caso. */
function resultadoHTML(entrada, r) {
  const c = clase(r);
  const codigo = r.advertencia?.codigo ?? r.codigo ?? 'OK';
  const mensaje = r.advertencia?.mensaje ?? r.mensaje ?? 'Válida: se puede continuar.';
  return html`<li class="resultado ${c}">
    <span class="icono" aria-hidden="true">${{ mal: '✕', aviso: '!', bien: '✓' }[c]}</span>
    <span class="resultado-texto">${entrada ? html`<code>${entrada}</code>` : ''}<b>${codigo}</b> ${mensaje}</span>
  </li>`;
}

function probar(tarjeta, sonar = true) {
  const control = CONTROLES[Number(tarjeta.dataset.control)];
  const lista = tarjeta.querySelector('.resultados');
  const respuestas = control.cantidad
    ? [[tarjeta.querySelector('input').value, validarCantidad(tarjeta.querySelector('input').value)]]
    : control.pruebas.map(([entrada, funcion]) => [entrada, funcion()]);
  const varias = respuestas.length > 1;
  pintar(lista, html`${respuestas.map(([entrada, r]) => resultadoHTML(varias ? entrada : '', r))}`);
  tarjeta.classList.add('probada');
  if (sonar) pitido(respuestas.some(([, r]) => !r.ok) ? 'error' : respuestas.some(([, r]) => r.advertencia) ? 'aviso' : 'ok');
}

export function iniciarControles() {
  const grilla = document.querySelector('[data-zona="controles"]');
  pintar(
    grilla,
    html`${CONTROLES.map(
      (c, i) => html`
        <article class="control" data-control="${i}">
          <header><span class="control-num">${i + 1}</span><h3>${c.regla}</h3></header>
          <div class="control-entradas">
            ${c.cantidad
              ? html`<input value="-12" inputmode="decimal" aria-label="Cantidad a validar" autocomplete="off">
                  ${CANTIDADES.map((q) => html`<button type="button" class="chip" data-cantidad="${q}">${q}</button>`)}`
              : c.pruebas.map(([entrada]) => html`<code>${entrada}</code>`)}
            <button type="button" class="boton-probar" data-accion="probar">Probar</button>
          </div>
          <ul class="resultados" aria-live="polite"></ul>
        </article>`,
    )}`,
  );

  grilla.addEventListener('click', (e) => {
    const tarjeta = e.target.closest('.control');
    if (!tarjeta) return;
    const cantidad = e.target.closest('[data-cantidad]');
    if (cantidad) tarjeta.querySelector('input').value = cantidad.dataset.cantidad;
    if (cantidad || e.target.closest('[data-accion="probar"]')) probar(tarjeta);
  });
  grilla.addEventListener('input', (e) => probar(e.target.closest('.control'), false));

  document.querySelector('[data-accion="probar-todos"]').addEventListener('click', async (e) => {
    e.currentTarget.blur();
    for (const tarjeta of grilla.querySelectorAll('.control')) {
      probar(tarjeta);
      await new Promise((r) => setTimeout(r, 420));
    }
  });
}

registrarDiapo('controles', {
  alSalir() {
    document.querySelectorAll('.control').forEach((t) => {
      t.classList.remove('probada');
      t.querySelector('.resultados').innerHTML = '';
    });
  },
});
