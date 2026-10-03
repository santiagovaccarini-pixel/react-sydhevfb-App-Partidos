import React, { useState } from "react";
import { MAXIMO_PUESTOS, PUESTOS, ROLES, actualesPrimero, esActual } from "../domain/plantel.js";
import { normalizarTextoBase } from "../domain/match";
import { t } from "../idioma/index.js";

// Dónde juega cada jugador en Partido: hasta cuatro puestos (con su sigla) y
// los roles gruesos (Defensa, Mediocampo, Ataque). Es lo que estaba en
// Partido › Ajustes › Jugadores › Posiciones, igual, ahora en Datos básicos.

export const nombreDelPuesto = (sigla) => t(`datos.puestos.${sigla}`, {}, PUESTOS.find((puesto) => puesto.sigla === sigla)?.nombre || sigla);
const nombreDelRol = (rol) => t(`datos.roles.${rol}`, {}, rol);

/**
 * El botón de un puesto: muestra la sigla y al tocarlo abre la lista con los
 * nombres. Un select común muestra el texto de la opción elegida, así que con
 * él no se podría ver "VM" cerrado y "Volante Mixto" adentro.
 */
export const SelectorPuesto = ({ sigla = "", elegidos = [], onElegir, deshabilitado = false }) => {
  const [abierto, setAbierto] = useState(false);

  return (
    <span className="puesto-jugador">
      <button
        type="button"
        className={`boton-puesto ${abierto ? "abierto" : ""} ${sigla ? "" : "vacio"}`}
        onClick={() => setAbierto((previo) => !previo)}
        aria-expanded={abierto}
        aria-label={sigla ? nombreDelPuesto(sigla) : t("datos.posiciones.agregarPuesto")}
        disabled={deshabilitado}
      >
        {sigla || "+"}
      </button>

      {abierto && (
        <>
          <span className="tapa-puesto" onClick={() => setAbierto(false)} aria-hidden="true" />
          <span className="lista-puestos">
            {PUESTOS.map((puesto) => {
              // Los que ya tiene no se pueden repetir, salvo el de este botón.
              const tomado = elegidos.includes(puesto.sigla) && puesto.sigla !== sigla;
              return (
                <button
                  type="button"
                  key={puesto.sigla}
                  className={puesto.sigla === sigla ? "activo" : ""}
                  disabled={tomado}
                  onClick={() => {
                    onElegir(puesto.sigla);
                    setAbierto(false);
                  }}
                >
                  <i>{puesto.sigla}</i>
                  {nombreDelPuesto(puesto.sigla)}
                </button>
              );
            })}

            {sigla && (
              <button
                type="button"
                className="quitar-puesto"
                onClick={() => {
                  onElegir(null);
                  setAbierto(false);
                }}
              >
                {t("datos.posiciones.quitarPuesto")}
              </button>
            )}
          </span>
        </>
      )}
    </span>
  );
};

// plantel: [{ id, nombre, puestos, roles }]; onCambiar(jugador, { puestos?, roles? })
// guarda al toque (son cambios de un toque: volver atrás a buscar un botón de
// guardar sería peor).
export const PosicionesJugadores = ({ plantel, soloLectura = false, onCambiar }) => {
  const [buscador, setBuscador] = useState("");
  const busqueda = normalizarTextoBase(buscador);
  // El plantel actual primero; los que se fueron, abajo y marcados.
  const ordenados = actualesPrimero(plantel);
  const visibles = busqueda ? ordenados.filter((jugador) => normalizarTextoBase(jugador.nombre).includes(busqueda)) : ordenados;

  const cambiarPuesto = (jugador, indice, sigla) => {
    const puestos = [...jugador.puestos];
    if (sigla === null) puestos.splice(indice, 1);
    else puestos[indice] = sigla;
    onCambiar(jugador, { puestos });
  };
  const alternarRol = (jugador, rol) =>
    onCambiar(jugador, { roles: jugador.roles.includes(rol) ? jugador.roles.filter((uno) => uno !== rol) : [...jugador.roles, rol] });

  return (
    <section className="tarjeta tarjeta-ficha">
      <div className="cabeza-ficha">
        <b>{t("datos.posiciones.titulo")}</b>
        <span className="cuenta-ajuste">{visibles.length}</span>
      </div>
      <p className="pista-equipo">{t("datos.posiciones.texto")}</p>

      <input
        className="buscador-plantel"
        value={buscador}
        placeholder={t("datos.posiciones.buscar")}
        aria-label={t("datos.posiciones.buscar")}
        onChange={(evento) => setBuscador(evento.target.value)}
      />

      {visibles.length === 0 ? (
        <p className="vacio-ficha">{plantel.length ? t("datos.posiciones.nadie") : t("datos.vacio")}</p>
      ) : (
        visibles.map((jugador) => (
          <div className="jugador-puestos" key={jugador.id ?? jugador.nombre}>
            <div className="arriba-puestos">
              <b>
                {jugador.nombre}
                {!esActual(jugador) && <small className="ya-no-esta"> · {t("datos.yaNoEsta")}</small>}
              </b>
              {jugador.puestos.map((sigla, i) => (
                <SelectorPuesto
                  key={`${jugador.id}-${i}`}
                  sigla={sigla}
                  elegidos={jugador.puestos}
                  deshabilitado={soloLectura}
                  onElegir={(nueva) => cambiarPuesto(jugador, i, nueva)}
                />
              ))}
              {!soloLectura && jugador.puestos.length < MAXIMO_PUESTOS && (
                <SelectorPuesto elegidos={jugador.puestos} onElegir={(nueva) => onCambiar(jugador, { puestos: [...jugador.puestos, nueva] })} />
              )}
            </div>

            <div className="abajo-puestos">
              {ROLES.map((rol) => (
                <button
                  type="button"
                  key={rol}
                  className={`chip-rol ${jugador.roles.includes(rol) ? "activo" : ""}`}
                  onClick={() => alternarRol(jugador, rol)}
                  aria-pressed={jugador.roles.includes(rol)}
                  disabled={soloLectura}
                >
                  {nombreDelRol(rol)}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
};
