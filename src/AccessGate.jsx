import React, { useCallback, useEffect, useRef, useState } from "react";
import { ENLACE_DE_ACCESO, supabase } from "./supabase.js";
import { claveDeEnlaceFallido, esEnlaceDeInvitacion, esEnlaceDeRecuperacion, vieneDeInvitacion } from "./domain/enlaceAcceso.js";
import { t, useIdioma } from "./idioma/index.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import {
  guardarPerfilLocal,
  leerMiPerfil,
  leerPerfilLocal,
  permisosDePerfil,
  situacionDePerfil,
} from "./domain/perfilesDb.js";
import { limpiarAlSalir } from "./domain/copiasLocales.js";
import { correoValido } from "./domain/membresiasDb.js";
import { RUTA_SESION_OPENFIELD } from "./trainingApi.js";

// La puerta de la app. Se entra una vez con correo y contraseña (Supabase
// Auth) y de ahí cada cuenta usa lo que tiene habilitado: Partido, Flujo
// diario o todo (administrador). La cuenta se lee de la tabla `perfiles`;
// sin señal se usa la copia guardada en el celular, así en la cancha se
// entra igual.

// Se vuelve del correo de "Olvidé mi contraseña": por el parámetro que la app
// pone en el enlace o, si Supabase lo perdió al redirigir, por la marca
// `type=recovery` que el enlace trae en el fragmento.
const esRecuperacionSolicitada = () => {
  if (typeof window === "undefined") return false;
  if (esEnlaceDeRecuperacion(ENLACE_DE_ACCESO)) return true;
  return new URLSearchParams(window.location.search).get("training_recovery") === "1";
};

// Se vuelve del mail de invitación (o la persona invitada confirmó su correo
// desde "Crear una cuenta"): la cuenta tiene una contraseña al azar que nadie
// conoce (la pone Supabase o, si la cuenta ya existía sin confirmar, el
// servidor al mandar el mail), así que antes de entrar elige la suya. Un
// enlace que no sirvió no pide nada: se avisa. Si cerró la app en la
// bienvenida, al volver a abrirla en este celular (ya sin el enlace en la
// URL) se le sigue pidiendo.
const esInvitacionSolicitada = (usuario) =>
  (!ENLACE_DE_ACCESO.error && vieneDeInvitacion(ENLACE_DE_ACCESO, usuario)) ||
  (Boolean(usuario?.id && usuario?.invited_at) && bienvenidaPendiente() === usuario.id);

// La cuenta que abrió la bienvenida en este celular y todavía no eligió su
// contraseña. Solo vale para esa cuenta: cualquier otra entra como siempre.
const CLAVE_BIENVENIDA_PENDIENTE = "bienvenida_pendiente";
const bienvenidaPendiente = () => {
  try {
    return localStorage.getItem(CLAVE_BIENVENIDA_PENDIENTE) || "";
  } catch {
    return "";
  }
};
const anotarBienvenidaPendiente = (userId) => {
  try {
    if (userId) localStorage.setItem(CLAVE_BIENVENIDA_PENDIENTE, userId);
    else localStorage.removeItem(CLAVE_BIENVENIDA_PENDIENTE);
  } catch {
    // Sin localStorage, la bienvenida la pide solo el enlace.
  }
};

export const limpiarParametroRecuperacion = () => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("training_recovery");
  // Y la marca con la que vuelve el mail de invitación.
  url.searchParams.delete("invitacion");
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
};

// Supabase contesta en inglés; acá se traduce lo que puede pasarle a quien entra.
const textoDeErrorDeAcceso = (error, porDefecto) => {
  const texto = String(error?.message || "");
  if (esFalloDeRed(error)) return t("comun.sinConexion");
  if (/invalid login credentials/i.test(texto)) return t("acceso.error.credenciales");
  if (/email not confirmed/i.test(texto)) return t("acceso.error.noConfirmado");
  if (/user already registered|already been registered/i.test(texto)) return t("acceso.error.yaRegistrado");
  // Supabase espera un minuto entre un mail y otro al mismo correo (la
  // invitación también cuenta).
  if (/for security purposes|only request this after/i.test(texto)) return t("acceso.error.esperarMail");
  if (/rate limit|too many requests/i.test(texto) || error?.status === 429) return t("acceso.error.demasiados");
  return textoDeErrorDeContrasena(error, porDefecto);
};

