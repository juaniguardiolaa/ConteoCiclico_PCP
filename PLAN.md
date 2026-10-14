# Plan de desarrollo · App de conteo cíclico TP6 (v2)

14/10/2026 · Basado en el plan del 13/10, ajustado para desarrollarlo con Claude Code y publicarlo en GitHub Pages.

Repositorio: https://github.com/juaniguardiolaa/ConteoCiclico_PCP

## Qué cambia respecto del plan del 13/10

| Cambio | Por qué |
| --- | --- |
| **Modo demo sin Google** | Cualquiera abre la app en Pages y recorre el conteo y la conciliación completos, con los datos guardados en el navegador. Sirve para el grupo, para la cátedra y como respaldo en la exposición. |
| **El repo no guarda secretos** | La URL del Web App y el token se cargan en cada celular, desde Ajustes o escaneando un QR de configuración. El repo es público sin exponer la planilla. |
| Movimientos tiene **40 filas**, no 41 | Recontado contra el Excel. El resto de los números del plan anterior se verificó y da igual. |
| Las filas de Stock 30/09 sin lote ni posición y con stock 0 no generan clave | Son PROD006, PROD007 y PROD009. Si se normalizaran a SIN_LOTE/SIN_POS, aparecerían 27 claves en vez de 24. |
| Tipo de movimiento nuevo `Transferencia_Posicion` | El caso no trae un tipo para mover un lote de posición. Se usa en el análisis del error de ubicación F1 → F2. |
| Los hitos los ejecuta Claude Code en esta sesión | Los pasos manuales quedan marcados con 👤. |

Se mantiene la decisión del 13/10: **HTML y JavaScript sin framework ni build**. Cualquiera del grupo puede editar un archivo, incluso desde la web de GitHub, y el cambio se publica solo.

## Qué aporta el trabajo de 2024

En `APP 2024` está la resolución de un grupo de hace dos años, con MIT App Inventor y otro set de datos. Sirve como referencia de qué se aceptó y de qué conviene mejorar. No se copia nada.

| Cómo lo resolvieron en 2024 | Qué hacemos nosotros |
| --- | --- |
| Menú con tres funciones: registrar stock, registrar movimiento y consultar stock | Mismo criterio de pocas pantallas y botones grandes. La consulta de stock por posición queda solo para Control: el operario cuenta a ciegas. |
| Envío con URL prellenada de Google Forms: sin validación, sin ID y sin usuario | Web App propio que repite las validaciones, guarda ID, usuario y fecha-hora, y deja todo en Log_API. |
| QR solo con el código de producto; el lote se tipea | Un QR por producto-lote. En su planilla hay un lote cargado como `L005` en vez de `L0005`: es el error que evita la validación 3. |
| QR generados con `=IMAGE()` desde api.qrserver.com | Las etiquetas se generan en la app, sin depender de un servicio externo. |
| Conciliación por Lote-Código, sin posición, con fórmulas que apuntan a filas fijas (`=F17-L4`) | Clave Codigo\|Lote\|Posicion y SUMIFS por clave. Detecta el error de ubicación F1 → F2 y no se rompe si cambia el orden de las filas. |
| Diagrama solo de la navegación de la app, sin carriles | El diagrama del grupo cubre las 5 fases con responsables (criterio 1). |

## Objetivo y mapeo con la rúbrica

Una app web para el celular que simula el conteo cíclico del 14/10/2026, envía cada lectura a Google Sheets y deja la conciliación resuelta con fórmulas verificables.

