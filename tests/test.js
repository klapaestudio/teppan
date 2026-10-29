// Tests de la lógica (js/core.js) con la config y la carta reales. Correr con: npm test
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const T = require("../js/core.js");

const raiz = path.join(__dirname, "..");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(raiz, "config.js"), "utf8"), sandbox);
const C = sandbox.window.TEPPAN_CONFIG;
const menu = JSON.parse(fs.readFileSync(path.join(raiz, "menu.json"), "utf8"));
const idx = T.indexarMenu(menu);

let ok = 0;
function test(nombre, fn) {
  try { fn(); ok++; console.log("  ✓ " + nombre); }
  catch (e) { console.log("  ✗ " + nombre + "\n    " + e.message); process.exitCode = 1; }
}
// Hora de Argentina (UTC-3) → Date
const ar = (iso) => new Date(iso + "-03:00");
const en = (iso) => T.ahoraEnZona(C.zonaHoraria, ar(iso));

console.log("\nCarta");
test("36 ítems (contando cada tamaño de combinado)", () => {
  const n = menu.productos.reduce((a, p) => a + (p.variantes ? p.variantes.length : 1), 0);
  assert.strictEqual(n, 36);
  assert.strictEqual(menu.categorias.length, 7);
});
test("formato de precio", () => {
  assert.strictEqual(T.formatPrecio(16000), "$16.000");
  assert.strictEqual(T.formatPrecio(108500), "$108.500");
  assert.strictEqual(T.formatPrecio(500), "$500");
});

console.log("\nHorarios (America/Argentina/Cordoba)");
test("miércoles 20:00 → abierto", () => assert.strictEqual(T.estadoLocal(C, en("2026-10-21T20:00")).tipo, "abierto"));
test("miércoles 17:00 → abre hoy 19:00", () => assert.strictEqual(T.estadoLocal(C, en("2026-10-21T17:00")).texto, "Abre hoy a las 19:00"));
test("miércoles 23:10 → cerrado, abre mañana", () => assert.strictEqual(T.estadoLocal(C, en("2026-10-21T23:10")).texto, "Cerrado · abre mañana a las 19:00"));
test("lunes → hoy cerrado, abre mañana", () => assert.strictEqual(T.estadoLocal(C, en("2026-10-26T20:00")).texto, "Hoy cerrado · abre mañana a las 19:00"));
test("domingo 23:30 → abre el martes", () => assert.strictEqual(T.estadoLocal(C, en("2026-10-25T23:30")).texto, "Cerrado · abre el martes a las 19:00"));
test("franjas de hoy: sin horarios pasados y con anticipación", () => {
  const dias = T.turnosDisponibles(C, en("2026-10-21T21:05"));
  assert.strictEqual(dias[0].offset, 0);
  assert.strictEqual(dias[0].franjas[0].hora, "21:45"); // 21:05 + 30 min → 21:45
  assert.strictEqual(dias[0].franjas.at(-1).hora, "22:45");
  assert.strictEqual(dias[1].etiqueta, "Mañana · jueves 22/10");
});
test("lunes: solo ofrece el martes, de 19:00 a 22:45", () => {
  const dias = T.turnosDisponibles(C, en("2026-10-26T12:00"));
  assert.strictEqual(dias.length, 1);
  assert.strictEqual(dias[0].franjas.length, 16);
  assert.strictEqual(T.textoTurno(dias[0].franjas[5]), "Martes 27/10 20:15 a 20:45");
});
test("domingo 23:30: el próximo es el martes (salta el lunes)", () => {
  const dias = T.turnosDisponibles(C, en("2026-10-25T23:30"));
  assert.strictEqual(dias.length, 1);
  assert.strictEqual(dias[0].etiqueta, "Martes 27/10");
});

