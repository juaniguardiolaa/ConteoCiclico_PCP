// D1, sin señal: la cola real de la app (dominio/cola.js) con un envío simulado que falla mientras
// el interruptor está en «sin señal». Se ve el reintento con espera creciente, el envío al volver la
// red y que un reenvío con el mismo ID no duplica la fila.
import { almacenEnMemoria } from '../../js/almacen.js';
import { crearCola } from '../../js/dominio/cola.js';
import { crearRegistro } from '../../js/dominio/registros.js';
import { fechaHoraLocal, horaCorta, html, nuevoId, pintar } from '../../js/ui.js';
import { registrarDiapo } from './deck.js';
import { CAMPANIA, FISICO, POSICIONES, estado } from './estado.js';
import { pitido } from './sonido.js';

const DEMORA_RED_MS = 700;

let conRed = true;
let confirmados = [];
let ultimoEnviado = null;
let reloj = null;
let reinicios = 0;
let cola;
let raiz;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function enviar(registro) {
  await esperar(DEMORA_RED_MS);
  if (!conRed) throw new Error('Sin conexión');
  const respuesta = estado.registrar(registro);
  if (respuesta.ok) ultimoEnviado = registro;
  return respuesta;
}

function siguientePosicion() {
  const ocupadas = new Set([
    ...estado.registros.filter((r) => r.estado === 'VALIDO' && r.campania === CAMPANIA).map((r) => r.posicion),
    ...cola.pendientes().map((e) => e.registro.posicion),
  ]);
  return POSICIONES.find((p) => !ocupadas.has(p));
}

function confirmarUno() {
  const posicion = siguientePosicion();
  if (!posicion) return;
  const fisico = FISICO.get(posicion);
  const registro = crearRegistro({
    id: nuevoId(),
    fechaHora: fechaHoraLocal(),
    usuario: estado.usuario,
    rol: 'OPERARIO',
    campania: CAMPANIA,
    posicion,
    codigo: fisico?.codigo,
    lote: fisico?.lote,
    cantidad: fisico?.stock ?? 0,
    vacia: !fisico,
    dispositivo: 'Presentación',
  });
  confirmados.push(registro);
  cola.encolar(registro);
  pitido(conRed ? 'ok' : 'aviso');
  cola.procesar().then(pintarTodo);
}

async function reenviarUltimo() {
  if (!ultimoEnviado) return;
  const boton = raiz.querySelector('[data-accion="reenviar"]');
  boton.disabled = true;
  const respuesta = await enviar(ultimoEnviado).catch(() => null);
  boton.disabled = false;
  const aviso = raiz.querySelector('[data-zona="reenvio"]');
  aviso.textContent = respuesta
    ? `Reenvío de ${ultimoEnviado.posicion} con el mismo ID: ${respuesta.codigo}. ${respuesta.mensaje}`
    : 'Sin señal: el reenvío no salió.';
  aviso.className = `reenvio ${respuesta ? 'bien' : 'mal'}`;
}

function estadoDe(registro) {
  const e = cola.estadoDe(registro.id);
  if (e === 'pendiente') return conRed ? 'enviando' : 'pendiente';
  return e;
}

const ETIQUETA_ESTADO = { enviado: 'Enviado', enviando: 'Enviando…', pendiente: 'Sin enviar', rechazado: 'Rechazado' };

