// Servidor estático mínimo, sin dependencias. Local: `npm start`. En Railway usa la variable PORT.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};
// Solo se sirven estas carpetas/archivos (no server.js, package.json, etc.)
const PERMITIDOS = /^\/(index\.html|config\.js|menu\.json|css\/[\w.-]+|js\/[\w.-]+|img\/[\w.-]+)$/;

http
  .createServer((req, res) => {
    let url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/") url = "/index.html";
    if (!PERMITIDOS.test(url)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("No encontrado");
    }
    const archivo = path.join(ROOT, url);
    fs.readFile(archivo, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("No encontrado");
      }
      const ext = path.extname(archivo).toLowerCase();
      // Sin caché: el sitio es chico y así los cambios de precios, config o estilos se ven al instante.
      res.writeHead(200, {
        "Content-Type": TIPOS[ext] || "application/octet-stream",
        "Cache-Control": "no-cache"
      });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`Teppan corriendo en http://localhost:${PORT}`));