| Criterio | Puntos | Qué lo demuestra | Hito |
| --- | --- | --- | --- |
| 1. Diagrama de flujo | 1,0 | Las dos hojas del diagrama ya hecho (carriles, decisiones, conectores A, B, C, R) | Hecho |
| 2. Aplicación de captura | 2,0 | App publicada en Pages; circuito completo en video, sin errores | H2, H3, H8 |
| 3. Captura y validación | 1,5 | QR y Code 128; posición, material, lote y cantidad; 7 validaciones con tests | H1, H2, H4 |
| 4. Integración con Google Sheets | 1,0 | Filas en Conteo_1410 con ID, fecha-hora y usuario; Log_API; cola sin pérdida | H3, H5 |
| 5. Conciliación | 2,5 | Hoja Conciliacion con SUMIFS que coinciden con la tabla de resultado esperado | H1, H6, H7 |
| 6. Evidencias y documentación | 2,0 | README reproducible, capturas por paso del diagrama, roles, Sheet compartido, informe | H8 y simulación |

Condición de acreditación: sin app funcional o sin conciliación, la nota máxima es 5,0. Por eso la conciliación se resuelve y se testea primero (H1), antes de tener cámara o Sheet.

## Arquitectura

```text
 Celular (Chrome / Safari)                      Google (cuenta gmail.com del grupo)
┌──────────────────────────────┐   HTTPS POST   ┌───────────────────────────────┐
│ App HTML + JS en GitHub Pages│  text/plain    │ Web App de Apps Script        │
│  · escáner (cámara)          │ ─────────────► │  · valida de nuevo (manda)    │
│  · validaciones              │ ◄───────────── │  · LockService + ID único     │
│  · cola offline (localStor.) │   JSON         │  · escribe en el Sheet        │
│  · backend: AppsScript | Demo│                │  · menú Inventario (concilia) │
└──────────────────────────────┘                └───────────────┬───────────────┘
        ▲  modo demo: todo en el navegador                       ▼
        └─ misma lógica de dominio (conciliacion.js)   Google Sheets (10 hojas, fórmulas)
```

- La app nunca escribe directo en la planilla: todo pasa por Apps Script, que repite las validaciones antes de guardar.
- Las pantallas hablan con un backend que tiene dos implementaciones con las mismas funciones: `backend/appsscript.js` (fetch al Web App) y `backend/demo.js` (localStorage más las funciones de dominio). Las pantallas no saben cuál está activa.
- La conciliación existe dos veces y las dos tienen que dar lo mismo: como función pura en JavaScript (tests, modo demo y pantalla de resultados) y como fórmulas SUMIFS en el Sheet (lo que verifica la cátedra).

## Stack y estructura del repo

- Front: HTML, CSS y JavaScript con módulos ES, sin framework ni build. GitHub Pages publica la carpeta `docs/` de la rama `main`.
- Librerías por CDN (jsDelivr) con versión fija: `html5-qrcode@2.3.8` (lectura de QR y Code 128), `qrcode-generator@1.4.4` y `jsbarcode@3.11.6` (etiquetas).
- Tests: `node --test` sobre la lógica de dominio. No hace falta instalar nada.
- Servidor local: `node scripts/servidor.mjs`, también sin dependencias. La cámara funciona en localhost.
- `exceljs` es la única dependencia y es de desarrollo: solo hace falta para volver a exportar los datos del Excel.
- GitHub Actions corre los tests en cada push y pull request.

```text
ConteoCiclico_PCP/
  CLAUDE.md  PLAN.md  README.md  package.json
  .github/workflows/tests.yml    node --test en cada push y PR
  data/                          Excel del caso (fuente única de datos)
  scripts/exportar-datos.mjs     Excel -> docs/js/datos/caso.js y apps-script/Datos.gs
  scripts/servidor.mjs           servidor estático para probar en la compu
  apps-script/                   Code.gs, Datos.gs, appsscript.json (se pegan en el Sheet)
  docs/                          lo que publica GitHub Pages
    index.html                   la app
    etiquetas.html               hoja A4 de etiquetas
    css/
    js/
      dominio/                   lógica pura, sin DOM: etiquetas, validaciones,
                                 conciliacion, indicadores, cola
      datos/caso.js              datos del caso generados desde el Excel
      backend/                   appsscript.js, demo.js
      pantallas/                 una por nodo del diagrama
      app.js                     arranque y navegación
  tests/                         *.test.js sobre docs/js/dominio
```

