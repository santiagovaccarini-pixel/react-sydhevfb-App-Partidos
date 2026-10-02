import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HojaOpciones } from "./HojaOpciones.js";
import { Icono } from "./AppChrome";
import { aplicarPegado, aTexto, desdeTexto, ordenDeColumnas, reordenar } from "../domain/tabla.js";
import { t, useIdioma } from "../idioma/index.js";
import "./tablaDatos.css";

// Una tabla estilo base de datos, parecida a Excel: las cabeceras se
// arrastran para cambiar el orden (en el celular, manteniendo apretado), las
// celdas se eligen tocándolas (con Shift se elige un rango; el número de
// fila elige la fila entera), se copian y se pegan como texto con
// tabulaciones (lo que Excel y Google Sheets entienden) y se cambian tocando
// dos veces. El orden de las columnas queda guardado en el celular.
//
// columnas: [{ clave, titulo, tipo, editable, opciones, ancho }]
// filas:    [{ id, valores: { clave: valor }, textos: { clave: texto } }]
// onEditar(filaId, clave, valor) → Promise<{ error }>; onPegar(cambios) → Promise<{ error, hechos }>
// onAbrirFila(filaId), onBorrarFila(filaId)

const CLAVE_ORDEN = "tabla_columnas";
const ESPERA_APRETAR = 380;

const leerOrden = (id) => {
  try {
    return JSON.parse(localStorage.getItem(`${CLAVE_ORDEN}:${id}`) || "null");
  } catch {
    return null;
  }
};

const guardarOrden = (id, orden) => {
  try {
    localStorage.setItem(`${CLAVE_ORDEN}:${id}`, JSON.stringify(orden));
  } catch {
    // Sin localStorage, el orden dura lo que dura la pantalla.
  }
};

const rango = (a, b) => (a <= b ? [a, b] : [b, a]);

