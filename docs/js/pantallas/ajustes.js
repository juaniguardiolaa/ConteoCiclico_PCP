// Ajustes del celular: sesión, conexión con la planilla, datos de demostración y etiquetas.
import { almacen } from '../almacen.js';
import { probarConexion } from '../backend/appsscript.js';
import { montarLector } from '../componentes/lector.js';
import { URL_QRCODE_GENERATOR, cargarScript, qrSVG } from '../componentes/qr.js';
import { mostrarResultado } from '../componentes/resultado.js';
import { leerEtiqueta, textoConfig } from '../dominio/etiquetas.js';
import { ROLES, puedeConciliar } from '../roles.js';
import { fechaHoraLocal, html, pintar } from '../ui.js';
import { VERSION } from '../version.js';

export async function mostrar(contenedor, app) {
  const demo = app.backend.modo === 'demo';
  const config = almacen.leer('config', { modo: 'demo' });

  pintar(
    contenedor,
    html`
      <section class="pantalla ajustes">
        <h1 tabindex="-1">Ajustes</h1>

        <h2>Sesión</h2>
        <p>${app.sesion.usuario}, ${ROLES[app.sesion.rol]?.nombre}. Campaña ${app.sesion.campania}.</p>
        <button class="boton secundario" type="button" data-accion="salir">Cambiar de usuario o de rol</button>

        <h2>Conexión</h2>
        <p>
          ${demo
            ? 'Ahora: modo demo. Los registros quedan en este navegador y la conciliación se calcula acá mismo.'
            : 'Ahora: conectado a la planilla de Google Sheets. Cada registro se envía al confirmarlo.'}
        </p>
        <form id="form-conexion" class="formulario" novalidate>
          <label class="campo">
            <span class="campo-nombre">URL del Web App</span>
            <input name="url" inputmode="url" autocomplete="off" spellcheck="false"
                   placeholder="https://script.google.com/macros/s/…/exec" value="${config.url ?? ''}">
          </label>
          <label class="campo">
            <span class="campo-nombre">Token</span>
            <input name="token" autocomplete="off" spellcheck="false" placeholder="Está en la hoja Parametros"
                   value="${config.token ?? ''}">
          </label>
          <div class="acciones">
            <button class="boton primario" type="submit">Probar y conectar con la planilla</button>
            <button class="boton secundario" type="button" data-accion="escanear-config">Escanear QR de configuración</button>
            ${demo ? '' : html`<button class="boton secundario" type="button" data-accion="usar-demo">Volver al modo demo</button>`}
          </div>
          <div id="lector-config"></div>
          <div id="resultado-conexion" aria-live="polite"></div>
        </form>

        ${!demo && puedeConciliar(app.sesion.rol)
          ? html`
            <h3>Configurar otros celulares</h3>
            <p class="nota">Los operarios escanean este QR desde su Ajustes y quedan conectados sin tipear la URL ni el token.</p>
            <button class="boton secundario" type="button" data-accion="mostrar-qr">Mostrar QR de configuración</button>
            <div id="qr-config" class="qr-config"></div>`
          : ''}

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
            </div>

            <h2>Prueba sin conexión</h2>
            <label class="interruptor">
              <input type="checkbox" data-accion="sin-conexion" ${app.backend.sinConexionSimulada() ? 'checked' : ''}>
              <span>Simular que no hay conexión con el servidor</span>
            </label>
            <p class="nota">
              Hace lo mismo que poner el celular en modo avión: los registros quedan en la cola y se envían al
              destildarlo. Sirve para mostrarlo en la exposición sin cortar la red del proyector.
            </p>`
          : ''}

        <h2>Etiquetas</h2>
        <p>Hoja A4 con las etiquetas QR y de código de barras de las posiciones y de los productos.</p>
        <a class="boton secundario" href="etiquetas.html">Abrir las etiquetas para imprimir</a>

        <h2>Documentación</h2>
        <div class="acciones">
          <a class="boton secundario" href="diagrama/">Diagrama de flujo del proceso</a>
          <a class="boton secundario" href="https://github.com/juaniguardiolaa/ConteoCiclico_PCP#readme" target="_blank" rel="noopener">
            Guía de uso y código en GitHub
          </a>
        </div>

        <h2>Versión</h2>
        <p class="nota">${VERSION}. TP6, Planificación y Control de la Producción, UTN FRH 2026.</p>
      </section>`,
  );

  const formulario = contenedor.querySelector('#form-conexion');
  const resultadoConexion = contenedor.querySelector('#resultado-conexion');
  let lector = null;

  const detenerLector = async () => {
    if (lector) await lector.detener();
    lector = null;
    contenedor.querySelector('#lector-config').replaceChildren();
  };

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    await detenerLector();
    const url = formulario.url.value.trim();
    const token = formulario.token.value.trim();
    const boton = formulario.querySelector('[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'Probando…';
    const prueba = await probarConexion(url, token);
    boton.disabled = false;
    boton.textContent = 'Probar y conectar con la planilla';
    if (!prueba.ok) {
      mostrarResultado(resultadoConexion, { tipo: 'error', mensaje: prueba.mensaje });
      return;
    }
    if (prueba.parametros.campania !== app.sesion.campania) {
      app.cerrarSesion(); // la planilla tiene otra campaña: hay que volver a entrar
    }
    mostrarResultado(resultadoConexion, { tipo: 'ok', mensaje: `${prueba.mensaje} Reiniciando la app…` });
    setTimeout(() => app.cambiarConexion({ modo: 'sheets', url, token }), 1200);
  });

  contenedor.querySelector('[data-accion="escanear-config"]').addEventListener('click', () => {
    if (lector) return;
    lector = montarLector(contenedor.querySelector('#lector-config'), {
      etiquetaManual: 'O pegá el texto del QR',
      ejemplo: 'CFG:{…}',
      alLeer: async (texto) => {
        const lectura = leerEtiqueta(texto);
        if (lectura.tipo !== 'CONFIG') {
          mostrarResultado(resultadoConexion, {
            tipo: 'error',
            mensaje: 'Ese no es un QR de configuración. Pedile a Control que lo muestre desde su Ajustes.',
          });
          lector?.reanudar();
          return;
        }
        formulario.url.value = lectura.url;
        formulario.token.value = lectura.token;
        await detenerLector();
        mostrarResultado(resultadoConexion, {
          tipo: 'ok',
          mensaje: 'Datos cargados desde el QR. Tocá «Probar y conectar con la planilla».',
        });
      },
    });
  });

  contenedor.querySelector('[data-accion="usar-demo"]')?.addEventListener('click', () => {
    app.cambiarConexion({ ...config, modo: 'demo' });
  });

  contenedor.querySelector('[data-accion="mostrar-qr"]')?.addEventListener('click', async (evento) => {
    const zona = contenedor.querySelector('#qr-config');
    try {
      await cargarScript(URL_QRCODE_GENERATOR);
      pintar(zona, html`${qrSVG(textoConfig(config.url, config.token), 'qr qr-grande')}`);
      evento.currentTarget.hidden = true;
    } catch (error) {
      mostrarResultado(zona, { tipo: 'error', mensaje: error.message });
    }
  });

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

  contenedor.querySelector('[data-accion="sin-conexion"]')?.addEventListener('change', async (evento) => {
    const sinConexion = evento.currentTarget.checked;
    app.backend.simularSinConexion(sinConexion);
    app.pintarEncabezado();
    if (sinConexion) {
      app.avisar('Sin conexión simulada: lo que se cargue queda en la cola.', 'info');
    } else {
      app.avisar('Conexión restablecida.');
      await app.sincronizar(true);
    }
  });

  contenedor.querySelector('[data-accion="borrar"]')?.addEventListener('click', async () => {
    if (!confirm('Se van a borrar todos los registros de demo de este navegador. ¿Seguir?')) return;
    const r = await app.backend.reiniciar();
    await app.refrescar();
    app.avisar(r.mensaje);
    app.ir('ruta');
  });

  return detenerLector;
}
