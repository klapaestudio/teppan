(function () {
  "use strict";

  var C = window.TEPPAN_CONFIG;
  var T = window.TeppanCore;
  var $ = function (id) { return document.getElementById(id); };

  var KEY_CARRITO = "teppan:v1:carrito";
  var KEY_CLIENTE = "teppan:v1:cliente";
  var CAMPOS_CLIENTE = ["nombre", "telefono", "modalidad", "calle", "barrio", "piso", "referencias", "metodo"];

  var idx = null;
  var carrito = [];
  var form = {
    nombre: "", telefono: "", modalidad: "retiro",
    calle: "", barrio: "", piso: "", referencias: "", ubicacion: "",
    cuando: "asap", turno: "",
    metodo: "", pagoJusto: false, monto: "",
    comentarios: ""
  };
  var tamanioCard = {}; // productoId -> varianteId elegido en la tarjeta
  var prod = null;      // estado de la hoja de producto
  var vista = null;     // "producto" | "carrito" | "datos" | "resumen" | "enviado"
  var ultimoLink = "";
  var errores = {};
  var focoPrevio = null;

  // ---------- Utilidades ----------

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  var $$ = T.formatPrecio;

  function leer(clave) {
    try { var v = localStorage.getItem(clave); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin storage: seguimos igual */ }
  }

  function ahora() { return T.ahoraEnZona(C.zonaHoraria); }

  var toastTimer;
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("visible"); }, 2200);
  }

  var ICON_WA = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';

  // ---------- Inicio ----------

  function init() {
    pintarDatosLocal();
    pintarEstado();
    setInterval(pintarEstado, 60000);
    cargarCliente();

    fetch("menu.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (menu) {
        idx = T.indexarMenu(menu);
        cargarCarrito();
        pintarCarta();
        pintarBarra();
      })
      .catch(function () {
        $("secciones").innerHTML =
          '<p class="error-carga">No pudimos cargar la carta. ' +
          (location.protocol === "file:" ? "Abrí la app con un servidor local (ver README)." : "Probá recargar la página.") +
          "</p>";
      });

    $("barra-pedido").addEventListener("click", function () { abrirSheet("carrito"); });
    $("sheet-cerrar").addEventListener("click", function () { cerrarSheet(); });
    $("backdrop").addEventListener("click", function () { cerrarSheet(); });
    $("sheet-atras").addEventListener("click", atras);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && vista) cerrarSheet();
    });
    window.addEventListener("popstate", function () { if (vista) ocultarSheet(); });

    $("secciones").addEventListener("click", clickCarta);
    $("sheet").addEventListener("click", clickSheet);
    $("sheet").addEventListener("input", inputSheet);
    $("sheet").addEventListener("change", inputSheet);
  }

  function pintarDatosLocal() {

    $("brand-bajada").textContent = C.bajada;
    $("txt-direccion").textContent = C.direccion.split(",")[0] + ", Villa María";
    $("link-maps").href = C.mapsUrl;
    $("txt-ig").textContent = C.instagramUsuario;
    $("link-ig").href = C.instagram;
    $("pie-alergias").textContent = "⚠️ " + C.textoAlergias;

    var orden = [2, 3, 4, 5, 6, 0, 1];
    var claves = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    var hoy = ahora().dow;
    $("pie-horarios").innerHTML = orden.map(function (d) {
      var h = C.horarios[claves[d]];
      var cls = d === hoy ? ' class="hoy"' : "";
      var nombre = T.DIAS_NOMBRE[d];
      return "<li><span" + cls + ">" + esc(nombre.charAt(0).toUpperCase() + nombre.slice(1)) + "</span><span" + cls + ">" +
        (h ? esc(h.abre + " a " + h.cierra) : "Cerrado") + "</span></li>";
    }).join("");
    $("pie-datos").innerHTML =
      esc(C.direccion) + '<br><a href="https://wa.me/' + esc(C.whatsapp) + '" target="_blank" rel="noopener">WhatsApp ' +
      esc(C.telefonoVisible) + '</a> · <a href="' + esc(C.instagram) + '" target="_blank" rel="noopener">Instagram</a>';
  }

  function pintarEstado() {
    var est = T.estadoLocal(C, ahora());
    var el = $("estado");
    el.textContent = est.texto;
    el.dataset.tipo = est.tipo;
    var aviso = $("aviso-cerrado");
    if (est.abierto) {
      aviso.hidden = true;
    } else {
      aviso.hidden = false;
      aviso.innerHTML = "<strong>Ahora estamos cerrados.</strong> Podés armar tu pedido igual y programarlo para cuando abramos (" +
        esc(est.texto.replace(/^(Hoy cerrado|Cerrado) · /, "").replace(/^Abre/, "abre")) + ").";
    }
    return est;
  }

  // ---------- Carta ----------

  function pintarCarta() {
    var cats = idx.menu.categorias.filter(function (c) {
      return idx.menu.productos.some(function (p) { return p.categoria === c.id; });
    });

    $("cats-list").innerHTML = cats.map(function (c, i) {
      return '<li><button type="button" class="cat-btn" data-target="cat-' + esc(c.id) + '"' +
        (i === 0 ? ' aria-current="true"' : "") + ">" + esc(c.nombre) + "</button></li>";
    }).join("");

    $("secciones").innerHTML = cats.map(function (c) {
      var prods = idx.menu.productos.filter(function (p) { return p.categoria === c.id; });
      var nota = "";
      if (c.id === C.categoriaAgregados && !C.permitirAgregadosSueltos) {
        nota = '<p class="seccion-nota">Se suman a cualquier ensalada desde la ensalada misma.</p>';
      }
      return '<section class="seccion" id="cat-' + esc(c.id) + '" aria-labelledby="h-' + esc(c.id) + '">' +
        '<h2 class="seccion-titulo" id="h-' + esc(c.id) + '">' + esc(c.nombre) + "</h2>" + nota +
        '<div class="cards">' + prods.map(tarjeta).join("") + "</div></section>";
    }).join("");

    $("cats-list").addEventListener("click", function (e) {
      var b = e.target.closest(".cat-btn");
      if (!b) return;
      var sec = $(b.dataset.target);
      if (sec) sec.scrollIntoView({ block: "start" });
      marcarCategoria(b.dataset.target);
    });
    observarCategorias(cats);
    iniciarBuscador();
  }

  // ---------- Buscador ----------

  // Minúsculas y sin tildes: "Salmón" encuentra "salmon" y viceversa.
  function normalizar(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  }

  function iniciarBuscador() {
    var input = $("buscar");
    var limpiar = $("buscar-limpiar");
    input.addEventListener("input", function () { filtrar(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && input.value) { e.stopPropagation(); input.value = ""; filtrar(""); }
      if (e.key === "Enter") input.blur(); // cierra el teclado en el celular
    });
    limpiar.addEventListener("click", function () { input.value = ""; filtrar(""); input.focus(); });
    $("ver-toda").addEventListener("click", function () { input.value = ""; filtrar(""); });
    if (input.value) filtrar(input.value); // el navegador puede restaurar el texto al volver
  }

  function filtrar(texto) {
    var palabras = normalizar(texto).split(" ").filter(Boolean);
    var buscando = palabras.length > 0;
    var total = 0;

    document.querySelectorAll("#secciones .seccion").forEach(function (sec) {
      var visibles = 0;
      sec.querySelectorAll(".card").forEach(function (card) {
        var t = card.dataset.buscar;
        var coincide = palabras.every(function (w) { return t.indexOf(w) > -1; });
        card.hidden = !coincide;
        if (coincide) visibles++;
      });
      sec.hidden = visibles === 0;
      total += visibles;
    });

    $("buscar-limpiar").hidden = !buscando;
    $("cats-list").hidden = buscando;
    $("sin-resultados").hidden = !buscando || total > 0;
    $("sin-resultados-txt").textContent = texto.trim();
    $("resultado-busqueda").textContent = buscando && total
      ? (total === 1 ? "1 plato encontrado" : total + " platos encontrados")
      : "";

    // Al buscar, llevar la vista al principio de los resultados.
    var carta = $("carta");
    var tope = carta.getBoundingClientRect().top + window.scrollY - document.querySelector(".cats").offsetHeight;
    if (window.scrollY > tope) window.scrollTo({ top: tope });
  }

  function marcarCategoria(id) {
    var activo = null;
    document.querySelectorAll(".cat-btn").forEach(function (b) {
      var es = b.dataset.target === id;
      b.setAttribute("aria-current", es ? "true" : "false");
      if (es) activo = b;
    });
    if (activo) {
      var ul = $("cats-list");
      var izq = activo.offsetLeft - ul.clientWidth / 2 + activo.clientWidth / 2;
      ul.scrollTo({ left: izq, behavior: "smooth" });
    }
  }

  function observarCategorias(cats) {
    if (!("IntersectionObserver" in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) marcarCategoria(en.target.id); });
    }, { rootMargin: "-130px 0px -65% 0px" });
    cats.forEach(function (c) { obs.observe($("cat-" + c.id)); });
  }

  function variantesDisponibles(p) {
    return (p.variantes || []).filter(function (v) { return v.disponible !== false; });
  }

  function tarjeta(p) {
    var disponible = p.disponible !== false;
    var esAgregado = p.categoria === C.categoriaAgregados;
    var pedible = disponible && (!esAgregado || C.permitirAgregadosSueltos);
    var img = p.imagen ? '<img class="card-img" src="' + esc(p.imagen) + '" alt="" loading="lazy">' : "";
    var precioHtml;
    var tamanios = "";

    if (p.variantes && p.variantes.length) {
      var disp = variantesDisponibles(p);
      if (!disp.length) pedible = false;
      var sel = tamanioCard[p.id] || (disp[0] && disp[0].id);
      tamanioCard[p.id] = sel;
      var vSel = idx.variantes[sel] ? idx.variantes[sel].variante : null;
      tamanios = '<div class="tamanios" role="group" aria-label="Tamaño de ' + esc(p.nombre) + '">' +
        p.variantes.map(function (v) {
          var off = v.disponible === false || !disponible;
          return '<button type="button" class="chip" data-action="tamanio-card" data-id="' + esc(p.id) + '" data-var="' + esc(v.id) + '"' +
            ' aria-pressed="' + (v.id === sel) + '"' + (off ? " disabled" : "") + ">" +
            "<span>" + v.piezas + " pzs</span><small>" + $$(v.precio) + "</small></button>";
        }).join("") + "</div>";
      precioHtml = '<span class="precio" id="precio-' + esc(p.id) + '">' + (vSel ? $$(vSel.precio) : "") + "</span>";
    } else {
      precioHtml = '<span class="precio">' + (esAgregado ? "+" : "") + $$(p.precio) + "</span>";
    }

    var boton;
    if (!disponible) boton = '<span class="badge">No disponible</span>';
    else if (esAgregado && !C.permitirAgregadosSueltos) boton = '<span class="badge">Con ensaladas</span>';
    else boton = '<button type="button" class="btn btn-primary" data-action="abrir-producto" data-id="' + esc(p.id) + '"' +
      (pedible ? "" : " disabled") + ' aria-label="' + (p.armable ? "Armar " : "Agregar ") + esc(p.nombre) + '">' +
      (p.armable ? "Armar" : "Agregar") + "</button>";

    var cat = idx.menu.categorias.find(function (c) { return c.id === p.categoria; });
    var partesBusqueda = [p.nombre, p.nombrePedido, p.descripcion, cat && cat.nombre];
    // En los combinados también se busca por las variedades que se pueden elegir ("niguiri" → combinados).
    if (p.armable) T.variedadesCombo(C, idx, p).forEach(function (v) { partesBusqueda.push(v.nombre, v.tipo); });
    var textoBusqueda = normalizar(partesBusqueda.join(" "));
    return '<article class="card' + (disponible ? "" : " no-disp") + '" data-buscar="' + esc(textoBusqueda) + '">' + img +
      '<div class="card-body"><h3>' + esc(p.nombre) + "</h3><p>" + esc(p.descripcion) + "</p>" + tamanios +
      '<div class="card-foot">' + precioHtml + boton + "</div></div></article>";
  }

  function clickCarta(e) {
    var b = e.target.closest("[data-action]");
    if (!b) return;
    if (b.dataset.action === "tamanio-card") {
      tamanioCard[b.dataset.id] = b.dataset.var;
      b.parentNode.querySelectorAll(".chip").forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === b));
      });
      $("precio-" + b.dataset.id).textContent = $$(idx.variantes[b.dataset.var].variante.precio);
    } else if (b.dataset.action === "abrir-producto") {
      abrirProducto(b.dataset.id);
    }
  }

  // ---------- Carrito (persistencia) ----------

  function cargarCarrito() {
    var guardado = leer(KEY_CARRITO);
    if (!Array.isArray(guardado)) return;
    var descartados = 0;
    carrito = guardado.filter(function (it) {
      var ok = it && T.resolverItem(C, idx, it).valido;
      if (!ok) descartados++;
      return ok;
    });
    if (descartados) {
      guardarCarrito();
      setTimeout(function () {
        toast(descartados === 1 ? "Sacamos 1 producto que ya no está disponible" : "Sacamos " + descartados + " productos que ya no están disponibles");
      }, 400);
    }
  }

  function guardarCarrito() { guardar(KEY_CARRITO, carrito); }

  function cargarCliente() {
    var c = leer(KEY_CLIENTE);
    if (!c) return;
    CAMPOS_CLIENTE.forEach(function (k) { if (typeof c[k] === "string") form[k] = c[k]; });
    if (form.modalidad !== "envio") form.modalidad = "retiro";
    if (C.metodosPago.indexOf(form.metodo) === -1) form.metodo = "";
  }

  function guardarCliente() {
    var c = {};
    CAMPOS_CLIENTE.forEach(function (k) { c[k] = form[k]; });
    guardar(KEY_CLIENTE, c);
  }

  function lineas() {
    return carrito.map(function (it) { return T.resolverItem(C, idx, it); }).filter(function (l) { return l.valido; });
  }

  function cantidadTotal() {
    return carrito.reduce(function (a, it) { return a + it.cantidad; }, 0);
  }

  function pintarBarra() {
    var n = cantidadTotal();
    var barra = $("barra-pedido");
    barra.hidden = n === 0;
    if (!n) return;
    var subtotal = lineas().reduce(function (a, l) { return a + l.total; }, 0);
    $("barra-cant").textContent = n;
    $("barra-total").textContent = $$(subtotal);
    barra.setAttribute("aria-label", "Ver pedido: " + n + (n === 1 ? " producto" : " productos") + ", " + $$(subtotal));
  }

  function agregarAlCarrito(item) {
    var firma = T.firmaItem(item);
    var existente = carrito.find(function (it) { return T.firmaItem(it) === firma; });
    if (existente) existente.cantidad += item.cantidad;
    else carrito.push(item);
    guardarCarrito();
    pintarBarra();
  }

  // ---------- Bottom sheet ----------

  function abrirSheet(v) {
    if (!vista) {
      focoPrevio = document.activeElement;
      $("backdrop").hidden = false;
      $("sheet").hidden = false;
      document.body.classList.add("no-scroll");
      try { history.pushState({ teppanSheet: true }, ""); } catch (e) { /* noop */ }
    }
    irA(v);
  }

  function irA(v) {
    vista = v;
    errores = {};
    pintarSheet();
    $("sheet-body").scrollTop = 0;
    $("sheet-titulo").focus({ preventScroll: true });
  }

  function cerrarSheet() {
    if (history.state && history.state.teppanSheet) history.back(); // dispara popstate → ocultarSheet
    else ocultarSheet();
  }

  function ocultarSheet() {
    vista = null;
    prod = null;
    $("backdrop").hidden = true;
    $("sheet").hidden = true;
    document.body.classList.remove("no-scroll");
    if (focoPrevio && document.contains(focoPrevio)) focoPrevio.focus({ preventScroll: true });
  }

  function atras() {
    if (vista === "datos") irA("carrito");
    else if (vista === "resumen") irA("datos");
    else cerrarSheet();
  }

  function pintarSheet() {
    var titulos = { producto: prod ? (idx.productos[prod.productoId].nombre) : "", carrito: "Tu pedido", datos: "Tus datos", resumen: "Revisá tu pedido", enviado: "Pedido listo" };
    $("sheet-titulo").textContent = titulos[vista] || "";
    $("sheet-atras").hidden = !(vista === "datos" || vista === "resumen");
    var scroll = $("sheet-body").scrollTop;
    if (vista === "producto") pintarProducto();
    else if (vista === "carrito") pintarCarrito();
    else if (vista === "datos") pintarDatos();
    else if (vista === "resumen") pintarResumen();
    else if (vista === "enviado") pintarEnviado();
    $("sheet-body").scrollTop = scroll;
  }

  // ---------- Hoja de producto ----------

  function abrirProducto(id) {
    var p = idx.productos[id];
    prod = { productoId: id, varianteId: null, cantidad: 1, aclaracion: "", agregados: [], seleccion: {} };
    if (p.variantes) {
      var disp = variantesDisponibles(p);
      var elegido = tamanioCard[id];
      prod.varianteId = disp.some(function (v) { return v.id === elegido; }) ? elegido : (disp[0] && disp[0].id);
    }
    abrirSheet("producto");
  }

  function itemDeProd() {
    var p = idx.productos[prod.productoId];
    var it = { uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), productoId: p.id, cantidad: prod.cantidad };
    if (prod.varianteId) it.varianteId = prod.varianteId;
    if (prod.aclaracion.trim()) it.aclaracion = prod.aclaracion.trim();
    if (p.admiteAgregados && prod.agregados.length) it.agregados = prod.agregados.slice();
    if (p.armable) {
      it.seleccion = {};
      Object.keys(prod.seleccion).forEach(function (k) { if (prod.seleccion[k]) it.seleccion[k] = prod.seleccion[k]; });
    }
    return it;
  }

  function pintarProducto() {
    var p = idx.productos[prod.productoId];
    var reglas = C.combinadoEleccion;
    var h = '<p class="prod-desc">' + esc(p.descripcion) + "</p>";

    if (p.variantes) {
      h += '<div class="bloque"><p class="bloque-titulo" id="lbl-tam">Tamaño</p><div class="tamanios" role="radiogroup" aria-labelledby="lbl-tam">' +
        p.variantes.map(function (v) {
          var off = v.disponible === false;
          return '<button type="button" role="radio" class="chip" data-action="tamanio" data-var="' + esc(v.id) + '" aria-checked="' + (v.id === prod.varianteId) + '"' +
            (off ? " disabled" : "") + "><span>" + v.piezas + " pzs</span><small>" + $$(v.precio) + "</small></button>";
        }).join("") + "</div></div>";
    }

    var piezas = p.variantes && idx.variantes[prod.varianteId] ? idx.variantes[prod.varianteId].variante.piezas : 0;

    if (p.armable) {
      var total = sumaSeleccion();
      var estado = total === piezas ? " completo" : total > piezas ? " excedido" : "";
      var pct = piezas ? Math.min(100, (total / piezas) * 100) : 0;
      h += '<div class="bloque"><div class="contador' + estado + '" aria-live="polite"><span>Llevás ' + total + " de " + piezas + " piezas</span>" +
        '<span class="barra" aria-hidden="true"><i style="width:' + pct + '%"></i></span></div>' +
        '<p class="bloque-titulo">Elegí tus variedades <small>de ' + reglas.minPorVariedad + " a " + reglas.maxPorVariedad + " piezas c/u</small></p>" +
        gruposVariedades(T.variedadesCombo(C, idx, p)).map(function (g) {
          return '<h4 class="variedades-tipo">' + esc(g.tipo) + '</h4><ul class="variedades">' + g.items.map(function (r) {
            var n = prod.seleccion[r.id] || 0;
            var subir = n === 0 ? reglas.minPorVariedad : reglas.paso;
            var puedeSubir = n < reglas.maxPorVariedad && total + subir <= piezas;
            return '<li class="variedad' + (n ? " activa" : "") + '"><div class="variedad-info"><strong>' + esc(r.nombre) + "</strong><small>" + esc(r.descripcion) + "</small></div>" +
              stepper("combo", r.id, n, n > 0, puedeSubir, r.nombre) + "</li>";
          }).join("") + "</ul>";
        }).join("") + "</div>";
    }

    if (p.admiteAgregados) {
      var ags = T.agregadosDisponibles(C, idx);
      if (ags.length) {
        h += '<fieldset class="bloque" style="border:0;padding:0;margin:0 0 22px"><legend class="bloque-titulo">Agregados <small>opcional</small></legend>' +
          ags.map(function (a) {
            return '<label class="check"><input type="checkbox" data-agregado="' + esc(a.id) + '"' + (prod.agregados.indexOf(a.id) > -1 ? " checked" : "") + ">" +
              "<span>" + esc(a.nombre) + '</span><span class="check-precio">+' + $$(a.precio) + "</span></label>";
          }).join("") + "</fieldset>";
      }
    }

    h += '<div class="bloque campo"><label for="aclaracion">Aclaración <span class="opcional">(opcional)</span></label>' +
      '<input class="input" id="aclaracion" data-prod="aclaracion" maxlength="140" placeholder="Ej: sin philadelphia" value="' + esc(prod.aclaracion) + '"></div>';

    h += '<div class="bloque fila"><span class="label" id="lbl-cant" style="margin:0">Cantidad</span>' +
      stepper("cant", "", prod.cantidad, prod.cantidad > 1, prod.cantidad < 99, "") + "</div>";

    $("sheet-body").innerHTML = h;

    var res = T.resolverItem(C, idx, itemDeProd());
    var ayuda = "";
    if (p.armable && !res.valido) {
      var faltan = piezas - sumaSeleccion();
      ayuda = faltan > 0 ? "Te faltan " + faltan + " piezas" : "Te pasaste " + (-faltan) + " piezas";
    }
    $("sheet-foot").innerHTML = (ayuda ? '<p class="foot-ayuda">' + esc(ayuda) + "</p>" : "") +
      '<button type="button" class="btn btn-primary btn-block" data-action="agregar"' + (res.valido ? "" : " disabled") + ">" +
      "Agregar al pedido" + (res.valido ? " · " + $$(res.total) : "") + "</button>";
  }

  // Agrupa las variedades por "tipo" respetando el orden de menu.json.
  function gruposVariedades(lista) {
    var grupos = [];
    lista.forEach(function (v) {
      var g = grupos.find(function (x) { return x.tipo === v.tipo; });
      if (!g) grupos.push(g = { tipo: v.tipo, items: [] });
      g.items.push(v);
    });
    return grupos;
  }

  function stepper(tipo, id, valor, puedeBajar, puedeSubir, nombre) {
    var desc = nombre ? " de " + esc(nombre) : "";
    return '<div class="stepper" role="group" aria-label="Cantidad' + desc + '">' +
      '<button type="button" data-action="' + tipo + '-menos" data-id="' + esc(id) + '" aria-label="Quitar' + desc + '"' + (puedeBajar ? "" : " disabled") + ">−</button>" +
      "<output>" + valor + "</output>" +
      '<button type="button" data-action="' + tipo + '-mas" data-id="' + esc(id) + '" aria-label="Sumar' + desc + '"' + (puedeSubir ? "" : " disabled") + ">+</button></div>";
  }

  function sumaSeleccion() {
    return Object.keys(prod.seleccion).reduce(function (a, k) { return a + (prod.seleccion[k] || 0); }, 0);
  }

  function cambiarCombo(id, subir) {
    var r = C.combinadoEleccion;
    var n = prod.seleccion[id] || 0;
    if (subir) n = n === 0 ? r.minPorVariedad : Math.min(r.maxPorVariedad, n + r.paso);
    else n = n - r.paso < r.minPorVariedad ? 0 : n - r.paso;
    if (n) prod.seleccion[id] = n;
    else delete prod.seleccion[id];
  }

  // ---------- Carrito ----------

  function pintarCarrito() {
    if (!carrito.length) {
      $("sheet-body").innerHTML = '<div class="vacio"><p>Tu pedido está vacío.</p><button type="button" class="btn btn-ghost" data-action="cerrar">Ver la carta</button></div>';
      $("sheet-foot").innerHTML = "";
      return;
    }
    var ls = lineas();
    var h = '<ul class="items">' + ls.map(function (l) {
      var it = l.item;
      var dets = l.detalles.filter(function (d) { return d.indexOf("Aclaración:") !== 0; });
      return '<li class="item"><div class="item-top"><div><div class="item-nombre">' + esc(l.nombre) + "</div>" +
        dets.map(function (d) { return '<p class="item-det">' + esc(d) + "</p>"; }).join("") +
        '<p class="item-det">' + $$(l.unitario) + " c/u</p></div>" +
        '<div class="item-precio">' + $$(l.total) + "</div></div>" +
        '<label class="label" for="acl-' + esc(it.uid) + '" style="position:absolute;left:-9999px">Aclaración para ' + esc(l.nombre) + "</label>" +
        '<input class="input" id="acl-' + esc(it.uid) + '" data-acl="' + esc(it.uid) + '" maxlength="140" placeholder="Aclaración (opcional)" value="' + esc(it.aclaracion || "") + '">' +
        '<div class="item-acciones">' + stepper("item", it.uid, l.cantidad, l.cantidad > 1, l.cantidad < 99, l.nombre) +
        '<button type="button" class="btn-link" data-action="eliminar" data-id="' + esc(it.uid) + '">Eliminar</button></div></li>';
    }).join("") + "</ul>";

    var t = T.calcularTotales(C, ls, form.modalidad);
    h += '<dl class="totales"><div class="total"><dt>Subtotal</dt><dd>' + $$(t.subtotal) + "</dd></div></dl>";
    h += '<p class="ayuda">' + (typeof C.costoEnvio === "number"
      ? "Envío a domicilio: " + $$(C.costoEnvio) + "."
      : "Si pedís con envío, el costo te lo confirma " + esc(C.nombre) + " por WhatsApp.") + "</p>";
    $("sheet-body").innerHTML = h;
    $("sheet-foot").innerHTML = '<button type="button" class="btn btn-primary btn-block" data-action="ir-datos">Continuar · ' + $$(t.subtotal) + "</button>";
  }

  function buscarItem(uid) { return carrito.find(function (it) { return it.uid === uid; }); }

  // ---------- Datos (checkout) ----------

  function pintarDatos() {
    var est = T.estadoLocal(C, ahora());
    // Abierto: por orden de llegada. Cerrado: se elige un rango horario estimado.
    form.cuando = est.abierto ? "asap" : "programado";
    var dias = T.turnosDisponibles(C, ahora());
    var h = "";

    h += '<section class="seccion-form"><h3>¿Quién pide?</h3>' +
      campo("nombre", "Nombre y apellido", '<input class="input" id="f-nombre" name="nombre" autocomplete="name" value="' + esc(form.nombre) + '">') +
      campo("telefono", "Teléfono", '<input class="input" id="f-telefono" name="telefono" type="tel" inputmode="tel" autocomplete="tel" placeholder="Ej: 353 4123456" value="' + esc(form.telefono) + '">',
        "Con característica, sin 0 ni 15.") +
      "</section>";

    h += '<section class="seccion-form"><h3>¿Cómo lo recibís?</h3>' +
      '<fieldset class="toggle"><legend>Modalidad</legend>' +
      opcion("modalidad", "retiro", "Retiro en el local", "") + opcion("modalidad", "envio", "Envío a domicilio", "") + "</fieldset>" +
      '<div id="bloque-retiro"><div class="caja info">Retirás en <a href="' + esc(C.mapsUrl) + '" target="_blank" rel="noopener">' + esc(C.direccion) + "</a></div></div>" +
      '<div id="bloque-envio">' +
      campo("calle", "Calle y número", '<input class="input" id="f-calle" name="calle" autocomplete="address-line1" placeholder="Ej: San Martín 1234" value="' + esc(form.calle) + '">') +
      campo("barrio", 'Barrio <span class="opcional">(opcional)</span>', '<input class="input" id="f-barrio" name="barrio" placeholder="Ej: Centro" value="' + esc(form.barrio) + '">') +
      campo("piso", 'Piso / depto <span class="opcional">(opcional)</span>', '<input class="input" id="f-piso" name="piso" autocomplete="address-line2" placeholder="Ej: 2 B" value="' + esc(form.piso) + '">') +
      campo("referencias", 'Referencias / entre calles <span class="opcional">(opcional)</span>', '<input class="input" id="f-referencias" name="referencias" placeholder="Ej: entre Mendoza y Corrientes, portón negro" value="' + esc(form.referencias) + '">') +
      '<div class="campo" id="bloque-ubicacion"></div>' +
      '<div class="caja info">' + (typeof C.costoEnvio === "number" ? "Costo de envío: " + $$(C.costoEnvio) + "." : "El costo de envío te lo confirma " + esc(C.nombre) + " por WhatsApp.") +
      (C.zonaCobertura ? " Zona de cobertura: " + esc(C.zonaCobertura) + "." : "") + "</div>" +
      "</div></section>";

    h += '<section class="seccion-form"><h3>¿Para cuándo?</h3>';
    if (est.abierto) {
      h += '<div class="caja info"><strong>Estamos abiertos.</strong> Los pedidos salen por orden de llegada.</div>';
    } else {
      h += '<div class="caja alerta"><strong>El local está cerrado ahora</strong> (' + esc(est.texto) + "). Elegí un horario estimado y lo preparamos para cuando abramos.</div>";
    }
    h += '<div id="bloque-turno">';
    if (dias.length) {
      if (form.turno && !T.buscarTurno(C, ahora(), form.turno)) form.turno = "";
      h += campo("turno", "Horario estimado", '<select class="input" id="f-turno" name="turno"><option value="">Elegí un rango horario</option>' +
        dias.map(function (d) {
          return '<optgroup label="' + esc(d.etiqueta) + '">' + d.franjas.map(function (f) {
            return '<option value="' + esc(f.valor) + '"' + (f.valor === form.turno ? " selected" : "") + ">" + esc(T.textoTurno(f)) + "</option>";
          }).join("") + "</optgroup>";
        }).join("") + "</select>",
        "Es un horario aproximado: puede variar según la demanda." + (dias[0].offset === 0 ? "" : " Hoy ya no quedan horarios: te ofrecemos el próximo día de atención."));
    } else {
      h += '<div class="caja alerta">No hay horarios disponibles para programar.</div>';
    }
    h += "</div></section>";

    h += '<section class="seccion-form"><h3>¿Cómo pagás?</h3>' +
      '<fieldset class="toggle tres" aria-describedby="err-metodo"><legend>Forma de pago</legend>' +
      C.metodosPago.map(function (m) { return opcion("metodo", m, m, ""); }).join("") + "</fieldset>" +
      '<p class="error" id="err-metodo" hidden></p>' +
      (C.aliasTransferencia ? '<div class="caja info" id="bloque-alias">Alias / CBU para transferir: <strong>' + esc(C.aliasTransferencia) + "</strong></div>" : "") +
      '<div id="bloque-efectivo">' +
      '<label class="check"><input type="checkbox" name="pagoJusto"' + (form.pagoJusto ? " checked" : "") + "><span>Pago justo (sin vuelto)</span></label>" +
      '<div id="bloque-monto">' + campo("monto", "¿Con cuánto pagás?", '<input class="input" id="f-monto" name="monto" inputmode="numeric" placeholder="Ej: 20000" value="' + esc(form.monto) + '">') +
      '<p class="ayuda" id="txt-vuelto" aria-live="polite"></p></div></div></section>';

    h += '<section class="seccion-form"><h3>Comentarios</h3>' +
      campo("comentarios", 'Comentarios del pedido <span class="opcional">(opcional)</span>', '<textarea class="input" id="f-comentarios" name="comentarios" maxlength="300" placeholder="Ej: tocar timbre 2B">' + esc(form.comentarios) + "</textarea>",
        "⚠️ " + C.textoAlergias) + "</section>";

    $("sheet-body").innerHTML = h;
    $("sheet-foot").innerHTML = '<button type="button" class="btn btn-primary btn-block" data-action="ir-resumen">Revisar pedido</button>';
    actualizarDatos();
  }

  function campo(nombre, label, control, ayuda) {
    var html = control.replace(/^<(input|select|textarea)/, '<$1 aria-describedby="err-' + nombre + (ayuda ? " ayuda-" + nombre : "") + '"');
    return '<div class="campo"><label for="f-' + nombre + '">' + label + "</label>" + html +
      (ayuda ? '<p class="ayuda" id="ayuda-' + nombre + '">' + esc(ayuda) + "</p>" : "") +
      '<p class="error" id="err-' + nombre + '" hidden></p></div>';
  }

  function opcion(nombre, valor, titulo, sub, deshabilitado) {
    return '<label class="opcion"><input type="radio" name="' + nombre + '" value="' + esc(valor) + '"' +
      (form[nombre] === valor ? " checked" : "") + (deshabilitado ? " disabled" : "") + "><span>" + esc(titulo) +
      (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span></label>";
  }

  // Muestra/oculta bloques del formulario según lo elegido, sin re-renderizar los inputs.
  function actualizarDatos() {
    $("bloque-envio").hidden = form.modalidad !== "envio";
    $("bloque-retiro").hidden = form.modalidad !== "retiro";
    $("bloque-turno").hidden = form.cuando !== "programado";
    var esEfectivo = form.metodo === "Efectivo";
    $("bloque-efectivo").hidden = !esEfectivo;
    $("bloque-monto").hidden = form.pagoJusto;
    if ($("bloque-alias")) $("bloque-alias").hidden = form.metodo !== "Transferencia";

    var u = $("bloque-ubicacion");
    if (form.ubicacion) {
      u.innerHTML = '<p class="ubicacion-ok">✓ Ubicación agregada (<a href="' + esc(form.ubicacion) + '" target="_blank" rel="noopener">ver en el mapa</a>)</p>' +
        '<button type="button" class="btn-link" data-action="quitar-ubicacion">Quitar ubicación</button>';
    } else if ("geolocation" in navigator) {
      u.innerHTML = '<button type="button" class="btn btn-ghost" data-action="ubicacion"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>Usar mi ubicación</button>' +
        '<p class="ayuda" id="txt-ubicacion">Opcional: suma un link de Google Maps al pedido.</p>';
    } else {
      u.innerHTML = "";
    }

    var t = T.calcularTotales(C, lineas(), form.modalidad);
    var txt = $("txt-vuelto");
    var monto = T.parsearMonto(form.monto);
    if (!isNaN(monto) && monto >= t.total) {
      txt.innerHTML = 'Total ' + $$(t.total) + (t.envioAConfirmar ? " (+ envío)" : "") + ' · Vuelto: <span class="vuelto">' + $$(monto - t.total) + "</span>";
    } else {
      txt.textContent = "Total a pagar: " + $$(t.total) + (t.envioAConfirmar ? " + envío a confirmar" : "");
    }
  }

  function pedirUbicacion() {
    var txt = $("txt-ubicacion");
    if (txt) txt.textContent = "Buscando tu ubicación…";
    navigator.geolocation.getCurrentPosition(function (pos) {
      form.ubicacion = "https://maps.google.com/?q=" + pos.coords.latitude.toFixed(6) + "," + pos.coords.longitude.toFixed(6);
      if (vista === "datos") actualizarDatos();
    }, function (err) {
      var t = $("txt-ubicacion");
      if (t) t.textContent = err.code === 1
        ? "No diste permiso para usar tu ubicación. Podés seguir sin ella."
        : "No pudimos obtener tu ubicación. Podés seguir sin ella.";
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  function validar() {
    var e = {};
    var est = T.estadoLocal(C, ahora());
    if (!carrito.length) e.carrito = "Tu pedido está vacío.";
    if (form.nombre.trim().length < 3) e.nombre = "Completá tu nombre y apellido.";
    if (!form.telefono.trim()) e.telefono = "Completá tu teléfono.";
    else if (!T.normalizarTelefono(form.telefono)) e.telefono = "Revisá el teléfono: tiene que tener característica y número (ej: 353 4123456).";
    if (form.modalidad === "envio" && form.calle.trim().length < 3) e.calle = "Completá tu dirección (calle y número).";
    else if (form.modalidad === "envio" && !/\d/.test(form.calle)) e.calle = "Agregá la altura de la calle (el número).";
    form.cuando = est.abierto ? "asap" : "programado";
    if (form.cuando === "programado") {
      if (!form.turno) e.turno = "Elegí un rango horario.";
      else if (!T.buscarTurno(C, ahora(), form.turno)) e.turno = "Ese horario ya no está disponible. Elegí otro.";
    }
    if (!form.metodo) e.metodo = "Elegí una forma de pago.";
    if (form.metodo === "Efectivo" && !form.pagoJusto) {
      var t = T.calcularTotales(C, lineas(), form.modalidad);
      var monto = T.parsearMonto(form.monto);
      if (isNaN(monto)) e.monto = "Decinos con cuánto pagás, o marcá \"Pago justo\".";
      else if (monto < t.total) e.monto = "El monto tiene que ser igual o mayor al total (" + $$(t.total) + ").";
    }
    return e;
  }

  function mostrarErrores() {
    var primero = null;
    ["nombre", "telefono", "calle", "turno", "metodo", "monto"].forEach(function (k) {
      var el = $("err-" + k);
      var input = $("f-" + k);
      if (!el) return;
      el.hidden = !errores[k];
      el.textContent = errores[k] || "";
      if (input) input.setAttribute("aria-invalid", errores[k] ? "true" : "false");
      if (errores[k] && !primero) primero = input || el.previousElementSibling;
    });
    if (primero) {
      primero.scrollIntoView({ block: "center" });
      if (primero.focus) primero.focus({ preventScroll: true });
    }
  }

  // ---------- Resumen y envío ----------

  function armarPedido() {
    var ls = lineas();
    var cuando = { tipo: "asap" };
    if (form.cuando === "programado") cuando = { tipo: "programado", turno: T.buscarTurno(C, ahora(), form.turno) };
    return {
      cliente: { nombre: form.nombre, telefono: T.normalizarTelefono(form.telefono) },
      modalidad: form.modalidad,
      direccion: { calle: form.calle, barrio: form.barrio, piso: form.piso, referencias: form.referencias, ubicacion: form.ubicacion },
      cuando: cuando,
      lineas: ls,
      totales: T.calcularTotales(C, ls, form.modalidad),
      pago: { metodo: form.metodo, pagoJusto: form.pagoJusto, montoEfectivo: T.parsearMonto(form.monto) },
      comentarios: form.comentarios
    };
  }

  function pintarResumen() {
    var p = armarPedido();
    var t = p.totales;
    var est = T.estadoLocal(C, ahora());
    var h = "";

    if (!est.abierto && p.cuando.tipo === "programado") {
      h += '<div class="caja alerta">El local está cerrado ahora. Horario estimado: <strong>' + esc(T.textoTurno(p.cuando.turno)) + "</strong>.</div>";
    }

    h += '<div class="resumen-bloque"><h3>Pedido <button type="button" class="mini-link" data-action="editar-carrito">Editar</button></h3><ul class="items">' +
      p.lineas.map(function (l) {
        return '<li class="item"><div class="item-top"><div><div class="item-nombre">' + l.cantidad + "x " + esc(l.nombre) + "</div>" +
          l.detalles.map(function (d) { return '<p class="item-det">– ' + esc(d) + "</p>"; }).join("") +
          '</div><div class="item-precio">' + $$(l.total) + "</div></div></li>";
      }).join("") + "</ul>" +
      '<dl class="totales"><div><dt>Subtotal</dt><dd>' + $$(t.subtotal) + "</dd></div>" +
      (t.esEnvio ? "<div><dt>Envío</dt><dd>" + (t.envioAConfirmar ? "A confirmar por " + esc(C.nombre) : $$(t.envio)) + "</dd></div>" : "") +
      '<div class="total"><dt>Total</dt><dd>' + $$(t.total) + "</dd></div></dl>" +
      (t.envioAConfirmar ? '<p class="ayuda">El total no incluye el envío.</p>' : "") + "</div>";

    var dir = "";
    if (p.modalidad === "envio") {
      // Misma línea de dirección que el mensaje de WhatsApp
      var lineaDir = T.construirMensaje(C, p).split("\n").filter(function (x) { return x.indexOf("📍") === 0; })[0] || "";
      dir = "<p>Envío a " + esc(lineaDir.replace("📍 *Dirección:* ", "")) + "</p>" +
        (p.direccion.referencias ? '<p class="item-det">Ref: ' + esc(p.direccion.referencias) + "</p>" : "") +
        (p.direccion.ubicacion ? '<p class="item-det">Con ubicación de Google Maps</p>' : "");
    } else {
      dir = "<p>Retiro en el local</p><p class=\"item-det\">" + esc(C.direccion) + "</p>";
    }
    h += '<div class="resumen-bloque"><h3>Entrega <button type="button" class="mini-link" data-action="editar-datos">Editar</button></h3>' + dir +
      "<p>" + (p.cuando.tipo === "programado" ? "Horario estimado: " + esc(T.textoTurno(p.cuando.turno)) : "Por orden de llegada") + "</p></div>";

    var pago = esc(p.pago.metodo);
    if (p.pago.metodo === "Efectivo") {
      pago += p.pago.pagoJusto ? " — pago justo" : " — pagás con " + $$(p.pago.montoEfectivo) + ' (vuelto <span class="vuelto">' + $$(p.pago.montoEfectivo - t.total) + "</span>)";
    }
    h += '<div class="resumen-bloque"><h3>Pago y contacto <button type="button" class="mini-link" data-action="editar-datos">Editar</button></h3><p>' + pago + "</p>" +
      "<p>" + esc(p.cliente.nombre) + " · " + esc(p.cliente.telefono) + "</p>" +
      (p.comentarios.trim() ? '<p class="item-det">Comentarios: ' + esc(p.comentarios.trim()) + "</p>" : "") + "</div>";

    h += '<details class="preview"><summary>Ver el mensaje que se va a enviar</summary><pre>' + esc(T.construirMensaje(C, p)) + "</pre></details>";

    $("sheet-body").innerHTML = h;
    $("sheet-foot").innerHTML = '<p class="foot-ayuda">Se abre WhatsApp con el pedido listo: solo tenés que tocar enviar.</p>' +
      '<button type="button" class="btn btn-wa btn-block" data-action="enviar">' + ICON_WA + "Enviar pedido por WhatsApp</button>";
  }

  function enviar() {
    errores = validar();
    if (Object.keys(errores).length) {
      irA("datos");
      errores = validar();
      mostrarErrores();
      toast("Revisá los datos marcados");
      return;
    }
    var msg = T.construirMensaje(C, armarPedido());
    ultimoLink = T.linkWhatsApp(C, msg);
    var w = window.open(ultimoLink, "_blank");
    if (w) { try { w.opener = null; } catch (e) { /* noop */ } }
    else window.location.href = ultimoLink;

    carrito = [];
    guardarCarrito();
    form.comentarios = "";
    form.monto = "";
    form.pagoJusto = false;
    form.turno = "";
    form.cuando = "asap";
    pintarBarra();
    irA("enviado");
  }

  function pintarEnviado() {
    $("sheet-body").innerHTML = '<div class="enviado"><div class="icono-ok"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></div>' +
      "<h3>¡Ya casi!</h3><p>Abrimos WhatsApp con tu pedido. Tocá <strong>enviar</strong> en WhatsApp para que le llegue a " + esc(C.nombre) +
      ". Te van a confirmar por ahí.</p>" +
      '<div class="acciones-col"><a class="btn btn-wa btn-block" href="' + esc(ultimoLink) + '" target="_blank" rel="noopener">' + ICON_WA + "Volver a abrir WhatsApp</a>" +
      '<button type="button" class="btn btn-ghost btn-block" data-action="otro-pedido">Hacer otro pedido</button></div></div>';
    $("sheet-foot").innerHTML = "";
  }

  // ---------- Eventos del sheet ----------

  function clickSheet(e) {
    var b = e.target.closest("[data-action]");
    if (!b || b.disabled) return;
    var a = b.dataset.action;
    var id = b.dataset.id;

    switch (a) {
      case "cerrar":
      case "otro-pedido":
        cerrarSheet();
        if (a === "otro-pedido") window.scrollTo({ top: 0 });
        break;
      case "tamanio":
        prod.varianteId = b.dataset.var;
        tamanioCard[prod.productoId] = b.dataset.var;
        pintarProducto();
        break;
      case "combo-mas": cambiarCombo(id, true); pintarProducto(); break;
      case "combo-menos": cambiarCombo(id, false); pintarProducto(); break;
      case "cant-mas": prod.cantidad = Math.min(99, prod.cantidad + 1); pintarProducto(); break;
      case "cant-menos": prod.cantidad = Math.max(1, prod.cantidad - 1); pintarProducto(); break;
      case "agregar":
        var it = itemDeProd();
        if (!T.resolverItem(C, idx, it).valido) return;
        agregarAlCarrito(it);
        cerrarSheet();
        toast("Agregado a tu pedido");
        break;
      case "item-mas":
      case "item-menos":
        var item = buscarItem(id);
        if (!item) return;
        item.cantidad = Math.max(1, Math.min(99, item.cantidad + (a === "item-mas" ? 1 : -1)));
        guardarCarrito(); pintarBarra(); pintarCarrito();
        break;
      case "eliminar":
        carrito = carrito.filter(function (x) { return x.uid !== id; });
        guardarCarrito(); pintarBarra(); pintarCarrito();
        toast("Producto eliminado");
        break;
      case "ir-datos":
        if (!carrito.length) return;
        irA("datos");
        break;
      case "ir-resumen":
        errores = validar();
        if (Object.keys(errores).length) { mostrarErrores(); return; }
        guardarCliente();
        irA("resumen");
        break;
      case "editar-carrito": irA("carrito"); break;
      case "editar-datos": irA("datos"); break;
      case "ubicacion": pedirUbicacion(); break;
      case "quitar-ubicacion": form.ubicacion = ""; actualizarDatos(); break;
      case "enviar": enviar(); break;
    }
  }

  function inputSheet(e) {
    var el = e.target;
    if (el.dataset.prod === "aclaracion") { prod.aclaracion = el.value; return; }
    if (el.dataset.agregado) {
      var aid = el.dataset.agregado;
      prod.agregados = prod.agregados.filter(function (x) { return x !== aid; });
      if (el.checked) prod.agregados.push(aid);
      if (e.type === "change") pintarProducto();
      return;
    }
    if (el.dataset.acl) {
      var item = buscarItem(el.dataset.acl);
      if (item) {
        var v = el.value.trim();
        if (v) item.aclaracion = v; else delete item.aclaracion;
        guardarCarrito();
      }
      return;
    }
    if (vista !== "datos" || !el.name || !(el.name in form)) return;
    if (el.type === "checkbox") form[el.name] = el.checked;
    else if (el.type === "radio") { if (el.checked) form[el.name] = el.value; }
    else form[el.name] = el.value;

    if (errores[el.name] && e.type === "change") {
      delete errores[el.name];
      var err = $("err-" + el.name);
      if (err) err.hidden = true;
      el.setAttribute("aria-invalid", "false");
    }
    if (el.name === "pagoJusto" && errores.monto) { delete errores.monto; $("err-monto").hidden = true; }
    if (CAMPOS_CLIENTE.indexOf(el.name) > -1) guardarCliente();
    actualizarDatos();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
