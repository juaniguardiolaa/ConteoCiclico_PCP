# Instalar la planilla y el Web App

Se hace una sola vez, con la cuenta de Google que va a ser dueña de la planilla (una cuenta gmail.com: la institucional puede bloquear el acceso público del Web App). Lleva unos 10 minutos.

## 1. Crear la planilla y pegar el código

1. Entrar a [sheets.new](https://sheets.new) con la cuenta del grupo y ponerle de nombre **TP6 Conteo cíclico**.
2. Menú **Extensiones → Apps Script**. Se abre el editor en otra pestaña.
3. Arriba a la izquierda, cambiar «Proyecto sin título» por **TP6 Conteo cíclico**.
4. En el archivo `Código.gs`, borrar todo lo que hay y pegar el contenido completo de [`conteo-ciclico.gs`](https://raw.githubusercontent.com/juaniguardiolaa/ConteoCiclico_PCP/main/apps-script/conteo-ciclico.gs) (abrir el link, Ctrl+A, Ctrl+C).
5. Guardar con **Ctrl+S**.

## 2. Crear las hojas

1. En la barra del editor, en el selector de funciones, elegir **setupHojas** y tocar **Ejecutar**.
2. La primera vez Google pide permisos: **Revisar permisos** → elegir la cuenta → aparece «Google no verificó esta app» → **Configuración avanzada** → **Ir a TP6 Conteo cíclico (no seguro)** → **Permitir**. Es el aviso normal para un script propio; los permisos son para editar esta planilla.
3. En el registro de ejecución tiene que aparecer: `Listo. Stock_3009: 13 filas, Movimientos: 40, materiales: 10, posiciones: 28.`
4. Volver a la planilla y recargarla: aparecen las 10 hojas y el menú **Inventario**. En la hoja **Parametros** está el **TOKEN**.

## 3. Publicar el Web App

1. En el editor: **Implementar → Nueva implementación**.
2. En el engranaje de «Seleccionar tipo», elegir **Aplicación web**.
3. Descripción: `v1`. **Ejecutar como: Yo**. **Quién tiene acceso: Cualquier usuario**.
4. **Implementar**, y copiar la **URL de la aplicación web** (termina en `/exec`).
5. Pegar esa URL en una pestaña del navegador. Tiene que mostrar algo como:

   ```json
   {"ok":true,"codigo":"PONG","mensaje":"El Web App responde.","datos":{"version":"0.5.1","hojasListas":true,...}}
   ```

   - Si dice `"hojasListas":false`, falta el paso 2: ejecutar **setupHojas**.
   - Si aparece una página de inicio de sesión de Google, el acceso no quedó en «Cualquier usuario».

## 4. Conectar la app

En el celular (o en la compu): **Ajustes → Conexión**, pegar la URL y el token, y tocar **Probar y conectar con la planilla**. Si dice «Conectado», la app se reinicia ya conectada.

Para los demás celulares: desde un celular conectado con rol Control, **Ajustes → Mostrar QR de configuración**, y en cada celular **Ajustes → Escanear QR de configuración**.

## Cuando cambia el código

Cada vez que en el repo cambia `apps-script/conteo-ciclico.gs`:

1. Pegarlo de nuevo entero en `Código.gs` y guardar.
2. **Implementar → Gestionar implementaciones** → el lápiz de la implementación activa → **Versión: Nueva versión** → **Implementar**.

Así la URL no cambia y no hay que reconfigurar los celulares. Si en vez de eso se hace una «Nueva implementación», sale otra URL.

## Si algo no anda

| Lo que aparece | Qué pasa | Qué hacer |
| --- | --- | --- |
| `"hojasListas":false` o «Falta la hoja Parametros» | No se ejecutó `setupHojas` | Paso 2. Si al ejecutarlo da error, mirar el registro de ejecución del editor |
| «El script no está vinculado a una planilla» | El proyecto se creó desde script.google.com | Crearlo desde la planilla: **Extensiones → Apps Script** |
| Página de inicio de sesión de Google en vez de JSON | La implementación no tiene acceso público | Gestionar implementaciones → lápiz → **Quién tiene acceso: Cualquier usuario** |
| Cambios del código que no se ven | La implementación sigue en la versión vieja | Gestionar implementaciones → lápiz → **Versión: Nueva versión** |
| `TOKEN_INVALIDO` en la app | El token no coincide con el de Parametros | Copiarlo de nuevo (menú **Inventario → Ver token para la app**) |

## Probar el Web App con curl

Reemplazar `URL` y `TOKEN`:

```bash
curl -L "URL?accion=ping"
```

```bash
curl -L -H "Content-Type: text/plain" -d '{"accion":"maestros","token":"TOKEN"}' "URL"
```

```bash
curl -L -H "Content-Type: text/plain" -d '{"accion":"registrar","token":"TOKEN","registro":{"id":"prueba-1","usuario":"curl","campania":"CC-2026-10-14","tipo":"CONTEO","posicion":"Z9","codigo":"PROD001","lote":"L0005","cantidad":5}}' "URL"
```

El último tiene que responder `POSICION_INEXISTENTE`, y la llamada queda anotada en **Log_API**.

## Menú Inventario

| Opción | Qué hace |
| --- | --- |
| Configurar hojas del caso | Lo mismo que `setupHojas`. Se puede repetir: no duplica datos ni cambia el token. |
| Ver token para la app | Muestra el token de la hoja Parametros. |
| Reiniciar la simulación | Borra conteos, conciliación, resumen y log, y deja Movimientos con los 40 del caso. Sirve para ensayar antes del 24/10. Pide confirmación. |

## Compartir

- Con la cátedra: **Compartir** → agregar el mail con permiso de **Lector**.
- Con el grupo: permiso de **Editor**. Quien quiera su propia copia para probar: **Archivo → Hacer una copia** (copia también el script) y repetir el paso 3 para tener su propia URL.
