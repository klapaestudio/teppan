/*
 * Intro: el logo se pinta con aerosol (js/aerosol.js) y después aparecen la pregunta y el botón.
 * Se reproduce cada vez que se carga o se recarga la página.
 * Con "reducir movimiento" activado, aparece el logo terminado sin animar.
 */
(function () {
  "use strict";

  var intro = document.getElementById("intro");
  if (!intro) return;

  var boton = document.getElementById("intro-entrar");
  var reducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var spray = window.TeppanSpray; // no existe si el navegador no tiene WebGL
  var textoVisible = false;

  function cerrar() {
    intro.classList.add("saliendo");
    document.documentElement.classList.remove("intro-abierta");
    setTimeout(function () { intro.remove(); }, 450);
    var carta = document.getElementById("carta");
    if (carta) carta.focus({ preventScroll: true });
  }

  boton.addEventListener("click", cerrar);
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape" && document.getElementById("intro")) {
      document.removeEventListener("keydown", esc);
      cerrar();
    }
  });

  function mostrarTexto() {
    if (textoVisible) return;
    textoVisible = true;
    intro.classList.add("listo");
    setTimeout(function () { boton.focus({ preventScroll: true }); }, 700);
  }

  // Sin WebGL: logo quieto.
  function logoQuieto() {
    var caja = intro.querySelector(".intro-logo");
    caja.innerHTML = '<img src="img/logo.png" alt="Teppan">';
    caja.classList.add("quieto");
    mostrarTexto();
  }

  if (!spray) {
    logoQuieto();
    return;
  }

  // Por si algo falla al cargar, la pregunta y el botón aparecen igual.
  setTimeout(mostrarTexto, 6000);

  spray.ready.then(function () {
    if (reducido) {
      spray.render(spray.duration);
      mostrarTexto();
      return;
    }
    spray.onComplete = mostrarTexto;
    spray.play();
  });
})();
