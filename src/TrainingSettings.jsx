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

const ETIQUETAS_INSPECCION = {
  "credencial-observada": "Credencial del editor identificada",
  "sin-authorization-visible": "El editor no manda Authorization: sesión por cookie u otro header",
  "sin-servicio-interno": "El editor no llamó al servicio interno de actividad",
  "sin-trafico": "No hubo tráfico a Catapult",
};

const tonoInspeccion = (veredicto) => {
  if (veredicto === "credencial-observada") return "correcto";
  if (veredicto === "sin-trafico") return "error";
  return "advertencia";
};

const ETIQUETAS_PASE = {
  "pase-abre-servicio": "El pase abre el servicio interno de actividad",
  "pase-abre-backend": "El pase abre el backend; falta el host del servicio interno",
  "pase-rechazado": "El pase fue rechazado en todas las rutas internas",
  "sin-pase": "No se pudo capturar el pase",
  "sin-respuesta": "Ninguna ruta interna respondió",
  inconcluso: "Inconcluso",
};

const tonoPase = (veredicto) => {
  if (veredicto === "pase-abre-servicio") return "correcto";
  if (veredicto === "pase-rechazado" || veredicto === "sin-pase" || veredicto === "sin-respuesta") {
    return "error";
  }
  return "advertencia";
};

const ETIQUETAS_ESCRITURA = {
  "escritura-validada": "✓ Escritura validada",
  "escritura-rechazada": "OpenField rechazó el batch",
  "sin-cambios": "OpenField aceptó el batch pero no cambió nada",
  "escritura-con-diferencias": "Escribió, pero no exactamente lo pedido",
};

const tonoEscritura = (codigo) => {
  if (codigo === "escritura-validada") return "correcto";
  if (codigo === "escritura-con-diferencias") return "error";
  return "advertencia";
};

const formatearHoraMs = (ms) => {
  const numero = Number(ms);
  if (!Number.isFinite(numero) || numero <= 0) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(numero));
};

const tonoStatus = (status) => {
  if (status === null || status === undefined) return "advertencia";
  if (status >= 200 && status < 400) return "correcto";
  if (status === 401 || status === 403) return "error";
  return "advertencia";
};

const esHostCatapult = (host) => /(^|\.)catapultsports\.com$/i.test(String(host || ""));

