import React, { useCallback, useEffect, useState } from "react";
import { PantallaAcceso } from "./AccessGate.jsx";
import { cargarEquipos, crearEquipo, guardarEquipoElegido } from "./domain/equipo.js";
import { EscudoDeClub } from "./components/ClubCrest";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// Lo segundo que ve una cuenta nueva, después de entrar: con qué club va a
// trabajar. Queda guardado en el celular; desde el portal se puede cambiar.
export default function ElegirClub({ onElegir, onSalir }) {
  useIdioma();
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState("");

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

  const crear = async (evento) => {
    evento.preventDefault();
    setAviso("");
    setCreando(true);
    const respuesta = await crearEquipo(nombre);
    setCreando(false);
    if (respuesta.error || !respuesta.equipo) {
      setAviso(respuesta.error || t("club.error"));
      return;
    }
    elegir(respuesta.equipo);
  };

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
          {equipos.map((equipo) => {
            // El administrador ve también clubes en los que no está: esos no
            // se eligen (adentro no vería nada); se suma desde Cuentas.
            const sinMembresia = equipo.miembro === false;
            return (
              <li key={equipo.id}>
                <button
                  type="button"
                  className={`elegir-club-opcion ${equipo.hasta ? "solo-lectura" : ""}`.trim()}
                  disabled={sinMembresia}
                  onClick={() => elegir(equipo)}
                >
                  <EscudoDeClub equipo="cam" nombre={equipo.nombre} compacto />
                  <span className="elegir-club-texto">
                    <span className="elegir-club-nombre">{equipo.nombre}</span>
                    {equipo.hasta && <small className="elegir-club-detalle">{t("club.hasta", { fecha: fechaCorta(equipo.hasta) })}</small>}
                    {sinMembresia && <small className="elegir-club-detalle">{t("club.sinMembresia")}</small>}
                  </span>
                  <b aria-hidden="true">›</b>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!cargando && !error && equipos.length === 0 && <p className="elegir-club-estado">{t("club.vacio")}</p>}

      <form className="training-access-form elegir-club-crear" onSubmit={crear}>
        <label>
          {t("club.crear")}
          <input
            type="text"
            value={nombre}
            placeholder={t("club.nombre")}
            maxLength={60}
            onChange={(evento) => setNombre(evento.target.value)}
          />
        </label>
        {aviso && <div className="training-access-message error">{aviso}</div>}
        <button type="submit" className="training-access-primary" disabled={creando || !nombre.trim()}>
          {creando ? t("club.creando") : t("club.crearBoton")}
        </button>
      </form>
    </PantallaAcceso>
  );
}
