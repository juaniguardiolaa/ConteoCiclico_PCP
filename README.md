# Conteo cíclico y conciliación de inventarios · TP6

Planificación y Control de la Producción · UTN FRH · 2026

App web para el celular que simula el conteo cíclico del 14/10/2026: lee QR o código de barras de cada posición y de cada producto-lote, valida los datos, los envía a Google Sheets y ejecuta la conciliación contra el stock del 30/09/2026 y los movimientos del 01 al 14/10/2026.

- **App:** https://juaniguardiolaa.github.io/ConteoCiclico_PCP/
- **Etiquetas para imprimir:** https://juaniguardiolaa.github.io/ConteoCiclico_PCP/etiquetas.html
- **Plan de desarrollo:** [PLAN.md](PLAN.md)

> En desarrollo. El estado de cada hito está en el plan.

## Probarla sin planilla (modo demo)

1. Abrir la app, escribir un nombre y elegir el rol. Con **Control de inventarios** se ve también la pestaña Conciliar.
2. **Escanear posición**: con la cámara o escribiendo la posición (`B2`). Después el producto (`PROD001 L0005`) y la cantidad.
3. Para ver la conciliación completa sin recorrer el rack: **Ajustes → Cargar el conteo del enunciado** y después **Conciliar**.

Los registros quedan guardados en el navegador de cada uno. **Ajustes → Borrar los datos de demo** empieza de cero.

Para probar la cámara sin imprimir: abrir la página de etiquetas en la compu y escanearlas desde el celular con la app. Con la opción «Etiquetas de prueba de los controles» aparecen también las que la app tiene que rechazar.

Sin conexión: con el celular en modo avión (o con **Ajustes → Simular que no hay conexión**), lo que se confirma queda guardado en el celular, el mapa lo marca con un punto naranja y se envía solo cuando vuelve la red. La app se puede abrir y recargar sin red después de la primera visita.

Controles que se pueden probar: `Z9` (posición inexistente), `B2` dos veces (duplicado), `PROD001 L005` (lote mal formado), `PROD001 L0099` (lote desconocido, solo advierte), cantidad `-12` o `1,5` (rechazadas).

## Cómo correrla en la compu

Hace falta [Node.js](https://nodejs.org/) 20 o superior. No hay que instalar dependencias.

```bash
npm run dev     # abre la app en http://localhost:8080
npm test        # corre los tests de la lógica de dominio
```

Si cambia el Excel de `data/`, `npm install` y después `npm run datos` regeneran `docs/js/datos/caso.js` y `apps-script/Datos.gs`. Es el único caso en que hace falta instalar algo.

## Resultado de la conciliación con los datos del caso

24 claves (código, lote y posición): 13 coinciden y 11 tienen diferencia, con una diferencia neta de −25 unidades. La tabla completa y las definiciones están en [PLAN.md](PLAN.md#resultado-esperado), y el test `tests/conciliacion.test.js` la verifica en cada push.

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| `docs/` | La app. Es lo que publica GitHub Pages. |
| `docs/js/dominio/` | Lógica pura: lectura de etiquetas, validaciones, conciliación, indicadores. |
| `apps-script/` | Código del Web App de Google Apps Script que vive en el Sheet. |
| `data/` | Excel del caso entregado por la cátedra, sin modificar. |
| `scripts/` | Exportación de datos del Excel y servidor local. |
| `tests/` | Tests con `node --test`. |
