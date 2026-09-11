const fs = require("fs");
const path = require("path");

// Completa el service worker con los archivos que acaba de generar la
// compilación. Se hace acá y no a mano porque los archivos llevan un hash en
// el nombre que cambia en cada build.

const raiz = path.resolve(__dirname, "..");
const dist = path.join(raiz, "dist");
const rutaSw = path.join(dist, "sw.js");

if (!fs.existsSync(rutaSw)) {
  throw new Error("No está dist/sw.js: ¿se compiló antes de correr esto?");
}

const version = String(
  JSON.parse(fs.readFileSync(path.join(raiz, "public", "version.json"), "utf8"))
    .version || "",
).trim();

if (!version) throw new Error("Versión vacía en public/version.json");

// Todo lo que haga falta para abrir la app sin red. Se listan los archivos
// reales del build en vez de escribirlos a mano, para que no se olvide ninguno.
const archivosDeAssets = fs.existsSync(path.join(dist, "assets"))
  ? fs
      .readdirSync(path.join(dist, "assets"))
      .map((nombre) => `/assets/${nombre}`)
  : [];

const sueltos = ["/index.html", "/manifest.json", "/cam-mark.svg"].filter(
  (archivo) => fs.existsSync(path.join(dist, archivo.slice(1))),
);

// "/" es lo que pide el navegador al abrir la app instalada.
const precarga = ["/", ...sueltos, ...archivosDeAssets];

const contenido = fs
  .readFileSync(rutaSw, "utf8")
  .replace('"__CACHE__"', JSON.stringify(`registro-partido-${version}`))
  .replace('["__PRECARGA__"]', JSON.stringify(precarga));

if (contenido.includes("__CACHE__") || contenido.includes("__PRECARGA__")) {
  throw new Error("No se pudieron reemplazar las marcas en dist/sw.js");
}

fs.writeFileSync(rutaSw, contenido);

console.log(
  `Service worker listo: ${precarga.length} archivos, cache registro-partido-${version}`,
);
