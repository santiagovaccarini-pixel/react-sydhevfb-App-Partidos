import React, { useEffect, useRef } from "react";
import { Icono } from "./components/AppChrome";
import { EscudoClub } from "./components/ClubCrest";
import { HojaInferior } from "./components/SheetPanel.js";
import {
  MODO_PARCIAL,
  estadoDeTarea,
  horaLocal,
  pausaAbierta,
  relojTexto,
  segundosDePausa,
  tiemposDeTarea,
} from "./domain/sesionEntrenamiento.js";

// Las piezas de la pantalla de Tareas, con la cara de la pantalla de partido:
// cabecera, reloj, pausas, solapas y el panel de la tarea activa. No guardan
// nada: reciben la tarea y avisan con las funciones que les pasan.

export const ETIQUETAS_ESTADO = {
  "sin-iniciar": "Sin iniciar",
  "en-curso": "En curso",
  "en-pausa": "En pausa",
  terminada: "Terminada",
};

export const SUGERENCIAS_NOMBRE = ["Calentamiento", "Rondo", "Posesión", "Reducido", "Finalización", "Pelota parada"];

const horaCorta = (hora) => String(hora || "").slice(0, 5);
const plural = (cantidad, singular, pluralTexto) => `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
const enMarcha = (estado) => estado === "en-curso" || estado === "en-pausa";

// La cabecera de la pantalla de partido: el escudo del club (el real si se
// encontró), la sesión, y a la derecha Borrar y Enviar, como Limpiar y Guardar.
export const CabeceraTablero = ({
  nombreSesion,
  nombreEquipo = "",
  escudoUrl = "",
  enCurso,
  etiquetaEnviar,
  onEnviar,
  onBorrar,
  puedeBorrar = false,
  deshabilitado = false,
}) => (
  <header className="cabecera-tablero">
    <div className="titulo-estado-partido">
      <span className="marca-movil-cabecera">
        <EscudoClub equipo="cam" nombre={nombreEquipo} url={escudoUrl} compacto />
      </span>
      <span className={`punto-estado ${enCurso ? "en-curso" : ""}`.trim()} />
      <div>
        <span className="sobrelinea">SESIÓN</span>
        <h1>{nombreSesion}</h1>
      </div>
    </div>
    <div className="acciones-cabecera">
      <button
        type="button"
        className="boton-limpiar-cabecera"
        onClick={onBorrar}
        disabled={!puedeBorrar}
        aria-label="Borrar tarea"
      >
        <Icono nombre="borrar" size={17} />
        <span>Borrar</span>
      </button>
      <button type="button" className="boton-guardar-cabecera" onClick={onEnviar} disabled={deshabilitado}>
        <Icono nombre="subir" size={18} />
        {etiquetaEnviar}
      </button>
    </div>
  </header>
);

export const RelojTarea = ({ tarea, numero, ahora }) => {
  const estado = estadoDeTarea(tarea);
  const tiempos = tiemposDeTarea(tarea, ahora);
  const abierta = pausaAbierta(tarea);
  const efectivo = `Efectivo ${relojTexto(tiempos.efectivoSegundos)}`;
  const detalle =
    estado === "sin-iniciar"
      ? "Tocá Iniciar tarea cuando arranque."
      : estado === "en-pausa"
        ? `${efectivo} · en pausa desde ${abierta.inicio}`
        : tarea.pausas.length > 0
          ? `${efectivo} · ${plural(tarea.pausas.length, "pausa", "pausas")} (${relojTexto(tiempos.pausasSegundos)})`
          : efectivo;

  return (
    <section className="reloj-principal" aria-live="off">
      <div className="cinta-reloj">
        <span
          className={`badge-vivo ${estado === "en-curso" ? "activo" : ""} ${estado === "en-pausa" ? "pausa" : ""}`
            .replace(/\s+/g, " ")
            .trim()}
        >
          <span className="punto-estado" />
          {ETIQUETAS_ESTADO[estado]}
        </span>
        <span className="hora-real-reloj">
          Hora real <strong>{horaLocal(new Date(ahora))}</strong>
        </span>
      </div>

      <div className="reloj-centro">
        <span className="rotulo-reloj">TAREA {numero} · RELOJ DE LA TAREA</span>
        <strong className="valor-reloj">{relojTexto(tiempos.brutoSegundos)}</strong>
        <span className="efectivo-reloj">{detalle}</span>
      </div>
    </section>
  );
};

// Solo la última pausa a la vista (la abierta, o la que acaba de terminar);
// las anteriores se despliegan a pedido. Así con diez pausas ocupa lo mismo
// que con una.
export const TarjetaPausas = ({ tarea, ahora, desplegada, onAlternar, onQuitar }) => {
  const estado = estadoDeTarea(tarea);
  const pausas = tarea.pausas;

  if (pausas.length === 0) {
    return (
      <section className="tarjeta-pausas" aria-label="Pausas de la tarea">
        <div className="cabeza-pausas">
          <div>
            <span className="sobrelinea">PAUSAS DE LA TAREA</span>
            <b>Sin pausas</b>
          </div>
        </div>
        <p className="vacio-pausas">
          {enMarcha(estado) ? "Tocá Pausa cuando el ejercicio se frene." : "Las pausas se registran con el botón Pausa mientras la tarea corre."}
        </p>
      </section>
    );
  }

  const tiempos = tiemposDeTarea(tarea, ahora);
  const visibles = desplegada ? pausas.map((pausa, i) => [pausa, i]) : [[pausas[pausas.length - 1], pausas.length - 1]];

  return (
    <section className="tarjeta-pausas" aria-label="Pausas de la tarea">
      <div className="cabeza-pausas">
        <div>
          <span className="sobrelinea">PAUSAS DE LA TAREA</span>
          <b>
            {plural(pausas.length, "pausa", "pausas")} · {relojTexto(tiempos.pausasSegundos)}
          </b>
        </div>
        {pausas.length > 1 && (
          <button type="button" className="boton-texto" onClick={onAlternar}>
            {desplegada ? "Ocultar anteriores" : `Ver anteriores (${pausas.length - 1})`}
          </button>
        )}
      </div>
      <ul className="lista-pausas">
        {visibles.map(([pausa, i]) => {
          const abierta = Boolean(pausa.inicio && !pausa.fin);
          const segundos = segundosDePausa(tarea, pausa, ahora);
          return (
            <li key={i} className={abierta ? "abierta" : ""}>
              <button
                type="button"
                className="quitar-pausa"
                aria-label={`Quitar pausa ${i + 1}`}
                onClick={() => onQuitar(i)}
              >
                <Icono nombre="borrar" size={14} />
              </button>
              <span>Pausa {i + 1}</span>
              <strong>
                {pausa.inicio || "--:--"} → {abierta ? "en curso" : pausa.fin || "--:--"}
              </strong>
              <em>{segundos === null ? "—" : relojTexto(segundos)}</em>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

// Una solapa por tarea, con el número; se deslizan de costado cuando son
// muchas y el + queda fijo a la derecha.
export const SolapasTareas = ({ tareas, activaId, textoPie, onElegir, onNueva, onVerTodas }) => {
  const cinta = useRef(null);

  useEffect(() => {
    const activa = cinta.current?.querySelector(".activo");
    if (activa && typeof activa.scrollIntoView === "function") {
      activa.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [activaId, tareas.length]);

  return (
    <section className="selector-periodos selector-tareas" aria-label="Tareas de la sesión">
      <div className="fila-solapas">
        <div className="cinta-solapas" role="tablist" ref={cinta}>
          {tareas.map((tarea, i) => {
            const estado = estadoDeTarea(tarea);
            const viva = enMarcha(estado);
            return (
              <button
                type="button"
                role="tab"
                key={tarea.id}
                aria-selected={tarea.id === activaId}
                aria-label={`Tarea ${i + 1}`}
                className={`${tarea.id === activaId ? "activo" : ""} ${viva ? "viva" : ""}`.trim()}
                onClick={() => onElegir(tarea.id)}
              >
                {i + 1} {estado === "terminada" && <Icono nombre="check" size={16} />}
                {viva && <i className="punto-solapa" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <button type="button" className="agregar-prorroga" aria-label="Nueva tarea" onClick={onNueva}>
          <Icono nombre="plus" size={20} />
        </button>
      </div>
      <div className="pie-solapas">
        <p>{textoPie}</p>
        {tareas.length > 0 && (
          <button type="button" className="boton-texto boton-ver-todas" onClick={onVerTodas}>
            Ver todas
          </button>
        )}
      </div>
    </section>
  );
};

export const PanelTarea = ({
  tarea,
  numero,
  total,
  pastilla,
  faltantes = [],
  cantidadJugadores,
  onNombre,
  onIniciar,
  onTerminar,
  onNueva,
  onJugadores,
  onPausa,
  onEntraSale,
  children,
}) => {
  const estado = estadoDeTarea(tarea);
  const corriendo = enMarcha(estado);

  return (
    <section className="panel-operativo panel-periodo-operativo panel-tarea">
      <div className="panel-titulo">
        <div>
          <span className="sobrelinea">
            TAREA {numero} DE {total}
          </span>
          <input
            className="nombre-tarea"
            type="text"
            value={tarea.nombre}
            onChange={(e) => onNombre(e.target.value)}
            placeholder="Nombre de la tarea"
            aria-label="Nombre de la tarea"
            autoComplete="off"
          />
          {!tarea.nombre && (
            <div className="sugerencias-nombre">
              {SUGERENCIAS_NOMBRE.map((sugerencia) => (
                <button type="button" key={sugerencia} onClick={() => onNombre(sugerencia)}>
                  {sugerencia}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={`estado-tarea ${pastilla.clase || ""}`.trim()}>{pastilla.etiqueta}</span>
      </div>

      {estado === "sin-iniciar" && (
        <button type="button" className="accion-periodo" onClick={onIniciar}>
          <span className="simbolo-accion-periodo" aria-hidden="true" />
          Iniciar tarea
        </button>
      )}
      {corriendo && (
        <button type="button" className="accion-periodo finalizar" onClick={onTerminar}>
          <span className="simbolo-accion-periodo" aria-hidden="true" />
          Terminar tarea
        </button>
      )}
      {estado === "terminada" && (
        <button type="button" className="accion-periodo" onClick={onNueva}>
          <Icono nombre="plus" size={20} />
          Nueva tarea
        </button>
      )}

      <div className="acciones-rapidas">
        <button type="button" className="accion-cambio" onClick={onJugadores}>
          <Icono nombre="formacion" />
          <span>Jugadores · {cantidadJugadores}</span>
        </button>
        <button
          type="button"
          className={estado === "en-pausa" ? "activa" : ""}
          onClick={onPausa}
          disabled={!corriendo}
        >
          <Icono nombre="pausa" />
          <span>{estado === "en-pausa" ? "Terminar pausa" : "Pausa"}</span>
        </button>
        <button type="button" onClick={onEntraSale} disabled={!corriendo}>
          <Icono nombre="cambio" />
          <span>Entra / Sale</span>
        </button>
      </div>

      {estado === "terminada" && faltantes.length > 0 && (
        <div className="aviso-formacion">
          {faltantes.map((problema) => (
            <div key={problema}>{problema}</div>
          ))}
        </div>
      )}

      <details className="ajustes-periodo">
        <summary>Ajustar horarios y pausas</summary>
        <div className="contenido-ajustes-periodo">{children}</div>
      </details>
    </section>
  );
};

export const PanelSinTareas = ({ onNueva }) => (
  <section className="panel-operativo panel-periodo-operativo panel-tarea panel-vacio">
    <div className="panel-titulo">
      <div>
        <span className="sobrelinea">SIN TAREAS</span>
        <h2>Todavía no hay tareas</h2>
        <p>Tocá Nueva tarea cuando arranque la primera. Después, Iniciar tarea pone en marcha el reloj.</p>
      </div>
    </div>
    <button type="button" className="accion-periodo" onClick={onNueva}>
      <Icono nombre="plus" size={20} />
      Nueva tarea
    </button>
  </section>
);

export const HojaJugadores = ({
  abierta,
  tarea,
  plantel,
  elegibles,
  estadoPlantel,
  errorPlantel,
  tieneDatos,
  atajos,
  onAlternar,
  onCerrar,
}) => {
  if (!abierta || !tarea) return null;
  const seleccionados = Object.keys(tarea.participantes).length;
  // Los que se pueden tildar primero; sin chaleco o sin datos, al final.
  const ordenados = plantel
    .map((jugador, orden) => ({ jugador, orden, apagado: !jugador.catapult_id || !tieneDatos(jugador) }))
    .sort((a, b) => Number(a.apagado) - Number(b.apagado) || a.orden - b.orden)
    .map(({ jugador }) => jugador);

  return (
    <HojaInferior
      abierta
      titulo={`Jugadores en ${tarea.nombre || "la tarea"}`}
      descripcion={`${seleccionados} de ${elegibles.length} en la tarea. Tocá para tildar o destildar.`}
      className="hoja-jugadores"
      onCerrar={onCerrar}
      acciones={
        <button type="button" className="boton-confirmar-hoja" onClick={onCerrar}>
          Listo
        </button>
      }
    >
      <div className="atajos-jugadores">
        {atajos.map((atajo) => (
          <button type="button" key={atajo.etiqueta} className="boton-texto" onClick={atajo.onClick}>
            {atajo.etiqueta}
          </button>
        ))}
      </div>

      {estadoPlantel === "cargando" && <p className="vacio-ficha">Leyendo la lista de jugadores…</p>}
      {estadoPlantel === "error" && <p className="error-equipo">{errorPlantel}</p>}
      {estadoPlantel === "listo" && plantel.length === 0 && (
        <p className="vacio-ficha">La lista de jugadores está vacía. Cargala en Ajustes › Lista de jugadores.</p>
      )}

      <div className="lista-jugadores-tarea">
        {ordenados.map((jugador) => {
          const clave = String(jugador.id);
          const datos = tarea.participantes[clave];
          const conChaleco = Boolean(jugador.catapult_id);
          const sinDatos = conChaleco && !tieneDatos(jugador);
          // Sin datos en la sesión no se puede agregar, pero sí sacar.
          const apagado = !conChaleco || (sinDatos && !datos);

          return (
            <label
              key={clave}
              className={`fila-jugador ${datos ? "activo" : ""} ${apagado ? "apagado" : ""}`.replace(/\s+/g, " ").trim()}
            >
              <input type="checkbox" checked={Boolean(datos)} disabled={apagado} onChange={() => onAlternar(clave)} />
              <span className="nombre-fila-jugador">{jugador.nombre}</span>
              {!conChaleco ? <small>sin chaleco</small> : sinDatos ? <small>sin datos</small> : null}
            </label>
          );
        })}
      </div>
    </HojaInferior>
  );
};

// Para el que se suma tarde o se va antes: queda en la tarea con menos
// tiempo, desde o hasta ahora. Las horas exactas se corrigen en "Ajustar".
export const HojaEntraSale = ({ abierta, tarea, elegibles, onEntra, onSale, onDeshacer, onCerrar }) => {
  if (!abierta || !tarea) return null;

  return (
    <HojaInferior
      abierta
      titulo="Entra / Sale"
      descripcion="Para el que se suma tarde o se va antes. Queda en la tarea con menos tiempo, desde o hasta ahora."
      className="hoja-entra-sale"
      onCerrar={onCerrar}
      acciones={
        <button type="button" className="boton-confirmar-hoja" onClick={onCerrar}>
          Listo
        </button>
      }
    >
      {elegibles.length === 0 && <p className="vacio-ficha">No hay jugadores con chaleco y datos en esta sesión.</p>}
      <div className="lista-entra-sale">
        {elegibles.map((jugador) => {
          const clave = String(jugador.id);
          const datos = tarea.participantes[clave];
          let texto = "No está en la tarea";
          const botones = [];

          if (!datos) {
            botones.push({ etiqueta: "Entra ahora", onClick: () => onEntra(clave) });
          } else if (datos.modo === MODO_PARCIAL) {
            texto =
              datos.inicio && datos.fin
                ? `${horaCorta(datos.inicio)} → ${horaCorta(datos.fin)}`
                : datos.fin
                  ? `Hasta ${horaCorta(datos.fin)}`
                  : `Desde ${horaCorta(datos.inicio) || "el inicio"}`;
            if (!datos.fin) botones.push({ etiqueta: "Sale ahora", onClick: () => onSale(clave) });
            botones.push({ etiqueta: "Deshacer", onClick: () => onDeshacer(clave) });
          } else {
            texto = "Toda la tarea";
            botones.push({ etiqueta: "Sale ahora", onClick: () => onSale(clave) });
          }

          return (
            <div className="fila-entra-sale" key={clave}>
              <span className="texto">
                <b>{jugador.nombre}</b>
                <small>{texto}</small>
              </span>
              {botones.map((boton) => (
                <button
                  type="button"
                  key={boton.etiqueta}
                  className="boton-texto"
                  aria-label={`${boton.etiqueta}, ${jugador.nombre}`}
                  onClick={boton.onClick}
                >
                  {boton.etiqueta}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </HojaInferior>
  );
};

export const ListaTareas = ({ tareas, activaId, filaDeTarea, onElegir }) => (
  <div className="lista-tareas-hoja">
    {tareas.map((tarea, i) => {
      const { etiqueta, clase } = filaDeTarea(tarea);
      const horario = tarea.inicio
        ? `${horaCorta(tarea.inicio)} → ${tarea.fin ? horaCorta(tarea.fin) : "en curso"}`
        : "Sin horario";
      return (
        <button
          type="button"
          key={tarea.id}
          className={`fila-tarea-lista ${tarea.id === activaId ? "elegida" : ""}`.trim()}
          onClick={() => onElegir(tarea.id)}
        >
          <span className={`num ${clase}`.trim()}>{i + 1}</span>
          <span className="texto">
            <b>{tarea.nombre || "Sin nombre"}</b>
            <small>
              {horario} · {plural(Object.keys(tarea.participantes).length, "jugador", "jugadores")}
            </small>
          </span>
          <span className={`estado ${clase}`.trim()}>{etiqueta}</span>
        </button>
      );
    })}
  </div>
);

export const HojaTodasLasTareas = ({
  abierta,
  nombreSesion,
  tareas,
  activaId,
  descripcion,
  aviso,
  filaDeTarea,
  onElegir,
  onNueva,
  onCerrar,
}) => {
  if (!abierta) return null;

  return (
    <HojaInferior
      abierta
      titulo={`Tareas de ${nombreSesion}`}
      descripcion={descripcion}
      className="hoja-lista"
      onCerrar={onCerrar}
      acciones={
        <>
          <button type="button" className="boton-cancelar-hoja" onClick={onCerrar}>
            Cerrar
          </button>
          <button type="button" className="boton-confirmar-hoja" onClick={onNueva}>
            Nueva tarea
          </button>
        </>
      }
    >
      {aviso && <p className="aviso-hoja">{aviso}</p>}
      {tareas.length === 0 ? (
        <p className="vacio-ficha">Todavía no hay tareas.</p>
      ) : (
        <ListaTareas tareas={tareas} activaId={activaId} filaDeTarea={filaDeTarea} onElegir={onElegir} />
      )}
    </HojaInferior>
  );
};