// Lo que Supabase puede objetar de una contraseña nueva.
const textoDeErrorDeContrasena = (error, porDefecto) => {
  const texto = `${error?.code || ""} ${error?.message || ""}`;
  if (/same_password|should be different|different from the old/i.test(texto)) return t("acceso.error.mismaContrasena");
  if (/weak_password|at least \d+ characters|weak|should contain/i.test(texto)) return t("acceso.error.debil");
  if (/reauthentication|re-authenticate|session/i.test(texto)) return t("acceso.error.reautenticar");
  return porDefecto;
};

const sinSenal = () => typeof navigator !== "undefined" && navigator.onLine === false;

// Supabase contestó, pero con un error suyo (5xx): hubo señal y del otro lado
// algo falló. En "Olvidé mi contraseña" y "Crear una cuenta" es casi siempre
// el envío del mail. supabase-js lo marca como reintentable, igual que la
// falta de señal (por eso esFalloDeRed lo cuenta): se distingue por el estado.
const esFalloDelServidor = (error) => !sinSenal() && Number(error?.status) >= 500;

// Los errores de lo que manda un mail (Olvidé mi contraseña, Crear una cuenta).
const textoDeErrorDeMail = (error, porDefecto) =>
  esFalloDelServidor(error) ? t("acceso.error.correoNoSalio") : textoDeErrorDeAcceso(error, porDefecto);

// Lo que objeta la propia puerta, ya en el idioma de la app (a diferencia de
// lo que contesta Supabase, en inglés).
const errorPropio = (clave) => Object.assign(new Error(t(clave)), { propio: true });

// Al guardar una contraseña nueva: lo de la puerta, tal cual; de Supabase,
// nunca su texto en inglés.
const textoDeErrorAlGuardarContrasena = (error) => {
  if (error?.propio) return error.message;
  if (esFalloDelServidor(error)) return t("acceso.error.noCambiarContrasena");
  if (esFalloDeRed(error)) return t("comun.sinConexion");
  return textoDeErrorDeContrasena(error, t("acceso.error.noCambiarContrasena"));
};

// Un fallo de red: no hay señal, o hay barras pero los datos no pasan.
// Supabase lo marca como reintentable; el navegador, como un fetch que falló.
export const esFalloDeRed = (error) =>
  sinSenal() ||
  error?.deRed === true ||
  error?.name === "AuthRetryableFetchError" ||
  error?.status === 0 ||
  /failed to fetch|load failed|networkerror|network request failed|fetch failed|AuthRetryableFetchError/i.test(
    String(error?.message || ""),
  );


// La sesión que Supabase deja guardada en el celular. Se borra a mano al
// salir, porque sin señal Supabase no llega a cerrarla y, al volver la
// conexión, la cuenta reaparecía sola.
export const borrarSesionGuardada = () => {
  if (typeof localStorage === "undefined") return;
  Object.keys(localStorage)
    .filter((clave) => /^sb-.*-auth-token/.test(clave))
    .forEach((clave) => localStorage.removeItem(clave));
};

// Cerrar la sesión de Supabase puede tardar medio minuto sin señal (intenta
// renovar el token antes de cerrarla): se le da un rato y se sigue.
const conTope = (promesa, milisegundos) =>
  Promise.race([promesa, new Promise((resolver) => setTimeout(resolver, milisegundos))]);

// Con barras pero sin datos, un pedido puede quedar sin contestar nunca (el
// celular se cree conectado). Pasado el tope se lo da por perdido, como un
// fallo de red.
const conTopeDeRed = (promesa, milisegundos) => {
  let reloj;
  const vencido = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error("Failed to fetch")), milisegundos);
  });
  return Promise.race([promesa, vencido]).finally(() => clearTimeout(reloj));
};

// Al abrir: a partir de cuándo se avisa que tarda (y, si hay una cuenta
// guardada en el celular, se ofrece entrar con ella), cuándo se entra con esa
// cuenta sin esperar más, y cuánto se espera a que la base lea la cuenta.
const TARDA_MS = 3000;
const ENTRAR_CON_COPIA_MS = 7000;
const TOPE_PERFIL_MS = 8000;

