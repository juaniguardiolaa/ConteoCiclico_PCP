// Diagrama, Hoja 1: «Mostrar resumen», «¿El operario confirma los datos?», «Guardar el registro con
// ID, fecha-hora y usuario» y «Enviar el registro a Google Sheets».
import { pasosHTML, rotuloPosicion } from '../componentes/pasos.js';
import { mostrarResultado } from '../componentes/resultado.js';
import { crearRegistro } from '../dominio/registros.js';
import { validarRegistro } from '../dominio/validaciones.js';
import { describirDispositivo, entero, fechaHoraLocal, html, nuevoId, pintar } from '../ui.js';

export async function mostrar(contenedor, app) {
  const b = app.borrador;
  const material = app.material(b.codigo);

  pintar(
    contenedor,
    html`
      <section class="pantalla captura">
        ${pasosHTML(3, b.vacia)}
        ${rotuloPosicion(b.posicion, b.tipo)}
        <h1 tabindex="-1">Revisá y confirmá</h1>
        ${b.vacia
          ? html`<dl class="ficha">
              <div><dt>Posición</dt><dd>${b.posicion}</dd></div>
              <div><dt>Estado</dt><dd>Vacía: se registra con cantidad 0</dd></div>
            </dl>`
          : html`<dl class="ficha">
              <div><dt>Posición</dt><dd>${b.posicion}</dd></div>
              <div><dt>Material</dt><dd><strong>${b.codigo}</strong> ${material?.descripcion ?? ''}</dd></div>
              <div><dt>Lote</dt><dd>${b.lote}</dd></div>
              <div><dt>Cantidad</dt><dd class="ficha-cantidad">${entero(b.cantidad)} ${material?.um ?? 'UN'}</dd></div>
              ${b.tipo === 'RECONTEO' ? html`<div><dt>Tipo</dt><dd>Reconteo: reemplaza el conteo anterior</dd></div>` : ''}
            </dl>`}
        ${b.advertencia ? html`<div class="mensaje advertencia"><p>${b.advertencia.mensaje}</p></div>` : ''}
        <div id="resultado" aria-live="assertive"></div>
        <div class="acciones">
          <button class="boton primario" type="button" data-accion="confirmar">Confirmar y enviar</button>
          <button class="boton secundario" type="button" data-accion="editar">Editar</button>
        </div>
      </section>`,
  );

  const resultado = contenedor.querySelector('#resultado');
  const confirmar = contenedor.querySelector('[data-accion="confirmar"]');

  contenedor.querySelector('[data-accion="editar"]').addEventListener('click', () => app.ir('producto'));

  confirmar.addEventListener('click', async () => {
    const registro = crearRegistro({
      id: nuevoId(),
      fechaHora: fechaHoraLocal(),
      usuario: app.sesion.usuario,
      rol: app.sesion.rol,
      campania: app.sesion.campania,
      tipo: b.tipo,
      posicion: b.posicion,
      codigo: b.codigo,
      lote: b.lote,
      cantidad: b.cantidad,
      vacia: b.vacia,
      dispositivo: describirDispositivo(),
    });

    const validacion = validarRegistro(registro, app.contexto());
    if (!validacion.ok) {
      mostrarResultado(resultado, { tipo: 'error', mensaje: validacion.mensaje, codigo: validacion.codigo });
      return;
    }

    confirmar.disabled = true;
    confirmar.textContent = 'Enviando…';
    let respuesta;
    try {
      respuesta = await app.backend.registrar(registro);
    } catch (error) {
      respuesta = { ok: false, codigo: 'SIN_CONEXION', mensaje: `No se pudo enviar el registro: ${error.message}` };
    }

    if (respuesta.ok) {
      app.borrador = null;
      app.avisar(respuesta.mensaje);
      app.ir('ruta');
      return;
    }
    confirmar.disabled = false;
    confirmar.textContent = 'Confirmar y enviar';
    mostrarResultado(resultado, {
      tipo: 'error',
      mensaje: respuesta.mensaje,
      codigo: respuesta.codigo,
      acciones: [{ texto: 'Volver a la ruta', alHacer: () => app.ir('ruta') }],
    });
  });
}