Para el grupo: `git clone`, después `npm run dev` (o abrir directamente la URL de Pages). Cada push a `main` se publica en uno o dos minutos. Para probar cambios sin tocar la versión publicada, se trabaja en una rama y se abre un pull request; los tests corren igual.

## Modelo de datos en Google Sheets

Un archivo con 10 hojas. La clave de todo es `Codigo|Lote|Posicion`. Los datos del caso se cargan sin tocar los valores y cada cálculo queda como fórmula.

| Hoja | Qué guarda | Columnas | Filas al inicio |
| --- | --- | --- | --- |
| Parametros | Configuración de la campaña | `Clave, Valor`: campaña activa `CC-2026-10-14`, fecha de conteo 14/10/2026, fecha de stock inicial 30/09/2026, inicio de movimientos 01/10/2026, token, tolerancia por defecto, alcance A1–G4 | 7 |
| Maestro_Materiales | Los 10 códigos | `Codigo, Descripcion, UM, Clase_ABC, Tolerancia` | 10 |
| Maestro_Posiciones | El rack | `Posicion, Bloque, Columna, Nivel` (bloque 1 = A–D, bloque 2 = E–G; nivel 1 abajo) | 28 |
| Maestro_Lotes | Pares material-lote conocidos | `Codigo, Lote` (fórmula UNIQUE sobre Stock_3009 y Movimientos) | 22 |
| Stock_3009 | Foto del 30/09 tal como viene en el Excel | `Codigo, Descripcion, Lote, Posicion, Stock` | 13 |
| Movimientos | Histórico del 01 al 14/10, con signo | `ID, Fecha, Codigo, Lote, Cantidad, UM, Tipo_Movimiento, Posicion, Motivo, Origen` | 40 |
| Conteo_1410 | Lo que manda la app, una fila por lectura | `ID, Fecha_Hora, Usuario, Rol, Campania, Tipo, Posicion, Codigo, Lote, Cantidad, Vacia, Estado, Dispositivo` | 0 |
| Conciliacion | Teórico contra físico por clave | `Clave, Codigo, Descripcion, Lote, Posicion, Stock_3009, Ingresos, Salidas, Ajustes, Teorico_1410, Fisico_1410, Diferencia, Tolerancia, Clasificacion, Causa, Accion, Aprobado_por` | se genera |
| Resumen | Indicadores del cierre | Exactitud por clave y por posición, diferencia neta por material, registros por clasificación | se genera |
| Log_API | Trazabilidad de cada llamada | `Fecha_Hora, Accion, Usuario, Resultado, Detalle` | 0 |

`Origen` distingue las filas del caso (`CASO`) de las que genera el proceso (`AJUSTE_CONTEO`, `TRANSFERENCIA`, `CORRECCION`). Así la cátedra ve qué estaba en el enunciado y qué agregó la conciliación.

Stock 1410 del Excel **no se carga en el Sheet**: es la realidad física que se captura con la app durante la simulación. Solo se usa como dato de prueba en los tests y, en modo demo, en el botón opcional «Precargar el conteo del caso».

## Reglas de la conciliación

