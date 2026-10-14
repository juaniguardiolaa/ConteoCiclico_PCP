# Guion de la simulación (sábado 24/10)

## Antes

- [ ] Planilla con el código actualizado y publicada como nueva versión ([INSTALAR.md](apps-script/INSTALAR.md)).
- [ ] **Inventario → Reiniciar la simulación** (deja Conteo_1410 y Log_API vacíos y la campaña abierta).
- [ ] Etiquetas impresas al 100 %: posiciones, productos en modo simulación y etiquetas de prueba de los controles.
- [ ] Rack de cartulina: bloque A–D y bloque E–G, 4 niveles (nivel 1 abajo). Etiqueta de posición en cada larguero; en cada posición ocupada, la etiqueta del producto y la tira con la cantidad física.
- [ ] Cada celular con la app abierta, conectada con el QR de configuración (Ajustes) y con la versión correcta en Ajustes.

## Roles

| Rol | Carril del diagrama | Qué hace |
| --- | --- | --- |
| Jefe de almacén | Supervisor | Aprueba el plan, los ajustes (Aprobado_por) y el cierre |
| Control de inventarios | Control | Concilia, pide reconteos, completa Causa y Acción |
| Operario 1 y 2 | Operario de conteo | Bloques A–D y E–G |
| Evidencias | Fuera del diagrama | Filma y saca capturas numeradas con el paso del diagrama |

## Paso a paso

1. **Planificación.** El Jefe de almacén aprueba el alcance (A1–G4). Control muestra Parametros y las etiquetas.
2. **Conteo.** Las 28 posiciones (7 vacías: B1, C1, C2, D2, D4, F1, G4). En vivo:
   - `POS:Z9` (etiqueta de prueba) → posición inexistente.
   - B2 escaneada dos veces → duplicado.
   - Cantidad `-12` → rechazada.
   - 3 posiciones en modo avión → quedan «sin enviar» y se envían al volver la red.
   - Error a propósito: en G3 cargar 18 en vez de 180.
3. **Conciliación** desde la app (Control): tiene que decir que la planilla coincide. G3 aparece con −172.
4. **Análisis.** Guardar foto (antes). Pedir reconteo de G3 (da 180 y reemplaza al 18) y de B3 (confirma 490). Transferencia F1 → F2. Causa, Ajuste y Aprobado_por en el resto. **Registrar ajustes y transferencias aprobados**: todo pasa a OK.
5. **Cierre.** Guardar foto (después) y **Cerrar la campaña** con el nombre del Jefe de almacén. La app muestra la campaña cerrada.

Resultado esperado después del paso 3 sin el error de G3: 24 claves, 13 OK, 54,2 % por clave, 60,7 % por posición, −25 unidades. Después del paso 4: 100 %.

## Evidencias

- [ ] Capturas numeradas por paso del diagrama (celular y planilla, con una fórmula de Conciliacion visible).
- [ ] Video de 3 a 5 minutos con el recorrido completo.
- [ ] Log_API, Conteo_1410 (con un REEMPLAZADO) y las dos fotos de la conciliación.
- [ ] Exportación de la planilla en .xlsx y Conciliacion y Resumen en PDF.
- [ ] Tabla de roles del equipo (README) y links a la app y al repo.

## Si algo falla

- Sin internet: se cuenta igual (la cola envía después); la conciliación espera a que vuelva la red.
- La cámara no lee: ingreso manual con el texto de la etiqueta.
- La planilla no responde: Ajustes → Volver al modo demo y seguir la demostración.
