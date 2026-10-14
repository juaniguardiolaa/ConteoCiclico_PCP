# Conteo cíclico y conciliación de inventarios · TP6

Planificación y Control de la Producción · UTN FRH · 2026

App web para el celular que simula el conteo cíclico del 14/10/2026: lee QR o código de barras de cada posición y de cada producto-lote, valida los datos, los envía a Google Sheets y ejecuta la conciliación contra el stock del 30/09/2026 y los movimientos del 01 al 14/10/2026.

- **App:** https://juaniguardiolaa.github.io/ConteoCiclico_PCP/
- **Plan de desarrollo:** [PLAN.md](PLAN.md)

> En desarrollo. El estado de cada hito está en el plan.

## Cómo correrla en la compu

Hace falta [Node.js](https://nodejs.org/) 20 o superior. No hay que instalar dependencias.

```bash
npm run dev     # abre la app en http://localhost:8080
npm test        # corre los tests de la lógica de dominio
```

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| `docs/` | La app. Es lo que publica GitHub Pages. |
| `docs/js/dominio/` | Lógica pura: lectura de etiquetas, validaciones, conciliación, indicadores. |
| `apps-script/` | Código del Web App de Google Apps Script que vive en el Sheet. |
| `data/` | Excel del caso entregado por la cátedra, sin modificar. |
| `scripts/` | Exportación de datos del Excel y servidor local. |
| `tests/` | Tests con `node --test`. |