- **Clave:** `Codigo|Lote|Posicion`. El universo de claves es la unión de Stock_3009, Movimientos y Conteo_1410 (registros VALIDO). Una fila de Stock_3009 sin lote ni posición y con stock 0 no genera clave.
- **Teórico 14/10** = Stock_3009 + Σ Movimientos con fecha entre el 01/10 y el 14/10/2026. Las cantidades ya traen signo. Se abre en Ingresos (Ingreso_Orden_Compra, Retorno_Venta), Salidas (Salida_Venta, Consumo_Orden_Producción) y Ajustes (Ajuste_Inventario_Ciclico, Ajuste_Inventario_Anual, Transferencia_Posicion).
- **Físico 14/10** = Σ Conteo_1410 con `Estado = VALIDO` y `Campania = CC-2026-10-14`. Las posiciones registradas como vacías no generan clave.
- **Diferencia** = Físico − Teórico.
- **Clasificación**, en este orden:
  1. `OK`: |Diferencia| ≤ Tolerancia del material.
  2. `NO_REGISTRADO`: el par Codigo|Lote no está en Maestro_Lotes (stock físico que el sistema no conoce).
  3. `UBICACION`: la suma de diferencias del mismo Codigo|Lote en todas sus posiciones queda dentro de la tolerancia. Es stock que está, pero en otra posición.
  4. `FALTANTE` si la diferencia es negativa, `SOBRANTE` si es positiva.
- **Tolerancia:** se toma de Maestro_Materiales y por defecto es 0 para todos. El caso no trae costos ni consumos valorizados para calcular la clase ABC, así que queda como parámetro editable.
- **Exactitud de inventario:** se informan las dos definiciones y el informe aclara cuál se toma como principal. Por clave: claves OK sobre claves totales. Por posición: posiciones sin diferencia sobre las 28 del alcance.

## Etiquetas y validaciones

| Etiqueta | Contenido | Expresión regular | Cantidad |
| --- | --- | --- | --- |
| Posición | `POS:B2` | `^POS:([A-G][1-4])$` | 28 |
| Producto-lote | `MAT:PROD001\|L0005` | `^MAT:(PROD\d{3})\|(L\d{4})$` | 22 |
| Configuración (opcional) | `CFG:` + URL del Web App + token | `^CFG:` | 1, la tiene Control |

Cada etiqueta lleva el QR, el mismo texto en Code 128 y el texto legible para cargarlo a mano.

| # | Regla | Si falla | Dónde |
| --- | --- | --- | --- |
| 1 | La posición existe en Maestro_Posiciones | Error «Posición inexistente»; se vuelve a escanear | App y servidor |
| 2 | La posición no tiene un registro VALIDO en la campaña | Alerta de duplicado; solo entra como RECONTEO pedido por Control | App y servidor |
| 3 | El material existe y el lote cumple `L\d{4}` | Error; se vuelve a escanear | App y servidor |
| 4 | El par material-lote está en Maestro_Lotes | Advertencia con confirmación explícita (puede ser stock no registrado) | App |
| 5 | Cantidad entera, entre 0 y 9999 | Error en el campo; no deja avanzar | App y servidor |
| 6 | Ningún campo obligatorio vacío | Confirmar deshabilitado | App y servidor |
| 7 | El ID (UUID del celular) no existe en Conteo_1410 | El servidor responde OK sin duplicar (envío idempotente) | Servidor |

La regla 4 advierte pero no bloquea. Si bloqueara, la conciliación nunca podría mostrar la clasificación `NO_REGISTRADO`.

## Pantallas de la app

Cada pantalla corresponde a un nodo de la Hoja 1 del diagrama. Los archivos de `docs/js/pantallas/` siguen ese orden para que el grupo pueda defender el código en la exposición.

1. **Inicio:** nombre, rol (Operario, Control o Supervisor) y campaña. Muestra si la app está en modo demo o conectada al Sheet.
2. **Ruta:** mapa del rack (bloques A–D y E–G, 4 niveles) con el estado de cada posición: pendiente, contada, vacía o con reconteo pedido. Muestra «x de 28 relevadas» y la cantidad pendiente de envío.
3. **Escanear posición:** cámara trasera y campo manual. Aplica las validaciones 1 y 2.
4. **¿Vacía?:** el botón «Posición vacía» registra cantidad 0 con `Vacia = SI` y salta al resumen.
5. **Escanear producto-lote:** validaciones 3 y 4.
6. **Cantidad:** teclado numérico y validación 5. Conteo ciego: nunca se muestra el teórico.
7. **Resumen y confirmación:** «Editar» vuelve al escaneo del producto; «Confirmar» guarda el registro con UUID, fecha-hora y usuario, y lo envía.
8. **Conciliación** (rol Control o Supervisor): avisa si faltan posiciones por relevar (decisión «¿Se relevaron todas?» de la Hoja 2), dispara la conciliación y muestra la tabla y los indicadores.
9. **Reconteos:** lista de posiciones con reconteo pedido; se capturan con el mismo flujo como `Tipo = RECONTEO`.
10. **Etiquetas:** hoja A4 lista para imprimir.
11. **Ajustes:** URL del Web App y token, o lectura del QR de configuración. También permite volver al modo demo.

