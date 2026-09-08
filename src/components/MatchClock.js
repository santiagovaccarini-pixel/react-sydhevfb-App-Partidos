import React, { useEffect, useState } from "react";
import {
  formatearDuracion,
  formatearTiempoTransmision,
  segundosEntre,
} from "../domain/match";

const useAhora = () => {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  return ahora;
};

const horaDesdeInstante = (instante) =>
  new Date(instante).toLocaleTimeString("es-AR", { hour12: false });

export const HoraActual = () => {
  const ahora = useAhora();
  return (
    <time dateTime={new Date(ahora).toISOString()}>
      {horaDesdeInstante(ahora)}
    </time>
  );
};

export const RelojPartido = ({
  periodo,
  modoTiempo,
  referencia,
  baseSegundos,
  inicio,
  final,
}) => {
  const ahora = useAhora();
  const horaReal = horaDesdeInstante(ahora);
  const iniciado = Boolean(inicio);
  const finalizado = Boolean(final);

  let valor = "00:00";
  if (modoTiempo === "transmision") {
    const referenciaNumerica = Number(referencia);
    valor =
      final ||
      (referenciaNumerica
        ? formatearTiempoTransmision(
            Number(baseSegundos || 0) +
              Math.max(0, Math.floor((ahora - referenciaNumerica) / 1000)),
          )
        : inicio || formatearTiempoTransmision(baseSegundos || 0));
  } else if (iniciado) {
    valor =
      formatearDuracion(segundosEntre(inicio, final || horaReal)) || "00:00";
  }

  return (
    <section className="reloj-principal" aria-live="off">
      <div className="cinta-reloj">
        <span
          className={`badge-vivo ${iniciado && !finalizado ? "activo" : ""}`}
        >
          <span className="punto-estado" />
          {finalizado ? "Finalizado" : iniciado ? "En vivo" : "Sin iniciar"}
        </span>
        <span className="hora-real-reloj">
          Hora real <strong>{horaReal}</strong>
        </span>
      </div>

      <div className="reloj-centro">
        <span className="rotulo-reloj">{periodo} · RELOJ DEL PERÍODO</span>
        <strong className="valor-reloj">{valor}</strong>
      </div>
    </section>
  );
};
