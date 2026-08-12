const fs = require("fs");
const path = require("path");

const raiz = path.resolve(__dirname, "..");
const rutaVersion = path.join(raiz, "public", "version.json");
const rutaApp = path.join(raiz, "src", "App.js");

const datosVersion = JSON.parse(fs.readFileSync(rutaVersion, "utf8"));
const version = String(datosVersion.version || "").trim();

if (!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(version)) {
  throw new Error(`Versión inválida en public/version.json: ${version || "vacía"}`);
}

const contenidoApp = fs.readFileSync(rutaApp, "utf8");
const patronVersion = /const APP_VERSION = "[^"]+";/;

if (!patronVersion.test(contenidoApp)) {
  throw new Error("No se encontró APP_VERSION en src/App.js");
}

const contenidoActualizado = contenidoApp.replace(
  patronVersion,
  `const APP_VERSION = "${version}";`
);

if (contenidoActualizado !== contenidoApp) {
  fs.writeFileSync(rutaApp, contenidoActualizado, "utf8");
  console.log(`APP_VERSION sincronizada: ${version}`);
} else {
  console.log(`APP_VERSION ya estaba sincronizada: ${version}`);
}
