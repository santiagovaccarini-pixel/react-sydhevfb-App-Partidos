import { autenticarCookieOpenField } from "../openfieldAuth.js";
import {
  ACTIVIDAD_PRUEBA,
  abrirEditorActividad,
  abrirNavegador,
  capturarPantalla,
  cerrarNavegador,
  clasificarErrorNavegador,
  iniciarSesionCatapult,
  leerBodyJson,
  resumirError,
  textoSeguro,
} from "../catapultCloud.js";
import {
  TIPOS_RED,
  describirAutorizacion,
  describirEnvio,
  esHostAuth,
  esHostCatapult,
  resumirCapturas,
} from "../catapultInspect.js";
import { describirCuerpo } from "../openfieldProbe.js";

const MAX_SOLICITUDES = 200;
const MAX_CUERPO = 3_000_000;

// Inspección de solo lectura: entra al Cloud Editor con las credenciales del
// usuario, abre 26-05 T y anota qué pedidos hace el editor y con qué
// credencial. No hace ningún click dentro del editor. No guarda la
// contraseña ni el valor de ningún token o cookie: solo nombres y formas.
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

  const capturas = [];
  const porRequest = new Map();
  let nav = null;
  let etapa = "inicio";

  const limpiar = () => capturas.map(({ request: _omitido, ...resto }) => resto);

  try {
    etapa = "lanzar-navegador";
    nav = await abrirNavegador();
    const { page, context } = nav;

    page.on("request", (req) => {
      if (capturas.length >= MAX_SOLICITUDES) return;
      if (!TIPOS_RED.has(req.resourceType())) return;

      let url;
      try {
        url = new URL(req.url());
      } catch {
        return;
      }

      const headers = req.headers();
      const relevante = esHostCatapult(url.hostname) || esHostAuth(url.hostname);

      const entrada = {
        id: capturas.length + 1,
        etapa,
        metodo: req.method(),
        host: url.hostname,
        path: url.pathname.slice(0, 200),
        conQuery: Boolean(url.search),
        tipo: req.resourceType(),
        // Solo para hosts de Catapult o del proveedor de identidad; el resto
        // (analítica, CDNs) se lista sin detalle.
        headerNames: relevante ? Object.keys(headers).sort() : [],
        autorizacion: relevante ? describirAutorizacion(headers) : null,
        envio: relevante && req.method() !== "GET" ? describirEnvio(req.postData()) : null,
        status: null,
        responseType: null,
        cuerpo: null,
        request: req,
      };

      capturas.push(entrada);
      porRequest.set(req, entrada);
    });

    page.on("response", async (res) => {
      const entrada = porRequest.get(res.request());
      if (!entrada) return;

      entrada.status = res.status();
      const contentType = res.headers()["content-type"] || "";
      entrada.responseType = contentType.split(";")[0].trim();

      // La forma de la respuesta solo para lecturas de actividad del servicio
      // interno: claves y primer período, sin valores.
      if (
        esHostCatapult(entrada.host) &&
        /json/i.test(contentType) &&
        /activit/i.test(entrada.path)
      ) {
        try {
          const texto = await res.text();
          if (texto.length <= MAX_CUERPO) entrada.cuerpo = describirCuerpo(texto);
        } catch {
          // Cuerpo no disponible (redirección o descarte): se deja sin describir.
        }
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
        paginaActual: page.url(),
        captura: await capturarPantalla(page),
        solicitudes: limpiar(),
        resumen: resumirCapturas(limpiar()),
      });
    }

    etapa = "abrir-editor";
    const editor = await abrirEditorActividad(page, ACTIVIDAD_PRUEBA);

    etapa = "escuchar-red";
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    etapa = "leer-almacenamiento";
    const almacenamiento = await page
      .evaluate(() => ({
        localStorage: Object.keys(window.localStorage),
        sessionStorage: Object.keys(window.sessionStorage),
      }))
      .catch(() => ({ localStorage: [], sessionStorage: [] }));

    const cookies = (await context.cookies().catch(() => [])).map((cookie) => ({
      name: cookie.name,
      domain: cookie.domain,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      expires: cookie.expires > 0 ? new Date(cookie.expires * 1000).toISOString() : null,
    }));

    const captura = await capturarPantalla(page);
    const solicitudes = limpiar();

    return response.status(200).json({
      ok: true,
      result: "cloud-editor-inspected",
      mode: "read-only-inspection",
      activity: ACTIVIDAD_PRUEBA,
      editor: {
        alcanzado: editor.enEditor,
        nombreVisible: editor.nombreVisible,
        path: (() => {
          try {
            return new URL(editor.url).pathname;
          } catch {
            return "";
          }
        })(),
      },
      solicitudes,
      almacenamiento,
      cookies,
      captura,
      resumen: resumirCapturas(solicitudes),
      message:
        "Inspección terminada. No se modificó ningún período ni se guardó ninguna credencial.",
    });
  } catch (error) {
    const { timeout } = clasificarErrorNavegador(error);
    const captura = await capturarPantalla(nav?.page);

    return response.status(timeout ? 504 : 502).json({
      ok: false,
      code: timeout ? "CATAPULT_TIMEOUT" : "CATAPULT_BROWSER_ERROR",
      error: timeout
        ? `Catapult demoró demasiado en responder durante la inspección (etapa: ${etapa}).`
        : `No se pudo completar la inspección del Cloud Editor (etapa: ${etapa}).`,
      etapa,
      detalle: resumirError(error),
      paginaActual: (() => {
        try {
          return nav?.page ? nav.page.url() : null;
        } catch {
          return null;
        }
      })(),
      captura,
      solicitudes: limpiar(),
    });
  } finally {
    await cerrarNavegador(nav);
  }
}