console.log("\nTeléfono");
for (const [entrada, esperado] of [
  ["353 4123456", "353 4123456"], ["+54 9 353 412-3456", "353 4123456"], ["0353 15 4123456", "353 4123456"],
  ["5493534123456", "353 4123456"], ["11 1234 5678", "11 12345678"], ["4123456", null], ["abc", null]
]) test(JSON.stringify(entrada) + " → " + esperado, () => assert.strictEqual(T.normalizarTelefono(entrada), esperado));

console.log("\nCombinado a elección");
const r = C.combinadoEleccion;
test("suma exacta y entre 5 y 10 por variedad → ok", () => assert.ok(T.validarCombo(C, idx, { classic: 10, passion: 10, crunch: 5, veggie: 5 }, 30).ok));
test("suma menor → error", () => assert.ok(!T.validarCombo(C, idx, { classic: 10 }, 15).ok));
test("más de 10 de una variedad → error", () => assert.ok(!T.validarCombo(C, idx, { classic: 15 }, 15).ok));
test("variedad que no es roll → error", () => assert.ok(!T.validarCombo(C, idx, { "quesadillas-pollo": 5, classic: 10 }, 15).ok));
test("sushis de variedadesCombinado + rolls de la carta (13 + 7)", () => {
  const vs = T.variedadesCombo(C, idx, idx.productos["combinado-teppan"]);
  assert.strictEqual(vs.length, 20);
  assert.deepStrictEqual([...new Set(vs.map((v) => v.tipo))], ["Sashimis", "Niguiris", "Temakis", "Makis", "Hot rolls", "Rolls"]);
});
test("los 4 combinados se arman y exigen selección", () => {
  for (const id of ["combinado-teppan", "combinado-eleccion", "combinado-street", "combinado-veggie"]) {
    assert.ok(idx.productos[id].armable, id);
    assert.ok(!T.resolverItem(C, idx, { productoId: id, varianteId: id + "-15", cantidad: 1 }).valido, id + " sin selección");
  }
});
test("mezcla de niguiris, temakis y rolls → ok", () =>
  assert.ok(T.validarCombo(C, idx, { "niguiri-salmon": 5, "temaki-langostino": 5, classic: 5 }, 15, idx.productos["combinado-street"]).ok));
test("variedad pausada → error", () => {
  const m2 = JSON.parse(JSON.stringify(menu));
  m2.variedadesCombinado.find((v) => v.id === "niguiri-teppan").disponible = false;
  assert.ok(!T.validarCombo(C, T.indexarMenu(m2), { "niguiri-teppan": 10, classic: 5 }, 15).ok);
});
test("lista propia por combinado (\"variedades\")", () => {
  const veggie = { ...idx.productos["combinado-veggie"], variedades: ["amapola", "robles", "veggie"] };
  assert.strictEqual(T.variedadesCombo(C, idx, veggie).length, 3);
  assert.ok(!T.validarCombo(C, idx, { "sashimi-salmon": 5, veggie: 10 }, 15, veggie).ok);
  assert.ok(T.validarCombo(C, idx, { amapola: 5, veggie: 10 }, 15, veggie).ok);
});
test("paso configurable", () => assert.deepStrictEqual([r.paso, r.minPorVariedad, r.maxPorVariedad], [5, 5, 10]));

console.log("\nPrecios");
test("ensalada + agregados", () => {
  const l = T.resolverItem(C, idx, { productoId: "ensalada-teppan", cantidad: 2, agregados: ["agregado-langostinos", "agregado-pollo"] });
  assert.strictEqual(l.nombre, "Ensalada Teppan + Langostinos + Pollo");
  assert.strictEqual(l.total, 24000);
});
test("agregado suelto no se puede pedir (flag en false)", () => assert.ok(!T.resolverItem(C, idx, { productoId: "agregado-pollo", cantidad: 1 }).valido));
test("producto pausado no se puede pedir", () => {
  const m2 = JSON.parse(JSON.stringify(menu));
  m2.productos.find((p) => p.id === "classic").disponible = false;
  assert.ok(!T.resolverItem(C, T.indexarMenu(m2), { productoId: "classic", cantidad: 1 }).valido);
});
test("envío con costo configurado se suma al total", () => {
  const ls = [T.resolverItem(C, idx, { productoId: "classic", cantidad: 1 })];
  const t = T.calcularTotales({ ...C, costoEnvio: 2500 }, ls, "envio");
  assert.strictEqual(t.total, 20500);
  assert.ok(!t.envioAConfirmar);
});

