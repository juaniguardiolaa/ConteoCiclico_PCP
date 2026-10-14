// Diagrama, Hoja 1: «Ir a la siguiente posición de la ruta» y «¿Quedan posiciones en la ruta?».
// El mapa muestra qué posiciones faltan. Conteo ciego: nunca se muestra el stock teórico.
import { rackHTML } from '../componentes/rack.js';
import { puedeConciliar } from '../roles.js';
import { entero, horaCorta, html, pintar } from '../ui.js';

export async function mostrar(contenedor, app) {
  await app.refrescar();
  const { registros, reconteos } = app.estado;
  const validos = registros.filter((r) => r.estado === 'VALIDO');
  const porPosicion = new Map(validos.map((r) => [r.posicion, r]));
  const total = app.maestros.posiciones.length;
  const relevadas = app.maestros.posiciones.filter((p) => porPosicion.has(p.posicion)).length;
  const completo = relevadas === total;
  const pendientes = app.cola.pendientes();
  const rechazados = app.cola.rechazados();

  const celda = (posicion) => {
    const r = porPosicion.get(posicion);
    if (reconteos.includes(posicion)) return { clase: 'reconteo', texto: 'recontar', descripcion: 'reconteo pedido por Control' };
    if (!r) return { clase: 'pendiente', descripcion: 'pendiente' };
    const envio = r.pendiente ? ' sin-enviar' : '';
    const aclaracion = r.pendiente ? ', sin enviar' : '';
    if (r.vacia) return { clase: `vacia${envio}`, texto: 'vacía', descripcion: `relevada, vacía${aclaracion}` };
    return {
      clase: `contada${envio}`,
      texto: entero(r.cantidad),
      descripcion: `contada, ${r.codigo} ${r.lote}, ${r.cantidad} unidades${aclaracion}`,
    };
  };

  const recientes = [...validos].sort((a, b) => b.fechaHora.localeCompare(a.fechaHora)).slice(0, 5);
  const ultimoError = pendientes.find((e) => e.ultimoError)?.ultimoError;

  pintar(
    contenedor,
    html`
      <section class="pantalla ruta">
        <div class="avance">
          <h1 tabindex="-1"><span class="avance-numero">${relevadas}</span> de ${total} posiciones relevadas</h1>
          <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${relevadas}"
               aria-label="Avance del conteo">
            <span style="width: ${Math.round((relevadas / total) * 100)}%"></span>
          </div>
        </div>

        ${app.estado.cerrada
          ? html`<div class="mensaje ok">
              <p><strong>La campaña ${app.sesion.campania} está cerrada.</strong>
              ${app.estado.cierreAprobadoPor ? `Aprobó el cierre: ${app.estado.cierreAprobadoPor}.` : ''}
              Ya no se aceptan registros.</p>
            </div>`
          : ''}

        ${reconteos.length && !app.estado.cerrada
          ? html`<div class="mensaje advertencia">
              <p><strong>Control pidió recontar ${reconteos.length === 1 ? 'la posición' : 'las posiciones'}
              ${reconteos.join(', ')}.</strong> Escaneá la posición y contala de nuevo: el nuevo conteo reemplaza al anterior.</p>
            </div>`
          : ''}

        ${rechazados.map(
          (r) => html`
            <div class="mensaje error" role="alert">
              <p><strong>La posición ${r.registro.posicion} no se registró.</strong> ${r.mensaje}</p>
              <p class="mensaje-codigo">Control: ${r.codigo}. Se había cargado sin conexión a las ${horaCorta(r.registro.fechaHora)}.</p>
              <div class="mensaje-acciones">
                <button class="boton secundario" type="button" data-descartar="${r.registro.id}">Entendido</button>
              </div>
            </div>`,
        )}

        ${pendientes.length
          ? html`<div class="mensaje advertencia">
              <p>
                <strong>${pendientes.length} registro(s) sin enviar</strong>
                (${pendientes.map((e) => e.registro.posicion).join(', ')}). Están guardados en el celular y se envían
                solos cuando vuelve la conexión.
              </p>
              ${ultimoError ? html`<p class="mensaje-codigo">Último intento: ${ultimoError}</p>` : ''}
              <div class="mensaje-acciones">
                <button class="boton secundario" type="button" data-accion="reintentar">Reintentar ahora</button>
              </div>
            </div>`
          : ''}

        ${rackHTML(app.maestros.posiciones, celda, 'Mapa del rack con el estado de cada posición')}

        <ul class="leyenda" aria-label="Referencias del mapa">
          <li><span class="muestra pendiente"></span>Pendiente</li>
          <li><span class="muestra contada"></span>Contada</li>
          <li><span class="muestra vacia"></span>Vacía</li>
          ${pendientes.length ? html`<li><span class="muestra contada sin-enviar"></span>Sin enviar</li>` : ''}
          ${reconteos.length ? html`<li><span class="muestra reconteo"></span>Reconteo pedido</li>` : ''}
        </ul>

        ${completo && !reconteos.length && !app.estado.cerrada
          ? html`<div class="mensaje ok">
              <p><strong>Relevaste las ${total} posiciones.</strong>
              ${puedeConciliar(app.sesion.rol)
                ? 'Ya se puede ejecutar la conciliación.'
                : 'Avisale a Control de inventarios que el conteo terminó.'}</p>
            </div>`
          : ''}

        <div class="acciones-fijas">
          ${completo && !reconteos.length && puedeConciliar(app.sesion.rol)
            ? html`<a class="boton primario" href="#/conciliacion">Ir a la conciliación</a>`
            : html`<button class="boton primario" type="button" data-accion="contar"
                ${(completo && !reconteos.length) || app.estado.cerrada ? 'disabled' : ''}>
                ${reconteos.length ? 'Escanear posición a recontar' : 'Escanear posición'}</button>`}
        </div>

        ${recientes.length
          ? html`
            <h2>Últimos registros</h2>
            <ul class="recientes">
              ${recientes.map(
                (r) => html`
                  <li>
                    <span class="recientes-pos">${r.posicion}</span>
                    <span class="recientes-detalle">
                      ${r.vacia ? 'Vacía' : `${r.codigo} ${r.lote}`}${r.tipo === 'RECONTEO' ? ' (reconteo)' : ''}
                      ${r.pendiente ? html`<span class="recientes-envio">sin enviar</span>` : ''}
                    </span>
                    <span class="recientes-cant">${r.vacia ? '0' : entero(r.cantidad)}</span>
                    <span class="recientes-hora">${horaCorta(r.fechaHora)}</span>
                  </li>`,
              )}
            </ul>`
          : html`<p class="nota">Todavía no hay registros. Elegí una posición del rack, escaneá su etiqueta y seguí los pasos.</p>`}
      </section>`,
  );

  contenedor.querySelector('[data-accion="contar"]')?.addEventListener('click', () => {
    app.borrador = { tipo: 'CONTEO' };
    app.ir('posicion');
  });

  contenedor.querySelector('[data-accion="reintentar"]')?.addEventListener('click', async (evento) => {
    evento.currentTarget.disabled = true;
    evento.currentTarget.textContent = 'Enviando…';
    await app.sincronizar(true);
    if (app.cola.pendientes().length) {
      app.avisar('Todavía no hay conexión. Se va a volver a intentar solo.', 'info');
      app.ir('ruta');
    }
  });

  contenedor.querySelectorAll('[data-descartar]').forEach((boton) =>
    boton.addEventListener('click', () => {
      app.cola.descartarRechazo(boton.dataset.descartar);
      app.ir('ruta');
    }),
  );
}
