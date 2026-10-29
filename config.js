/*
 * Configuración de Teppan — todo lo editable del local está acá.
 * Los productos y precios están en menu.json.
 */
window.TEPPAN_CONFIG = {
  nombre: "Teppan",
  bajada: "american sushi & street food — delivery",
  direccion: "Buenos Aires 599-501, X5900 Villa María, Córdoba, Argentina",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Buenos+Aires+599+Villa+Mar%C3%ADa+C%C3%B3rdoba",
  instagram: "https://instagram.com/teppansyt",
  instagramUsuario: "@teppansyt",

  // WhatsApp que recibe los pedidos (confirmado). Solo dígitos, con código de país: 54 9 + característica + número.
  whatsapp: "5493534083326",
  telefonoVisible: "+54 9 3534 08-3326",

  zonaHoraria: "America/Argentina/Cordoba",

  // Horario de atención por día. null = cerrado.
  // El cierre tiene que ser posterior a la apertura (no se soporta pasar la medianoche).
  horarios: {
    lunes: null,
    martes: { abre: "19:00", cierra: "23:00" },
    miercoles: { abre: "19:00", cierra: "23:00" },
    jueves: { abre: "19:00", cierra: "23:00" },
    viernes: { abre: "19:00", cierra: "23:00" },
    sabado: { abre: "19:00", cierra: "23:00" },
    domingo: { abre: "19:00", cierra: "23:00" }
  },

  // Pedidos programados: franjas cada X minutos, desde la apertura hasta antes del cierre.
  intervaloMinutos: 15,
  // Ancho del rango horario estimado que se muestra (21:30 a 22:00 = 30 minutos).
  rangoHorarioMinutos: 30,
  // Anticipación mínima para un horario programado de hoy (en minutos desde ahora).
  anticipacionMinutos: 30,

  // TODO(confirmar con Teppan): costo de envío y zona de cobertura.
  // null = "a confirmar por Teppan" (el total no lo incluye). Número = se suma al total. Ej: 2500
  costoEnvio: null,
  zonaCobertura: null, // Ej: "Villa María y Villa Nueva". null = no se muestra.

  // TODO(confirmar con Teppan): métodos de pago aceptados.
  // "Efectivo" activa el cálculo de vuelto.
  metodosPago: ["Efectivo", "Transferencia", "Mercado Pago"],
  // TODO(confirmar con Teppan): alias/CBU para transferencia. null = no se muestra.
  aliasTransferencia: null,

  textoAlergias:
    "Si tenés alergias alimentarias, avisanos antes de ordenar. Los platos pueden contener o estar en contacto con alérgenos comunes.",

  // Combinado a elección (constructor de piezas)
  combinadoEleccion: {
    categoriaVariedades: "rolls", // de qué categoría salen las variedades elegibles
    paso: 5, // el stepper sube/baja de a 5 piezas
    minPorVariedad: 5,
    maxPorVariedad: 10
  },

  // Agregados para ensaladas
  categoriaAgregados: "agregados",
  // TODO(confirmar con Teppan): ¿se pueden pedir agregados sueltos, sin ensalada?
  permitirAgregadosSueltos: false

  // TODO(confirmar con Teppan): cuántas piezas trae cada roll individual (la carta no lo indica).
  // TODO(confirmar con Teppan): precios de Combinado Teppan (20 pzs $37.000 vs 30 pzs $41.000)
  //   y Combinado Street (30 pzs $44.000 vs 45 pzs $54.000): verificar que no sea un error de carga.
};
