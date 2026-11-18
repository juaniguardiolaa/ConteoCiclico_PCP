// Pitido del lector: agudo si la lectura sirve, grave si la app la rechaza. Se apaga desde la barra.
const CLAVE = 'tp6-presentacion.sonido';

let activo = leer();
let contexto = null;

function leer() {
  try {
    return localStorage.getItem(CLAVE) !== 'no';
  } catch {
    return true;
  }
}

export const sonidoActivo = () => activo;

export function alternarSonido() {
  activo = !activo;
  try {
    localStorage.setItem(CLAVE, activo ? 'si' : 'no');
  } catch {
    // queda solo para esta sesión
  }
}

/** tipo: 'ok' | 'aviso' | 'error' */
export function pitido(tipo = 'ok') {
  if (!activo) return;
  try {
    contexto ??= new AudioContext();
    const ahora = contexto.currentTime;
    const oscilador = contexto.createOscillator();
    const volumen = contexto.createGain();
    oscilador.type = tipo === 'error' ? 'square' : 'sine';
    oscilador.frequency.value = { ok: 1480, aviso: 880, error: 196 }[tipo] ?? 1480;
    const duracion = tipo === 'error' ? 0.28 : 0.11;
    volumen.gain.setValueAtTime(0.0001, ahora);
    volumen.gain.exponentialRampToValueAtTime(tipo === 'error' ? 0.06 : 0.12, ahora + 0.01);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + duracion);
    oscilador.connect(volumen).connect(contexto.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + duracion + 0.02);
  } catch {
    // sin audio no pasa nada
  }
}
