import { autenticarCookieOpenField } from "../../lib/openfieldAuth.js";
import {
  ACTIVIDAD_PRUEBA,
  abrirNavegador,
  capturarPantalla,
  cerrarNavegador,
  clasificarErrorNavegador,
  iniciarSesionCatapult,
  leerBodyJson,
  resumirError,
  textoSeguro,
} from "../../lib/catapultCloud.js";
import { describirAutorizacion } from "../../lib/catapultInspect.js";
import {
  cabeceraCookies,
  candidatosInternos,
  extraerTokenOauth,
  resumirInterno,
} from "../../lib/catapultInternal.js";
import { describirCuerpo } from "../../lib/openfieldProbe.js";

export const config = {
  maxDuration: 60,
};

const TIMEOUT_INTERNO_MS = 9000;

// Prueba del pase interno, solo lectura: inicia sesión en Catapult, captura
// el access_token que devuelve /oauth/token apenas llega (antes de que el
// editor pueda desloguearse), cierra el navegador y usa ese pase desde el
// servidor para leer 26-05 T por los servicios internos. Solo GET. El pase
// nunca se devuelve ni se guarda: se usa y se descarta.
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

  const body = leerBodyJson(request);
  const username = textoSeguro(body?.username, 254);
  const password = textoSeguro(body?.password, 512);

  if (!username || !password) {
    return response.status(400).json({
      ok: false,
      error: "Completá usuario y contraseña de Catapult.",
    });
  }

  let nav = null;
  let etapa = "inicio";
  let pase = null;
  let cookies = [];
  let pantalla = null;

  try {
    etapa = "lanzar-navegador";
    nav = await abrirNavegador();
    const { page, context } = nav;

    page.on("response", async (res) => {
      try {
        const url = new URL(res.url());
        if (!/\/oauth\/token$/.test(url.pathname)) return;
        if (res.status() < 200 || res.status() >= 300) return;
        const extraido = extraerTokenOauth(JSON.parse(await res.text()));
        if (extraido) pase = extraido;
      } catch {
        // Respuesta no legible: se sigue esperando otra.
      }
    });

    etapa = "login";
    const login = await iniciarSesionCatapult(page, { username, password });

    if (!login.ok) {
      return response.status(login.status).json({
        ok: false,
        code: login.code,
        error: login.error,
        etapa,
        captura: await capturarPantalla(page),
      });
    }

    // La respuesta de /oauth/token suele llegar antes de que termine el login;
    // por las dudas se le da un margen corto.
    etapa = "capturar-pase";
    for (let intento = 0; intento < 10 && !pase; intento += 1) {
      await page.waitForTimeout(300);
    }

    cookies = await context.cookies().catch(() => []);
    pantalla = await capturarPantalla(page);

    await cerrarNavegador(nav);
    nav = null;

    etapa = "sondear-interno";
    const candidatos = candidatosInternos({
      activityId: ACTIVIDAD_PRUEBA.id,
      backendBase: process.env.OPENFIELD_BACKEND_BASE_URL,
      activityServiceBase: process.env.OPENFIELD_ACTIVITY_SERVICE_BASE_URL,
    });

    const resultados = await Promise.all(
      candidatos.map(async (candidato) => {
        const url = new URL(candidato.url);
        const headers = { Accept: "application/json" };

        if (pase) headers.Authorization = `${pase.tokenType} ${pase.accessToken}`;

        if (candidato.conCookies) {
          const cabecera = cabeceraCookies(cookies, url.hostname);
          if (cabecera) headers.Cookie = cabecera;
          const xsrf = cookies.find((cookie) => cookie.name === "XSRF-TOKEN");
          if (xsrf?.value) headers["X-XSRF-TOKEN"] = decodeURIComponent(xsrf.value);
        }

        const controlador = new AbortController();
        const timeout = setTimeout(() => controlador.abort(), TIMEOUT_INTERNO_MS);
        const inicio = Date.now();

        try {
          const upstream = await fetch(candidato.url, {
            method: "GET",
            headers,
            signal: controlador.signal,
            redirect: "manual",
          });
          const texto = await upstream.text();

          return {
            clave: candidato.clave,
            descripcion: candidato.descripcion,
            metodo: "GET",
            host: url.hostname,
            path: url.pathname,
            conCookies: candidato.conCookies,
            status: upstream.status,
            ms: Date.now() - inicio,
            contentType: upstream.headers.get("content-type") || "",
            cuerpo: describirCuerpo(texto),
          };
        } catch (error) {
          return {
            clave: candidato.clave,
            descripcion: candidato.descripcion,
            metodo: "GET",
            host: url.hostname,
            path: url.pathname,
            conCookies: candidato.conCookies,
            status: 0,
            ms: Date.now() - inicio,
            contentType: "",
            cuerpo: null,
            error: error?.name === "AbortError" ? "timeout" : "network",
          };
        } finally {
          clearTimeout(timeout);
        }
      }),
    );

    // Describe el pase sin exponerlo: esquema, formato, vigencia y claims.
    const descripcionPase = pase
      ? describirAutorizacion({ authorization: `${pase.tokenType} ${pase.accessToken}` })
      : null;

    return response.status(200).json({
      ok: true,
      result: "cloud-token-probed",
      mode: "read-only-token-probe",
      activity: ACTIVIDAD_PRUEBA,
      pase: pase
        ? {
            capturado: true,
            tipo: pase.tokenType,
            duraSegundos: pase.expiresIn,
            tieneRefresh: pase.tieneRefresh,
            formato: descripcionPase?.formato || null,
            largo: descripcionPase?.largo || null,
            expira: descripcionPase?.expira || null,
            claims: descripcionPase?.claims || null,
            claimNombres: descripcionPase?.claimNombres || null,
          }
        : { capturado: false },
      cookies: cookies.map((cookie) => ({
        name: cookie.name,
        domain: cookie.domain,
        httpOnly: cookie.httpOnly,
      })),
      resultados,
      resumen: resumirInterno(resultados, { tokenCapturado: Boolean(pase) }),
      captura: pantalla,
      message:
        "Prueba del pase terminada. No se modificó ningún período y el pase no se guardó.",
    });
  } catch (error) {
    const { timeout } = clasificarErrorNavegador(error);
    const captura = pantalla || (await capturarPantalla(nav?.page));

    return response.status(timeout ? 504 : 502).json({
      ok: false,
      code: timeout ? "CATAPULT_TIMEOUT" : "CATAPULT_BROWSER_ERROR",
      error: timeout
        ? `Catapult demoró demasiado durante la prueba del pase (etapa: ${etapa}).`
        : `No se pudo completar la prueba del pase (etapa: ${etapa}).`,
      etapa,
      detalle: resumirError(error),
      captura,
    });
  } finally {
    await cerrarNavegador(nav);
  }
}