const formatearFechaHora = (iso) => {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
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

  const [estadoInspeccion, setEstadoInspeccion] = useState("idle");
  const [inspeccion, setInspeccion] = useState(null);
  const [errorInspeccion, setErrorInspeccion] = useState("");
  const [fallaInspeccion, setFallaInspeccion] = useState(null);
  const [copiaInspeccion, setCopiaInspeccion] = useState("");

  const inspeccionarEditor = async () => {
    const usuarioLimpio = username.trim();
    if (!usuarioLimpio || !password) {
      setEstadoInspeccion("error");
      setInspeccion(null);
      setErrorInspeccion("Completá usuario y contraseña de Catapult en el panel 01.");
      return;
    }

    setEstadoInspeccion("inspeccionando");
    setInspeccion(null);
    setErrorInspeccion("");
    setFallaInspeccion(null);
    setCopiaInspeccion("");

    try {
      const respuesta = await fetch("/api/openfield/cloud-editor-inspect", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: usuarioLimpio, password }),
      });

      const payload = await respuesta.json().catch(() => null);
      setPassword("");

      if (!respuesta.ok || !payload?.ok) {
        // El backend cuenta en qué etapa falló y adjunta la pantalla que vio:
        // sin eso el mensaje genérico no permite diagnosticar nada.
        setFallaInspeccion(payload && typeof payload === "object" ? payload : null);
        throw new Error(payload?.error || "No se pudo inspeccionar el Cloud Editor.");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("catapult_openfield_username", usuarioLimpio);
      }

      setInspeccion(payload);
      setEstadoInspeccion("ok");
    } catch (error) {
      setPassword("");
      setInspeccion(null);
      setEstadoInspeccion("error");
      setErrorInspeccion(error?.message || "No se pudo inspeccionar el Cloud Editor.");
    }
  };

  const copiarFallaInspeccion = async () => {
    if (!fallaInspeccion) return;

    try {
      const { captura: _omitida, ...sinImagen } = fallaInspeccion;
      await navigator.clipboard.writeText(JSON.stringify(sinImagen, null, 2));
      setCopiaInspeccion("ok");
    } catch {
      setCopiaInspeccion("error");
    }
  };

  const [estadoPase, setEstadoPase] = useState("idle");
  const [pase, setPase] = useState(null);
  const [errorPase, setErrorPase] = useState("");
  const [fallaPase, setFallaPase] = useState(null);
  const [copiaPase, setCopiaPase] = useState("");

  const probarPase = async () => {
    const usuarioLimpio = username.trim();
    if (!usuarioLimpio || !password) {
      setEstadoPase("error");
      setPase(null);
      setFallaPase(null);
      setErrorPase("Completá usuario y contraseña de Catapult en el panel 01.");
      return;
    }

    setEstadoPase("probando");
    setPase(null);
    setErrorPase("");
    setFallaPase(null);
    setCopiaPase("");

    try {
      const respuesta = await fetch("/api/openfield/cloud-token-probe", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: usuarioLimpio, password }),
      });

      const payload = await respuesta.json().catch(() => null);
      setPassword("");

      if (!respuesta.ok || !payload?.ok) {
        setFallaPase(payload && typeof payload === "object" ? payload : null);
        throw new Error(payload?.error || "No se pudo probar el pase interno.");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("catapult_openfield_username", usuarioLimpio);
      }

      setPase(payload);
      setEstadoPase("ok");
    } catch (error) {
      setPassword("");
      setPase(null);
      setEstadoPase("error");
      setErrorPase(error?.message || "No se pudo probar el pase interno.");
    }
  };

  const copiarPase = async () => {
    const fuente = pase || fallaPase;
    if (!fuente) return;

    try {
      const { captura: _omitida, ...sinImagen } = fuente;
      await navigator.clipboard.writeText(JSON.stringify(sinImagen, null, 2));
      setCopiaPase("ok");
    } catch {
      setCopiaPase("error");
    }
  };

  const [confirmacion, setConfirmacion] = useState("");
  const [estadoEscritura, setEstadoEscritura] = useState("idle");
  const [escritura, setEscritura] = useState(null);
  const [errorEscritura, setErrorEscritura] = useState("");
  const [fallaEscritura, setFallaEscritura] = useState(null);
  const [copiaEscritura, setCopiaEscritura] = useState("");

  const ocupado =
    estado === "probando" || estadoInspeccion === "inspeccionando" || estadoPase === "probando";
  const confirmacionValida = confirmacion.trim() === "26-05 T";
  const escrituraHabilitada =
    confirmacionValida && Boolean(username.trim()) && Boolean(password) && !ocupado;

  const ejecutarEscritura = async () => {
    if (!escrituraHabilitada || estadoEscritura === "escribiendo") return;

    setEstadoEscritura("escribiendo");
    setEscritura(null);
    setErrorEscritura("");
    setFallaEscritura(null);
    setCopiaEscritura("");

    try {
      const respuesta = await fetch("/api/openfield/cloud-write-test", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          confirmacion: confirmacion.trim(),
        }),
      });

      const payload = await respuesta.json().catch(() => null);
      setPassword("");
      setConfirmacion("");

      if (!respuesta.ok || !payload?.ok) {
        setFallaEscritura(payload && typeof payload === "object" ? payload : null);
        throw new Error(payload?.error || "El write test no pudo completarse.");
      }

      setEscritura(payload);
      setEstadoEscritura("ok");
    } catch (error) {
      setPassword("");
      setConfirmacion("");
      setEscritura(null);
      setEstadoEscritura("error");
      setErrorEscritura(error?.message || "El write test no pudo completarse.");
    }
  };

  const copiarEscritura = async () => {
    const fuente = escritura || fallaEscritura;
    if (!fuente) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(fuente, null, 2));
      setCopiaEscritura("ok");
    } catch {
      setCopiaEscritura("error");
    }
  };

  const copiarInspeccion = async () => {
    if (!inspeccion) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(inspeccion, null, 2));
      setCopiaInspeccion("ok");
    } catch {
      setCopiaInspeccion("error");
    }
  };

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
    event?.preventDefault?.();

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

  const enviarVerificacion = (event) => {
    event.preventDefault();
    probarPase();
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
            Primero verificá el acceso con tu cuenta. Después, el write test sobre 26-05 T. Los
            diagnósticos que ya usamos quedan plegados abajo.
          </p>
        </div>

        <div className="entrenamiento-ajustes-grid">
          <section className="entrenamiento-panel entrenamiento-ajustes-panel">
            <div className="entrenamiento-panel-titulo">
              <span>01</span>
              <div>
                <h2>Cuenta de Catapult</h2>
                <p>La contraseña se usa solo durante cada prueba y no se guarda en ningún lado.</p>
              </div>
            </div>

            <form onSubmit={enviarVerificacion}>
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
                disabled={ocupado || estadoEscritura === "escribiendo"}
              >
                {estadoPase === "probando" ? "Verificando acceso…" : "Verificar acceso (solo lectura)"}
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
                <h2>Acceso al editor</h2>
                <p>
                  Inicia sesión, captura el pase que devuelve /oauth/token apenas llega, cierra el
                  navegador y con ese pase lee 26-05 T por los servicios internos. Solo GET. El pase
                  no se muestra ni se guarda.
                </p>
              </div>
            </div>

            {estadoPase === "idle" && (
              <div className="entrenamiento-ajustes-limites">
                <strong>Cómo se usa</strong>
                <span>
                  Completá usuario y contraseña en el panel 01 y tocá "Verificar acceso".
                  Tarda menos de un minuto. El resultado dice si el pase abre la puerta que usa el
                  editor para escribir y qué forma tiene una actividad ahí adentro.
                </span>
              </div>
            )}

            {estadoPase === "probando" && (
              <div className="entrenamiento-ajustes-resultado" aria-live="polite">
                <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
                <div>
                  <strong>Probando el pase</strong>
                  <span>Iniciando sesión, capturando el pase y leyendo 26-05 T por dentro…</span>
                </div>
              </div>
            )}

            {estadoPase === "error" && (
              <>
                <div className="entrenamiento-ajustes-resultado error" aria-live="polite">
                  <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
                  <div>
                    <strong>La prueba del pase no pudo completarse</strong>
                    <span>{errorPase}</span>
                  </div>
                </div>

                {fallaPase && (
                  <>
                    <p className="entrenamiento-sonda-control">
                      {fallaPase.etapa ? `Etapa: ${fallaPase.etapa}` : "Etapa desconocida"}
                      {fallaPase.code ? ` · Código: ${fallaPase.code}` : ""}
                      {fallaPase.detalle?.tipo ? ` · ${fallaPase.detalle.tipo}` : ""}
                      {fallaPase.detalle?.mensaje ? ` · ${fallaPase.detalle.mensaje}` : ""}
                    </p>
                    {fallaPase.captura && (
                      <figure className="entrenamiento-inspeccion-captura">
                        <img src={fallaPase.captura} alt="Pantalla al fallar la prueba del pase" />
                        <figcaption>Lo que vio el navegador automatizado en el momento del error.</figcaption>
                      </figure>
                    )}
                    <div className="entrenamiento-sonda-acciones">
                      <button type="button" className="entrenamiento-boton-secundario" onClick={copiarPase}>
                        {copiaPase === "ok" ? "Copiado ✓" : "Copiar detalle del error"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {pase && (
              <>
                <div
                  className={`entrenamiento-ajustes-resultado ${tonoPase(pase.resumen?.veredicto)}`}
                  aria-live="polite"
                >
                  <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
                  <div>
                    <strong>
                      {ETIQUETAS_PASE[pase.resumen?.veredicto] || pase.resumen?.veredicto || "Sin veredicto"}
                    </strong>
                    <span>{pase.resumen?.detalle}</span>
                  </div>
                </div>

                <div className="entrenamiento-sonda-tokens">
                  <span
                    className={`entrenamiento-sonda-chip ${pase.pase?.capturado ? "correcto" : "error"}`}
                  >
                    {pase.pase?.capturado ? "Pase capturado" : "Pase no capturado"}
                  </span>
                  {pase.pase?.capturado && (
                    <>
                      <span className="entrenamiento-sonda-chip">
                        {pase.pase.tipo} · {pase.pase.formato} · {pase.pase.largo} car.
                      </span>
                      {pase.pase.expira && (
                        <span className="entrenamiento-sonda-chip">
                          Vence {formatearFechaHora(pase.pase.expira)}
                        </span>
                      )}
                      <span className={`entrenamiento-sonda-chip ${pase.pase.tieneRefresh ? "correcto" : "advertencia"}`}>
                        {pase.pase.tieneRefresh ? "Con refresh token" : "Sin refresh token"}
                      </span>
                    </>
                  )}
                </div>

                <ul className="entrenamiento-sonda-rutas">
                  {(pase.resultados || []).map((resultado) => (
                    <li key={resultado.clave}>
                      <code>
                        {resultado.metodo} {resultado.host}
                        {resultado.path}
                        {resultado.conCookies ? " (con sesión)" : " (con pase)"}
                      </code>
                      <span className={`entrenamiento-sonda-chip ${tonoStatus(resultado.status || null)}`}>
                        {resultado.status || "sin respuesta"} ·{" "}
                        {resultado.error || resultado.contentType || resultado.descripcion}
                      </span>
                      {resultado.cuerpo?.tipo === "objeto" && (
                        <small>Respuesta: {resultado.cuerpo.claves.join(", ")}</small>
                      )}
                      {resultado.cuerpo?.tipo === "array" && (
                        <small>
                          Lista de {resultado.cuerpo.largo} ·{" "}
                          {(resultado.cuerpo.clavesPrimero || []).join(", ")}
                        </small>
                      )}
                      {resultado.cuerpo?.muestraPeriodo && (
                        <small>Período: {resultado.cuerpo.muestraPeriodo.claves.join(", ")}</small>
                      )}
                      {resultado.cuerpo?.message && <small>{resultado.cuerpo.message}</small>}
                    </li>
                  ))}
                </ul>

                {pase.captura && (
                  <details className="entrenamiento-sonda-json">
                    <summary>Ver pantalla tras el login</summary>
                    <figure className="entrenamiento-inspeccion-captura">
                      <img src={pase.captura} alt="Pantalla de Catapult tras iniciar sesión" />
                      <figcaption>Lo que vio el navegador automatizado justo antes de cerrarse.</figcaption>
                    </figure>
                  </details>
                )}

                <div className="entrenamiento-sonda-acciones">
                  <button type="button" className="entrenamiento-boton-secundario" onClick={copiarPase}>
                    {copiaPase === "ok" ? "Copiado ✓" : "Copiar resultado"}
                  </button>
                </div>

                {copiaPase === "error" && (
                  <div className="entrenamiento-estado advertencia">
                    No se pudo copiar automáticamente. Abrí el JSON completo y copialo a mano.
                  </div>
                )}

                <details className="entrenamiento-sonda-json">
                  <summary>Ver JSON completo</summary>
                  <pre>{JSON.stringify({ ...pase, captura: undefined }, null, 2)}</pre>
                </details>
              </>
            )}
          </section>

          <section className="entrenamiento-panel entrenamiento-ajustes-panel entrenamiento-ajustes-panel-ancho">
            <div className="entrenamiento-panel-titulo">
              <span>03</span>
              <div>
                <h2>Write test · Modo Prueba</h2>
                <p>
                  La primera escritura real de la app en OpenField. Solo sobre 26-05 T. Agrega un
                  período de prueba por la misma puerta que usa el editor y después verifica por
                  las dos vías que quedó exacto y que nada más cambió.
                </p>
              </div>
            </div>

            <div className="entrenamiento-ajustes-limites">
              <strong>Qué hace, paso por paso</strong>
              <span>
                1. Inicia sesión y captura el pase. 2. Toma un snapshot por el servicio interno y por
                la API oficial. 3. Arma UN período nuevo (TEST APP NN, 10 minutos, 10 minutos
                después del inicio, con los participantes del primer período). 4. Manda el batch
                con solo ese período. 5. Relee todo. 6. Compara: tiene que aparecer exactamente ese
                período, con 0 ms de diferencia, y ningún otro tocado. No borra el período de
                prueba: se saca a mano desde el editor.
              </span>
            </div>

            <label>
              Escribí 26-05 T para habilitar el botón
              <input
                type="text"
                value={confirmacion}
                onChange={(event) => setConfirmacion(event.target.value)}
                placeholder="26-05 T"
                autoComplete="off"
                disabled={estadoEscritura === "escribiendo"}
              />
            </label>

            <button
              type="button"
              className="entrenamiento-boton-principal"
              onClick={ejecutarEscritura}
              disabled={!escrituraHabilitada || estadoEscritura === "escribiendo"}
            >
              {estadoEscritura === "escribiendo"
                ? "Escribiendo y verificando…"
                : "Escribir TEST APP en 26-05 T"}
            </button>

            {!escrituraHabilitada && estadoEscritura !== "escribiendo" && (
              <p className="entrenamiento-sonda-control">
                {!username.trim() || !password
                  ? "Completá usuario y contraseña de Catapult en el panel 01."
                  : !confirmacionValida
                    ? "Falta la confirmación exacta."
                    : "Esperá a que termine la otra prueba."}
              </p>
            )}

            {estadoEscritura === "escribiendo" && (
              <div className="entrenamiento-ajustes-resultado" aria-live="polite">
                <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
                <div>
                  <strong>Escribiendo</strong>
                  <span>Login, snapshot, batch, relectura y comparación. Hasta un minuto.</span>
                </div>
              </div>
            )}

            {estadoEscritura === "error" && (
              <>
                <div className="entrenamiento-ajustes-resultado error" aria-live="polite">
                  <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
                  <div>
                    <strong>El write test no pudo completarse</strong>
                    <span>{errorEscritura}</span>
                  </div>
                </div>
                {fallaEscritura && (
                  <>
                    <p className="entrenamiento-sonda-control">
                      {fallaEscritura.etapa ? `Etapa: ${fallaEscritura.etapa}` : ""}
                      {fallaEscritura.code ? ` · Código: ${fallaEscritura.code}` : ""}
                      {fallaEscritura.detalle?.mensaje ? ` · ${fallaEscritura.detalle.mensaje}` : ""}
                      {fallaEscritura.escribio === true
                        ? " · ATENCIÓN: el batch ya se había enviado cuando falló; revisá 26-05 T en el editor."
                        : fallaEscritura.escribio === false
                          ? " · No se escribió nada."
                          : ""}
                    </p>
                    <div className="entrenamiento-sonda-acciones">
                      <button type="button" className="entrenamiento-boton-secundario" onClick={copiarEscritura}>
                        {copiaEscritura === "ok" ? "Copiado ✓" : "Copiar detalle del error"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {escritura && (
              <>
                <div
                  className={`entrenamiento-ajustes-resultado ${tonoEscritura(escritura.veredicto?.codigo)}`}
                  aria-live="polite"
                >
                  <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
                  <div>
                    <strong>
                      {ETIQUETAS_ESCRITURA[escritura.veredicto?.codigo] ||
                        escritura.veredicto?.codigo ||
                        "Sin veredicto"}
                    </strong>
                    <span>{escritura.veredicto?.detalle}</span>
                  </div>
                </div>

                <div className="entrenamiento-sonda-tokens">
                  <span className={`entrenamiento-sonda-chip ${tonoStatus(escritura.put?.status || null)}`}>
                    PUT batch → {escritura.put?.status || "sin respuesta"}
                  </span>
                  <span className="entrenamiento-sonda-chip">
                    {escritura.enviado?.periodo?.name} ·{" "}
                    {formatearHoraMs(escritura.enviado?.periodo?.start_time_ms)} →{" "}
                    {formatearHoraMs(escritura.enviado?.periodo?.end_time_ms)} ·{" "}
                    {escritura.enviado?.periodo?.participantes} participantes
                  </span>
                  <span className="entrenamiento-sonda-chip">
                    Interno: {escritura.antes?.interno?.periods?.length ?? "?"} →{" "}
                    {escritura.despues?.interno?.periods?.length ?? "?"} períodos
                  </span>
                  <span className="entrenamiento-sonda-chip">
                    API oficial: {escritura.antes?.connect?.count ?? "?"} →{" "}
                    {escritura.despues?.connect?.count ?? "?"} períodos
                  </span>
                </div>

                <ul className="entrenamiento-sonda-rutas">
                  {[
                    ["Servicio interno", escritura.validacion?.interna],
                    ["API oficial", escritura.validacion?.connect],
                  ].map(([nombre, validacion]) => (
                    <li key={nombre}>
                      <code>{nombre}</code>
                      {validacion ? (
                        <>
                          <span
                            className={`entrenamiento-sonda-chip ${validacion.valido ? "correcto" : "error"}`}
                          >
                            {validacion.valido ? "Exacto" : "Con diferencias"} · +
                            {validacion.diff?.agregados?.length ?? 0} · −
                            {validacion.diff?.eliminados?.length ?? 0} · ~
                            {validacion.diff?.modificados?.length ?? 0}
                          </span>
                          {validacion.corte && (
                            <small>
                              {validacion.corte.motivo === "ok"
                                ? "Inicio y fin: 0 ms de diferencia."
                                : validacion.corte.motivo === "no-encontrado"
                                  ? "El período de prueba no apareció."
                                  : `Inicio ${validacion.corte.diferenciaInicioMs ?? "?"} ms · fin ${
                                      validacion.corte.diferenciaFinMs ?? "?"
                                    } ms respecto de lo pedido.`}
                            </small>
                          )}
                          {validacion.participantes && (
                            <small>
                              Participantes:{" "}
                              {validacion.participantes.valido
                                ? "coinciden"
                                : `faltan ${validacion.participantes.detalle?.faltantes?.length ?? "?"}, sobran ${
                                    validacion.participantes.detalle?.sobrantes?.length ?? "?"
                                  }`}
                            </small>
                          )}
                          {(validacion.diff?.modificados || []).map((modificado) => (
                            <small key={modificado.id}>
                              Modificado: {modificado.name} ·{" "}
                              {Object.keys(modificado.cambios || {}).join(", ")}
                            </small>
                          ))}
                          {(validacion.diff?.eliminados || []).map((eliminado) => (
                            <small key={eliminado.id}>Eliminado: {eliminado.name}</small>
                          ))}
                        </>
                      ) : (
                        <span className="entrenamiento-sonda-chip advertencia">Sin relectura</span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="entrenamiento-sonda-acciones">
                  <button type="button" className="entrenamiento-boton-secundario" onClick={copiarEscritura}>
                    {copiaEscritura === "ok" ? "Copiado ✓" : "Copiar resultado"}
                  </button>
                </div>

                {copiaEscritura === "error" && (
                  <div className="entrenamiento-estado advertencia">
                    No se pudo copiar automáticamente. Abrí el JSON completo y copialo a mano.
                  </div>
                )}

                <details className="entrenamiento-sonda-json">
                  <summary>Ver JSON completo</summary>
                  <pre>{JSON.stringify(escritura, null, 2)}</pre>
                </details>
              </>
            )}
          </section>

          <details className="entrenamiento-ajustes-avanzado">
            <summary>Diagnóstico avanzado · pruebas que ya cumplieron su función</summary>

          <section className="entrenamiento-panel entrenamiento-ajustes-panel">
            <div className="entrenamiento-panel-titulo">
              <span>A</span>
              <div>
                <h2>Prueba de login del editor</h2>
                <p>Antes de habilitar cualquier escritura.</p>
              </div>
            </div>

            <button
              type="button"
              className="entrenamiento-boton-secundario entrenamiento-ajustes-boton-ancho"
              onClick={probarConexion}
              disabled={ocupado || estadoEscritura === "escribiendo"}
            >
              {estado === "probando" ? "Comprobando acceso…" : "Probar login del editor (solo lectura)"}
            </button>

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
              <span>B</span>
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

          <section className="entrenamiento-panel entrenamiento-ajustes-panel entrenamiento-ajustes-panel-ancho">
            <div className="entrenamiento-panel-titulo">
              <span>C</span>
              <div>
                <h2>Inspección del Cloud Editor</h2>
                <p>
                  Entra con tu usuario, abre 26-05 T en el editor y anota qué pedidos hace y con
                  qué credencial. No guarda la contraseña, no muestra el valor de ningún token y
                  no modifica nada.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="entrenamiento-boton-secundario entrenamiento-ajustes-boton-ancho"
              onClick={inspeccionarEditor}
              disabled={ocupado || estadoEscritura === "escribiendo"}
            >
              {estadoInspeccion === "inspeccionando"
                ? "Inspeccionando el editor…"
                : "Inspeccionar Cloud Editor (solo lectura)"}
            </button>

            {estadoInspeccion === "idle" && (
              <div className="entrenamiento-ajustes-limites">
                <strong>Cómo se usa</strong>
                <span>
                  Completá usuario y contraseña en el panel 01 y tocá "Inspeccionar Cloud Editor".
                  Tarda menos de un minuto. El resultado dice por qué puerta y con qué credencial
                  escribe el editor.
                </span>
              </div>
            )}

            {estadoInspeccion === "inspeccionando" && (
              <div className="entrenamiento-ajustes-resultado" aria-live="polite">
                <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
                <div>
                  <strong>Inspeccionando</strong>
                  <span>Iniciando sesión, abriendo 26-05 T y escuchando la red del editor…</span>
                </div>
              </div>
            )}

            {estadoInspeccion === "error" && (
              <>
                <div className="entrenamiento-ajustes-resultado error" aria-live="polite">
                  <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
                  <div>
                    <strong>La inspección no pudo completarse</strong>
                    <span>{errorInspeccion}</span>
                  </div>
                </div>

                {fallaInspeccion && (
                  <>
                    <p className="entrenamiento-sonda-control">
                      {fallaInspeccion.etapa ? `Etapa: ${fallaInspeccion.etapa}` : "Etapa desconocida"}
                      {fallaInspeccion.code ? ` · Código: ${fallaInspeccion.code}` : ""}
                      {fallaInspeccion.detalle?.tipo ? ` · ${fallaInspeccion.detalle.tipo}` : ""}
                      {fallaInspeccion.detalle?.mensaje ? ` · ${fallaInspeccion.detalle.mensaje}` : ""}
                      {fallaInspeccion.paginaActual
                        ? ` · Página al fallar: ${fallaInspeccion.paginaActual}`
                        : ""}
                    </p>

                    {fallaInspeccion.captura && (
                      <figure className="entrenamiento-inspeccion-captura">
                        <img
                          src={fallaInspeccion.captura}
                          alt="Pantalla que vio el navegador automatizado al fallar"
                        />
                        <figcaption>Lo que vio el navegador automatizado en el momento del error.</figcaption>
                      </figure>
                    )}

                    <div className="entrenamiento-sonda-acciones">
                      <button
                        type="button"
                        className="entrenamiento-boton-secundario"
                        onClick={copiarFallaInspeccion}
                      >
                        {copiaInspeccion === "ok" ? "Copiado ✓" : "Copiar detalle del error"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {inspeccion && (
              <>
                <div
                  className={`entrenamiento-ajustes-resultado ${tonoInspeccion(
                    inspeccion.resumen?.veredicto,
                  )}`}
                  aria-live="polite"
                >
                  <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
                  <div>
                    <strong>
                      {ETIQUETAS_INSPECCION[inspeccion.resumen?.veredicto] ||
                        inspeccion.resumen?.veredicto ||
                        "Sin veredicto"}
                    </strong>
                    <span>{inspeccion.resumen?.detalle}</span>
                  </div>
                </div>

                <div className="entrenamiento-sonda-tokens">
                  <span
                    className={`entrenamiento-sonda-chip ${
                      inspeccion.editor?.alcanzado ? "correcto" : "advertencia"
                    }`}
                  >
                    {inspeccion.editor?.alcanzado
                      ? inspeccion.editor?.nombreVisible
                        ? "Editor de 26-05 T abierto"
                        : "Editor abierto, título no confirmado"
                      : "No se llegó al editor"}
                  </span>
                  <span className="entrenamiento-sonda-chip">
                    {inspeccion.resumen?.solicitudesCatapult ?? 0} pedidos a Catapult
                  </span>
                  {(inspeccion.resumen?.esquemas || []).map((esquema) => (
                    <span key={esquema} className="entrenamiento-sonda-chip correcto">
                      Authorization: {esquema}
                    </span>
                  ))}
                  {(inspeccion.resumen?.proveedorAuth || []).map((host) => (
                    <span key={host} className="entrenamiento-sonda-chip">
                      Identidad vía {host}
                    </span>
                  ))}
                </div>

                {inspeccion.resumen?.autorizacionEjemplo?.esquema && (
                  <p className="entrenamiento-sonda-control">
                    Credencial observada: {inspeccion.resumen.autorizacionEjemplo.esquema} ·{" "}
                    {inspeccion.resumen.autorizacionEjemplo.formato} ·{" "}
                    {inspeccion.resumen.autorizacionEjemplo.largo} caracteres
                    {inspeccion.resumen.autorizacionEjemplo.expira
                      ? ` · vence ${formatearFechaHora(inspeccion.resumen.autorizacionEjemplo.expira)}`
                      : ""}
                    {inspeccion.resumen.autorizacionEjemplo.claims?.iss
                      ? ` · emisor ${inspeccion.resumen.autorizacionEjemplo.claims.iss}`
                      : ""}
                  </p>
                )}

                <ul className="entrenamiento-sonda-rutas">
                  {(inspeccion.solicitudes || [])
                    .filter((solicitud) => esHostCatapult(solicitud.host))
                    .slice(0, 40)
                    .map((solicitud) => (
                      <li key={solicitud.id}>
                        <code>
                          {solicitud.metodo} {solicitud.host}
                          {solicitud.path}
                        </code>
                        <span
                          className={`entrenamiento-sonda-chip ${tonoStatus(solicitud.status)}`}
                        >
                          {solicitud.status ?? "sin respuesta"} ·{" "}
                          {solicitud.responseType || solicitud.tipo}
                        </span>
                        {solicitud.autorizacion?.esquema && (
                          <small>
                            Authorization: {solicitud.autorizacion.esquema} (
                            {solicitud.autorizacion.formato}, {solicitud.autorizacion.largo} car.)
                          </small>
                        )}
                        {solicitud.autorizacion?.headersEspeciales?.length > 0 && (
                          <small>
                            Headers especiales: {solicitud.autorizacion.headersEspeciales.join(", ")}
                          </small>
                        )}
                        {solicitud.envio?.claves && (
                          <small>Enviado: {solicitud.envio.claves.join(", ")}</small>
                        )}
                        {solicitud.cuerpo?.tipo === "objeto" && (
                          <small>Respuesta: {solicitud.cuerpo.claves.join(", ")}</small>
                        )}
                        {solicitud.cuerpo?.muestraPeriodo && (
                          <small>Período: {solicitud.cuerpo.muestraPeriodo.claves.join(", ")}</small>
                        )}
                      </li>
                    ))}
                </ul>

                <p className="entrenamiento-sonda-control">
                  localStorage: {(inspeccion.almacenamiento?.localStorage || []).join(", ") || "vacío"}{" "}
                  · sessionStorage:{" "}
                  {(inspeccion.almacenamiento?.sessionStorage || []).join(", ") || "vacío"} · cookies:{" "}
                  {(inspeccion.cookies || [])
                    .map((cookie) => `${cookie.name}${cookie.httpOnly ? " (httpOnly)" : ""}`)
                    .join(", ") || "ninguna"}
                </p>

                {inspeccion.captura && (
                  <details className="entrenamiento-sonda-json">
                    <summary>Ver pantalla del editor</summary>
                    <figure className="entrenamiento-inspeccion-captura">
                      <img src={inspeccion.captura} alt="Pantalla del Cloud Editor con 26-05 T" />
                      <figcaption>Lo que vio el navegador automatizado al terminar.</figcaption>
                    </figure>
                  </details>
                )}

                <div className="entrenamiento-sonda-acciones">
                  <button
                    type="button"
                    className="entrenamiento-boton-secundario"
                    onClick={copiarInspeccion}
                  >
                    {copiaInspeccion === "ok" ? "Copiado ✓" : "Copiar resultado"}
                  </button>
                </div>

                {copiaInspeccion === "error" && (
                  <div className="entrenamiento-estado advertencia">
                    No se pudo copiar automáticamente. Abrí el JSON completo y copialo a mano.
                  </div>
                )}

                <details className="entrenamiento-sonda-json">
                  <summary>Ver JSON completo</summary>
                  <pre>{JSON.stringify(inspeccion, null, 2)}</pre>
                </details>
              </>
            )}
          </section>
          </details>
        </div>
      </section>
    </main>
  );
}