// La foto del estadio, borrosa, de fondo: la parada en el celular y la
// apaisada en la computadora (las mismas de la portada de Partido).
const fotoDeFondo = () =>
  typeof window !== "undefined" && window.innerHeight > window.innerWidth
    ? "/portal/partido-parada.webp"
    : "/portal/partido.webp";

// La pantalla de la puerta, con la misma pinta que el portal: la foto
// borrosa atrás, el ícono de la app y una tarjeta oscura con lo que haya que
// completar. Arriba, si hay adónde volver, el botón para volver.
export const PantallaAcceso = ({ titulo, texto, onVolver, etiquetaVolver, children }) => {
  useIdioma();
  return (
  <main className="training-access-page">
    <div className="training-access-fondo" aria-hidden="true">
      <img src={fotoDeFondo()} alt="" decoding="async" />
    </div>
    {onVolver ? (
      <button type="button" className="training-access-volver" onClick={onVolver}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
        {etiquetaVolver || t("acceso.volverPortal")}
      </button>
    ) : (
      <span />
    )}
    <SelectorIdioma className="training-access-idioma" />
    <section className="training-access-card">
      <span className="training-access-logo" aria-hidden="true">
        <img src="/icono-app-192.png" alt="" />
      </span>
      <span className="training-access-kicker">{t("acceso.marca")}</span>
      <h1>{titulo}</h1>
      {texto && <p>{texto}</p>}
      {children}
    </section>
  </main>
  );
};

const Espera = () => <span className="training-access-espera" aria-hidden="true" />;