## Hitos

Cada hito termina con `npm test` en verde, una prueba a mano descrita y un commit. Los pasos con 👤 los tenés que hacer vos, porque necesitan tu cuenta de GitHub o de Google, o el celular.

### H0 · Repo y publicación
- Claude: `package.json`, `.gitignore`, workflow de tests, servidor local, `README.md` inicial, copia del Excel del caso en `data/` y una `docs/index.html` provisoria. Primer push a `main`.
- 👤 Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch: `main`, carpeta `/docs` → Save.
- Verificación: https://juaniguardiolaa.github.io/ConteoCiclico_PCP/ abre la página.

### H1 · Datos del caso y lógica de dominio (el núcleo de la nota)
- Claude: `scripts/exportar-datos.mjs` lee el Excel y genera `docs/js/datos/caso.js` y `apps-script/Datos.gs`. En `docs/js/dominio/`: `etiquetas.js` (lectura de QR), `validaciones.js` (reglas 1 a 7), `conciliacion.js` (claves, teórico, físico, diferencia y clasificación) e `indicadores.js`.
- Test de aceptación: con Stock 1410 como si fuera el conteo, la conciliación tiene que dar exactamente la tabla de [Resultado esperado](#resultado-esperado).
- Verificación: `npm test` en verde, local y en GitHub Actions.

### H2 · App de captura en modo demo
- Claude: las pantallas 1 a 7, el escáner (html5-qrcode con cámara trasera, QR y Code 128, más ingreso manual), el mapa del rack y `backend/demo.js`. Diseño para celular: botones de 48 px o más, una mano, alto contraste para el depósito.
- 👤 Abrir la URL de Pages en el celular y escanear etiquetas mostradas en la pantalla de la compu.
- Verificación: se cargan las 28 posiciones y el contador llega a 28/28; los cuatro controles de la simulación (POS:Z9, B2 dos veces, cantidad −12, campo vacío) se rechazan.

### H3 · Cola sin conexión
- Claude: `dominio/cola.js`. Si el envío falla, el registro queda en localStorage y se reintenta con espera creciente y al volver la red. Indicador «N pendientes». Como el ID es el UUID del celular, un reintento nunca duplica. Tests con fetch simulado. Service worker que guarda la app y las librerías, para poder recargarla sin red.
- Verificación: en modo avión se cargan 3 posiciones; al volver la red se envían y no queda ninguna duplicada.

### H4 · Etiquetas para imprimir
- Claude: `etiquetas.html` con 28 etiquetas de posición y 22 de producto-lote, con QR de 2,5 cm o más, Code 128 y texto. Agrega el QR de configuración.
- 👤 Imprimir o exportar a PDF y escanear 5 etiquetas al azar.
- Verificación: las 5 se reconocen.

### H5 · Google Sheets y Apps Script
- Claude: `apps-script/Code.gs` con `setupHojas()` (crea las 10 hojas y carga los datos; se puede correr de nuevo sin duplicar), Web App con `doGet` (`ping`, `maestros`, `registrados`, `reconteos`, `conciliacion`) y `doPost` (`registrar`, `conciliar`). Repite las validaciones 1, 2, 3, 5, 6 y 7, usa LockService y token, y anota cada llamada en Log_API. Respuesta siempre `{ok, codigo, mensaje, datos}`. Del lado de la app, `backend/appsscript.js` y la pantalla Ajustes. Incluye la guía paso a paso y los comandos curl de prueba.
- 👤 Con una cuenta **gmail.com** (la institucional puede bloquear el acceso público): crear el Sheet, abrir Extensiones → Apps Script, pegar los archivos, correr `setupHojas()` y autorizar. Implementar → Aplicación web, con «Ejecutar como: Yo» y «Acceso: Cualquier usuario». Cargar la URL en la app.
- Verificación: aparecen 13, 40, 10, 28 y 22 filas. Un registro desde el celular aparece en Conteo_1410 en menos de 3 segundos. El mismo ID repetido no duplica; Z9 se rechaza; una segunda lectura de B2 da duplicado.

### H6 · Conciliación en el Sheet
- Claude: menú «Inventario → Ejecutar conciliación». Normaliza las claves, arma la unión en Conciliacion y escribe **fórmulas** (SUMIFS) para Stock_3009, Ingresos, Salidas, Ajustes, Teórico y Físico, más la fórmula de Clasificación y formato condicional por clase. Hoja Resumen con los indicadores. Desde la app (pantalla 8) se dispara lo mismo con `conciliar`, y antes se controla que las 28 posiciones estén relevadas.
- Verificación: la hoja Conciliacion coincide con la tabla esperada. Al hacer clic en una celda de Teórico se ve la fórmula, no un número pegado. La pantalla de la app muestra los mismos números.

### H7 · Análisis de diferencias y cierre (Hoja 2, fases 4 y 5)
- Claude: columnas Causa y Acción con listas desplegables (Transferencia, Reconteo, Corrección de movimiento, Ajuste) y Aprobado_por. La acción Reconteo aparece en la app (pantalla 9) y, al capturarlo, la fila anterior pasa a `REEMPLAZADO`. Menú «Registrar ajustes aprobados»: agrega a Movimientos filas `Ajuste_Inventario_Ciclico` del 14/10 con Motivo, solo si tienen Aprobado_por. Una transferencia agrega dos filas `Transferencia_Posicion` (sale de una posición y entra en la otra). Menú «Guardar foto de la conciliación»: copia en valores, con fecha y hora, para tener el antes y el después. Menú «Cerrar campaña».
- Verificación: con la transferencia F1 → F2 de PROD003 L0009 y los 9 ajustes aprobados, Movimientos pasa a 51 filas y la nueva conciliación da 0 diferencias fuera de tolerancia.

### H8 · Pulido y documentación
- Claude: revisión como si fuera el docente que corrige (errores sin manejar, textos confusos, pasos de más). README completo: links a la app y al Sheet, cómo reproducir todo desde cero, estructura, tests, cómo copiar el Sheet. Guion de la simulación y checklist de evidencias.
- 👤 Que otra persona del grupo siga el README en otra computadora y llegue a cargar un conteo sin preguntar nada.

Después de la simulación, el informe en Word se arma con el formato UTN FRH de siempre (carátula, títulos, tablas), con las capturas y los resultados reales.

## Resultado esperado

Calculado con el Excel de la cátedra. La app, los tests y el Sheet tienen que dar exactamente esto.

- 24 claves: 13 OK y 11 con diferencia.
- Exactitud por clave: 13/24 = 54,2 %. Por posición: 17/28 = 60,7 %.
- Teórico total 1.594 unidades, físico total 1.569, diferencia neta −25. Sin contar el error de ubicación, que suma cero: 42 unidades faltantes y 17 sobrantes.
- Diferencia neta por material: PROD003 −2, PROD004 −20, PROD006 −2, PROD008 +2, PROD010 −3; el resto 0. PROD001 da 0 neto, pero tiene −10 en B2 y +10 en B3.
- 7 posiciones vacías en el conteo: B1, C1, C2, D2, D4, F1 y G4.

| Posición | Código | Lote | Stock 30/09 | Mov. 01–14/10 | Teórico 14/10 | Físico 14/10 | Diferencia | Clasificación |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | PROD003 | L0003 | 20 | −20 | 0 | 5 | +5 | SOBRANTE |
| A2 | PROD003 | L0010 | 0 | +52 | 52 | 45 | −7 | FALTANTE |
| A3 | PROD010 | L0003 | 0 | +50 | 50 | 50 | 0 | OK |
| A4 | PROD004 | L0064 | 400 | −370 | 30 | 20 | −10 | FALTANTE |
| B2 | PROD001 | L0005 | 300 | −170 | 130 | 120 | −10 | FALTANTE |
| B3 | PROD001 | L0007 | 0 | +480 | 480 | 490 | +10 | SOBRANTE |
| B4 | PROD001 | L0006 | 0 | +100 | 100 | 100 | 0 | OK |
| C3 | PROD002 | L0150 | 0 | +180 | 180 | 180 | 0 | OK |
| C4 | PROD003 | L0009 | 40 | 0 | 40 | 40 | 0 | OK |
| D1 | PROD010 | L0002 | 15 | −5 | 10 | 10 | 0 | OK |
| D3 | PROD008 | L0014 | 24 | 0 | 24 | 24 | 0 | OK |
| E1 | PROD008 | L0018 | 0 | +50 | 50 | 50 | 0 | OK |
| E2 | PROD009 | L0015 | 0 | +105 | 105 | 105 | 0 | OK |
| E3 | PROD007 | L0005 | 0 | +26 | 26 | 26 | 0 | OK |
| E4 | PROD006 | L0120 | 0 | +60 | 60 | 60 | 0 | OK |
| F1 | PROD003 | L0009 | 0 | +20 | 20 | 0 | −20 | UBICACION |
| F2 | PROD003 | L0009 | 0 | 0 | 0 | 20 | +20 | UBICACION |
| F2 | PROD005 | L0100 | 80 | −80 | 0 | 0 | 0 | OK |
| F3 | PROD005 | L0110 | 0 | +30 | 30 | 30 | 0 | OK |
| F4 | PROD006 | L0070 | 0 | +12 | 12 | 10 | −2 | FALTANTE |
| G1 | PROD008 | L0016 | 12 | −12 | 0 | 2 | +2 | SOBRANTE |
| G2 | PROD010 | L0001 | 20 | −15 | 5 | 2 | −3 | FALTANTE |
| G3 | PROD004 | L0074 | 0 | +190 | 190 | 180 | −10 | FALTANTE |
| G4 | PROD002 | L0110 | 100 | −100 | 0 | 0 | 0 | OK |

## Simulación (sábado 24/10)

| Rol | Carril del diagrama | Qué hace |
| --- | --- | --- |
| Jefe de Almacén | Supervisor | Aprueba el plan, los ajustes y el cierre |
| Analista de Control | Control de Inventarios | Configura la campaña, concilia, pide reconteos y analiza causas |
| Operarios 1 y 2 | Operario de conteo | Uno recorre los bloques A–D y el otro E–G |
| Evidencias | Fuera del diagrama | Filma y saca capturas numeradas con el paso del diagrama |

Guion:

1. **Montaje.** Rack de cartulina con los dos bloques y las etiquetas de posición. En cada posición ocupada va la etiqueta del producto-lote y una tarjeta con la cantidad de Stock 1410. El operario cuenta con la tarjeta y nunca ve el teórico.
2. **Planificación.** Campaña `CC-2026-10-14` y aprobación del Jefe de Almacén.
3. **Conteo.** Las 28 posiciones, 7 vacías. En vivo se muestran los controles: POS:Z9 rechazada, B2 escaneada dos veces, cantidad −12 rechazada y 3 lecturas en modo avión que se envían después.
4. **Conciliación.** Desde la app; la hoja muestra las 11 diferencias.
5. **Análisis.** Transferencia F1 → F2. Reconteo de B3, que confirma 490. Ajustes propuestos y aprobados para el resto.
   - Sugerencia para mostrar la rama «el reconteo no confirma» del diagrama: en el primer conteo, el operario carga 18 en G3 a propósito. La conciliación da −172, el reconteo da 180 y reemplaza al anterior, y G3 vuelve a −10 como en el caso.
6. **Cierre.** Foto de la conciliación final sin diferencias, Resumen, cierre de campaña.

## Cronograma

| Fecha | Qué | Quién |
| --- | --- | --- |
| Mié 14/10 | Plan aprobado, repo creado, H0 y H1 | Claude, 👤 Pages |
| Jue 15 – Vie 16/10 | H2, H3 y H4: app en modo demo publicada y probada en el celular | Claude, 👤 prueba en el celular |
| Sáb 17 – Lun 19/10 | H5 y H6: Sheet, Web App y conciliación con fórmulas | 👤 Sheet y despliegue, Claude el código |
| Mar 20/10 | H7: análisis y cierre | Claude |
| **Mié 21/10** | **Punto de control:** circuito completo en el celular contra el Sheet | Grupo |
| Jue 22 – Vie 23/10 | H8, impresión de etiquetas, rack de cartulina, ensayo | Grupo, Claude README |
| **Sáb 24/10** | **Simulación presencial y evidencias** | Grupo |
| Dom 25 – Lun 26/10 | Informe Word y video de 3 a 5 minutos | Grupo, Claude informe |
| **Mar 27/10 23:59** | **Entrega en Teams** | Grupo |
| 28/10 o 04/11 | Exposición | Grupo |

Si el 21/10 la cámara todavía falla en algún celular, queda el ingreso manual (que ya cumple el resto de los criterios) y el tiempo restante se usa en la conciliación y el informe.

## Riesgos

| Riesgo | Cómo se nota | Qué hacer |
| --- | --- | --- |
| La cuenta institucional bloquea el acceso «Cualquier usuario» | La app recibe una página de login de Google en vez de JSON | Usar una cuenta gmail.com y compartir el Sheet con la cátedra |
| Los cambios del Apps Script no se reflejan | Sigue el comportamiento viejo | Gestionar implementaciones → Editar → Nueva versión (mantiene la URL) |
| Error de CORS | «blocked by CORS policy» en la consola | POST con `Content-Type: text/plain` y sin encabezados propios |
| La cámara no abre | Pantalla negra o permiso denegado | Solo funciona con HTTPS (Pages) o localhost; revisar permisos; queda el ingreso manual |
| Etiquetas que no se leen | Lectura lenta o fallida | QR de 2,5 cm o más, sin escalar, con buena luz |
| Dos operarios escriben a la vez | Filas duplicadas o pisadas | LockService e ID único por registro |
| El celular muestra una versión vieja de la app | No aparecen los últimos cambios | El service worker se actualiza solo al recargar dos veces; la versión se ve en Ajustes |
| El CDN no responde | El escáner no carga | El service worker guarda las librerías después de la primera carga; queda el ingreso manual |
| El grupo no puede explicar el código | Preguntas sin respuesta en la exposición | Al cerrar cada hito, un resumen corto de qué hace cada archivo; un hito por integrante para estudiar |

## Decisiones

Tomadas el 14/10:

- Stack HTML + JavaScript sin build.
- Repo público `ConteoCiclico_PCP`.
- Se sube el Excel del caso a `data/`.

Pendientes:

1. **Cuenta de Google:** cuál gmail del grupo va a ser dueña del Sheet y del Web App (hace falta para H5).
2. **Exactitud principal:** por clave (54,2 %) o por posición (60,7 %). El informe tiene que dejar escrita la definición elegida.
3. **Rúbrica:** el criterio 6 vale 2,0 pero su escala llega a 1,0, y la fórmula habla de 7 criterios cuando hay 6. Conviene consultarlo en clase.
