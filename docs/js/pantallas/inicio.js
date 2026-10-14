// Diagrama, Hoja 1: «Iniciar sesión en la app y abrir la campaña de conteo».
import { almacen } from '../almacen.js';
import { ROLES } from '../roles.js';
import { fechaCorta, html, pintar } from '../ui.js';

export async function mostrar(contenedor, app) {
  const p = app.parametros;
  const ultimoUsuario = almacen.leer('ultimoUsuario', '');

  pintar(
    contenedor,
    html`
      <section class="pantalla inicio">
        <h1 tabindex="-1">Conteo cíclico</h1>
        <p class="bajada">
          Campaña ${p.campania}. Se cuenta el stock físico al ${fechaCorta(p.fechaConteo)} y se concilia contra
          el stock del ${fechaCorta(p.fechaStockInicial)} más los movimientos del período.
        </p>

        <form class="formulario" id="form-inicio" novalidate>
          <label class="campo">
            <span class="campo-nombre">Tu nombre</span>
            <input name="usuario" autocomplete="name" value="${ultimoUsuario}" required>
          </label>

          <fieldset class="campo">
            <legend class="campo-nombre">Rol en el conteo</legend>
            <div class="opciones-rol">
              ${Object.entries(ROLES).map(
                ([clave, rol], i) => html`
                  <label class="opcion-rol">
                    <input type="radio" name="rol" value="${clave}" ${i === 0 ? 'checked' : ''}>
                    <span class="opcion-nombre">${rol.nombre}</span>
                    <span class="opcion-tarea">${rol.tarea}</span>
                  </label>`,
              )}
            </div>
          </fieldset>

          <p class="mensaje error" id="error-inicio" hidden></p>

          <p class="nota">
            ${app.backend.modo === 'demo'
              ? 'Modo demo: los registros quedan guardados en este navegador. La conexión con Google Sheets se configura en Ajustes.'
              : 'Conectado a la planilla de Google Sheets: cada registro se envía al confirmarlo.'}
          </p>

          <button class="boton primario" type="submit">Empezar el conteo</button>
        </form>
      </section>`,
  );

  const formulario = contenedor.querySelector('#form-inicio');
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const usuario = formulario.usuario.value.trim();
    const error = contenedor.querySelector('#error-inicio');
    if (!usuario) {
      error.textContent = 'Escribí tu nombre: queda en cada registro para saber quién contó qué.';
      error.hidden = false;
      formulario.usuario.focus();
      return;
    }
    app.iniciarSesion({ usuario, rol: formulario.rol.value, campania: p.campania });
    await app.refrescar();
    app.ir('ruta');
  });
}
