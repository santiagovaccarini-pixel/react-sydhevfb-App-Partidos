import { autenticarCookieOpenField } from "../openfieldAuth.js";
import { resolverPase } from "../catapultAcceso.js";
import { ACTIVIDAD_PRUEBA, leerBodyJson, textoSeguro } from "../catapultCloud.js";
import { describirAutorizacion } from "../catapultInspect.js";
import { candidatosInternos, resumirInterno } from "../catapultInternal.js";
import { describirCuerpo } from "../openfieldProbe.js";

const TIMEOUT_INTERNO_MS = 9000;

// Verificación de acceso, solo lectura: consigue el pase de Catapult (con la
// cuenta guardada del usuario, o con usuario y contraseña si vienen en el
// pedido) y con él lee 26-05 T por los servicios internos. Solo GET. El pase
// nunca se devuelve.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Cookie, Authorization");

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

  const acceso = await resolverPase({ request, username, password });
  if (!acceso.ok) {
    return response.status(acceso.status || 502).json({
      ok: false,
      code: acceso.code || null,
      error: acceso.error,
      etapa: acceso.etapa || null,
      captura: acceso.captura || null,
    });
  }

  const pase = acceso.pase;
  const autorizacion = `${pase.tokenType || "Bearer"} ${pase.accessToken}`;

  // Sin navegador no hay cookies de sesión: se prueban solo las rutas con el pase.
  const candidatos = candidatosInternos({
    activityId: ACTIVIDAD_PRUEBA.id,
    backendBase: process.env.OPENFIELD_BACKEND_BASE_URL,
    activityServiceBase: process.env.OPENFIELD_ACTIVITY_SERVICE_BASE_URL,
  }).filter((candidato) => !candidato.conCookies);

  const resultados = await Promise.all(
    candidatos.map(async (candidato) => {
      const url = new URL(candidato.url);
      const controlador = new AbortController();
      const timeout = setTimeout(() => controlador.abort(), TIMEOUT_INTERNO_MS);
      const inicio = Date.now();
      const base = {
        clave: candidato.clave,
        descripcion: candidato.descripcion,
        metodo: "GET",
        host: url.hostname,
        path: url.pathname,
        conCookies: false,
      };

      try {
        const upstream = await fetch(candidato.url, {
          method: "GET",
          headers: { Accept: "application/json", Authorization: autorizacion },
          signal: controlador.signal,
          redirect: "manual",
        });
        const texto = await upstream.text();
        return {
          ...base,
          status: upstream.status,
          ms: Date.now() - inicio,
          contentType: upstream.headers.get("content-type") || "",
          cuerpo: describirCuerpo(texto),
        };
      } catch (error) {
        return {
          ...base,
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

  const descripcionPase = describirAutorizacion({ authorization: autorizacion });

  return response.status(200).json({
    ok: true,
    result: "cloud-token-probed",
    mode: "read-only-token-probe",
    activity: ACTIVIDAD_PRUEBA,
    usuario: acceso.usuario,
    origenPase: acceso.origen,
    pase: {
      capturado: true,
      tipo: pase.tokenType || "Bearer",
      formato: descripcionPase?.formato || null,
      largo: descripcionPase?.largo || null,
      expira: descripcionPase?.expira || pase.expira || null,
      claims: descripcionPase?.claims || null,
    },
    resultados,
    resumen: resumirInterno(resultados, { tokenCapturado: true }),
    message: "Acceso verificado. No se modificó ningún período y el pase no se mostró.",
  });
}