export default function AccessGate({ children }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [tardando, setTardando] = useState(false);
  const [accion, setAccion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [modoRecuperacion, setModoRecuperacion] = useState(esRecuperacionSolicitada);
  const [sesionRecuperacion, setSesionRecuperacion] = useState(null);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  // Se vuelve de una invitación: la pantalla de contraseña nueva es la
  // bienvenida (con el club y el correo con que va a entrar).
  const [bienvenida, setBienvenida] = useState(null);
  const sesionActual = useRef(null);
  // Para que la puerta se vuelva a dibujar al cambiar el idioma.
  useIdioma();
  const desdeCacheActual = useRef(false);
  const accionActual = useRef("");
  const montado = useRef(true);
  // Se vuelve del correo de "Olvidé mi contraseña". Se apaga al terminar (o
  // al cancelar): la marca del enlace queda en la URL de la pestaña, y sin
  // esto cada aviso de sesión de Supabase volvía a pedir la contraseña nueva.
  const recuperacionPendiente = useRef(esRecuperacionSolicitada());
  // La invitación del enlace se atiende una vez: después de elegir la
  // contraseña, los avisos de sesión no la vuelven a pedir.
  const invitacionAtendida = useRef(false);
  const pideBienvenida = (session) =>
    Boolean(session?.user) && !invitacionAtendida.current && esInvitacionSolicitada(session.user);
  const abrirBienvenida = (session) => {
    anotarBienvenidaPendiente(session.user?.id || "");
    setBienvenida({ club: String(session.user?.user_metadata?.club || "").trim(), correo: session.user?.email || "" });
    setModoRecuperacion(true);
    setSesionRecuperacion(session);
    setError("");
  };

  const ponerSesion = (nueva) => {
    sesionActual.current = nueva;
    setSesion(nueva);
  };

  const marcarDesdeCache = (valor) => {
    desdeCacheActual.current = valor;
    setDesdeCache(valor);
  };

  const cambiarAccion = (valor) => {
    accionActual.current = valor;
    setAccion(valor);
  };

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Si comprobar la cuenta tarda (sin señal, Supabase insiste un rato antes
  // de rendirse), se avisa que no está trabado.
  useEffect(() => {
    if (!cargando) return undefined;
    const reloj = window.setTimeout(() => setTardando(true), TARDA_MS);
    return () => {
      window.clearTimeout(reloj);
      setTardando(false);
    };
  }, [cargando]);

  // La cuenta de quien entró: su fila de perfiles. Sin señal, la copia del
  // celular; sin copia, se avisa.
  const resolverPerfil = useCallback(async (session) => {
    const userId = session?.user?.id;
    if (!userId) {
      setPerfil(null);
      return;
    }
    try {
      const fila = await conTopeDeRed(leerMiPerfil(userId), TOPE_PERFIL_MS);
      const cuenta = fila || { user_id: userId, email: session.user?.email || "", estado: "pendiente" };
      guardarPerfilLocal(fila ? cuenta : null);
      setPerfil(cuenta);
      marcarDesdeCache(false);
    } catch (errorLectura) {
      const guardado = leerPerfilLocal(userId);
      if (guardado) {
        setPerfil(guardado);
        marcarDesdeCache(true);
        return;
      }
      setPerfil(null);
      // La base contesta en inglés: se muestra el texto de la clave que vino
      // (o el genérico), en el idioma de la app.
      const clave = String(errorLectura?.message || "");
      throw errorPropio(
        esFalloDeRed(errorLectura)
          ? "acceso.error.sinConexionCuenta"
          : /^[a-z]+(\.[a-zA-Z0-9]+)+$/.test(clave) ? clave : "acceso.error.noComprobar",
      );
    }
  }, []);

  // Entrar con la última cuenta que entró en este celular, sin sesión viva:
  // es lo que vale en la cancha sin señal.
  const entrarConCopia = (guardado) => {
    ponerSesion({ user: { id: guardado.user_id, email: guardado.email || "" }, sinSenal: true });
    setPerfil(guardado);
    marcarDesdeCache(true);
  };

  // Mientras se comprueba la cuenta al abrir: si ya se entró con la copia
  // del celular (sin señal, o porque tardaba), y la cuenta guardada con la
  // que se puede entrar sin esperar.
  const entroConCopiaAlAbrir = useRef(false);
  const copiaParaEntrar = () => {
    if (recuperacionPendiente.current || entroConCopiaAlAbrir.current) return null;
    if (esEnlaceDeInvitacion(ENLACE_DE_ACCESO) && !invitacionAtendida.current) return null;
    // Si Supabase ya contestó con una sesión, la copia tiene que ser de esa cuenta.
    return leerPerfilLocal(sesionActual.current?.user?.id || null);
  };
  const entrarSinEsperar = () => {
    const guardado = copiaParaEntrar();
    if (!guardado || !montado.current) return;
    entroConCopiaAlAbrir.current = true;
    if (sesionActual.current?.user?.id) {
      // La sesión ya está: falta la cuenta, que sigue leyéndose y la reemplaza al llegar.
      setPerfil(guardado);
      marcarDesdeCache(true);
    } else {
      entrarConCopia(guardado);
    }
    setCargando(false);
  };

  const iniciar = useCallback(async () => {
    setCargando(true);
    setError("");
    entroConCopiaAlAbrir.current = false;
    // Con barras pero sin datos, comprobar la cuenta puede no terminar nunca:
    // pasado un rato se entra con la cuenta guardada, como sin señal. Lo que
    // conteste después igual se usa.
    const reloj = window.setTimeout(entrarSinEsperar, ENTRAR_CON_COPIA_MS);

    try {
      // Sin señal y con una cuenta guardada se entra ya, sin esperar a que
      // Supabase termine de intentar renovar la sesión (tarda hasta medio
      // minuto en rendirse).
      if (sinSenal()) entrarSinEsperar();

      const { data, error: errorSesion } = await supabase.auth.getSession();
      if (!montado.current) return;
      const session = data?.session || null;

      if (recuperacionPendiente.current) {
        setModoRecuperacion(true);
        // Un enlace vencido o ya usado no abre nada, aunque en este celular
        // hubiera otra sesión abierta: no se le cambia la contraseña a esa.
        if (ENLACE_DE_ACCESO.error || !session) {
          setSesionRecuperacion(null);
          setError(t(claveDeEnlaceFallido(ENLACE_DE_ACCESO) || "acceso.error.enlaceRecuperacion"));
        } else {
          setSesionRecuperacion(session);
        }
        return;
      }

      // Vuelve de aceptar una invitación: primero elige su contraseña. La
      // base ya lo metió en el club al confirmarse el correo.
      if (pideBienvenida(session)) {
        abrirBienvenida(session);
        return;
      }
      if (esEnlaceDeInvitacion(ENLACE_DE_ACCESO) && !ENLACE_DE_ACCESO.error) {
        // El enlace de la invitación no abrió ninguna sesión. El correo ya
        // quedó confirmado al tocarlo (y la invitación, usada): se avisa que
        // elija su contraseña con Olvidé mi contraseña. Si fue por la señal
        // (supabase-js no pudo leer la cuenta del enlace), la URL queda como
        // está, para volver a cargarla con señal.
        if (!session) {
          const inicio = await supabase.auth.initialize?.();
          if (!montado.current) return;
          const sinRed = sinSenal() || esFalloDeRed(inicio?.error || errorSesion);
          if (!sinRed) limpiarParametroRecuperacion();
          setMensaje("");
          setError(t(sinRed ? "acceso.error.invitacionSinSenal" : "acceso.error.invitacionSinAbrir"));
          return;
        }
        // Es de una cuenta que no fue invitada: la entrada común, sin la marca en la URL.
        limpiarParametroRecuperacion();
      }

      // Un enlace del correo que no sirvió (vencido, ya usado): se avisa en
      // la puerta, sin dejar afuera a quien ya tenía la sesión abierta.
      if (ENLACE_DE_ACCESO.error) {
        setMensaje("");
        setError(t(claveDeEnlaceFallido(ENLACE_DE_ACCESO)));
        limpiarParametroRecuperacion();
      }

      if (errorSesion && !session) {
        if (entroConCopiaAlAbrir.current) return;
        // Sin señal (o con barras pero sin datos) y con la sesión vencida,
        // Supabase no la puede renovar: vale la última cuenta que entró acá.
        const guardado = esFalloDeRed(errorSesion) ? leerPerfilLocal() : null;
        if (!guardado) throw errorSesion;
        entrarConCopia(guardado);
        return;
      }

      ponerSesion(session);
      if (session) {
        await resolverPerfil(session);
      } else {
        // Supabase contestó bien y no hay sesión: nadie entró en este celular,
        // así que la copia (si quedó alguna) no vale.
        setPerfil(null);
        marcarDesdeCache(false);
      }
    } catch (errorInicio) {
      if (!montado.current) return;
      setError(
        esFalloDeRed(errorInicio)
          ? t("comun.sinConexion")
          : errorInicio?.message || t("acceso.error.noComprobar"),
      );
    } finally {
      window.clearTimeout(reloj);
      if (montado.current) setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolverPerfil]);

  useEffect(() => {
    let activo = true;

    iniciar();

    const { data } = supabase.auth.onAuthStateChange((evento, session) => {
      if (!activo) return;

      // La sesión inicial ya la resolvió iniciar(). Este aviso llega también
      // sin señal, con la sesión vacía, y no puede echar a quien entró con
      // la copia del celular.
      if (evento === "INITIAL_SESSION") return;

      if (evento === "PASSWORD_RECOVERY") recuperacionPendiente.current = true;
      if (evento === "PASSWORD_RECOVERY" || (recuperacionPendiente.current && session)) {
        setModoRecuperacion(true);
        setSesionRecuperacion(session || null);
        setError("");
        setCargando(false);
        return;
      }

      if (pideBienvenida(session)) {
        abrirBienvenida(session);
        setCargando(false);
        return;
      }

      if (evento === "SIGNED_OUT" || !session) {
        ponerSesion(null);
        setPerfil(null);
        marcarDesdeCache(false);
        return;
      }

      if (evento === "TOKEN_REFRESHED") {
        // Un token renovado sin nadie adentro (se salió sin señal) no abre nada.
        if (!sesionActual.current) return;
        ponerSesion(session);
        // Si se había entrado con la copia, ahora hay señal: se comprueba.
        if (desdeCacheActual.current) resolverPerfil(session).catch(() => {});
        return;
      }

      if (evento === "SIGNED_IN") {
        // Entrar desde el formulario ya lee la cuenta: no hace falta dos veces.
        if (accionActual.current === "ingresar" || accionActual.current === "crear") return;

        const actual = sesionActual.current;
        const otraCuenta = actual?.user?.id !== session.user?.id;
        // Entró en otra pestaña, volvió una sesión que no teníamos, o la que
        // había entrado con la copia ahora tiene señal: se comprueba la cuenta.
        if (otraCuenta || actual?.sinSenal || desdeCacheActual.current) {
          ponerSesion(session);
          resolverPerfil(session).catch((errorPerfil) => {
            if (activo && otraCuenta) setError(errorPerfil.message);
          });
        }
      }
    });

    // Al volver la señal, quien entró con la copia del celular se vuelve a
    // comprobar contra la base (permisos vigentes, cuenta bloqueada, etc.).
    const alVolverLaSenal = async () => {
      if (!activo) return;
      const actual = sesionActual.current;
      if (!actual || (!actual.sinSenal && !desdeCacheActual.current)) return;
      try {
        const { data: datos } = await supabase.auth.getSession();
        const session = datos?.session;
        if (!activo || !session) return;
        ponerSesion(session);
        await resolverPerfil(session);
      } catch {
        // Se vuelve a intentar con la próxima señal.
      }
    };
    window.addEventListener("online", alVolverLaSenal);

    return () => {
      activo = false;
      data?.subscription?.unsubscribe();
      window.removeEventListener("online", alVolverLaSenal);
    };
  }, [iniciar, resolverPerfil]);

  const ingresar = async (event) => {
    event.preventDefault();
    cambiarAccion("ingresar");
    setError("");
    setMensaje("");

    try {
      const { data, error: errorLogin } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (errorLogin) throw errorLogin;
      ponerSesion(data.session);
      setPassword("");
      await resolverPerfil(data.session);
    } catch (errorLogin) {
      setError(textoDeErrorDeAcceso(errorLogin, errorLogin?.message || t("acceso.error.noEntrar")));
    } finally {
      cambiarAccion("");
    }
  };

  const crearCuenta = async () => {
    cambiarAccion("crear");
    setError("");
    setMensaje("");

    try {
      const correo = email.trim();
      if (!correo || !password) {
        throw new Error(t("acceso.error.completar"));
      }
      // Con un correo que no puede existir (el punto del mensaje de invitación
      // pegado al final, por ejemplo) no se crea la cuenta: nunca le llegaría nada.
      if (!correoValido(correo)) {
        throw new Error(t("acceso.error.correoInvalido"));
      }

      const { data, error: errorRegistro } = await supabase.auth.signUp({
        email: correo,
        password,
      });

      if (errorRegistro) throw errorRegistro;

      if (data.session) {
        ponerSesion(data.session);
        setPassword("");
        await resolverPerfil(data.session);
      } else {
        setMensaje(t("acceso.cuentaCreada"));
      }
    } catch (errorRegistro) {
      setError(textoDeErrorDeMail(errorRegistro, errorRegistro?.message || t("acceso.error.noCrear")));
    } finally {
      cambiarAccion("");
    }
  };

  const solicitarRestablecimiento = async () => {
    cambiarAccion("recuperar");
    setError("");
    setMensaje("");

    try {
      const correo = email.trim();
      if (!correo) {
        throw new Error(t("acceso.error.escribiCorreo"));
      }

      const redirectTo = `${window.location.origin}/?training_recovery=1`;
      const { error: errorReset } = await supabase.auth.resetPasswordForEmail(correo, {
        redirectTo,
      });

      if (errorReset) throw errorReset;

      setMensaje(t("acceso.enlaceEnviado"));
    } catch (errorReset) {
      setError(textoDeErrorDeMail(errorReset, errorReset?.message || t("acceso.error.noEnviarCorreo")));
    } finally {
      cambiarAccion("");
    }
  };

  const guardarNuevaPassword = async (event) => {
    event.preventDefault();
    cambiarAccion("cambiar-password");
    setError("");
    setMensaje("");

    try {
      if (!sesionRecuperacion) throw errorPropio("acceso.error.enlaceNoValido");
      if (nuevaPassword.length < 8) throw errorPropio("acceso.error.minimo8");
      if (nuevaPassword !== confirmarPassword) throw errorPropio("acceso.error.noCoinciden");

      const { error: errorUpdate } = await supabase.auth.updateUser({
        password: nuevaPassword,
      });

      // También en la bienvenida de una invitación: solo se entra si Supabase
      // guardó la contraseña nueva, que cierra cualquier otra sesión abierta
      // de esa cuenta.
      if (errorUpdate) throw errorUpdate;
      invitacionAtendida.current = true;
      if (bienvenidaPendiente() === sesionRecuperacion.user?.id) anotarBienvenidaPendiente(null);

      const { data, error: errorSesion } = await supabase.auth.getSession();
      if (errorSesion) throw errorSesion;
      if (!data?.session) throw errorPropio("acceso.error.sesionNoAbierta");

      limpiarParametroRecuperacion();
      recuperacionPendiente.current = false;
      setModoRecuperacion(false);
      setBienvenida(null);
      setSesionRecuperacion(null);
      setNuevaPassword("");
      setConfirmarPassword("");
      ponerSesion(data.session);
      await resolverPerfil(data.session);
    } catch (errorUpdate) {
      setError(textoDeErrorAlGuardarContrasena(errorUpdate));
    } finally {
      cambiarAccion("");
    }
  };

  // Volver sin cambiar la contraseña: el enlace ya había abierto una sesión,
  // y no tiene sentido quedar adentro por un correo que no se terminó de usar.
  // Se cierra solo en este celular. Si el enlace no abrió nada (vencido) y en
  // el celular ya había otra sesión, se sigue con esa.
  const cancelarRecuperacion = async () => {
    limpiarParametroRecuperacion();
    recuperacionPendiente.current = false;
    if (sesionRecuperacion) {
      await conTope(supabase.auth.signOut({ scope: "local" }).catch(() => null), 4000);
      borrarSesionGuardada();
      guardarPerfilLocal(null);
    }
    setModoRecuperacion(false);
    setSesionRecuperacion(null);
    setError("");
    await iniciar();
  };

  const volverAComprobar = async () => {
    cambiarAccion("comprobar");
    setError("");
    try {
      await resolverPerfil(sesionActual.current);
    } catch (errorPerfil) {
      setError(errorPerfil.message);
    } finally {
      cambiarAccion("");
    }
  };

  const salir = async () => {
    cambiarAccion("salir");
    setError("");

    try {
      await fetch(RUTA_SESION_OPENFIELD, {
        method: "DELETE",
        cache: "no-store",
        headers: { Accept: "application/json" },
      }).catch(() => null);
      // Solo este celular: en la tablet o en otro teléfono la cuenta sigue
      // abierta. Sin señal Supabase no llega a cerrar nada, así que la sesión
      // guardada se borra a mano abajo.
      await conTope(supabase.auth.signOut({ scope: "local" }).catch(() => null), 4000);
    } finally {
      borrarSesionGuardada();
      guardarPerfilLocal(null);
      // Las copias de los clubes y el club elegido no quedan en el celular.
      limpiarAlSalir();
      ponerSesion(null);
      setPerfil(null);
      marcarDesdeCache(false);
      setPassword("");
      cambiarAccion("");
    }
  };

  if (cargando) {
    // Si tarda y en el celular quedó la cuenta que entró, se puede entrar
    // con ella sin esperar (como sin señal).
    const conCopia = tardando && Boolean(copiaParaEntrar());
    return (
      <PantallaAcceso
        titulo={t("acceso.cargandoTitulo")}
        texto={tardando ? t(conCopia ? "acceso.cargandoTardaConCopia" : "acceso.cargandoTarda") : t("acceso.cargandoTexto")}
      >
        <Espera />
        {conCopia && (
          <div className="training-access-form">
            <button type="button" className="training-access-primary" onClick={entrarSinEsperar}>
              {t("acceso.entrarSinConexion")}
            </button>
          </div>
        )}
      </PantallaAcceso>
    );
  }

  if (modoRecuperacion) {
    // La misma pantalla sirve de bienvenida a quien acepta una invitación: un
    // solo paso (elegir la contraseña) y adentro. Sin Volver: sin contraseña
    // propia no tendría con qué entrar después.
    const tituloBienvenida = bienvenida?.club
      ? t("acceso.bienvenidaTituloClub", { club: bienvenida.club })
      : t("acceso.bienvenidaTitulo");
    return (
      <PantallaAcceso
        titulo={bienvenida ? tituloBienvenida : t("acceso.recuperarTitulo")}
        texto={bienvenida ? t("acceso.bienvenidaTexto", { correo: bienvenida.correo }) : t("acceso.recuperarTexto")}
        onVolver={bienvenida ? undefined : cancelarRecuperacion}
        etiquetaVolver={t("comun.volver")}
      >
        <form onSubmit={guardarNuevaPassword} className="training-access-form">
          <label>
            {t("acceso.nuevaContrasena")}
            <input
              type="password"
              value={nuevaPassword}
              onChange={(event) => setNuevaPassword(event.target.value)}
              autoComplete="new-password"
              minLength="8"
              required
            />
          </label>

          <label>
            {t("acceso.repetirContrasena")}
            <input
              type="password"
              value={confirmarPassword}
              onChange={(event) => setConfirmarPassword(event.target.value)}
              autoComplete="new-password"
              minLength="8"
              required
            />
          </label>

          {error && <div className="training-access-message error">{error}</div>}

          <button
            type="submit"
            className="training-access-primary"
            disabled={Boolean(accion) || !sesionRecuperacion}
          >
            {accion === "cambiar-password"
              ? t("comun.guardando")
              : t(bienvenida ? "acceso.guardarYEntrar" : "acceso.guardarContrasena")}
          </button>
        </form>
      </PantallaAcceso>
    );
  }

  if (sesion && perfil) {
    const situacion = situacionDePerfil(perfil);
    const correo = perfil.email || sesion.user?.email || "";

    if (situacion === "ok") {
      return typeof children === "function"
        ? children({
            email: correo,
            userId: sesion.user?.id || perfil.user_id || "",
            permisos: permisosDePerfil(perfil),
            perfil,
            desdeCache,
            cerrarSesion: salir,
          })
        : children;
    }

    const textos = {
      pendiente: { titulo: t("acceso.pendienteTitulo"), texto: t("acceso.pendienteTexto", { correo }) },
      bloqueado: { titulo: t("acceso.bloqueadoTitulo"), texto: t("acceso.bloqueadoTexto") },
      "sin-modulos": { titulo: t("acceso.sinModulosTitulo"), texto: t("acceso.sinModulosTexto") },
    }[situacion];

    return (
      <PantallaAcceso titulo={textos.titulo} texto={textos.texto}>
        <div className="training-access-form">
          {error && <div className="training-access-message error">{error}</div>}
          <button type="button" className="training-access-primary" onClick={volverAComprobar} disabled={Boolean(accion)}>
            {accion === "comprobar" ? t("acceso.comprobando") : t("acceso.comprobar")}
          </button>
          <div className="training-access-enlaces">
            <button type="button" className="training-access-enlace" onClick={salir} disabled={Boolean(accion)}>
              {accion === "salir" ? t("comun.saliendo") : t("comun.salir")}
            </button>
          </div>
        </div>
      </PantallaAcceso>
    );
  }

  if (sesion && !perfil) {
    return (
      <PantallaAcceso titulo={t("acceso.noPudimosTitulo")} texto={error || t("acceso.noPudimosTexto")}>
        <div className="training-access-form">
          <button type="button" className="training-access-primary" onClick={volverAComprobar} disabled={Boolean(accion)}>
            {accion === "comprobar" ? t("acceso.comprobando") : t("comun.reintentar")}
          </button>
          <div className="training-access-enlaces">
            <button type="button" className="training-access-enlace" onClick={salir} disabled={Boolean(accion)}>
              {accion === "salir" ? t("comun.saliendo") : t("comun.salir")}
            </button>
          </div>
        </div>
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso titulo={t("acceso.entrarTitulo")} texto={t("acceso.entrarTexto")}>
      <form onSubmit={ingresar} className="training-access-form">
        <label>
          {t("acceso.correo")}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder={t("acceso.correoEjemplo")}
            required
          />
        </label>

        <label>
          {t("acceso.contrasena")}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            minLength="8"
            required
          />
        </label>

        {error && <div className="training-access-message error">{error}</div>}
        {mensaje && <div className="training-access-message ok">{mensaje}</div>}

        <button type="submit" className="training-access-primary" disabled={Boolean(accion)}>
          {accion === "ingresar" ? t("acceso.entrando") : t("acceso.entrar")}
        </button>

        <div className="training-access-enlaces">
          <button
            type="button"
            className="training-access-enlace"
            onClick={solicitarRestablecimiento}
            disabled={Boolean(accion)}
          >
            {accion === "recuperar" ? t("acceso.enviando") : t("acceso.olvide")}
          </button>

          <button
            type="button"
            className="training-access-enlace"
            onClick={crearCuenta}
            disabled={Boolean(accion)}
          >
            {accion === "crear" ? t("acceso.creando") : t("acceso.crear")}
          </button>
        </div>
      </form>

      <small>{t("acceso.notaAutorizacion")}</small>
    </PantallaAcceso>
  );
}
