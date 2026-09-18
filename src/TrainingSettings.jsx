import React, { useState } from "react";
import { ETIQUETAS_CLASIFICACION } from "../lib/openfieldProbe.js";
import "./training-settings.css";

const usuarioInicial = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("catapult_openfield_username") || "";
};

const ETIQUETAS_VEREDICTO = {
  "escritura-anunciada": "La API anuncia escritura",
  prohibido: "403: falta scope o el gateway oculta la ruta",
  "sin-escritura-anunciada": "Las rutas existen, sin escritura anunciada",
  "rutas-inexistentes": "Ninguna ruta existe",
  "token-rechazado": "Token rechazado",
  "sin-respuesta": "Sin respuesta",
  inconcluso: "Inconcluso",
  "sin-datos": "Sin datos",
};

const tonoVeredicto = (veredicto) => {
  if (veredicto === "escritura-anunciada") return "correcto";
  if (veredicto === "token-rechazado" || veredicto === "sin-respuesta") return "error";
  return "advertencia";
};

const tonoClasificacion = (clasificacion) => {
  if (clasificacion === "responde" || clasificacion === "metodo-no-permitido") return "correcto";
  if (clasificacion === "token-rechazado" || clasificacion === "sin-respuesta") return "error";
  return "advertencia";
};

// En el celular el UUID completo tapa lo importante: se muestra el patrón de la ruta.
const abreviarRuta = (ruta, sonda) => {
  let texto = String(ruta || "");
  if (sonda?.activityId) texto = texto.replace(sonda.activityId, "{actividad}");
  if (sonda?.periodId) texto = texto.replace(sonda.periodId, "{período}");
  return texto;
};