// ---------- Mensajes de ejemplo ----------
function pedido(items, extra) {
  const lineas = items.map((it) => {
    const l = T.resolverItem(C, idx, it);
    assert.ok(l.valido, "ítem inválido: " + JSON.stringify(it) + " → " + l.motivo);
    return l;
  });
  return Object.assign({
    cliente: { nombre: "Juan Pérez", telefono: T.normalizarTelefono("353 4123456") },
    modalidad: "retiro", direccion: {}, cuando: { tipo: "asap" }, lineas,
    totales: T.calcularTotales(C, lineas, extra.modalidad || "retiro"), comentarios: ""
  }, extra);
}
const turno = (iso, valor) => T.buscarTurno(C, en(iso), valor);

const ejemplos = {
  "1) Envío + efectivo con vuelto (ejemplo del brief)": pedido([
    { productoId: "combinado-teppan", varianteId: "combinado-teppan-30", cantidad: 1, seleccion: { "niguiri-teppan": 10, "sashimi-salmon": 10, "hot-pink-boom": 5, "maki-crazy": 5 } },
    { productoId: "combinado-eleccion", varianteId: "combinado-eleccion-15", cantidad: 1, seleccion: { classic: 5, passion: 5, crunch: 5 } },
    { productoId: "quesadillas-pollo", cantidad: 2, aclaracion: "sin bacon en una" },
    { productoId: "ensalada-teppan", cantidad: 1, agregados: ["agregado-langostinos"] }
  ], {
    modalidad: "envio",
    direccion: { calle: "San Martín 1234", barrio: "Centro", piso: "2 B", referencias: "entre Mendoza y Corrientes", ubicacion: "https://maps.google.com/?q=-32.41,-63.24" },
    pago: { metodo: "Efectivo", pagoJusto: false, montoEfectivo: 120000 },
    comentarios: "Tocar timbre 2B"
  }),
  "2) Retiro en el local + transferencia": pedido([
    { productoId: "classic", cantidad: 2 },
    { productoId: "burrito-texas", cantidad: 1 }
  ], { pago: { metodo: "Transferencia" } }),
  "3) Programado (local cerrado, lunes → martes) + Mercado Pago": pedido([
    { productoId: "salmon-grillado", cantidad: 1, aclaracion: "papas bien crocantes" },
    { productoId: "ensalada-mediterranea", cantidad: 1, agregados: ["agregado-salmon"] }
  ], { cuando: { tipo: "programado", turno: turno("2026-10-26T18:00", "2026-10-27 20:15") }, pago: { metodo: "Mercado Pago" } }),
  "4) Combinado a elección 30 pzs + programado hoy + efectivo pago justo": pedido([
    { productoId: "combinado-eleccion", varianteId: "combinado-eleccion-30", cantidad: 1, seleccion: { classic: 10, passion: 10, crunch: 5, veggie: 5 } }
  ], { cuando: { tipo: "programado", turno: turno("2026-10-21T19:30", "2026-10-21 21:30") }, pago: { metodo: "Efectivo", pagoJusto: true } }),
  "5) Envío con costo fijo configurado ($2.500) + efectivo": (() => {
    const C2 = { ...C, costoEnvio: 2500 };
    const lineas = [T.resolverItem(C2, idx, { productoId: "eby-quesadilla", cantidad: 1 })];
    return {
      _config: C2, cliente: { nombre: "Ana Gómez", telefono: T.normalizarTelefono("0353 15 4987654") }, modalidad: "envio",
      direccion: { calle: "Mendoza 450", barrio: "", piso: "Depto 3", referencias: "" }, cuando: { tipo: "asap" }, lineas,
      totales: T.calcularTotales(C2, lineas, "envio"), pago: { metodo: "Efectivo", pagoJusto: false, montoEfectivo: 20000 }, comentarios: ""
    };
  })()
};

