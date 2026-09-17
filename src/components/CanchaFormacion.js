import React, { useLayoutEffect, useRef, useState } from "react";

import {
  FRANJAS,
  MAXIMO_EN_CANCHA,
  apellido,
  escalonarFila,
  jugadoresDeLaFranja,
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
const mismosEscalones = (uno, otro) => {
  const clavesUno = Object.keys(uno);
  const clavesOtro = Object.keys(otro);
  return (
    clavesUno.length === clavesOtro.length &&
    clavesUno.every(
      (clave) =>
        uno[clave]?.nivel === otro[clave]?.nivel &&
        uno[clave]?.dx === otro[clave]?.dx,
    )
  );
};

const Puesto = ({
  puesto,
  cancha,
  cambio,
  onCambiar,
  onTocar,
  soloLectura,
  escalon = null,
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

  // El puesto mide lo que mide el nombre. Antes se lo recortaba al lugar que le
  // tocaba en la fila y los apellidos largos quedaban cortados; ahora el cuadro
  // se agranda hacia los costados. El único tope es la cancha.
  const estilo = {
    left: `${puesto.x}%`,
    top: `${puesto.y}%`,
  };

  if (escalon?.dx) {
    estilo.marginLeft = `${escalon.dx}px`;
  }

  const claseEscalon = escalon?.nivel || "";

  if (soloLectura) {
    return (
      <span
        data-puesto={puesto.id}
        className={`puesto-cancha ${cambio ? "con-cambio" : ""} ${claseEscalon}`}
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
      data-puesto={puesto.id}
      className={`puesto-cancha ${puesto.aMano ? "a-mano" : ""} ${
        moviendo ? "moviendo" : ""
      } ${cambio ? "con-cambio" : ""} ${claseEscalon}`}
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
  plantel = [],
  soloLectura = false,
  titulo = "Formación",
  cambios = {},
}) => {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [eligiendo, setEligiendo] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const pista = useRef(null);
  // Qué puesto se corre para arriba y cuál para abajo cuando los nombres de una
  // fila no entran de corrido. Se llena midiendo lo ya dibujado.
  const [escalones, setEscalones] = useState({});

  const normalizada = normalizarCancha(cancha);
  const puestos = puestosDeCancha(normalizada);
  const total = totalEnCancha(normalizada);
  const puestas = titularesDeCancha(normalizada).filter(
    (nombre) => nombre,
  ).length;
  const tomados = titularesDeCancha(normalizada).filter(Boolean);
  const enElPuesto = puestos.find((puesto) => puesto.id === eligiendo);
  const franja = FRANJAS.find((una) => una.id === enElPuesto?.franja);

  // El desplegable de cada línea ofrece a los de esa línea. Los que todavía no
  // tienen rol cargado no son "de otra línea": quedan detrás de "Ver todo el
  // plantel", para que nunca se llegue a una lista vacía.
  const delSector = jugadoresDeLaFranja(plantel, enElPuesto?.franja);
  const aElegir = verTodos || delSector.length === 0 ? plantel : delSector;
  const faltan = plantel.length - delSector.length;

  /**
   * Un apellido largo agranda su cuadro, y en una fila cargada los cuadros se
   * terminan pisando. Cuando eso pasa, la fila se escalona: los de adentro
   * bajan y los de afuera suben, que es como se paran en la cancha —los dos
   * centrales atrás de los laterales, los dos volantes del medio atrás de los
   * externos—. Solo se mueve la fila que lo necesita.
   *
   * Se mide lo dibujado, así que hace falta el layout; las filas se arman con
   * la `y` del puesto y no con la posición en pantalla, que es justamente lo
   * que este efecto cambia.
   */
  useLayoutEffect(() => {
    const cancha = pista.current;
    if (!cancha) return;

    const anchoCancha = cancha.getBoundingClientRect().width;
    // Sin layout no hay nada que medir: la cancha todavía no se dibujó, está
    // escondida, o el entorno no calcula tamaños.
    if (!anchoCancha) return;

    const filas = new Map();

    puestos.forEach((puesto) => {
      const nodo = cancha.querySelector(`[data-puesto="${puesto.id}"]`);
      if (!nodo) return;

      // El centro sale del dato y el ancho del dibujo. Ninguno de los dos
      // depende del corrimiento ya aplicado, así que la cuenta no se persigue
      // a sí misma.
      const ancho = nodo.getBoundingClientRect().width;
      if (!ancho) return;

      const centro = (puesto.x / 100) * anchoCancha;
      const fila = Math.round(puesto.y);
      if (!filas.has(fila)) filas.set(fila, []);
      filas.get(fila).push({
        id: puesto.id,
        x: puesto.x,
        ancho,
        izquierda: centro - ancho / 2,
        derecha: centro + ancho / 2,
      });
    });

    const nuevos = {};
    filas.forEach((fila) => Object.assign(nuevos, escalonarFila(fila)));

    setEscalones((previos) =>
      mismosEscalones(previos, nuevos) ? previos : nuevos,
    );
  });

  const aplicar = (nueva) => {
    onCambiar?.(nueva);
  };

  const abrirPuesto = (id) => {
    setVerTodos(false);
    setEligiendo(id);
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

      <div className="pista" ref={pista}>
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
            escalon={escalones[puesto.id]}
            onCambiar={aplicar}
            onTocar={abrirPuesto}
          />
        ))}

        {eligiendo && (
          <div className="elegir-jugador">
            <div className="alto-elegir">
              <b>
                Puesto {enElPuesto?.numero}
                {franja && <i>{franja.nombre}</i>}
              </b>
              <button
                type="button"
                className="cerrar-elegir"
                onClick={() => setEligiendo(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="lista-elegir">
              {aElegir
                .filter((jugador) => String(jugador?.nombre || "").trim())
                .map(({ nombre }) => {
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

              {aElegir.length === 0 && (
                <p className="sin-jugadores">
                  No hay nadie cargado en el plantel. Se agregan en Ajustes ›
                  Jugadores.
                </p>
              )}
            </div>

            <div className="pie-elegir">
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

              {delSector.length > 0 && faltan > 0 && (
                <button
                  type="button"
                  className="ver-todos"
                  onClick={() => setVerTodos((previo) => !previo)}
                >
                  {verTodos
                    ? `Solo ${franja?.nombre?.toLowerCase()}`
                    : `Ver todo el plantel (${faltan} más)`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanchaFormacion;
