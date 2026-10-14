// Diagrama, Hoja 1: «Contar las unidades e ingresar la cantidad» y «¿Cantidad entera y mayor
// o igual a 0?» (validación 5). Continuar queda deshabilitado mientras el dato no sea válido (regla 6).
import { pasosHTML, rotuloPosicion } from '../componentes/pasos.js';
import { validarCantidad } from '../dominio/validaciones.js';
import { html, pintar } from '../ui.js';

export async function mostrar(contenedor, app) {
  const { posicion, tipo, codigo, lote, cantidad } = app.borrador;
  const material = app.material(codigo);

  pintar(
    contenedor,
    html`
      <section class="pantalla captura">
        ${pasosHTML(2)}
        ${rotuloPosicion(posicion, tipo)}
        <p class="producto-leido"><strong>${codigo}</strong> ${material?.descripcion ?? ''}<br>Lote ${lote}</p>
        <h1 tabindex="-1">Contá las unidades</h1>
        <form id="form-cantidad" class="formulario" novalidate>
          <label class="campo">
            <span class="campo-nombre">Cantidad contada (${material?.um ?? 'UN'})</span>
            <input name="cantidad" class="cantidad-grande" inputmode="numeric" autocomplete="off" enterkeyhint="done"
                   value="${cantidad ?? ''}" aria-describedby="error-cantidad">
          </label>
          <p class="error-campo" id="error-cantidad" aria-live="polite"></p>
          <button class="boton primario" type="submit" disabled>Continuar</button>
        </form>
        <a class="boton texto" href="#/producto">Volver al producto</a>
      </section>`,
  );

  const formulario = contenedor.querySelector('#form-cantidad');
  const campo = formulario.cantidad;
  const error = contenedor.querySelector('#error-cantidad');
  const boton = formulario.querySelector('button');

  const revisar = () => {
    const validacion = validarCantidad(campo.value);
    const vacio = validacion.codigo === 'CAMPO_VACIO';
    error.textContent = validacion.ok || vacio ? '' : validacion.mensaje;
    campo.setAttribute('aria-invalid', String(!validacion.ok && !vacio));
    boton.disabled = !validacion.ok;
    return validacion;
  };

  campo.addEventListener('input', revisar);
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const validacion = revisar();
    if (!validacion.ok) {
      error.textContent = validacion.mensaje;
      return;
    }
    app.borrador = { ...app.borrador, cantidad: validacion.valor };
    app.ir('resumen');
  });

  revisar();
  campo.focus();
}
