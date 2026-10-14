// Ajustes del celular: sesión, conexión y datos de demostración.
import { ROLES } from '../roles.js';
import { fechaHoraLocal, html, pintar } from '../ui.js';
import { VERSION } from '../version.js';

export async function mostrar(contenedor, app) {
  const demo = app.backend.modo === 'demo';

  pintar(
    contenedor,
    html`
      <section class="pantalla ajustes">
        <h1 tabindex="-1">Ajustes</h1>

        <h2>Sesión</h2>
        <p>${app.sesion.usuario}, ${ROLES[app.sesion.rol]?.nombre}. Campaña ${app.sesion.campania}.</p>
        <button class="boton secundario" type="button" data-accion="salir">Cambiar de usuario o de rol</button>

        <h2>Conexión</h2>
        ${demo
          ? html`<p>
              Modo demo: los registros quedan guardados en este navegador y la conciliación se calcula acá mismo,
              con la misma lógica que la planilla. La conexión con Google Sheets se configura en esta sección
              cuando la planilla esté publicada.
            </p>`
          : html`<p>Conectado a Google Sheets.</p>`}

        ${demo
          ? html`
            <h2>Datos de demo</h2>
            <p>
              Para ver la conciliación sin recorrer el rack, se pueden cargar las 28 posiciones con el stock físico
              del 14/10 del enunciado. Reemplaza lo que se haya contado en este navegador.
            </p>
            <div class="acciones">
              <button class="boton secundario" type="button" data-accion="precargar">Cargar el conteo del enunciado</button>
              <button class="boton secundario peligro" type="button" data-accion="borrar">Borrar los datos de demo</button>
            </div>`
          : ''}

        <h2>Etiquetas</h2>
        <p>Hoja A4 con las etiquetas QR y de código de barras de las posiciones y de los productos.</p>
        <a class="boton secundario" href="etiquetas.html">Abrir las etiquetas para imprimir</a>

        <h2>Versión</h2>
        <p class="nota">${VERSION}</p>
      </section>`,
  );

  contenedor.querySelector('[data-accion="salir"]').addEventListener('click', () => {
    app.cerrarSesion();
    app.ir('inicio');
  });

  contenedor.querySelector('[data-accion="precargar"]')?.addEventListener('click', async () => {
    if (!confirm('Se van a reemplazar los registros de este navegador por el conteo del enunciado. ¿Seguir?')) return;
    const r = await app.backend.precargarCaso(app.sesion, fechaHoraLocal());
    await app.refrescar();
    app.avisar(r.mensaje);
    app.ir('ruta');
  });

  contenedor.querySelector('[data-accion="borrar"]')?.addEventListener('click', async () => {
    if (!confirm('Se van a borrar todos los registros de demo de este navegador. ¿Seguir?')) return;
    const r = await app.backend.reiniciar();
    await app.refrescar();
    app.avisar(r.mensaje);
    app.ir('ruta');
  });
}
