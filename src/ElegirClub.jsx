import React, { useCallback, useEffect, useState } from "react";
import { PantallaAcceso } from "./AccessGate.jsx";
import PedidoAcceso from "./PedidoAcceso.jsx";
import { cargarEquipos, guardarEquipoElegido } from "./domain/equipo.js";
import { salirDelClub } from "./domain/pedidosDb.js";
import { EscudoDeClub } from "./components/ClubCrest";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// Lo segundo que ve una cuenta, después de entrar: con qué club va a
// trabajar. Queda guardado en el celular; desde el portal se puede cambiar.
// Se ven solo los clubes en los que está o estuvo. Quien no está hoy en
// ninguno pide acceso al suyo y espera (como en la puerta); quien ya está en
// alguno, debajo de la lista, puede pedir entrar a otro con el mismo pedido y
// la misma espera. Los clubes se crean desde Clubes de la app, que es de los
// dueños: ahí no se entra a ningún club.
// Abajo de todo, quien sigue activo en el club elegido (`club`) puede irse:
// es el único lugar de la app para salir de un club, igual para todos (también
// para los dueños, a los que nadie más puede sacar). Después avisa con
// `onSalioDelClub` para que el portal relea ese club.
export default function ElegirClub({
  onElegir,
  onSalir,
  esDueno = false,
  email = "",
  onClubesDeLaApp = null,
  club = null,
  onSalioDelClub = null,
}) {
  useIdioma();
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  // Salir del club elegido: la hoja de confirmar, mientras se sale y cómo
  // salió ({ ok, clave, datos }).
  const [aSalir, setASalir] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [avisoSalida, setAvisoSalida] = useState(null);
  // Pedir entrar a otro club: el pedido se abre al tocar el enlace.
  const [pidiendoOtro, setPidiendoOtro] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    const respuesta = await cargarEquipos();
    setEquipos(respuesta.equipos || []);
    if (respuesta.error) setError(t("club.error"));
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const elegir = (equipo) => {
    guardarEquipoElegido(equipo);
    onElegir(equipo);
  };

  // Una base de antes le mostraba al dueño clubes en los que no está: esos
  // no se muestran (adentro no vería nada).
  const visibles = equipos.filter((equipo) => equipo.miembro !== false);
  const activos = visibles.filter((equipo) => !equipo.hasta);
  const sinClubActivo = !cargando && !error && activos.length === 0;
  // Con algún club activo, el pedido a otro va como enlace debajo de la lista
  // (lo principal sigue siendo elegir). No depende de `cargando`: al volver a
  // comprobar, la lista se relee y el pedido abierto no desaparece.
  const puedePedirOtro = !error && activos.length > 0;

  // El club elegido como lo dice la base ahora: si la cuenta sigue activa en
  // él, se puede ir.
  const elegido = club?.id ? visibles.find((equipo) => equipo.id === club.id) || null : null;
  const puedeSalir = !cargando && Boolean(elegido) && !elegido.hasta;

  // Irse del club elegido (último día: hoy). Se vuelve a leer la lista y el
  // portal relee su club: queda en solo lectura hasta hoy, como cualquiera que
  // se fue. Si no se pudo (el único admin, ya no está, sin señal), lo dice.
  const confirmarSalida = async () => {
    setASalir(false);
    if (!elegido) return;
    const { id, nombre } = elegido;
    setSaliendo(true);
    setAvisoSalida(null);
    try {
      await salirDelClub(id);
      setAvisoSalida({ ok: true, clave: "pedidos.saliste", datos: { club: nombre } });
      await cargar();
      onSalioDelClub?.();
    } catch (errorSalir) {
      setAvisoSalida({ ok: false, clave: errorSalir?.message || "pedidos.error.generico", datos: {} });
    } finally {
      setSaliendo(false);
    }
  };

  // Para los dueños, la entrada al panel (también sin ningún club).
  const alPanel = esDueno && onClubesDeLaApp && (
    <div className="elegir-club-panel">
      {sinClubActivo && <p className="elegir-club-estado">{t("club.vacioDueno")}</p>}
      <button type="button" className="training-access-primary elegir-club-panel-boton" onClick={onClubesDeLaApp}>
        {t("portal.clubesApp")}
      </button>
    </div>
  );

  // En ningún club, ni de antes: la pantalla del pedido de acceso.
  if (sinClubActivo && visibles.length === 0) {
    return (
      <PedidoAcceso correo={email} onComprobar={cargar} onSalir={onSalir} textoSinPedidos={t("club.vacio", { correo: email })}>
        {alPanel}
      </PedidoAcceso>
    );
  }

  // «Salir» solo cuando cierra la sesión (todavía sin club elegido). Desde
  // Cambiar se vuelve al portal, y así no se confunde con «Salir de {club}».
  return (
    <>
      <PantallaAcceso titulo={t("club.titulo")} texto={t("club.texto")} onVolver={onSalir} etiquetaVolver={club ? undefined : t("comun.salir")}>
        {error && (
          <div className="training-access-message error">
            {error}{" "}
            <button type="button" className="training-access-enlace" onClick={cargar}>
              {t("comun.reintentar")}
            </button>
          </div>
        )}
        {cargando ? (
          <p className="elegir-club-estado">{t("club.cargando")}</p>
        ) : (
          <ul className="elegir-club-lista">
            {visibles.map((equipo) => (
              <li key={equipo.id}>
                <button
                  type="button"
                  className={`elegir-club-opcion ${equipo.hasta ? "solo-lectura" : ""}`.trim()}
                  onClick={() => elegir(equipo)}
                >
                  <EscudoDeClub equipo="cam" nombre={equipo.nombre} compacto />
                  <span className="elegir-club-texto">
                    <span className="elegir-club-nombre">{equipo.nombre}</span>
                    {equipo.hasta && <small className="elegir-club-detalle">{t("club.hasta", { fecha: fechaCorta(equipo.hasta) })}</small>}
                  </span>
                  <b aria-hidden="true">›</b>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Ya está en algún club: pedir entrar a otro, como enlace; al tocarlo,
            el mismo pedido de siempre (o la espera, si ya hay uno abierto). */}
        {puedePedirOtro &&
          (pidiendoOtro ? (
            <PedidoAcceso
              correo={email}
              enPantalla={false}
              onComprobar={cargar}
              tituloSinPedidos={t("club.pedirOtro")}
              textoSinPedidos={t("pedidos.error.faltaMigracion")}
            />
          ) : (
            <div className="elegir-club-otro">
              <div className="training-access-enlaces">
                <button type="button" className="training-access-enlace" onClick={() => setPidiendoOtro(true)}>
                  {t("club.pedirOtro")}
                </button>
              </div>
            </div>
          ))}

        {/* Solo clubes de los que se fue: los sigue mirando y, abajo, pide entrar a otro. */}
        {sinClubActivo && <PedidoAcceso correo={email} enPantalla={false} onComprobar={cargar} textoSinPedidos={t("club.vacio", { correo: email })} />}

        {alPanel}

        {/* Salir del club elegido: abajo de todo y como enlace, para no competir con elegir. */}
        {(puedeSalir || avisoSalida) && (
          <div className="elegir-club-salir">
            {avisoSalida && (
              <div className={`training-access-message ${avisoSalida.ok ? "ok" : "error"}`} role="status">
                {t(avisoSalida.clave, avisoSalida.datos)}
              </div>
            )}
            {puedeSalir && (
              <div className="training-access-enlaces">
                <button type="button" className="training-access-enlace" disabled={saliendo} onClick={() => setASalir(true)}>
                  {saliendo ? t("comun.saliendo") : t("club.salirDe", { club: elegido.nombre })}
                </button>
              </div>
            )}
          </div>
        )}
      </PantallaAcceso>

      {/* Fuera de la tarjeta: su fondo borroso encerraría la hoja. */}
      <HojaConfirmar
        abierta={aSalir}
        icono="salir"
        titulo={t("pedidos.salirTitulo", { club: elegido?.nombre || "" })}
        descripcion={t("pedidos.salirTexto")}
        etiquetaConfirmar={t("pedidos.siSalir")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarSalida}
        onCancelar={() => setASalir(false)}
      />
    </>
  );
}
