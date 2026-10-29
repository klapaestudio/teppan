/*
 * Lógica pura de la app (sin DOM): precios, horarios, validaciones y armado del mensaje.
 * Funciona en el navegador (window.TeppanCore) y en Node (require) para testear.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TeppanCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DIAS_CLAVE = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  var DIAS_NOMBRE = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var WEEKDAY_EN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  // ---------- Formato ----------

  function formatPrecio(n) {
    var s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (n < 0 ? "-$" : "$") + s;
  }

  function capitalizar(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function minutosAHora(min) {
    return pad2(Math.floor(min / 60)) + ":" + pad2(min % 60);
  }

  function horaAMinutos(hhmm) {
    var p = String(hhmm).split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1] || "0", 10);
  }

  // ---------- Fecha y hora en la zona del local ----------

  // Devuelve { y, m, d, dow, min } con la hora local de la zona indicada.
  function ahoraEnZona(zona, fecha) {
    var f = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23"
    });
    var partes = {};
    f.formatToParts(fecha || new Date()).forEach(function (p) {
      partes[p.type] = p.value;
    });
    var hora = parseInt(partes.hour, 10) % 24;
    return {
      y: parseInt(partes.year, 10),
      m: parseInt(partes.month, 10),
      d: parseInt(partes.day, 10),
      dow: WEEKDAY_EN[partes.weekday],
      min: hora * 60 + parseInt(partes.minute, 10)
    };
  }

  // Suma días a una fecha de calendario { y, m, d }.
  function sumarDias(fecha, dias) {
    var t = new Date(Date.UTC(fecha.y, fecha.m - 1, fecha.d + dias));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() };
  }

  function horarioDelDia(config, dow) {
    var h = config.horarios[DIAS_CLAVE[dow]];
    if (!h) return null;
    return { abre: horaAMinutos(h.abre), cierra: horaAMinutos(h.cierra) };
  }

  // Próximo día con atención a partir de mañana (1..7 días). Devuelve { offset, fecha, horario } o null.
  function proximoDiaAbierto(config, ahora) {
    for (var i = 1; i <= 7; i++) {
      var f = sumarDias(ahora, i);
      var h = horarioDelDia(config, f.dow);
      if (h) return { offset: i, fecha: f, horario: h };
    }
    return null;
  }

  function nombreDia(offset, fecha) {
    if (offset === 0) return "hoy";
    if (offset === 1) return "mañana";
    return "el " + DIAS_NOMBRE[fecha.dow];
  }

  // Estado del local para el header.
  // tipo: "abierto" | "abre-hoy" | "cerrado"
  function estadoLocal(config, ahora) {
    var h = horarioDelDia(config, ahora.dow);
    if (h && ahora.min >= h.abre && ahora.min < h.cierra) {
      return { abierto: true, tipo: "abierto", texto: "Abierto ahora · hasta las " + minutosAHora(h.cierra) };
    }
    if (h && ahora.min < h.abre) {
      return { abierto: false, tipo: "abre-hoy", texto: "Abre hoy a las " + minutosAHora(h.abre) };
    }
    var prox = proximoDiaAbierto(config, ahora);
    var prefijo = h ? "Cerrado" : "Hoy cerrado";
    if (!prox) return { abierto: false, tipo: "cerrado", texto: prefijo };
    return {
      abierto: false,
      tipo: "cerrado",
      texto: prefijo + " · abre " + nombreDia(prox.offset, prox.fecha) + " a las " + minutosAHora(prox.horario.abre)
    };
  }

  function etiquetaDia(offset, fecha) {
    var dm = pad2(fecha.d) + "/" + pad2(fecha.m);
    if (offset === 0) return "Hoy";
    if (offset === 1) return "Mañana · " + DIAS_NOMBRE[fecha.dow] + " " + dm;
    return capitalizar(DIAS_NOMBRE[fecha.dow]) + " " + dm;
  }

  // Rango horario estimado: "Hoy 21:30 a 22:00" / "Miércoles 22/10 20:15 a 20:45".
  function textoTurno(turno) {
    var rango = turno.hora + (turno.hasta ? " a " + turno.hasta : "");
    if (turno.offset === 0) return "Hoy " + rango;
    return capitalizar(DIAS_NOMBRE[turno.fecha.dow]) + " " + pad2(turno.fecha.d) + "/" + pad2(turno.fecha.m) + " " + rango;
  }

  function claveFecha(f) {
    return f.y + "-" + pad2(f.m) + "-" + pad2(f.d);
  }

  function franjas(config, horario, desdeMin) {
    var out = [];
    var paso = config.intervaloMinutos || 15;
    for (var t = horario.abre; t < horario.cierra; t += paso) {
      if (t >= desdeMin) out.push(t);
    }
    return out;
  }

  // Días y franjas disponibles para programar: hoy (si quedan franjas) y el próximo día de atención.
  function turnosDisponibles(config, ahora) {
    var dias = [];
    var hoy = horarioDelDia(config, ahora.dow);
    if (hoy) {
      var slotsHoy = franjas(config, hoy, ahora.min + (config.anticipacionMinutos || 0));
      if (slotsHoy.length) dias.push(armarDia(config, 0, ahora, slotsHoy));
    }
    var prox = proximoDiaAbierto(config, ahora);
    if (prox) dias.push(armarDia(config, prox.offset, prox.fecha, franjas(config, prox.horario, 0)));
    return dias;
  }

  function armarDia(config, offset, fecha, slots) {
    var rango = config.rangoHorarioMinutos || config.intervaloMinutos || 15;
    var f = { y: fecha.y, m: fecha.m, d: fecha.d, dow: fecha.dow };
    return {
      offset: offset,
      fecha: f,
      etiqueta: etiquetaDia(offset, f),
      franjas: slots.map(function (min) {
        var hora = minutosAHora(min);
        return { valor: claveFecha(f) + " " + hora, hora: hora, hasta: minutosAHora(min + rango), offset: offset, fecha: f };
      })
    };
  }

  // Busca un turno por su valor ("2026-10-21 21:30") entre los disponibles ahora.
  function buscarTurno(config, ahora, valor) {
    var dias = turnosDisponibles(config, ahora);
    for (var i = 0; i < dias.length; i++) {
      for (var j = 0; j < dias[i].franjas.length; j++) {
        if (dias[i].franjas[j].valor === valor) return dias[i].franjas[j];
      }
    }
    return null;
  }

  // ---------- Teléfono ----------

  // Acepta números argentinos con o sin +54, 9, 0 y 15. Devuelve "353 4123456" o null.
  function normalizarTelefono(texto) {
    var d = String(texto || "").replace(/\D/g, "");
    if (d.indexOf("54") === 0 && d.length >= 12) d = d.slice(2);
    if (d.charAt(0) === "9" && d.length === 11) d = d.slice(1);
    if (d.charAt(0) === "0") d = d.slice(1);
    if (d.length === 12) {
      // Característica (2 a 4 dígitos) + 15 + número
      for (var largo = 2; largo <= 4; largo++) {
        if (d.substr(largo, 2) === "15") {
          var sin15 = d.slice(0, largo) + d.slice(largo + 2);
          if (sin15.length === 10) {
            d = sin15;
            break;
          }
        }
      }
    }
    if (d.length !== 10 || d.charAt(0) === "0") return null;
    // Formato de muestra: característica de 3 dígitos es lo más común en el interior.
    var corte = d.indexOf("11") === 0 ? 2 : 3;
    return d.slice(0, corte) + " " + d.slice(corte);
  }

  // ---------- Carta ----------

  function indexarMenu(menu) {
    var productos = {};
    var variantes = {};
    var variedades = {};
    menu.productos.forEach(function (p) {
      productos[p.id] = p;
      (p.variantes || []).forEach(function (v) {
        variantes[v.id] = { variante: v, producto: p };
      });
    });
    (menu.variedadesCombinado || []).forEach(function (v) {
      variedades[v.id] = v;
    });
    return { menu: menu, productos: productos, variantes: variantes, variedades: variedades };
  }

  // Busca una variedad elegible para combinados: de "variedadesCombinado" o un roll de la carta.
  function buscarVariedad(config, idx, id) {
    if (idx.variedades[id]) return idx.variedades[id];
    var p = idx.productos[id];
    if (p && p.categoria === config.combinadoEleccion.categoriaVariedades) return p;
    return null;
  }

  // Variedades disponibles para armar un combinado: las de "variedadesCombinado" más los rolls de la carta.
  // Si el combinado tiene "variedades": [ids], se limita a esas.
  function variedadesCombo(config, idx, combinado) {
    var cat = config.combinadoEleccion.categoriaVariedades;
    var catNombre = (idx.menu.categorias.find(function (c) { return c.id === cat; }) || {}).nombre || cat;
    var todas = (idx.menu.variedadesCombinado || []).concat(
      idx.menu.productos
        .filter(function (p) { return p.categoria === cat; })
        .map(function (p) {
          return { id: p.id, tipo: catNombre, nombre: p.nombre, descripcion: p.descripcion, disponible: p.disponible };
        })
    );
    var permitidas = combinado && Array.isArray(combinado.variedades) ? combinado.variedades : null;
    return todas.filter(function (v) {
      return v.disponible !== false && (!permitidas || permitidas.indexOf(v.id) > -1);
    });
  }

  function agregadosDisponibles(config, idx) {
    return idx.menu.productos.filter(function (p) {
      return p.categoria === config.categoriaAgregados && p.disponible !== false;
    });
  }

  // seleccion: { idVariedad: piezas } (en orden de elección)
  function validarCombo(config, idx, seleccion, piezasTotales, combinado) {
    var reglas = config.combinadoEleccion;
    var permitidas = variedadesCombo(config, idx, combinado).map(function (v) { return v.id; });
    var total = 0;
    var errores = [];
    Object.keys(seleccion || {}).forEach(function (id) {
      var n = seleccion[id];
      if (!n) return;
      var p = buscarVariedad(config, idx, id);
      if (!p || permitidas.indexOf(id) === -1) {
        errores.push("Una de las variedades elegidas ya no está disponible.");
        return;
      }
      if (n < reglas.minPorVariedad || n > reglas.maxPorVariedad || n % reglas.paso !== 0) {
        errores.push(p.nombre + ": entre " + reglas.minPorVariedad + " y " + reglas.maxPorVariedad + " piezas.");
      }
      total += n;
    });
    if (total !== piezasTotales) {
      errores.push("Tenés que elegir exactamente " + piezasTotales + " piezas (llevás " + total + ").");
    }
    return { ok: errores.length === 0, total: total, errores: errores };
  }

  function desgloseCombo(config, idx, seleccion) {
    var ids = Object.keys(seleccion || {}).filter(function (id) {
      return seleccion[id] > 0;
    });
    // Mayor cantidad primero; a igual cantidad, respeta el orden en que se eligió.
    var ordenados = ids
      .map(function (id, i) {
        return { id: id, n: seleccion[id], i: i };
      })
      .sort(function (a, b) {
        return b.n - a.n || a.i - b.i;
      });
    return ordenados
      .map(function (x) {
        var p = buscarVariedad(config, idx, x.id);
        return (p ? p.nombre : x.id) + " x" + x.n;
      })
      .join(", ");
  }

  /*
   * Un ítem del carrito:
   * { uid, productoId, varianteId?, cantidad, aclaracion?, agregados?: [ids], seleccion?: {id: piezas} }
   * Devuelve la línea resuelta con precios actuales, o { valido: false, motivo } si ya no se puede pedir.
   */
  function resolverItem(config, idx, item) {
    var p = idx.productos[item.productoId];
    if (!p || p.disponible === false) return { valido: false, motivo: "no disponible" };
    if (p.categoria === config.categoriaAgregados && !config.permitirAgregadosSueltos) {
      return { valido: false, motivo: "no se puede pedir suelto" };
    }

    var base;
    var nombre = p.nombrePedido || p.nombre;
    var detalles = [];
    var variante = null;

    if (p.variantes && p.variantes.length) {
      var reg = idx.variantes[item.varianteId];
      if (!reg || reg.producto.id !== p.id || reg.variante.disponible === false) {
        return { valido: false, motivo: "tamaño no disponible" };
      }
      variante = reg.variante;
      base = variante.precio;
      nombre += " " + variante.piezas + " pzs";
    } else {
      base = p.precio;
    }

    if (p.armable) {
      var v = validarCombo(config, idx, item.seleccion, variante.piezas, p);
      if (!v.ok) return { valido: false, motivo: v.errores[0] };
      detalles.push(desgloseCombo(config, idx, item.seleccion));
    }

    var extras = 0;
    var nombresExtras = [];
    if (p.admiteAgregados && item.agregados && item.agregados.length) {
      for (var i = 0; i < item.agregados.length; i++) {
        var a = idx.productos[item.agregados[i]];
        if (!a || a.disponible === false || a.categoria !== config.categoriaAgregados) {
          return { valido: false, motivo: "agregado no disponible" };
        }
        extras += a.precio;
        nombresExtras.push(a.nombre);
      }
      nombre += " + " + nombresExtras.join(" + ");
    }

    var aclaracion = (item.aclaracion || "").trim();
    if (aclaracion) detalles.push("Aclaración: " + aclaracion);

    var cantidad = Math.max(1, Math.floor(item.cantidad || 1));
    var unitario = base + extras;
    return {
      valido: true,
      item: item,
      producto: p,
      variante: variante,
      nombre: nombre,
      detalles: detalles,
      aclaracion: aclaracion,
      cantidad: cantidad,
      unitario: unitario,
      total: unitario * cantidad
    };
  }

  // Firma para unificar ítems iguales en el carrito.
  function firmaItem(item) {
    var sel = item.seleccion
      ? Object.keys(item.seleccion)
          .sort()
          .map(function (k) {
            return k + ":" + item.seleccion[k];
          })
          .join(",")
      : "";
    return [
      item.productoId,
      item.varianteId || "",
      (item.agregados || []).slice().sort().join(","),
      sel,
      (item.aclaracion || "").trim().toLowerCase()
    ].join("|");
  }

  // ---------- Totales ----------

  function calcularTotales(config, lineas, modalidad) {
    var subtotal = lineas.reduce(function (acc, l) {
      return acc + l.total;
    }, 0);
    var esEnvio = modalidad === "envio";
    var envioConfirmado = esEnvio && typeof config.costoEnvio === "number";
    var envio = envioConfirmado ? config.costoEnvio : 0;
    return {
      subtotal: subtotal,
      envio: envio,
      esEnvio: esEnvio,
      envioAConfirmar: esEnvio && !envioConfirmado,
      total: subtotal + envio
    };
  }

  // ---------- Mensaje de WhatsApp ----------

  /*
   * pedido = {
   *   cliente: { nombre, telefono },
   *   modalidad: "retiro" | "envio",
   *   direccion: { calle, barrio, piso, referencias, ubicacion },
   *   cuando: { tipo: "asap" } | { tipo: "programado", turno },
   *   lineas, totales,
   *   pago: { metodo, pagoJusto, montoEfectivo },
   *   comentarios
   * }
   */
  // Texto escrito por el cliente, apto para WhatsApp: sin * _ ~ ` (rompen negritas y cursivas)
  // y en una sola línea, para no desarmar el formato del mensaje.
  function limpiar(texto) {
    return String(texto || "")
      .replace(/[*_~`]/g, "")
      .replace(/\s*[\r\n]+\s*/g, " / ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  /*
   * Emojis del mensaje: solo de Unicode 6.0 (2010), que se ven en cualquier versión de WhatsApp.
   * Evitar emojis nuevos (🧾, 🛵…) y símbolos como ↳, que en algunos dispositivos salen como "?".
   */
  function construirMensaje(config, pedido) {
    var L = [];
    L.push("🍣 *NUEVO PEDIDO — " + config.nombre.toUpperCase() + "*");
    L.push("");
    L.push("👤 *Cliente:* " + limpiar(pedido.cliente.nombre));
    L.push("📱 *Teléfono:* " + pedido.cliente.telefono);
    L.push("");

    if (pedido.modalidad === "envio") {
      var d = pedido.direccion || {};
      L.push("🏠 *Modalidad:* Envío a domicilio");
      var dir = limpiar(d.calle);
      if (limpiar(d.barrio)) dir += ", B° " + limpiar(d.barrio).replace(/^(b°|b º|barrio)\s*/i, "");
      if (limpiar(d.piso)) {
        var piso = limpiar(d.piso);
        dir += " — " + (/^(piso|depto|dpto|dto|departamento|casa|pb|planta|local|of)/i.test(piso) ? "" : "Piso ") + piso;
      }
      L.push("📍 *Dirección:* " + dir);
      if (limpiar(d.referencias)) L.push("    Ref: " + limpiar(d.referencias));
      if (d.ubicacion) L.push("    Ubicación: " + d.ubicacion);
    } else {
      L.push("🏪 *Modalidad:* Retira en el local");
    }
    L.push("");

    if (pedido.cuando.tipo === "programado") L.push("🕒 *Horario estimado:* " + textoTurno(pedido.cuando.turno));
    else L.push("🕒 *Horario:* Por orden de llegada");
    L.push("");

    L.push("📋 *Pedido:*");
    pedido.lineas.forEach(function (l) {
      L.push("• " + l.cantidad + "x " + l.nombre + " — " + formatPrecio(l.total));
      l.detalles.forEach(function (det) {
        L.push("    - " + limpiar(det));
      });
    });
    L.push("");

    var t = pedido.totales;
    L.push("Subtotal: " + formatPrecio(t.subtotal));
    if (t.esEnvio) {
      L.push("Envío: " + (t.envioAConfirmar ? "a confirmar" : formatPrecio(t.envio)));
    }
    L.push("*TOTAL: " + formatPrecio(t.total) + "*" + (t.envioAConfirmar ? " (+ envío)" : ""));
    L.push("");

    var pago = pedido.pago;
    var textoPago = pago.metodo;
    if (pago.metodo === "Efectivo") {
      if (pago.pagoJusto) {
        textoPago += " — pago justo";
      } else {
        textoPago +=
          " — abona con " + formatPrecio(pago.montoEfectivo) + " (vuelto " + formatPrecio(pago.montoEfectivo - t.total) + ")";
      }
    }
    L.push("💵 *Pago:* " + textoPago);

    var com = limpiar(pedido.comentarios);
    if (com) {
      L.push("");
      L.push("📝 *Comentarios:* " + com);
    }
    return L.join("\n");
  }

  function linkWhatsApp(config, mensaje) {
    return "https://wa.me/" + config.whatsapp + "?text=" + encodeURIComponent(mensaje);
  }

  // Monto en pesos escrito por el usuario: "120.000", "$120000", "120000,50" → 120000
  function parsearMonto(texto) {
    var s = String(texto || "").replace(/[^\d,]/g, "");
    s = s.split(",")[0];
    return s ? parseInt(s, 10) : NaN;
  }

  return {
    DIAS_NOMBRE: DIAS_NOMBRE,
    formatPrecio: formatPrecio,
    minutosAHora: minutosAHora,
    ahoraEnZona: ahoraEnZona,
    horarioDelDia: horarioDelDia,
    estadoLocal: estadoLocal,
    turnosDisponibles: turnosDisponibles,
    buscarTurno: buscarTurno,
    textoTurno: textoTurno,
    normalizarTelefono: normalizarTelefono,
    indexarMenu: indexarMenu,
    variedadesCombo: variedadesCombo,
    agregadosDisponibles: agregadosDisponibles,
    validarCombo: validarCombo,
    desgloseCombo: desgloseCombo,
    resolverItem: resolverItem,
    firmaItem: firmaItem,
    calcularTotales: calcularTotales,
    construirMensaje: construirMensaje,
    limpiar: limpiar,
    linkWhatsApp: linkWhatsApp,
    parsearMonto: parsearMonto
  };
});