console.log("\nMensajes");
test("el ejemplo 1 coincide con el formato del brief", () => {
  const m = T.construirMensaje(C, ejemplos["1) Envío + efectivo con vuelto (ejemplo del brief)"]);
  assert.ok(m.includes("• 1x Combinado Teppan 30 pzs — $41.000"));
  assert.ok(m.includes("    - Niguiri Teppan x10, Sashimi de salmón x10, Pink Boom x5, Maki Crazy x5"));
  assert.ok(m.includes("    - Classic x5, Passion x5, Crunch x5"));
  assert.ok(m.includes("• 1x Ensalada Teppan + Langostinos — $9.000"));
  assert.ok(m.includes("*TOTAL: $108.500* (+ envío)"));
  assert.ok(m.includes("abona con $120.000 (vuelto $11.500)"));
});
test("retiro: sin dirección ni línea de envío", () => {
  const m = T.construirMensaje(C, ejemplos["2) Retiro en el local + transferencia"]);
  assert.ok(m.includes("🏪 *Modalidad:* Retira en el local"));
  assert.ok(!m.includes("Envío") && !m.includes("Dirección") && !m.includes("Comentarios"));
});
test("combinado ordenado por cantidad", () => {
  const m = T.construirMensaje(C, ejemplos["4) Combinado a elección 30 pzs + programado hoy + efectivo pago justo"]);
  assert.ok(m.includes("- Classic x10, Passion x10, Crunch x5, Veggie x5"));
  assert.ok(m.includes("🕒 *Horario estimado:* Hoy 21:30 a 22:00"));
});
test("solo emojis de Unicode 6.0 y sin símbolos raros (se ven en cualquier WhatsApp)", () => {
  // Emojis permitidos: todos existen desde 2010
  const permitidos = new Set(["🍣", "👤", "📱", "🏠", "🏪", "📍", "🕒", "📋", "💵", "📝"]);
  for (const p of Object.values(ejemplos)) {
    const m = T.construirMensaje(p._config || C, p);
    for (const ch of m) {
      const cp = ch.codePointAt(0);
      if (cp > 0xffff) assert.ok(permitidos.has(ch), "emoji no permitido: " + ch);
      else assert.ok(cp < 0x2000 || "—•".includes(ch), "símbolo dudoso: " + ch + " U+" + cp.toString(16));
    }
  }
});
test("texto del cliente sin * _ ~ ni saltos de línea", () => {
  const p = pedido([{ productoId: "classic", cantidad: 1, aclaracion: "sin *philadelphia*\npor favor" }],
    { pago: { metodo: "Transferencia" }, comentarios: "tocar _timbre_\n\nportón ~negro~" });
  const m = T.construirMensaje(C, p);
  assert.ok(m.includes("    - Aclaración: sin philadelphia / por favor"));
  assert.ok(m.includes("📝 *Comentarios:* tocar timbre / portón negro"));
});
test("encodeURIComponent ida y vuelta (tildes, ñ, emojis, saltos de línea)", () => {
  for (const p of Object.values(ejemplos)) {
    const m = T.construirMensaje(p._config || C, p);
    const link = T.linkWhatsApp(C, m);
    assert.ok(link.startsWith("https://wa.me/5493534083326?text="));
    assert.ok(/^[A-Za-z0-9\-_.!~*'()%]*$/.test(link.split("?text=")[1]), "caracteres sin codificar");
    assert.strictEqual(decodeURIComponent(link.split("?text=")[1]), m);
  }
});

console.log("\n" + ok + " tests OK" + (process.exitCode ? " — HAY FALLAS" : ""));

if (process.argv.includes("--mensajes")) {
  for (const [titulo, p] of Object.entries(ejemplos)) {
    console.log("\n==================== " + titulo + " ====================\n");
    console.log(T.construirMensaje(p._config || C, p));
  }
}