export const TablaDatos = ({
  id,
  columnas = [],
  filas = [],
  onEditar,
  onPegar,
  onAbrirFila,
  onBorrarFila,
  aviso = "",
}) => {
  const { plural } = useIdioma();
  const [orden, setOrden] = useState(() => ordenDeColumnas(columnas.map((c) => c.clave), leerOrden(id)));
  const [seleccion, setSeleccion] = useState(null); // { f1, c1, f2, c2 } en índices visibles
  const [activa, setActiva] = useState(null); // { f, c }
  const [editando, setEditando] = useState(null); // { f, c, valor }
  const [hoja, setHoja] = useState(null);
  const [arrastre, setArrastre] = useState(null); // { desde, sobre }
  const [mensaje, setMensaje] = useState("");
  const [ocupada, setOcupada] = useState(false);
  const marco = useRef(null);
  const temporizador = useRef(null);
  const arrastreRef = useRef(null);

  // Columnas nuevas o que ya no están, sin perder el orden elegido.
  useEffect(() => {
    setOrden((actual) => ordenDeColumnas(columnas.map((c) => c.clave), actual));
  }, [columnas]);

  const visibles = useMemo(() => orden.map((clave) => columnas.find((c) => c.clave === clave)).filter(Boolean), [orden, columnas]);
  // Sin ninguna columna que se pueda cambiar (solo lectura), Pegar no va.
  const algoEditable = visibles.some((columna) => columna.editable);

  useEffect(() => {
    if (!mensaje) return undefined;
    const temp = setTimeout(() => setMensaje(""), 2600);
    return () => clearTimeout(temp);
  }, [mensaje]);

  // ----------------------------------------------------------- Selección --

  const elegir = (f, c, extender = false) => {
    setEditando(null);
    if (extender && activa) {
      setSeleccion({ f1: activa.f, c1: activa.c, f2: f, c2: c });
      return;
    }
    setActiva({ f, c });
    setSeleccion({ f1: f, c1: c, f2: f, c2: c });
  };

  const elegirFila = (f, extender = false) => {
    setEditando(null);
    const ultima = visibles.length - 1;
    if (extender && activa) {
      setSeleccion({ f1: activa.f, c1: 0, f2: f, c2: ultima });
      return;
    }
    setActiva({ f, c: 0 });
    setSeleccion({ f1: f, c1: 0, f2: f, c2: ultima });
  };

  const estaElegida = (f, c) => {
    if (!seleccion) return false;
    const [fa, fb] = rango(seleccion.f1, seleccion.f2);
    const [ca, cb] = rango(seleccion.c1, seleccion.c2);
    return f >= fa && f <= fb && c >= ca && c <= cb;
  };

  const celdasElegidas = useMemo(() => {
    if (!seleccion) return 0;
    const [fa, fb] = rango(seleccion.f1, seleccion.f2);
    const [ca, cb] = rango(seleccion.c1, seleccion.c2);
    return (fb - fa + 1) * (cb - ca + 1);
  }, [seleccion]);

  // -------------------------------------------------------------- Copiar --

  const textoSeleccionado = () => {
    if (!seleccion) return "";
    const [fa, fb] = rango(seleccion.f1, seleccion.f2);
    const [ca, cb] = rango(seleccion.c1, seleccion.c2);
    const matriz = [];
    for (let f = fa; f <= fb; f++) {
      const fila = filas[f];
      if (!fila) continue;
      matriz.push(visibles.slice(ca, cb + 1).map((col) => fila.textos?.[col.clave] ?? ""));
    }
    return aTexto(matriz);
  };

  const copiar = async () => {
    const texto = textoSeleccionado();
    if (!texto && celdasElegidas === 0) return;
    try {
      await navigator.clipboard.writeText(texto);
      setMensaje(plural("tabla.copiado", celdasElegidas));
    } catch {
      // Sin acceso al portapapeles queda la copia de la última selección en
      // memoria (sirve para pegar en esta misma tabla).
      copiaLocal.current = texto;
      setMensaje(plural("tabla.copiado", celdasElegidas));
    }
  };
  const copiaLocal = useRef("");

  // --------------------------------------------------------------- Pegar --

  const pegarTexto = async (texto) => {
    if (!texto) {
      setMensaje(t("tabla.nadaQuePegar"));
      return;
    }
    if (!activa) {
      setMensaje(t("tabla.sinSeleccion"));
      return;
    }
    const matriz = desdeTexto(texto);
    const { cambios, ignoradas } = aplicarPegado(matriz, {
      filas,
      columnas: visibles,
      filaInicial: activa.f,
      columnaInicial: activa.c,
    });
    if (cambios.length === 0) {
      setMensaje(ignoradas ? plural("tabla.ignoradas", ignoradas) : t("tabla.nadaQuePegar"));
      return;
    }
    setOcupada(true);
    const respuesta = (await onPegar?.(cambios)) || {};
    setOcupada(false);
    const hechos = respuesta.hechos ?? cambios.length;
    const partes = [plural("tabla.pegado", hechos)];
    if (ignoradas) partes.push(plural("tabla.ignoradas", ignoradas));
    if (respuesta.error) partes.push(t(respuesta.error));
    setMensaje(partes.join(" · "));
  };

  const pegar = async () => {
    let texto = "";
    try {
      texto = await navigator.clipboard.readText();
    } catch {
      texto = copiaLocal.current;
      if (!texto) {
        setMensaje(t("tabla.sinPermisoPegar"));
        return;
      }
    }
    await pegarTexto(texto);
  };

  // ------------------------------------------------------------- Teclado --

  const alTeclear = (evento) => {
    if (editando) return;
    const ctrl = evento.ctrlKey || evento.metaKey;
    if (ctrl && evento.key.toLowerCase() === "c") {
      evento.preventDefault();
      copiar();
      return;
    }
    if (ctrl && evento.key.toLowerCase() === "v") {
      // El pegado llega por el evento "paste" (con el texto adentro).
      return;
    }
    if (!activa) return;
    const mover = (df, dc) => {
      evento.preventDefault();
      const f = Math.min(Math.max(activa.f + df, 0), filas.length - 1);
      const c = Math.min(Math.max(activa.c + dc, 0), visibles.length - 1);
      elegir(f, c, evento.shiftKey);
    };
    if (evento.key === "ArrowDown") mover(1, 0);
    else if (evento.key === "ArrowUp") mover(-1, 0);
    else if (evento.key === "ArrowRight") mover(0, 1);
    else if (evento.key === "ArrowLeft") mover(0, -1);
    else if (evento.key === "Enter" || evento.key === "F2") {
      evento.preventDefault();
      empezarEdicion(activa.f, activa.c);
    } else if (evento.key === "Escape") {
      setSeleccion(null);
      setActiva(null);
    }
  };

  const alPegarEvento = (evento) => {
    if (editando) return;
    const texto = evento.clipboardData?.getData("text/plain");
    if (!texto) return;
    evento.preventDefault();
    pegarTexto(texto);
  };

  // -------------------------------------------------------------- Editar --

  const empezarEdicion = (f, c) => {
    const fila = filas[f];
    const col = visibles[c];
    if (!fila || !col || !col.editable) return;
    if (col.tipo === "lista") {
      setHoja({ f, c, col });
      return;
    }
    setEditando({ f, c, valor: fila.valores?.[col.clave] ?? "" });
  };

  const guardarEdicion = async (valor) => {
    const actual = editando;
    setEditando(null);
    if (!actual) return;
    const fila = filas[actual.f];
    const col = visibles[actual.c];
    if (!fila || !col) return;
    const nuevo = col.tipo === "numero" ? (valor === "" ? null : Number(String(valor).replace(",", "."))) : valor;
    if (col.tipo === "numero" && valor !== "" && !Number.isFinite(nuevo)) return;
    if ((fila.valores?.[col.clave] ?? "") === (nuevo ?? "")) return;
    setOcupada(true);
    const respuesta = (await onEditar?.(fila.id, col.clave, nuevo)) || {};
    setOcupada(false);
    if (respuesta.error) setMensaje(t(respuesta.error));
  };

  const elegirDeHoja = async (valor) => {
    const actual = hoja;
    setHoja(null);
    if (!actual) return;
    const fila = filas[actual.f];
    if (!fila) return;
    setOcupada(true);
    const respuesta = (await onEditar?.(fila.id, actual.col.clave, valor || null)) || {};
    setOcupada(false);
    if (respuesta.error) setMensaje(t(respuesta.error));
  };

  // ------------------------------------------- Arrastrar las cabeceras --

  const terminarArrastre = useCallback(() => {
    const estado = arrastreRef.current;
    arrastreRef.current = null;
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
    setArrastre(null);
    if (estado && estado.activo && estado.sobre !== null && estado.sobre !== estado.desde) {
      setOrden((actual) => {
        const nuevo = reordenar(actual, estado.desde, estado.sobre);
        guardarOrden(id, nuevo);
        return nuevo;
      });
      setSeleccion(null);
      setActiva(null);
    }
  }, [id]);

  const columnaBajo = (x, y) => {
    const elemento = document.elementFromPoint(x, y);
    const th = elemento?.closest?.("th[data-columna]");
    return th ? Number(th.dataset.columna) : null;
  };

  const alApretarCabecera = (evento, indice) => {
    if (evento.button !== undefined && evento.button !== 0) return;
    const inicio = { x: evento.clientX, y: evento.clientY };
    const esMouse = evento.pointerType === "mouse";
    arrastreRef.current = { desde: indice, sobre: null, activo: false, inicio, puntero: evento.pointerId, elemento: evento.currentTarget };
    const activar = () => {
      const estado = arrastreRef.current;
      if (!estado || estado.activo) return;
      estado.activo = true;
      try {
        estado.elemento.setPointerCapture(estado.puntero);
      } catch {
        // Sin captura igual se sigue por el documento.
      }
      setArrastre({ desde: estado.desde, sobre: null });
    };
    if (esMouse) {
      // Con mouse, arrastrar un poco alcanza.
      arrastreRef.current.alMover = (e) => {
        const estado = arrastreRef.current;
        if (!estado || estado.activo) return;
        if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 6) activar();
      };
    } else {
      // Con el dedo, mantener apretado; moverse antes es desplazar la tabla.
      temporizador.current = setTimeout(activar, ESPERA_APRETAR);
    }
  };

  const alMoverCabecera = (evento) => {
    const estado = arrastreRef.current;
    if (!estado) return;
    if (!estado.activo) {
      estado.alMover?.(evento);
      if (!estado.activo && evento.pointerType !== "mouse" && Math.hypot(evento.clientX - estado.inicio.x, evento.clientY - estado.inicio.y) > 10) {
        // Se movió antes de tiempo: era un desplazamiento, no un arrastre.
        if (temporizador.current) clearTimeout(temporizador.current);
        arrastreRef.current = null;
      }
      return;
    }
    evento.preventDefault();
    const sobre = columnaBajo(evento.clientX, evento.clientY);
    if (sobre !== null && sobre !== estado.sobre) {
      estado.sobre = sobre;
      setArrastre({ desde: estado.desde, sobre });
    }
  };

  useEffect(() => () => terminarArrastre(), [terminarArrastre]);

  // ------------------------------------------------------------- Dibujo --

  const filaActiva = activa ? filas[activa.f] : null;

  return (
    <div className="tabla-datos" ref={marco}>
      <div className="tabla-datos-barra">
        <span className="tabla-datos-estado">
          {ocupada ? t("tabla.guardando") : mensaje || aviso || (celdasElegidas ? plural("tabla.seleccion", celdasElegidas) : t("tabla.sinSeleccion"))}
        </span>
        <div className="tabla-datos-acciones">
          <button type="button" className="boton-secundario" onClick={copiar} disabled={!seleccion}>
            <Icono nombre="documento" size={15} />
            {t("tabla.copiar")}
          </button>
          {algoEditable && (
            <button type="button" className="boton-secundario" onClick={pegar} disabled={!activa || ocupada}>
              <Icono nombre="guardar" size={15} />
              {t("tabla.pegar")}
            </button>
          )}
          {onAbrirFila && (
            <button type="button" className="boton-secundario" onClick={() => filaActiva && onAbrirFila(filaActiva.id)} disabled={!filaActiva}>
              {t("tabla.ficha")}
            </button>
          )}
          {onBorrarFila && (
            <button type="button" className="boton-secundario tabla-datos-borrar" onClick={() => filaActiva && onBorrarFila(filaActiva.id)} disabled={!filaActiva || ocupada}>
              <Icono nombre="borrar" size={15} />
              {t("tabla.borrarFila")}
            </button>
          )}
        </div>
      </div>

      <div className="tabla-datos-marco" tabIndex={0} onKeyDown={alTeclear} onPaste={alPegarEvento}>
        <table className={`tabla-datos-tabla ${arrastre ? "arrastrando" : ""}`}>
          <thead>
            <tr>
              <th className="tabla-datos-numero" aria-label={t("tabla.fila")}>
                #
              </th>
              {visibles.map((col, indice) => (
                <th
                  key={col.clave}
                  data-columna={indice}
                  className={`${arrastre?.desde === indice ? "origen" : ""} ${arrastre?.sobre === indice ? "destino" : ""} ${col.editable ? "" : "fija"}`.trim()}
                  style={col.ancho ? { minWidth: col.ancho } : undefined}
                  onPointerDown={(evento) => alApretarCabecera(evento, indice)}
                  onPointerMove={alMoverCabecera}
                  onPointerUp={terminarArrastre}
                  onPointerCancel={terminarArrastre}
                  title={col.titulo}
                >
                  {col.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={visibles.length + 1} className="tabla-datos-vacia">
                  {t("tabla.vacio")}
                </td>
              </tr>
            )}
            {filas.map((fila, f) => (
              <tr key={fila.id} className={activa?.f === f ? "activa" : ""}>
                <th
                  className="tabla-datos-numero"
                  onClick={(evento) => elegirFila(f, evento.shiftKey)}
                  onDoubleClick={() => onAbrirFila?.(fila.id)}
                >
                  {f + 1}
                </th>
                {visibles.map((col, c) => {
                  const enEdicion = editando && editando.f === f && editando.c === c;
                  const esActiva = activa?.f === f && activa?.c === c;
                  return (
                    <td
                      key={col.clave}
                      className={`${estaElegida(f, c) ? "elegida" : ""} ${esActiva ? "activa" : ""} ${col.editable ? "" : "fija"}`.trim()}
                      onClick={(evento) => {
                        if (esActiva && !evento.shiftKey && !enEdicion) empezarEdicion(f, c);
                        else elegir(f, c, evento.shiftKey);
                      }}
                      onDoubleClick={() => empezarEdicion(f, c)}
                    >
                      {enEdicion ? (
                        <input
                          autoFocus
                          type={col.tipo === "fecha" ? "date" : col.tipo === "fecha_hora" ? "datetime-local" : col.tipo === "numero" ? "number" : "text"}
                          value={editando.valor ?? ""}
                          onChange={(evento) => setEditando({ ...editando, valor: evento.target.value })}
                          onBlur={(evento) => guardarEdicion(evento.target.value)}
                          onKeyDown={(evento) => {
                            if (evento.key === "Enter") guardarEdicion(evento.currentTarget.value);
                            if (evento.key === "Escape") setEditando(null);
                            evento.stopPropagation();
                          }}
                        />
                      ) : (
                        fila.textos?.[col.clave] ?? ""
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HojaOpciones
        abierta={Boolean(hoja)}
        titulo={hoja?.col.titulo}
        opciones={hoja ? [{ valor: "", etiqueta: t("comun.sinDato") }, ...(hoja.col.opciones || [])] : []}
        elegida={hoja ? filas[hoja.f]?.valores?.[hoja.col.clave] || "" : ""}
        onElegir={elegirDeHoja}
        onCerrar={() => setHoja(null)}
      />
    </div>
  );
};

export default TablaDatos;
