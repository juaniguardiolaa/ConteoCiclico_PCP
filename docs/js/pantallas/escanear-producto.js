// Diagrama, Hoja 1: «¿La posición está vacía?», «Escanear el código del producto (material + lote)»
// y «¿Material y lote válidos según el maestro?» (validaciones 3 y 4).
import { montarLector } from '../componentes/lector.js';
import { pasosHTML, rotuloPosicion } from '../componentes/pasos.js';
import { limpiarResultado, mostrarResultado } from '../componentes/resultado.js';
import { leerEtiqueta, leerProductoManual } from '../dominio/etiquetas.js';
import { validarLecturaProducto } from '../dominio/validaciones.js';
import { html, pintar, vibrar } from '../ui.js';

export async function mostrar(contenedor, app) {
  const { posicion, tipo } = app.borrador;

  pintar(
    contenedor,
    html`
      <section class="pantalla captura">
        ${pasosHTML(1)}
        ${rotuloPosicion(posicion, tipo)}
        <h1 tabindex="-1">Escaneá el producto</h1>
        <p class="bajada">Leé la etiqueta del producto y lote que hay en la posición (empieza con MAT).</p>
        <div id="zona-lector"></div>
        <div id="resultado" aria-live="assertive"></div>
        <div class="acciones">
          <button class="boton secundario" type="button" data-accion="vacia">La posición está vacía</button>
          <a class="boton texto" href="#/ruta">Cancelar</a>
        </div>
      </section>`,
  );

  const resultado = contenedor.querySelector('#resultado');

  const seguirConProducto = (lectura, advertencia = null) => {
    // Si se volvió a escanear el mismo producto (opción «Editar»), se conserva la cantidad cargada.
    const b = app.borrador;
    const mismo = !b.vacia && b.codigo === lectura.codigo && b.lote === lectura.lote;
    app.borrador = { ...b, codigo: lectura.codigo, lote: lectura.lote, vacia: false, advertencia, cantidad: mismo ? b.cantidad : undefined };
    app.ir('cantidad');
  };

  const lector = montarLector(contenedor.querySelector('#zona-lector'), {
    etiquetaManual: 'O escribí material y lote',
    ejemplo: 'Por ejemplo PROD001 L0005',
    alLeer(texto, origen) {
      const lectura = origen === 'manual' ? leerProductoManual(texto) : leerEtiqueta(texto);
      const validacion = validarLecturaProducto(lectura, app.contexto());
      const volver = {
        texto: 'Volver a escanear',
        primaria: true,
        alHacer: () => {
          limpiarResultado(resultado);
          lector.reanudar();
        },
      };

      if (!validacion.ok) {
        vibrar([80, 60, 80]);
        mostrarResultado(resultado, { tipo: 'error', mensaje: validacion.mensaje, codigo: validacion.codigo, acciones: [volver] });
        return;
      }
      if (validacion.advertencia) {
        vibrar([60, 40, 60]);
        mostrarResultado(resultado, {
          tipo: 'advertencia',
          mensaje: validacion.advertencia.mensaje,
          codigo: validacion.advertencia.codigo,
          acciones: [
            { texto: 'Registrar igual', primaria: true, alHacer: () => seguirConProducto(lectura, validacion.advertencia) },
            { ...volver, primaria: false },
          ],
        });
        return;
      }
      seguirConProducto(lectura);
    },
  });

  contenedor.querySelector('[data-accion="vacia"]').addEventListener('click', () => {
    app.borrador = { ...app.borrador, vacia: true, codigo: '', lote: '', cantidad: 0, advertencia: null };
    app.ir('resumen');
  });

  return () => lector.detener();
}
