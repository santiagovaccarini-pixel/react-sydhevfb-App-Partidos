const crypto = require("crypto");
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

// La página de inicio no se lista por su nombre de archivo: el servidor lo
// redirige a "/" y una respuesta redirigida no sirve para abrir la app sin
// señal. "/" ya está en la lista.
const sueltos = [
  "/manifest.json",
  "/icono-app-192.png",
  "/icono-app-512.png",
  "/icono-app-180.png",
  // Las fotos del portal: son lo primero que se ve, también sin señal.
  "/portal/partido.webp",
  "/portal/flujo.webp",
  "/portal/partido-parada.webp",
  "/portal/flujo-parada.webp",
  "/portal/lesiones.webp",
  "/portal/lesiones-parada.webp",
];

// Un archivo que falte dejaría la app sin esa parte cuando no hay señal, y
// nadie se enteraría hasta estar en la cancha: mejor que falle la compilación.
const faltantes = sueltos.filter(
  (archivo) => !fs.existsSync(path.join(dist, archivo.slice(1))),
);
if (faltantes.length) {
  throw new Error(`Faltan en dist/ archivos de la precarga: ${faltantes.join(", ")}`);
}

// "/" es lo que pide el navegador al abrir la app instalada.
const precarga = ["/", ...sueltos, ...archivosDeAssets];

// El nombre del cache lleva la versión y una huella de la lista: así una
// compilación distinta con la misma versión también estrena cache y el service
// worker borra el anterior al activarse.
const huella = crypto
  .createHash("sha256")
  .update(precarga.join("\n"))
  .digest("hex")
  .slice(0, 8);
const nombreCache = `registro-partido-${version}-${huella}`;

const contenido = fs
  .readFileSync(rutaSw, "utf8")
  .replace('"__CACHE__"', JSON.stringify(nombreCache))
  .replace('["__PRECARGA__"]', JSON.stringify(precarga));

if (contenido.includes("__CACHE__") || contenido.includes("__PRECARGA__")) {
  throw new Error("No se pudieron reemplazar las marcas en dist/sw.js");
}

fs.writeFileSync(rutaSw, contenido);

console.log(
  `Service worker listo: ${precarga.length} archivos, cache ${nombreCache}`,
);
