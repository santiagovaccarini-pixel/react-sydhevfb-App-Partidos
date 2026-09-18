// Navegación automatizada del Cloud Editor de Catapult (Playwright en Vercel).
// Solo login y navegación: acá no hay ninguna acción que cree, edite o borre.
// La usan cloud-login-test.js y cloud-editor-inspect.js.

import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";

export const OPENFIELD_LOGIN_URL = "https://us.openfield.catapultsports.com/login";
export const OPENFIELD_EDITOR_BASE = "https://us.openfield.catapultsports.com/editor";

// 26-05 T: la única actividad autorizada para pruebas.
export const ACTIVIDAD_PRUEBA = {
  id: "9dffa100-99e5-4ce6-921f-226e9e01e264",
  name: "26-05 T",
};

export const leerBodyJson = (request) => {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body !== "string") return {};

  try {
    return JSON.parse(request.body);
  } catch {
    return {};
  }
};

export const textoSeguro = (valor, maximo) => String(valor || "").trim().slice(0, maximo);

export const clasificarErrorNavegador = (error) => ({
  timeout:
    /timeout/i.test(String(error?.name || "")) || /timeout/i.test(String(error?.message || "")),
});

// Primeras líneas del error de Playwright (incluye su "call log"), sin el
// stack. Playwright no imprime los valores que se escriben en un campo, así
// que acá nunca aparece la contraseña.
export const resumirError = (error) => ({
  tipo: String(error?.name || "Error"),
  mensaje: String(error?.message || "")
    .split("\n")
    .filter((linea) => linea.trim())
    .slice(0, 6)
    .join(" · ")
    .slice(0, 600),
});

// Captura chica de lo que el navegador ve en ese momento: es lo que permite
// distinguir un captcha, un pedido de código o una pantalla inesperada.
export const capturarPantalla = async (page) => {
  if (!page) return null;

  try {
    const buffer = await page.screenshot({ type: "jpeg", quality: 35, timeout: 5000 });
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
};

export const abrirNavegador = async () => {
  // Sin GPU en serverless: evita que Chromium intente inicializar WebGL.
  if ("setGraphicsMode" in chromium) chromium.setGraphicsMode = false;

  // Playwright rechaza "--user-data-dir" como argumento de launch(): cada
  // corrida usa un perfil temporal propio que el navegador crea y descarta.
  const browser = await playwright.launch({
    args: [...chromium.args],
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "es-AR",
  });

  const page = await context.newPage();
  page.setDefaultTimeout(12000);

  return { browser, context, page };
};

export const cerrarNavegador = async (nav) => {
  if (!nav) return;

  try {
    if (nav.context) await nav.context.close();
  } catch {
    // Nada que hacer: evitamos que un cierre tardío oculte el resultado principal.
  }

  try {
    if (nav.browser) await nav.browser.close();
  } catch {
    // Nada que hacer.
  }
};

const primerLocatorVisible = async (page, selectores) => {
  for (const selector of selectores) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
      return locator;
    }
  }
  return null;
};

const botonLoginVisible = async (page) => {
  const porRol = page
    .getByRole("button", { name: /log\s*in|login|sign\s*in|entrar|iniciar\s*sesión/i })
    .first();
  if ((await porRol.count()) > 0 && (await porRol.isVisible().catch(() => false))) {
    return porRol;
  }

  return primerLocatorVisible(page, ["button[type='submit']", "input[type='submit']"]);
};

// Devuelve { ok: true } o { ok: false, status, code, error } sin lanzar.
export const iniciarSesionCatapult = async (page, { username, password }) => {
  await page.goto(OPENFIELD_LOGIN_URL, {
    waitUntil: "domcontentloaded",
    timeout: 25000,
  });

  const campoUsuario = await primerLocatorVisible(page, [
    "input[name='username']",
    "input[autocomplete='username']",
    "input[type='email']",
    "input[type='text']",
  ]);
  const campoPassword = await primerLocatorVisible(page, [
    "input[name='password']",
    "input[autocomplete='current-password']",
    "input[type='password']",
  ]);
  const botonLogin = await botonLoginVisible(page);

  if (!campoUsuario || !campoPassword || !botonLogin) {
    return {
      ok: false,
      status: 502,
      code: "LOGIN_FORM_NOT_FOUND",
      error:
        "Catapult cambió la pantalla de acceso y la prueba no pudo localizar el formulario de login.",
    };
  }

  await campoUsuario.fill(username);
  await campoPassword.fill(password);

  await Promise.allSettled([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }),
    botonLogin.click(),
  ]);

  await page.waitForTimeout(1200);

  if (new URL(page.url()).pathname.startsWith("/login")) {
    return {
      ok: false,
      status: 401,
      code: "CATAPULT_LOGIN_REJECTED",
      error: "Catapult no aceptó las credenciales o pidió una validación adicional.",
    };
  }

  return { ok: true };
};

// Abre el editor de una actividad y reporta qué se pudo confirmar, sin lanzar
// por el nombre: la red capturada sirve aunque el título no se haya visto.
export const abrirEditorActividad = async (page, { id, name }) => {
  await page.goto(`${OPENFIELD_EDITOR_BASE}/${id}`, {
    waitUntil: "domcontentloaded",
    timeout: 25000,
  });

  const nombreVisible = await page
    .getByText(name, { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);

  const url = page.url();

  return {
    url,
    enEditor: url.includes(`/editor/${id}`),
    nombreVisible,
  };
};
