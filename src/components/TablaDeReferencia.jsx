import React, { useRef, useState } from "react";
import { TocarParaOcultar } from "./Ocultar.jsx";
import { t } from "../idioma/index.js";
import { fechaYHora } from "../idioma/formatos.js";

// Los valores de referencia (V.R.) en la solapa de cada base (Santiago,
// 14/10: «Todos los vr tienen que tener su solapa aparte»; se ven, se
// cambian, se agregan y se borran, con historial y «volver atrás»).

// Dos toques con el dedo, como en las tablas de las bases.
const ENTRE_TOQUES = 400;
const TOQUE_QUIETO = 10;

// Una tabla de V.R. (una fila por corte, o Promedio y Desvío; una columna
// por medida), con la cara de las de Evaluaciones. Un número se cambia como
// en las bases: dos toques (o dos clics, o Enter) en la celda, se escribe y
// Enter (o tocar afuera) lo guarda; Esc no cambia nada.
//
// columnas: [{ clave, titulo, teclado?, editable? }]; filas: [{ clave, titulo }]
// (una columna con editable: false solo se mira).
// texto(fila, columna): lo que se ve.
// interpretar(fila, columna, escrito): el número, null (vaciar) o
// undefined (no se entiende).
// onCambiar(fila, columna, valor) → Promise<{ error }>. Sin onCambiar, la
// tabla solo se mira.
// ocultar (de useOcultar, el mismo para todas las tablas de la pantalla):
// tocar el nombre de una columna o de una fila pregunta si se oculta
// (Santiago, 15/10). Sin ocultar, se ven todas.
export const TablaDeReferencia = ({ columnas: todasLasColumnas, filas: todasLasFilas, texto, interpretar, onCambiar, primera = null, minimo = null, ocultar = null }) => {
  const columnas = ocultar ? todasLasColumnas.filter((columna) => !ocultar.columnaOculta(columna.clave)) : todasLasColumnas;
  const filas = ocultar ? todasLasFilas.filter((fila) => !ocultar.filaOculta(fila.clave)) : todasLasFilas;
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState("");
  const [error, setError] = useState("");
  // Lo que se está escribiendo, también para el aviso de tocar afuera (que
  // llega después de Esc y no tiene que guardar).
  const enCurso = useRef(null);
  const toque = useRef(null);
  const celdas = useRef(new Map());
  const editable = typeof onCambiar === "function";
  const claveDe = (fila, columna) => `${fila.clave}|${columna.clave}`;

  const empezar = (fila, columna) => {
    if (!editable || guardando) return;
    const original = texto(fila, columna) || "";
    enCurso.current = { fila, columna, escrito: original, original };
    setError("");
    setEditando(enCurso.current);
  };

  const cerrar = (celda) => {
    enCurso.current = null;
    setEditando(null);
    celda?.focus();
  };

  // guardar: false con Esc. alSalir: al tocar afuera (lo que no se entiende
  // no se guarda y se avisa).
  const terminar = async (guardar, { alSalir = false } = {}) => {
    const actual = enCurso.current;
    if (!actual) return;
    const celda = celdas.current.get(claveDe(actual.fila, actual.columna));
    if (!guardar || actual.escrito.trim() === actual.original.trim()) {
      cerrar(alSalir ? null : celda);
      return;
    }
    const valor = interpretar(actual.fila, actual.columna, actual.escrito);
    if (valor === undefined) {
      setError(t("referencias.noSeEntiende", { texto: actual.escrito.trim() }));
      if (alSalir) cerrar(null);
      return;
    }
    cerrar(null);
    const clave = claveDe(actual.fila, actual.columna);
    setGuardando(clave);
    const respuesta = await onCambiar(actual.fila, actual.columna, valor);
    setGuardando("");
    if (respuesta?.error) setError(t(respuesta.error));
    if (!alSalir) celda?.focus();
  };

  const tocar = (evento, fila, columna) => {
    const dedo = evento.changedTouches?.[0];
    if (!dedo) return;
    const clave = claveDe(fila, columna);
    const ahora = Date.now();
    const antes = toque.current;
    if (antes && antes.clave === clave && ahora - antes.cuando < ENTRE_TOQUES && Math.abs(antes.x - dedo.clientX) < TOQUE_QUIETO && Math.abs(antes.y - dedo.clientY) < TOQUE_QUIETO) {
      evento.preventDefault();
      toque.current = null;
      empezar(fila, columna);
      return;
    }
    toque.current = { clave, cuando: ahora, x: dedo.clientX, y: dedo.clientY };
  };

  return (
    <>
      <div className="evaluaciones-bloque-marco">
        <table className="evaluaciones-vr" style={minimo ? { minWidth: minimo } : undefined}>
          <thead>
            <tr>
              {primera ? <th scope="col">{primera}</th> : <td />}
              {columnas.map((columna) => (
                <th key={columna.clave} scope="col">
                  {/* Al menos una columna queda a la vista. */}
                  {ocultar && columnas.length > 1 ? (
                    <TocarParaOcultar ocultar={ocultar} tipo="columna" clave={columna.clave} titulo={columna.titulo}>
                      {columna.titulo}
                    </TocarParaOcultar>
                  ) : (
                    columna.titulo
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.clave}>
                <th scope="row">
                  {ocultar ? (
                    <TocarParaOcultar ocultar={ocultar} tipo="fila" clave={fila.clave} titulo={fila.titulo}>
                      {fila.titulo}
                    </TocarParaOcultar>
                  ) : (
                    fila.titulo
                  )}
                </th>
                {columnas.map((columna) => {
                  const clave = claveDe(fila, columna);
                  const aca = editando && claveDe(editando.fila, editando.columna) === clave;
                  const seCambia = editable && columna.editable !== false;
                  return (
                    <td
                      key={columna.clave}
                      ref={(celda) => (celda ? celdas.current.set(clave, celda) : celdas.current.delete(clave))}
                      className={[seCambia && "evaluaciones-vr-celda", guardando === clave && "guardando"].filter(Boolean).join(" ") || undefined}
                      tabIndex={seCambia && !aca ? 0 : undefined}
                      onDoubleClick={seCambia ? () => empezar(fila, columna) : undefined}
                      onTouchEnd={seCambia ? (evento) => tocar(evento, fila, columna) : undefined}
                      onKeyDown={
                        seCambia && !aca
                          ? (evento) => {
                              if (evento.key === "Enter" || evento.key === "F2") {
                                evento.preventDefault();
                                empezar(fila, columna);
                              }
                            }
                          : undefined
                      }
                    >
                      {aca ? (
                        <input
                          className="evaluaciones-vr-entrada"
                          type="text"
                          inputMode={columna.teclado || "decimal"}
                          autoFocus
                          aria-label={`${fila.titulo} · ${columna.titulo}`}
                          value={editando.escrito}
                          onChange={(evento) => {
                            enCurso.current = { ...enCurso.current, escrito: evento.target.value };
                            setEditando(enCurso.current);
                          }}
                          onKeyDown={(evento) => {
                            if (evento.key === "Enter") {
                              evento.preventDefault();
                              terminar(true);
                            } else if (evento.key === "Escape") {
                              evento.preventDefault();
                              terminar(false);
                            }
                          }}
                          onBlur={() => terminar(true, { alSalir: true })}
                        />
                      ) : (
                        texto(fila, columna)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <p className="evaluaciones-vr-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
};

// Los últimos cambios de los V.R. de lo que se está mirando, con «Volver».
// entradas: [{ id, cuando, quien, lineas: [texto], volver: bool }];
// onVolver(id) → Promise<{ error }>.
const DE_A = 8;
export const HistorialDeReferencias = ({ entradas, onVolver, error = "" }) => {
  const [cuantas, setCuantas] = useState(DE_A);
  const [volviendo, setVolviendo] = useState(null);
  const [fallo, setFallo] = useState("");
  const volver = async (id) => {
    setVolviendo(id);
    setFallo("");
    const respuesta = await onVolver(id);
    setVolviendo(null);
    if (respuesta?.error) setFallo(t(respuesta.error));
  };
  return (
    <section className="tarjeta referencias-historial">
      <h2>{t("referencias.historial.titulo")}</h2>
      <p className="lesiones-ayuda">{t(onVolver ? "referencias.historial.ayuda" : "referencias.historial.ayudaMirar")}</p>
      {error && <p className="evaluaciones-vr-error">{t(error)}</p>}
      {fallo && (
        <p className="evaluaciones-vr-error" role="alert">
          {fallo}
        </p>
      )}
      {!error && !entradas.length && <p className="lesiones-ayuda">{t("referencias.historial.vacio")}</p>}
      <ol className="referencias-historial-lista">
        {entradas.slice(0, cuantas).map((entrada) => (
          <li key={entrada.id}>
            <div className="referencias-historial-cabeza">
              <span>
                <b>{fechaYHora(entrada.cuando)}</b> · {entrada.quien || t("referencias.historial.sinCuenta")}
              </span>
              {entrada.volver && onVolver && (
                <button type="button" className="boton-secundario" onClick={() => volver(entrada.id)} disabled={Boolean(volviendo)}>
                  {volviendo === entrada.id ? t("referencias.historial.volviendo") : t("referencias.historial.volver")}
                </button>
              )}
            </div>
            <ul>
              {entrada.lineas.map((linea, indice) => (
                <li key={indice}>{linea}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {entradas.length > cuantas && (
        <button type="button" className="boton-secundario referencias-historial-mas" onClick={() => setCuantas((antes) => antes + DE_A)}>
          {t("referencias.historial.verMas")}
        </button>
      )}
    </section>
  );
};
