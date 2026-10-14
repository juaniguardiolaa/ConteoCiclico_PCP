# TP6 · Conteo cíclico y conciliación de inventarios (UTN FRH · PCP 2026)

## Qué es
App web para el celular que simula el conteo cíclico del 14/10/2026 de un almacén con
28 posiciones (A1–G4) y 10 materiales (PROD001–PROD010). Lee QR o Code 128, valida,
envía cada registro a Google Sheets y dispara la conciliación contra el stock del
30/09/2026 y los movimientos del 01 al 14/10/2026. Plan completo y resultado esperado en PLAN.md.

## Stack (no cambiar sin preguntar)
- Front: HTML + CSS + JavaScript con módulos ES, sin framework ni build, en `docs/`.
  GitHub Pages publica `docs/` de la rama `main` (Deploy from a branch).
- Librerías por CDN jsDelivr con versión fija: html5-qrcode@2.3.8, qrcode-generator@1.4.4,
  jsbarcode@3.11.6. Nada de npm en el navegador.
- Tests: `node --test` sobre `docs/js/dominio` (funciones puras, sin DOM). Sin dependencias.
- `npm run dev` levanta `scripts/servidor.mjs` (servidor estático sin dependencias).
- `exceljs` es la única dependencia (dev): solo para `npm run datos`.
- Backend: Google Apps Script vinculado al Sheet, publicado como Web App (doGet/doPost).
  POST con Content-Type text/plain (evita el preflight de CORS). Respuesta siempre
  `{ok, codigo, mensaje, datos}`.
- `docs/js/backend/appsscript.js` y `docs/js/backend/demo.js` exponen las mismas funciones;
  las pantallas no dependen de cuál está activa.
- Servidor: `apps-script/Code.gs` (a mano) + `Datos.gs` y `Dominio.gs` (generados). `npm run apps-script`
  arma `apps-script/conteo-ciclico.gs`, el único archivo que se pega en Apps Script. Dominio.gs es
  docs/js/dominio sin import/export: los módulos de dominio no pueden repetir nombres de nivel superior.
- El servidor se prueba con `tests/simulador-google.js` (SpreadsheetApp, Utilities, LockService y
  ContentService simulados; las fórmulas se calculan con `tests/formulas-simuladas.js`). Si Code.gs
  usa un método o una función de hoja nueva, hay que sumarlos al simulador.
- Configuración regional: la planilla va en en_US (CONFIGURACION_REGIONAL en Code.gs). Google
  interpreta las fórmulas que escribe el script (setFormula o setValues) con la configuración de la
  planilla; en es_AR espera «;» y las fórmulas con «,» quedan en #ERROR! (pasó con la 0.6.0 y la 0.6.1).
  setupHojas y la conciliación la pasan a en_US. El simulador arranca en es_AR y reproduce el error.
- Fórmulas con setFormula/setFormulas y valores con setValues, por claridad.
- Cada archivo nuevo de `docs/` va en la lista ARCHIVOS de `docs/sw.js` (lo controla un test).

## Reglas del negocio
- Una posición guarda un solo producto y un solo lote.
- Clave: Codigo|Lote|Posicion. Universo = Stock_3009 ∪ Movimientos ∪ Conteo VALIDO.
  Filas de Stock_3009 sin lote ni posición y con stock 0 no generan clave.
- Teórico 14/10 = Stock_3009 + Σ Movimientos con fecha 01/10..14/10/2026 (ya traen signo).
- Físico 14/10 = Σ Conteo_1410 con Estado = VALIDO y Campania = CC-2026-10-14.
- Diferencia = Físico − Teórico.
- Clasificación en orden: OK (|dif| ≤ tolerancia) · NO_REGISTRADO (par material-lote
  fuera de Maestro_Lotes) · UBICACION (el mismo Codigo|Lote suma dentro de tolerancia
  entre posiciones) · FALTANTE / SOBRANTE.
- Tolerancia por material en Maestro_Materiales; por defecto 0.
- Un reconteo marca la fila anterior como REEMPLAZADO; nunca se borran filas.
- Tipos de movimiento: los 6 del caso más Transferencia_Posicion.

## Etiquetas
- Posición: `POS:B2`. Producto-lote: `MAT:PROD001|L0005`. Configuración: `CFG:{"url":…,"token":…}`.
- `dominio/etiquetas.js` reconoce el formato en sentido amplio; si la posición, el material
  o el lote son válidos lo decide `dominio/validaciones.js` contra los maestros.

## Validaciones (app y servidor)
1 posición existe · 2 posición no registrada en la campaña (salvo RECONTEO) ·
3 material existe y lote con formato L#### · 4 par material-lote conocido (solo advertencia) ·
5 cantidad entera 0..9999 · 6 sin campos vacíos · 7 ID único (UUID del celular, envío idempotente).

## Hojas del Sheet
Parametros, Maestro_Materiales, Maestro_Posiciones, Maestro_Lotes, Stock_3009,
Movimientos, Conteo_1410, Conciliacion, Resumen, Log_API. Columnas en PLAN.md.

## Convenciones
- Interfaz y mensajes en español rioplatense. Código e identificadores en español sin tildes.
- Botones de 48 px o más; se usa con una mano en el depósito. Conteo ciego: la app de
  captura nunca muestra el stock teórico.
- La conciliación del Sheet se escribe con fórmulas (SUMIFS), no con valores pegados:
  la cátedra tiene que poder verificarla.
- La lógica de negocio va en `docs/js/dominio/` como funciones puras con tests; las
  pantallas solo muestran y llaman.
- Datos del caso: solo el Excel de /data, exportado con `scripts/exportar-datos.mjs`.
  No inventar datos. Stock 1410 no se carga en el Sheet; solo se usa en tests y en el modo demo.
- Nunca commitear la URL del Web App ni el token: se cargan en la pantalla Ajustes.
- Antes de cerrar un hito: `npm test` en verde y la lista de cómo probarlo a mano.

## Prueba de aceptación
La tabla "Resultado esperado" de PLAN.md: 24 claves, 13 OK, 11 con diferencia, neto −25.
