# Teppan — pedidos por WhatsApp

Webapp para pedir en **Teppan — american sushi & street food** (Villa María). El cliente arma el pedido desde el celular, completa sus datos y se abre WhatsApp con el mensaje listo para mandar al local. No hay backend ni pagos online.

Es un sitio estático (HTML + CSS + JavaScript, sin frameworks ni build). `server.js` es un servidor mínimo en Node, sin dependencias.

## Correrlo en local

Necesitás [Node.js](https://nodejs.org) 18 o más nuevo.

```bash
npm start
```

Abrí <http://localhost:3000>. Para probar en el celular dentro de la misma red wifi, entrá a `http://IP-DE-TU-PC:3000`. Ojo: "Usar mi ubicación" solo funciona en `localhost` o con `https`.

> No abras `index.html` con doble clic: el navegador no deja leer `menu.json` desde un archivo local. Tiene que ser con el servidor.

Tests de la lógica (horarios, precios, validaciones y mensaje):

```bash
npm test                     # corre los tests
node tests/test.js --mensajes  # además imprime 5 mensajes de ejemplo
```

## Qué archivo tocar para cada cosa

| Quiero cambiar…                                    | Archivo       |
|----------------------------------------------------|---------------|
| Precios, productos, descripciones, fotos, pausar  | `menu.json`   |
| WhatsApp, horarios, envío, medios de pago, alergias| `config.js`   |
| Colores y tipografía                               | `css/styles.css` (bloque `:root` del principio) |

Después de guardar, recargá la página. No hace falta reiniciar nada.

La intro (el logo en aerosol, "¿Viniste a mirar o a comer?") sale cada vez que se carga o se recarga la página. Los textos están en `index.html`; la animación, en `js/aerosol.js`.

### Productos (`menu.json`)

Cada producto tiene esta forma:

```json
{ "id": "classic", "categoria": "rolls", "nombre": "Classic",
  "descripcion": "Roll de arroz sushi con salmón…", "precio": 18000, "disponible": true }
```

- **Cambiar un precio:** editá `precio`. Va en pesos, sin puntos ni signo `$` (`18000`, no `"$18.000"`).
- **Pausar un producto** (por ejemplo, porque no hay stock): poné `"disponible": false`. Se sigue viendo en la carta como "No disponible", pero no se puede pedir. Para volver a ofrecerlo, ponelo en `true`.
- **Agregar un producto:** copiá uno de la misma categoría y cambiale el `id`. El `id` tiene que ser único, en minúsculas y sin espacios.
- **Foto:** agregá `"imagen": "img/classic.jpg"` y poné la foto en la carpeta `img/`. Conviene usar formato horizontal (16:9). Las tarjetas sin foto se ven bien igual.
- **Nombre en el mensaje:** `nombrePedido` es opcional y sirve si el nombre de la carta no alcanza solo. Por ejemplo, la ensalada "Teppan" sale en el mensaje como "Ensalada Teppan".
- **Combinados:** cada tamaño es una `variante` con sus `piezas`, su `precio` y su `disponible`. Así se puede pausar un solo tamaño.
- **Armar combinados:** los combinados con `"armable": true` piden elegir qué sushis van (hoy son los 4). Si le sacás `armable` a uno, solo se elige el tamaño y lo arma el sushiman.
- **Sushis para combinados:** están en la lista `variedadesCombinado`, al principio de `menu.json` (sashimis, niguiris, temakis, makis, hot rolls). Cada uno tiene `tipo` (el grupo en el que aparece), `nombre`, `descripcion` y `disponible`. Además, se pueden elegir todos los rolls de la carta. Si pausás un sushi o un roll, desaparece del constructor.
- **Lista propia por combinado:** agregale `"variedades": [...]` con los `id` permitidos. Por ejemplo, para el Combinado Veggie: `"variedades": ["amapola", "robles", "veggie"]`. Ojo: con el máximo de 10 por variedad, 3 variedades suman 30 piezas como mucho, así que el tamaño de 45 no se podría armar.
- **Ensaladas:** llevan `"admiteAgregados": true`, y los agregados salen de la categoría `agregados`.

Cuidado con las comas: si el JSON queda mal escrito, la carta no carga. Ante la duda, pegalo en <https://jsonlint.com> para revisarlo.

### Configuración (`config.js`)

- `whatsapp`: el número que recibe los pedidos, solo dígitos y con el `549` adelante.
- `horarios`: un bloque por día. `null` significa cerrado. El cierre no puede pasar la medianoche.
- Con el local abierto, los pedidos van por orden de llegada (no se elige horario). Con el local cerrado, el cliente elige un horario estimado para cuando abra.
- `intervaloMinutos` y `anticipacionMinutos`: cada cuánto arrancan los rangos horarios (cada 15 minutos, como mínimo 30 minutos desde ahora). El último arranca 15 minutos antes del cierre.
- `rangoHorarioMinutos`: el ancho del rango que se muestra (con 30 sale, por ejemplo, "21:30 a 22:00").
- `costoEnvio`: con `null`, aparece "Envío: a confirmar" y el total no lo incluye. Con un número (por ejemplo `2500`), se suma al total.
- `zonaCobertura`: texto opcional que se muestra cuando el cliente elige envío.
- `metodosPago`: la lista de opciones. Si está `"Efectivo"`, se pide el monto y se calcula el vuelto.
- `aliasTransferencia`: si tiene valor, se muestra cuando el cliente elige "Transferencia".
- `combinadoEleccion`: el paso del stepper (`paso`, 5) y el mínimo y máximo por variedad (5 y 10).
- `permitirAgregadosSueltos`: con `true`, los agregados se pueden pedir sin ensalada.

## Deploy

### Railway

1. Subí la carpeta a un repo de GitHub.
2. En Railway: **New Project → Deploy from GitHub repo** y elegí el repo.
3. Railway detecta Node y corre `npm start`. El servidor toma el puerto de la variable `PORT`.
4. En **Settings → Networking**, tocá **Generate Domain** para tener la URL pública.

Cada `git push` vuelve a deployar. Para cambiar un precio, editás `menu.json` (se puede hacer desde la web de GitHub) y hacés commit.

### GitHub Pages

También funciona sin servidor propio: **Settings → Pages → Deploy from a branch** (`main`, carpeta `/`). `server.js` se ignora.

### Imagen para compartir

`index.html` usa `img/og-image.png` como vista previa de los links. Algunas apps (WhatsApp, Facebook) piden la URL completa: cuando tengas el dominio final, cambiá en `index.html` `content="img/og-image.png"` por `content="https://TU-DOMINIO/img/og-image.png"`.

## Estructura

```
index.html        página
config.js         datos del local (editable)
menu.json         carta (editable)
css/styles.css    estilos
js/core.js        lógica pura: horarios, precios, validaciones, mensaje
js/app.js         interfaz: carta, carrito, checkout
js/aerosol.js     animación del logo en aerosol (WebGL, provista por Teppan)
js/intro.js       intro: animación + "¿Viniste a mirar o a comer?"
img/              logo (fondo transparente), favicon, íconos, imagen para compartir
server.js         servidor estático para local y Railway
tests/test.js     tests de js/core.js
```

## Pendiente de confirmar con Teppan

Están marcados como `TODO` en `config.js`:

- [x] Que el +54 9 3534 083326 sea el WhatsApp que recibe los pedidos (confirmado).
- [ ] Costo de envío (fijo, por zona o a confirmar) y zona de cobertura.
- [ ] Medios de pago aceptados y alias/CBU para transferencia.
- [ ] Cuántas piezas trae cada roll individual (la carta no lo dice).
- [ ] Si se pueden pedir agregados sueltos.
- [ ] Precios del Combinado Teppan (20 pzs $37.000 vs 30 pzs $41.000) y del Combinado Street (30 pzs $44.000 vs 45 pzs $54.000): revisar que no sea un error de carga.