function pintarCelular() {
  const pendientes = cola.pendientes();
  const proximo = cola.proximoIntento();
  const faltan = proximo ? Math.max(0, Math.ceil((proximo - Date.now()) / 1000)) : 0;
  const primero = pendientes[0];
  const rechazos = new Map(cola.rechazados().map((r) => [r.registro.id, r]));
  pintar(
    raiz.querySelector('[data-zona="cola"]'),
    html`
      ${pendientes.length
        ? html`<p class="cola-estado ${conRed ? 'enviando' : 'pendiente'}">
            <b>${pendientes.length} sin enviar</b>
            ${conRed
              ? ' · enviando ahora'
              : primero.intentos
                ? ` · intento ${primero.intentos} falló, reintenta en ${faltan} s`
                : ' · esperando señal'}
          </p>`
        : html`<p class="cola-estado al-dia">Todo enviado a la planilla</p>`}
      <ul class="cola-lista">
        ${confirmados.slice(-7).reverse().map((r) => {
          const e = estadoDe(r);
          return html`<li class="${e}">
            <span class="punto" aria-hidden="true"></span>
            <b>${r.posicion}</b>
            <span>${r.vacia ? 'vacía' : `${r.codigo} ${r.lote} · ${r.cantidad}`}</span>
            <span class="cola-etiqueta">${ETIQUETA_ESTADO[e]}${e === 'rechazado' ? `: ${rechazos.get(r.id)?.codigo}` : ''}</span>
          </li>`;
        })}
      </ul>`,
  );
  const siguiente = siguientePosicion();
  const boton = raiz.querySelector('[data-accion="confirmar"]');
  boton.disabled = !siguiente;
  boton.textContent = siguiente ? `Confirmar la posición ${siguiente}` : 'Ya se relevaron las 28 posiciones';
  raiz.querySelector('[data-accion="reenviar"]').disabled = !ultimoEnviado;
  raiz.querySelector('[data-accion="reintentar"]').disabled = !pendientes.length;
}

function pintarPlanilla() {
  const filas = estado.registros.filter((r) => r.campania === CAMPANIA).slice(-6).reverse();
  pintar(
    raiz.querySelector('[data-zona="planilla-filas"]'),
    html`${filas.length
      ? filas.map(
          (r) => html`<tr class="${r.id === ultimoEnviado?.id ? 'nueva' : ''}">
            <td class="mono">${r.id.slice(0, 8)}…</td><td>${horaCorta(r.fechaHora)}</td><td><b>${r.posicion}</b></td>
            <td>${r.codigo}</td><td>${r.lote}</td><td class="num">${r.cantidad}</td><td>${r.estado}</td>
          </tr>`,
        )
      : html`<tr><td colspan="7" class="tenue">Conteo_1410 todavía está vacía.</td></tr>`}`,
  );
  pintar(
    raiz.querySelector('[data-zona="planilla-log"]'),
    html`${estado.log.slice(-4).reverse().map(
      (l) => html`<li><span class="mono">${horaCorta(l.fechaHora)}</span> <b>${l.accion}</b> <span class="log-resultado ${l.resultado === 'YA_REGISTRADO' ? 'ya' : ''}">${l.resultado}</span> ${l.detalle}</li>`,
    )}`,
  );
}

function pintarTodo() {
  pintarCelular();
  pintarPlanilla();
}

function ponerRed(valor) {
  conRed = valor;
  const interruptor = raiz.querySelector('[data-accion="red"]');
  interruptor.setAttribute('aria-checked', String(conRed));
  interruptor.querySelector('.red-texto').textContent = conRed ? 'Con señal' : 'Sin señal';
  raiz.classList.toggle('offline', !conRed);
  // Como el evento «online» de la app: al volver la red se envía todo sin esperar.
  if (conRed) cola.procesar({ forzar: true }).then(pintarTodo);
  pintarTodo();
}

const nuevaCola = () => crearCola({ almacen: almacenEnMemoria(), nombre: 'presentacion', enviar, alCambiar: () => pintarCelular() });

export function iniciarSinSenal() {
  raiz = document.getElementById('sin-senal');
  cola = nuevaCola();
  raiz.addEventListener('click', (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'red') ponerRed(!conRed);
    else if (accion === 'confirmar') confirmarUno();
    else if (accion === 'reintentar') cola.procesar({ forzar: true }).then(pintarTodo);
    else if (accion === 'reenviar') reenviarUltimo();
  });
  estado.alCambiar(() => {
    if (estado.reinicios !== reinicios) {
      reinicios = estado.reinicios;
      confirmados = [];
      ultimoEnviado = null;
      cola = nuevaCola();
      pintarCelular();
    }
    pintarPlanilla();
  });
  pintarTodo();
}

registrarDiapo('sin-senal', {
  alEntrar() {
    pintarTodo();
    // Mientras se ve la diapositiva, la cola reintenta sola como en la app.
    reloj = setInterval(() => {
      cola.procesar().then(pintarTodo);
      pintarCelular();
    }, 1000);
  },
  alSalir() {
    clearInterval(reloj);
    if (!conRed) ponerRed(true);
  },
});
