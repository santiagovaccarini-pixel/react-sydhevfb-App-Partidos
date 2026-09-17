import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";
import { autenticarCookieOpenField } from "../../lib/openfieldAuth.js";

export const config = {
  maxDuration: 60,
};

const OPENFIELD_LOGIN_URL = "https://us.openfield.catapultsports.com/login";
const TEST_ACTIVITY_ID = "9dffa100-99e5-4ce6-921f-226e9e01e264";
const TEST_ACTIVITY_NAME = "26-05 T";
const TEST_EDITOR_URL = `https://us.openfield.catapultsports.com/editor/${TEST_ACTIVITY_ID}`;

const leerBody = (request) => {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body !== "string") return {};

  try {
    return JSON.parse(request.body);
  } catch {
    return {};
  }
};

const textoSeguro = (valor, maximo) => String(valor || "").trim().slice(0, maximo);

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
  const porRol = page.getByRole("button", { name: /log\s*in|login|sign\s*in|entrar|iniciar\s*sesión/i }).first();
  if ((await porRol.count()) > 0 && (await porRol.isVisible().catch(() => false))) {
    return porRol;
  }

  return primerLocatorVisible(page, ["button[type='submit']", "input[type='submit']"]);
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Cookie");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const auth = autenticarCookieOpenField(request);
  if (!auth.ok) {
    return response.status(auth.status).json({ ok: false, error: auth.error });
  }

  const body = leerBody(request);
  const username = textoSeguro(body?.username, 254);
  const password = textoSeguro(body?.password, 512);

  if (!username || !password) {
    return response.status(400).json({
      ok: false,
      error: "Completá usuario y contraseña de Catapult.",
    });
  }

  let browser = null;
  let context = null;
  const userDataDir = `/tmp/openfield-${randomUUID()}`;

  try {
    browser = await playwright.launch({
      args: [...chromium.args, `--user-data-dir=${userDataDir}`],
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "es-AR",
    });

    const page = await context.newPage();
    page.setDefaultTimeout(12000);

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
      return response.status(502).json({
        ok: false,
        code: "LOGIN_FORM_NOT_FOUND",
        error: "Catapult cambió la pantalla de acceso y la prueba no pudo localizar el formulario de login.",
      });
    }

    await campoUsuario.fill(username);
    await campoPassword.fill(password);

    await Promise.allSettled([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }),
      botonLogin.click(),
    ]);

    await page.waitForTimeout(1200);

    if (new URL(page.url()).pathname.startsWith("/login")) {
      return response.status(401).json({
        ok: false,
        code: "CATAPULT_LOGIN_REJECTED",
        error: "Catapult no aceptó las credenciales o pidió una validación adicional.",
      });
    }

    await page.goto(TEST_EDITOR_URL, {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });

    const actividadVisible = page.getByText(TEST_ACTIVITY_NAME, { exact: true }).first();
    await actividadVisible.waitFor({ state: "visible", timeout: 20000 });

    const urlActual = page.url();
    const llegoAlEditor = urlActual.includes(`/editor/${TEST_ACTIVITY_ID}`);

    if (!llegoAlEditor) {
      return response.status(502).json({
        ok: false,
        code: "EDITOR_NOT_REACHED",
        error: "Catapult inició sesión, pero la prueba no pudo confirmar el Editor de la actividad 26-05 T.",
      });
    }

    return response.status(200).json({
      ok: true,
      result: "catapult-login-verified",
      mode: "read-only-login-test",
      activity: {
        id: TEST_ACTIVITY_ID,
        name: TEST_ACTIVITY_NAME,
      },
      message: "Inicio de sesión validado y actividad 26-05 T abierta correctamente. No se modificó ningún período.",
    });
  } catch (error) {
    const timeout = /timeout/i.test(String(error?.name || "")) || /timeout/i.test(String(error?.message || ""));

    return response.status(timeout ? 504 : 502).json({
      ok: false,
      code: timeout ? "CATAPULT_TIMEOUT" : "CATAPULT_BROWSER_ERROR",
      error: timeout
        ? "Catapult demoró demasiado en responder durante la prueba de conexión."
        : "No se pudo completar la prueba de acceso automatizado a Catapult.",
    });
  } finally {
    try {
      if (context) await context.close();
    } catch {
      // Nada que hacer: evitamos que un cierre tardío oculte el resultado principal.
    }

    try {
      if (browser) await browser.close();
    } catch {
      // Nada que hacer.
    }

    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}
