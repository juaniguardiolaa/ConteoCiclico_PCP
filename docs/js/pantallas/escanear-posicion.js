// Diagrama, Hoja 1: «Escanear el QR de la posición», «¿La posición existe en el maestro?»
// (validación 1) y «¿La posición ya fue registrada en esta campaña?» (validación 2).
import { montarLector } from '../componentes/lector.js';
import { pasosHTML } from '../componentes/pasos.js';
import { limpiarResultado, mostrarResultado } from '../componentes/resultado.js';
import { leerEtiqueta, leerPosicionManual } from '../dominio/etiquetas.js';
import { validarLecturaPosicion } from '../dominio/validaciones.js';
import { html, pintar, vibrar } from '../ui.js';

export async function mostrar(contenedor, app) {
  app.borrador ??= { tipo: 'CONTEO' };
  const esReconteo = app.borrador.tipo === 'RECONTEO';
  await app.refrescar();

  pintar(
    contenedor,
    html`
      <section class="pantalla captura">
        ${pasosHTML(0)}
        <h1 tabindex="-1">${esReconteo ? 'Escaneá la posición a recontar' : 'Escaneá la posición'}</h1>
        <p class="bajada">Leé la etiqueta de la posición (empieza con POS).</p>
        <div id="zona-lector"></div>
        <div id="resultado" aria-live="assertive"></div>
        <a class="boton texto" href="#/ruta">Cancelar</a>
      </section>`,
  );

  const resultado = contenedor.querySelector('#resultado');
  const lector = montarLector(contenedor.querySelector('#zona-lector'), {
    etiquetaManual: 'O escribí la posición',
    ejemplo: 'Por ejemplo B2',
    alLeer(texto, origen) {
      const lectura = origen === 'manual' ? leerPosicionManual(texto) : leerEtiqueta(texto);
      const validacion = validarLecturaPosicion(lectura, app.contexto(), app.borrador.tipo);
      // Una posición ya contada con reconteo pedido por Control pasa sola a RECONTEO (Hoja 2:
      // «Recontar la posición, misma captura de la Hoja 1, tipo = reconteo»).
      if (validacion.codigo === 'POSICION_DUPLICADA' && app.estado.reconteos.includes(lectura.posicion)) {
        app.borrador = { ...app.borrador, tipo: 'RECONTEO', posicion: lectura.posicion };
        app.avisar(`Control pidió recontar ${lectura.posicion}: este conteo reemplaza al anterior.`, 'info');
        app.ir('producto');
        return;
      }
      if (validacion.ok) {
        app.borrador = { ...app.borrador, posicion: lectura.posicion };
        app.ir('producto');
        return;
      }
      vibrar([80, 60, 80]);
      const volver = {
        texto: 'Volver a escanear',
        primaria: true,
        alHacer: () => {
          limpiarResultado(resultado);
          lector.reanudar();
        },
      };
      const acciones =
        validacion.codigo === 'POSICION_DUPLICADA'
          ? [{ texto: 'Pasar a la siguiente', primaria: true, alHacer: () => app.ir('ruta') }, { ...volver, primaria: false }]
          : [volver];
      mostrarResultado(resultado, { tipo: 'error', mensaje: validacion.mensaje, codigo: validacion.codigo, acciones });
    },
  });

  return () => lector.detener();
}
