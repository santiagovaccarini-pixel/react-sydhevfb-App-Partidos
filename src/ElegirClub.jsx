import React, { useCallback, useEffect, useState } from "react";
import { PantallaAcceso } from "./AccessGate.jsx";
import PedidoAcceso from "./PedidoAcceso.jsx";
import { cargarEquipos, guardarEquipoElegido } from "./domain/equipo.js";
import { EscudoDeClub } from "./components/ClubCrest";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// Lo segundo que ve una cuenta, después de entrar: con qué club va a
// trabajar. Queda guardado en el celular; desde el portal se puede cambiar.
// Se ven solo los clubes en los que está o estuvo. Quien no está hoy en
// ninguno pide acceso al suyo y espera (como en la puerta). Los clubes se
// crean desde Clubes de la app, que es de los dueños: ahí no se entra a
// ningún club.
export default function ElegirClub({ onElegir, onSalir, esDueno = false, email = "", onClubesDeLaApp = null }) {
  useIdioma();
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <PantallaAcceso titulo={t("club.titulo")} texto={t("club.texto")} onVolver={onSalir} etiquetaVolver={t("comun.salir")}>
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

      {/* Solo clubes de los que se fue: los sigue mirando y, abajo, pide entrar a otro. */}
      {sinClubActivo && <PedidoAcceso correo={email} enPantalla={false} onComprobar={cargar} textoSinPedidos={t("club.vacio", { correo: email })} />}

      {alPanel}
    </PantallaAcceso>
  );
}