export default function TrainingSettings({ onVolverRegistro, onVolverModulos }) {
  const [username, setUsername] = useState(usuarioInicial);
  const [password, setPassword] = useState("");
  const [estado, setEstado] = useState("idle");
  const [mensaje, setMensaje] = useState("");

  const [estadoSonda, setEstadoSonda] = useState("idle");
  const [sonda, setSonda] = useState(null);
  const [errorSonda, setErrorSonda] = useState("");
  const [copia, setCopia] = useState("");

  const ejecutarSonda = async () => {
    setEstadoSonda("sondeando");
    setErrorSonda("");
    setCopia("");

    try {
      const respuesta = await fetch("/api/openfield/capability-probe", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const payload = await respuesta.json().catch(() => null);

      if (!respuesta.ok || !payload?.ok) {
        throw new Error(payload?.error || "La sonda no pudo consultar OpenField.");
      }

      setSonda(payload);
      setEstadoSonda("ok");
    } catch (error) {
      setSonda(null);
      setEstadoSonda("error");
      setErrorSonda(error?.message || "La sonda no pudo consultar OpenField.");
    }
  };

  const copiarSonda = async () => {
    if (!sonda) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(sonda, null, 2));
      setCopia("ok");
    } catch {
      setCopia("error");
    }
  };

  const probarConexion = async (event) => {
    event.preventDefault();

    const usuarioLimpio = username.trim();
    if (!usuarioLimpio || !password) {
      setEstado("error");
      setMensaje("Completá usuario y contraseña de Catapult.");
      return;
    }

    setEstado("probando");
    setMensaje("Abriendo Catapult y comprobando el acceso a 26-05 T…");

    try {
      const respuesta = await fetch("/api/openfield/cloud-login-test", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: usuarioLimpio,
          password,
        }),
      });

      const payload = await respuesta.json().catch(() => null);
      setPassword("");

      if (!respuesta.ok || !payload?.ok) {
        throw new Error(payload?.error || "No se pudo validar el acceso a Catapult.");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("catapult_openfield_username", usuarioLimpio);
      }

      setEstado("ok");
      setMensaje(
        payload?.message ||
          "Catapult conectado y actividad 26-05 T abierta correctamente. No se modificó ningún período.",
      );
    } catch (error) {
      setPassword("");
      setEstado("error");
      setMensaje(error?.message || "No se pudo validar el acceso a Catapult.");
    }
  };

  return (
    <main className="entrenamiento-app entrenamiento-ajustes-pagina">
      <header className="entrenamiento-barra">
        <button type="button" className="entrenamiento-volver" onClick={onVolverRegistro}>
          ← Registro
        </button>
        <div>
          <span>Entrenamiento</span>
          <strong>Ajustes</strong>
        </div>
        <button
          type="button"
          className="entrenamiento-ajustes-modulos"
          onClick={onVolverModulos}
        >
          Módulos
        </button>
      </header>

      <section className="entrenamiento-contenido entrenamiento-ajustes-contenido">
        <div className="entrenamiento-ajustes-encabezado">
          <span>Integraciones</span>
          <h1>Catapult OpenField</h1>
          <p>
            Conectá la cuenta que usará la automatización del Cloud Editor. En esta primera prueba
            solo validamos el inicio de sesión y que podamos abrir la actividad 26-05 T.
          </p>
        </div>

        <div className="entrenamiento-ajustes-grid">
          <section className="entrenamiento-panel entrenamiento-ajustes-panel">
            <div className="entrenamiento-panel-titulo">
              <span>01</span>
              <div>
                <h2>Cuenta de Catapult</h2>
                <p>La contraseña se usa únicamente durante la prueba y no se guarda.</p>
              </div>
            </div>

            <form onSubmit={probarConexion}>
              <label>
                Usuario
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Usuario o correo de Catapult"
                  disabled={estado === "probando"}
                />
              </label>

              <label>
                Contraseña
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Contraseña de Catapult"
                  disabled={estado === "probando"}
                />
              </label>

              <button
                type="submit"
                className="entrenamiento-boton-principal"
                disabled={estado === "probando"}
              >
                {estado === "probando" ? "Comprobando acceso…" : "Conectar Catapult"}
              </button>
            </form>

            <div className="entrenamiento-ajustes-seguridad">
              <strong>Seguridad</strong>
              <span>
                La contraseña no se escribe en GitHub, Vercel, localStorage ni Supabase. El backend
                la mantiene solo durante esta solicitud y cierra el navegador al terminar.
              </span>
            </div>
          </section>

          <section className="entrenamiento-panel entrenamiento-ajustes-panel">
            <div className="entrenamiento-panel-titulo">
              <span>02</span>
              <div>
                <h2>Prueba controlada</h2>
                <p>Antes de habilitar cualquier escritura.</p>
              </div>
            </div>

            <div className="entrenamiento-ajustes-objetivo">
              <span>Actividad de prueba</span>
              <strong>26-05 T</strong>
              <small>9dffa100-99e5-4ce6-921f-226e9e01e264</small>
            </div>

            <div
              className={`entrenamiento-ajustes-resultado ${
                estado === "ok" ? "correcto" : estado === "error" ? "error" : ""
              }`}
              aria-live="polite"
            >
              <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
              <div>
                <strong>
                  {estado === "probando"
                    ? "Probando conexión"
                    : estado === "ok"
                      ? "Catapult conectado"
                      : estado === "error"
                        ? "No se pudo conectar"
                        : "Sin probar"}
                </strong>
                <span>
                  {mensaje ||
                    "La prueba iniciará sesión y comprobará que el Editor de 26-05 T sea accesible. No crea, edita ni borra períodos."}
                </span>
              </div>
            </div>

            <div className="entrenamiento-ajustes-limites">
              <strong>Esta etapa no puede escribir</strong>
              <span>
                El endpoint usado acá solo realiza login y navegación. La creación de períodos se
                implementará recién después de validar esta conexión.
              </span>
            </div>
          </section>

          <section className="entrenamiento-panel entrenamiento-ajustes-panel entrenamiento-ajustes-panel-ancho">
            <div className="entrenamiento-panel-titulo">
              <span>03</span>
              <div>
                <h2>Sonda de la Connect API</h2>
                <p>
                  Pregunta al servidor qué rutas de períodos existen y qué métodos anuncia. Solo
                  envía GET y OPTIONS: no crea, edita ni borra nada.
                </p>
              </div>
            </div>

            <div className="entrenamiento-sonda-acciones">
              <button
                type="button"
                className="entrenamiento-boton-principal"
                onClick={ejecutarSonda}
                disabled={estadoSonda === "sondeando"}
              >
                {estadoSonda === "sondeando" ? "Sondeando OpenField…" : "Sondear capacidades"}
              </button>

              {sonda && (
                <button
                  type="button"
                  className="entrenamiento-boton-secundario"
                  onClick={copiarSonda}
                >
                  {copia === "ok" ? "Copiado ✓" : "Copiar resultado"}
                </button>
              )}
            </div>

            {copia === "error" && (
              <div className="entrenamiento-estado advertencia">
                No se pudo copiar automáticamente. Abrí el JSON completo y copialo a mano.
              </div>
            )}

            {estadoSonda === "error" && (
              <div className="entrenamiento-ajustes-resultado error" aria-live="polite">
                <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
                <div>
                  <strong>La sonda no pudo ejecutarse</strong>
                  <span>{errorSonda}</span>
                </div>
              </div>
            )}

            {estadoSonda === "idle" && (
              <div className="entrenamiento-ajustes-limites">
                <strong>Qué responde la sonda</strong>
                <span>
                  404 significa que la ruta no existe. 405 significa que existe pero con otro
                  método. 403 significa que existe y falta scope, o que el gateway la oculta. El
                  header Allow dice qué métodos acepta cada ruta.
                </span>
              </div>
            )}

            {sonda && (
              <>
                <div className="entrenamiento-sonda-tokens">
                  {sonda.tokens.map((token) => (
                    <span
                      key={token.env}
                      className={`entrenamiento-sonda-chip ${
                        token.configurado ? "correcto" : "advertencia"
                      }`}
                    >
                      {token.env}: {token.configurado ? "configurado" : "no configurado"}
                    </span>
                  ))}
                </div>

                <p className="entrenamiento-sonda-control">
                  Control con el token {sonda.control.token}: GET /activities →{" "}
                  {sonda.control.status || "sin respuesta"}
                  {sonda.control.actividadEncontrada
                    ? ` · ${sonda.control.actividadNombre || "actividad"} encontrada · ${sonda.control.periodos} períodos`
                    : " · la actividad de prueba no apareció en el listado"}
                  {sonda.control.is_injected === true
                    ? " · actividad INYECTADA (is_injected: sí)"
                    : sonda.control.is_injected === false
                      ? " · actividad real de chalecos (is_injected: no)"
                      : ""}
                  {sonda.periodId ? "" : " · sin período para sondear /periods/{id}"}
                </p>

                {Object.entries(sonda.sondas).map(([clave, datos]) => (
                  <article className="entrenamiento-sonda-token" key={clave}>
                    <header>
                      <span>Token {clave}</span>
                      <strong>
                        {sonda.tokens.find((token) => token.clave === clave)?.env || clave}
                      </strong>
                    </header>

                    <div
                      className={`entrenamiento-ajustes-resultado ${tonoVeredicto(
                        datos.resumen.veredicto,
                      )}`}
                    >
                      <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
                      <div>
                        <strong>
                          {ETIQUETAS_VEREDICTO[datos.resumen.veredicto] || datos.resumen.veredicto}
                        </strong>
                        <span>{datos.resumen.detalle}</span>
                      </div>
                    </div>

                    <ul className="entrenamiento-sonda-rutas">
                      {datos.resultados.map((resultado) => (
                        <li key={resultado.clave}>
                          <code>
                            {resultado.metodo} {abreviarRuta(resultado.ruta, sonda)}
                          </code>
                          <span
                            className={`entrenamiento-sonda-chip ${tonoClasificacion(
                              resultado.clasificacion,
                            )}`}
                          >
                            {resultado.status || "—"} ·{" "}
                            {ETIQUETAS_CLASIFICACION[resultado.clasificacion] ||
                              resultado.clasificacion}
                          </span>
                          {resultado.allow.length > 0 && (
                            <small>Allow: {resultado.allow.join(", ")}</small>
                          )}
                          {resultado.corsMethods.length > 0 && (
                            <small>CORS (informativo): {resultado.corsMethods.join(", ")}</small>
                          )}
                          {resultado.cuerpo?.message && <small>{resultado.cuerpo.message}</small>}
                          {resultado.cuerpo?.error && <small>{resultado.cuerpo.error}</small>}
                          {resultado.cuerpo?.tipo === "objeto" && (
                            <small>Claves: {resultado.cuerpo.claves.join(", ")}</small>
                          )}
                          {resultado.error && <small>Error de red: {resultado.error}</small>}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}

                <details className="entrenamiento-sonda-json">
                  <summary>Ver JSON completo</summary>
                  <pre>{JSON.stringify(sonda, null, 2)}</pre>
                </details>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
