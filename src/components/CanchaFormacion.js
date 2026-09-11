import React, { useRef, useState } from "react";

import {
  FRANJAS,
  MAXIMO_EN_CANCHA,
  apellido,
  cambiarLinea,
  hayPuestosAMano,
  moverPuesto,
  nombreDeFormacion,
  normalizarCancha,
  ponerJugador,
  puestosDeCancha,
  reacomodarCancha,
  titularesDeCancha,
  totalEnCancha,
} from "../domain/formacion.js";

const DIBUJO = (
  <svg viewBox="0 0 100 130" preserveAspectRatio="none" aria-hidden="true">
    <rect x="2" y="2" width="96" height="126" />
    <line x1="2" y1="65" x2="98" y2="65" />
    <circle cx="50" cy="65" r="13" />
    <rect x="28" y="2" width="44" height="17" />
    <rect x="40" y="2" width="20" height="7" />
    <rect x="28" y="111" width="44" height="17" />
    <rect x="40" y="121" width="20" height="7" />
  </svg>
);

/**
 * Un puesto de la cancha. Se arrastra para dejarlo donde quieras y un toque
 * sin mover abre la lista de jugadores.
 */
const Puesto = ({
  puesto,
  cancha,
  cambio,
  onCambiar,
  onTocar,
  soloLectura,
}) => {
  const boton = useRef(null);
  const arrastre = useRef({ activo: false, movio: false, desde: null });
  const [moviendo, setMoviendo] = useState(false);
  // Arrastrar termina en un click del navegador: hay que saber distinguirlo
  // de un toque para no abrir la lista al soltar la ficha.
  const arrastro = useRef(false);

  const empezar = (evento) => {
    if (soloLectura) return;
    arrastre.current = {
      activo: true,
      movio: false,
      desde: { x: evento.clientX, y: evento.clientY },
    };
    arrastro.current = false;
    boton.current?.setPointerCapture?.(evento.pointerId);
  };

  const mover = (evento) => {
    const estado = arrastre.current;
    if (!estado.activo) return;

    const corrido = Math.hypot(
      evento.clientX - estado.desde.x,
      evento.clientY - estado.desde.y,
    );
    if (!estado.movio && corrido < 5) return;
    if (!estado.movio) setMoviendo(true);
    estado.movio = true;
    arrastro.current = true;

    const pista = boton.current?.parentElement;
    if (!pista) return;

    const caja = pista.getBoundingClientRect();
    const ficha = boton.current.getBoundingClientRect();
    // El puesto se dibuja centrado en su punto, así que hay que dejarle media
    // ficha de aire contra cada borde para que no se salga de la cancha.
    const mitadAncho = (ficha.width / caja.width) * 50;
    const mitadAlto = (ficha.height / caja.height) * 50;
    const entre = (valor, minimo, maximo) =>
      Math.min(maximo, Math.max(minimo, valor));

    onCambiar(
      moverPuesto(
        cancha,
        puesto.id,
        entre(
          ((evento.clientX - caja.left) / caja.width) * 100,
          mitadAncho + 1,
          99 - mitadAncho,
        ),
        entre(
          ((evento.clientY - caja.top) / caja.height) * 100,
          mitadAlto + 1,
          99 - mitadAlto,
        ),
      ),
    );
  };

  const soltar = () => {
    if (!arrastre.current.activo) return;
    arrastre.current = { activo: false, movio: false, desde: null };
    setMoviendo(false);
  };

  // Con el click y no con el pointerup, así también se abre con el teclado.
  const tocar = () => {
    if (arrastro.current) {
      arrastro.current = false;
      return;
    }
    onTocar(puesto.id);
  };

  const etiqueta = puesto.nombre
    ? `${puesto.nombre}, puesto ${puesto.numero}`
    : `Puesto ${puesto.numero} libre`;

  // Al que lo cambiaron se lee como un cambio: su cuadro de siempre con la
  // flecha roja y, abajo, un cuadro negro con el que entró y la hora. La hora
  // va en su propia línea: al lado del nombre, con cuatro en una fila, no
  // entrarían los dos.
  const adentro = cambio ? (
    <>
      <span className="ficha-cancha salio-cancha">
        {apellido(puesto.nombre)}
        <i>↓</i>
      </span>
      <span className="entro-cancha">
        <b>↑ {apellido(cambio.entra)}</b>
        <em>{cambio.hora}</em>
      </span>
    </>
  ) : puesto.nombre ? (
    <span className="ficha-cancha">{apellido(puesto.nombre)}</span>
  ) : (
    <span className="ficha-cancha vacia">{puesto.numero}</span>
  );

  const estilo = {
    left: `${puesto.x}%`,
    top: `${puesto.y}%`,
    maxWidth: `${puesto.ancho}%`,
  };

  if (soloLectura) {
    return (
      <span
        className={`puesto-cancha ${cambio ? "con-cambio" : ""}`}
        style={estilo}
        title={etiqueta}
      >
        {adentro}
      </span>
    );
  }

  return (
    <button
      ref={boton}
      type="button"
      className={`puesto-cancha ${puesto.aMano ? "a-mano" : ""} ${
        moviendo ? "moviendo" : ""
      } ${cambio ? "con-cambio" : ""}`}
      style={estilo}
      aria-label={etiqueta}
      onClick={tocar}
      onPointerDown={empezar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      {adentro}
    </button>
  );
};

/**
 * La cancha con la formación: elegís cuántos van en cada línea, tocás cada
 * puesto para cargar al jugador y lo acomodás a mano si querés.
 */
const CanchaFormacion = ({
  cancha,
  onCambiar,
  opciones = [],
  soloLectura = false,
  titulo = "Formación",
  cambios = {},
}) => {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [eligiendo, setEligiendo] = useState(null);

  const normalizada = normalizarCancha(cancha);
  const puestos = puestosDeCancha(normalizada);
  const total = totalEnCancha(normalizada);
  const puestas = titularesDeCancha(normalizada).filter(
    (nombre) => nombre,
  ).length;
  const tomados = titularesDeCancha(normalizada).filter(Boolean);
  const enElPuesto = puestos.find((puesto) => puesto.id === eligiendo);

  const aplicar = (nueva) => {
    onCambiar?.(nueva);
  };

  return (
    <div className="cancha-formacion">
      <div className="cabecera-cancha">
        <h2>{titulo}</h2>

        {!soloLectura ? (
          <button
            type="button"
            className={`chip-formacion ${panelAbierto ? "abierto" : ""}`}
            onClick={() => setPanelAbierto((previo) => !previo)}
            aria-expanded={panelAbierto}
          >
            {nombreDeFormacion(normalizada)}
          </button>
        ) : (
          <span className="chip-formacion fijo">
            {nombreDeFormacion(normalizada)}
          </span>
        )}

        <span
          className={`cuenta-cancha ${puestas === total ? "completo" : ""}`}
        >
          {puestas}/{total}
        </span>
      </div>

      {panelAbierto && !soloLectura && (
        <div className="panel-formacion">
          {FRANJAS.map((franja) => (
            <div className="linea-formacion" key={franja.id}>
              <b>{franja.nombre}</b>

              <button
                type="button"
                className="paso-formacion"
                disabled={normalizada.lineas[franja.id] === 0}
                aria-label={`Quitar uno en ${franja.nombre}`}
                onClick={() =>
                  aplicar(cambiarLinea(normalizada, franja.id, -1))
                }
              >
                −
              </button>

              <span className="valor-formacion">
                {normalizada.lineas[franja.id]}
              </span>

              <button
                type="button"
                className="paso-formacion"
                disabled={total >= MAXIMO_EN_CANCHA}
                aria-label={`Sumar uno en ${franja.nombre}`}
                onClick={() => aplicar(cambiarLinea(normalizada, franja.id, 1))}
              >
                +
              </button>
            </div>
          ))}

          <p className="pie-formacion">
            Hasta {MAXIMO_EN_CANCHA} entre los tres.
            <button
              type="button"
              disabled={!hayPuestosAMano(normalizada)}
              onClick={() => aplicar(reacomodarCancha(normalizada))}
            >
              Reacomodar
            </button>
          </p>
        </div>
      )}

      <div className="pista">
        {DIBUJO}
        <div className="franja-cancha ata">
          <span>Ataque</span>
        </div>
        <div className="franja-cancha med">
          <span>Mediocampo</span>
        </div>
        <div className="franja-cancha def">
          <span>Defensa</span>
        </div>

        {puestos.map((puesto) => (
          <Puesto
            key={puesto.id}
            puesto={puesto}
            cancha={normalizada}
            cambio={puesto.nombre ? cambios[puesto.nombre] : null}
            soloLectura={soloLectura}
            onCambiar={aplicar}
            onTocar={setEligiendo}
          />
        ))}

        {eligiendo && (
          <div className="elegir-jugador">
            <div className="alto-elegir">
              <b>Puesto {enElPuesto?.numero}</b>
              <button
                type="button"
                className="cerrar-elegir"
                onClick={() => setEligiendo(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="lista-elegir">
              {opciones
                .filter((nombre) => String(nombre || "").trim())
                .map((nombre) => {
                  // El que ya está en otro puesto se puede elegir igual: se
                  // muda, no se duplica.
                  const enCancha = tomados.includes(nombre);

                  return (
                    <button
                      type="button"
                      key={nombre}
                      className={nombre === enElPuesto?.nombre ? "activo" : ""}
                      onClick={() => {
                        aplicar(ponerJugador(normalizada, eligiendo, nombre));
                        setEligiendo(null);
                      }}
                    >
                      {nombre}
                      {enCancha && nombre !== enElPuesto?.nombre && (
                        <i>en cancha</i>
                      )}
                    </button>
                  );
                })}
            </div>

            {enElPuesto?.nombre && (
              <button
                type="button"
                className="vaciar-puesto"
                onClick={() => {
                  aplicar(ponerJugador(normalizada, eligiendo, ""));
                  setEligiendo(null);
                }}
              >
                Dejar el puesto libre
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CanchaFormacion;
