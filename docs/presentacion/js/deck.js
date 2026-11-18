// Motor de la presentación: escala el escenario de 1600 × 900 a cualquier pantalla, navega con el
// teclado, el clicker (PageUp/PageDown) o la barra de abajo, y avisa a cada diapositiva cuando entra,
// sale o avanza un paso. La dirección guarda la diapositiva (#5), así un F5 no vuelve al principio.
import { alternarSonido, sonidoActivo } from './sonido.js';

const ANCHO = 1600;
const ALTO = 900;

// Las secciones son las columnas del rack: cada diapositiva es un nivel de su columna.
const SECCIONES = {
  A: 'Preparar',
  B: 'Contar',
  C: 'Controles',
  D: 'Sin señal',
  E: 'Planilla',
  F: 'Conciliar',
  G: 'Cerrar',
};

const hooks = new Map();
let diapos = [];
let actual = -1;
let paso = 0;
let escenario;

/**
 * Cada diapositiva interactiva se engancha por su id:
 * { alEntrar(), alSalir(), pasos, alPaso(n), tecla(evento) -> true si la usó }.
 */
export function registrarDiapo(id, hook) {
  hooks.set(id, hook);
}

export function iniciarDeck() {
  escenario = document.getElementById('escenario');
  diapos = [...document.querySelectorAll('.diapo')];
  diapos.forEach((d) => (d.inert = true));
  armarBarra();
  escalar();
  addEventListener('resize', escalar);
  document.addEventListener('keydown', alTeclear);
  addEventListener('hashchange', () => ir(leerHash()));
  ir(leerHash());
}

function escalar() {
  const escala = Math.min(innerWidth / ANCHO, innerHeight / ALTO);
  escenario.style.setProperty('--escala', escala);
}

function leerHash() {
  const n = Number.parseInt(location.hash.slice(1), 10);
  return Number.isFinite(n) ? n - 1 : 0;
}

function ir(indice, { atras = false } = {}) {
  const destino = Math.max(0, Math.min(diapos.length - 1, indice));
  if (destino === actual) return;
  const previa = diapos[actual];
  if (previa) {
    previa.classList.remove('activa');
    previa.inert = true;
    hooks.get(previa.id)?.alSalir?.();
  }
  escenario.dataset.direccion = destino > actual ? 'adelante' : 'atras';
  actual = destino;
  const diapo = diapos[actual];
  diapo.inert = false;
  diapo.classList.add('activa');
  const hook = hooks.get(diapo.id);
  paso = atras && hook?.pasos ? hook.pasos : 0;
  hook?.alEntrar?.();
  if (hook?.pasos) hook.alPaso?.(paso);
  history.replaceState(null, '', `#${actual + 1}`);
  actualizarBarra();
}

export function siguiente() {
  const hook = hooks.get(diapos[actual].id);
  if (hook?.pasos && paso < hook.pasos) {
    paso += 1;
    hook.alPaso?.(paso);
    return;
  }
  ir(actual + 1);
}

export function anterior() {
  const hook = hooks.get(diapos[actual].id);
  if (hook?.pasos && paso > 0) {
    paso -= 1;
    hook.alPaso?.(paso);
    return;
  }
  ir(actual - 1, { atras: true });
}

/** Para las diapositivas con pasos que tienen su propio botón «Repetir». */
export function volverAlPaso(n) {
  const hook = hooks.get(diapos[actual].id);
  paso = n;
  hook?.alPaso?.(paso);
}

function alTeclear(evento) {
  if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
  const enCampo = evento.target.closest?.('input, textarea, select, [contenteditable="true"]');
  if (!enCampo && hooks.get(diapos[actual].id)?.tecla?.(evento)) {
    evento.preventDefault();
    return;
  }
  const clicker = evento.key === 'PageDown' || evento.key === 'PageUp';
  if (enCampo && !clicker) return;

  const acciones = {
    ArrowRight: siguiente,
    ArrowDown: siguiente,
    PageDown: siguiente,
    ' ': evento.shiftKey ? anterior : siguiente,
    ArrowLeft: anterior,
    ArrowUp: anterior,
    PageUp: anterior,
    Home: () => ir(0),
    End: () => ir(diapos.length - 1),
    f: pantallaCompleta,
    F: pantallaCompleta,
  };
  const accion = acciones[evento.key];
  if (!accion) return;
  evento.preventDefault();
  accion();
}

function pantallaCompleta() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

// ------------------------------------------------------------------------------- barra
function armarBarra() {
  const rack = document.querySelector('[data-zona="barra-rack"]');
  const columnas = new Map();
  diapos.forEach((d, i) => {
    const letra = d.dataset.seccion;
    if (!letra) return;
    if (!columnas.has(letra)) columnas.set(letra, []);
    columnas.get(letra).push(i);
  });

  const inicio = document.createElement('button');
  inicio.type = 'button';
  inicio.className = 'barra-inicio';
  inicio.dataset.ir = '0';
  inicio.title = 'Portada';
  inicio.textContent = 'TP6';
  rack.append(inicio);

  for (const [letra, indices] of columnas) {
    const columna = document.createElement('div');
    columna.className = 'barra-columna';
    columna.dataset.seccion = letra;
    const titulo = document.createElement('button');
    titulo.type = 'button';
    titulo.className = 'barra-titulo';
    titulo.dataset.ir = String(indices[0]);
    titulo.innerHTML = `<b>${letra}</b> ${SECCIONES[letra]}`;
    const niveles = document.createElement('div');
    niveles.className = 'barra-niveles';
    indices.forEach((i) => {
      const nivel = document.createElement('button');
      nivel.type = 'button';
      nivel.className = 'barra-nivel';
      nivel.dataset.ir = String(i);
      nivel.title = `${diapos[i].dataset.codigo}: ${diapos[i].dataset.titulo}`;
      nivel.setAttribute('aria-label', nivel.title);
      niveles.append(nivel);
    });
    columna.append(titulo, niveles);
    rack.append(columna);
  }

  document.querySelector('.barra').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button');
    if (!boton) return;
    if (boton.dataset.ir) ir(Number(boton.dataset.ir), { atras: Number(boton.dataset.ir) < actual });
    else if (boton.dataset.nav === 'anterior') anterior();
    else if (boton.dataset.nav === 'siguiente') siguiente();
    else if (boton.dataset.nav === 'pantalla') pantallaCompleta();
    else if (boton.dataset.nav === 'sonido') {
      alternarSonido();
      pintarSonido();
    }
    boton.blur(); // así la barra espaciadora sigue avanzando diapositivas
  });
  pintarSonido();
}

function pintarSonido() {
  const boton = document.querySelector('[data-nav="sonido"]');
  boton.setAttribute('aria-pressed', String(sonidoActivo()));
  boton.title = sonidoActivo() ? 'Sonido del lector: activado' : 'Sonido del lector: apagado';
}

function actualizarBarra() {
  const diapo = diapos[actual];
  document.querySelectorAll('.barra-columna').forEach((c) => c.classList.toggle('actual', c.dataset.seccion === diapo.dataset.seccion));
  document.querySelectorAll('.barra-nivel, .barra-inicio').forEach((b) => {
    const i = Number(b.dataset.ir);
    b.classList.toggle('actual', i === actual);
    b.classList.toggle('visto', i < actual);
  });
  document.querySelector('[data-zona="contador"]').textContent = `${actual + 1} / ${diapos.length}`;
  document.querySelector('[data-nav="anterior"]').disabled = actual === 0;
  document.querySelector('[data-nav="siguiente"]').disabled = actual === diapos.length - 1 && !hooks.get(diapo.id)?.pasos;
}
