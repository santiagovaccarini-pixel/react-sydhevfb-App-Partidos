import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HojaOpciones } from "./HojaOpciones.js";
import { HojaDeFiltro, elegidosAlAbrir } from "./ListaParaMarcar.jsx";
import { Icono } from "./AppChrome";
import {
  aplicarPegado,
  aTexto,
  desdeTexto,
  filtrarFilas,
  interpretarHoras,
  interpretarMinutos,
  ordenarFilas,
  ordenDeColumnas,
  reordenar,
  textoDeHoras,
  textoDeMinutos,
  tramosDeGrupos,
  valoresDeColumna,
} from "../domain/tabla.js";
import { t, useIdioma } from "../idioma/index.js";
import "./tablaDatos.css";

// Una tabla estilo base de datos, parecida a Excel: las cabeceras se
// arrastran para cambiar el orden (en el celular, manteniendo apretado), las
// celdas se eligen tocándolas (con Shift se elige un rango; con Shift y la
// barra espaciadora, la fila entera, como en Excel), se copian y se pegan
// como texto con tabulaciones (lo que Excel y Google Sheets entienden) y se
// cambian tocando dos veces. Cada columna se achica o se agranda arrastrando
// el borde derecho de su cabecera (dos clics en el borde: vuelve a su ancho).
// El orden y el ancho de las columnas quedan guardados en el celular. Cada
// cabecera tiene su filtro, como en Excel (valores para elegir y orden), y
// si las columnas traen grupo, arriba va la fila de los grupos. Arriba de la
// tabla va cuántas filas hay (con filtros, cuántas se ven de cuántas): la
// tabla no lleva una columna que cuente las filas (Santiago, 05/10).
//
// columnas: [{ clave, titulo, tipo, editable, opciones, ancho, grupo, grupoTitulo }]
// filas:    [{ id, valores: { clave: valor }, textos: { clave: texto }, orden?: { clave: valor }, apagada? }]
//           (`orden`, si está, es lo que se usa para ordenar esa columna;
//           `apagada`, una fila que va en otro color: en las bases, alguien
//           que ya no está en el plantel actual)
// leyenda: qué quiere decir ese color (se ve si hay alguna fila apagada a la
// vista; si no, guarda su lugar); rotuloApagada: lo que dice una fila
// apagada al pasar el mouse
// onEditar(filaId, clave, valor) → Promise<{ error }>; onPegar(cambios) → Promise<{ error, hechos }>
// onAbrirFila(filaId), onBorrarFilas(filaIds): las filas elegidas (con
// Shift, varias), en el orden en que se ven
// recordar: con qué nombre se guardan los filtros y el orden mientras la app
// está abierta (al abrir una ficha y volver, siguen como estaban).
// fijas: claves de las columnas que van primero y quedan a la vista al
// correr la tabla en la compu (como inmovilizar en Excel). No se arrastran;
// cada una lleva su `ancho` (en píxeles, de borde a borde). Son las de
// entrada: en la compu, dos clics en una cabecera la dejan fija o la sueltan,
// y lo elegido queda guardado en ese aparato para esa tabla (Santiago, 11/10).
// vista(filasVista) → { estilos, arriba }: lo que depende de las filas que
// se ven (las que dejan los filtros), como el SUBTOTAL y el formato
// condicional de Excel. estilos: { id de fila: { clave: estilo } }; arriba:
// filas que van sobre las cabeceras, alineadas con cada columna:
// [{ id, rotulo, alto?, celdas: { clave: { texto, estilo } } }]. El rótulo
// ocupa las columnas fijas (sin fijas, la primera columna, y el dato de esa
// columna no se ve) y alto: cuántas filas; con rotulo: null, esa fila queda
// bajo el rótulo de la de arriba.
// Una columna con `alinear: "centro"` va centrada.
// siempreAVista: ids de filas que se ven aunque los filtros las dejen afuera
// (una fila recién agregada, para completarla ahí), hasta que se cambien los
// filtros: ahí vuelven a mandar los filtros.
// muchasFilas: para una base de miles de filas (GPS): se dibujan solo las
// filas que se ven al correr la tabla, y unas cuantas más arriba y abajo; lo
// demás (elegir, copiar, pegar, filtros, el informe de arriba) sigue con
// todas. Con las flechas, la tabla corre hasta la celda elegida.

const CLAVE_ORDEN = "tabla_columnas";
const CLAVE_ANCHOS = "tabla_anchos";
const CLAVE_FIJAS = "tabla_fijas";
const ESPERA_APRETAR = 380;
// Lo más angosta que queda una columna: entran el botón del filtro (con la
// flecha del orden) y el borde para agrandarla, también con el dedo.
const ANCHO_MINIMO = 56;
// El ancho de una columna fija que no trae el suyo.
const ANCHO_FIJA = 120;
// Con muchasFilas: el alto de una fila hasta medir la primera, cuántas se
// dibujan al abrir y cuántas de más arriba y abajo de las que se ven.
const ALTO_FILA = 34;
const FILAS_AL_ABRIR = 60;
const FILAS_DE_MAS = 8;
const enElProximoCuadro = (fn) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16));
const cancelarCuadro = (id) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : clearTimeout(id));

const leerDelCelular = (clave, id) => {
  try {
    return JSON.parse(localStorage.getItem(`${clave}:${id}`) || "null");
  } catch {
    return null;
  }
};

const guardarEnCelular = (clave, id, valor) => {
  try {
    localStorage.setItem(`${clave}:${id}`, JSON.stringify(valor));
  } catch {
    // Sin localStorage, el orden y los anchos duran lo que dura la pantalla.
  }
};

const leerOrden = (id) => leerDelCelular(CLAVE_ORDEN, id);
const guardarOrden = (id, orden) => guardarEnCelular(CLAVE_ORDEN, id, orden);

// Los anchos elegidos a mano: { clave: píxeles } (lo que no se entiende, no).
const leerAnchos = (id) => {
  const guardados = leerDelCelular(CLAVE_ANCHOS, id);
  if (!guardados || typeof guardados !== "object" || Array.isArray(guardados)) return {};
  return Object.fromEntries(
    Object.entries(guardados)
      .filter(([, ancho]) => Number.isFinite(ancho))
      .map(([clave, ancho]) => [clave, Math.max(ANCHO_MINIMO, Math.round(ancho))]),
  );
};

// Las columnas fijas elegidas con dos clics: [clave] en el orden en que se
// fijaron, o null si nunca se eligieron (van las de entrada).
const leerFijas = (id) => {
  const guardadas = leerDelCelular(CLAVE_FIJAS, id);
  return Array.isArray(guardadas) ? guardadas.filter((clave) => typeof clave === "string") : null;
};

// Las fijas quedan a la vista solo en la compu (en el celular corren con las
// demás: no entrarían todas), así que se eligen ahí. Sin matchMedia (pruebas),
// como en la compu.
const fijasEnEstaPantalla = () => typeof window === "undefined" || typeof window.matchMedia !== "function" || window.matchMedia("(min-width: 900px)").matches;

// La variable de CSS con el ancho de una columna. Mientras se arrastra el
// borde cambia solo la variable: la tabla no se vuelve a dibujar entera.
const variableDeAncho = (clave) => `--tabla-ancho-${String(clave).replace(/[^A-Za-z0-9_-]/g, "_")}`;

const rango = (a, b) => (a <= b ? [a, b] : [b, a]);

const SIN_FIJAS = [];

// Los filtros y el orden de cada tabla, mientras la app está abierta.
const memoria = new Map();

// Tonos de la fila de grupos: uno por grupo, siempre el mismo para cada uno.
const TONOS_DE_GRUPO = 7;

// El tono de cada grupo (tono-0 a tono-6 en la hoja de estilos), por el orden
// en que aparece en las columnas: así no cambia al mover una. Lo usan la base
// y la tabla del reporte individual, para que cada grupo se vea igual.
export const tonosDeGrupos = (columnas) => {
  const tonos = {};
  columnas.forEach((columna) => {
    if (columna.grupo && !(columna.grupo in tonos)) tonos[columna.grupo] = Object.keys(tonos).length % TONOS_DE_GRUPO;
  });
  return tonos;
};

export const TablaDatos = ({
  id,
  columnas = [],
  filas = [],
  onEditar,
  onPegar,
  onAbrirFila,
  onBorrarFilas,
  aviso = "",
  recordar = null,
  leyenda = "",
  rotuloApagada = "",
  fijas = SIN_FIJAS,
  vista = null,
  siempreAVista = SIN_FIJAS,
  muchasFilas = false,
}) => {
  const { plural } = useIdioma();
  const [orden, setOrden] = useState(() => ordenDeColumnas(columnas.map((c) => c.clave), leerOrden(id)));
  const [seleccion, setSeleccion] = useState(null); // { f1, c1, f2, c2 } en índices visibles
  const [activa, setActiva] = useState(null); // { f, c }
  // Lo que se está editando, por fila (id) y columna (clave): si mientras
  // tanto la tabla se reordena, lo escrito igual va a su fila.
  const [editando, setEditando] = useState(null); // { filaId, clave, valor }
  const [hoja, setHoja] = useState(null); // { filaId, col }
  const [arrastre, setArrastre] = useState(null); // { desde, sobre }
  const [mensaje, setMensaje] = useState("");
  const [ocupada, setOcupada] = useState(false);
  // Las casillas que se están guardando: { "fila:clave": valor nuevo }. Se ven
  // marcadas (o no) al toque, sin esperar a la base.
  const [pendientes, setPendientes] = useState({});
  const [filtros, setFiltros] = useState(() => (recordar && memoria.get(recordar)?.filtros) || {}); // { clave: [textos elegidos] }
  const [ordenFilas, setOrdenFilas] = useState(() => (recordar && memoria.get(recordar)?.orden) || null); // { clave, sentido }
  const [hojaFiltro, setHojaFiltro] = useState(null); // { clave, titulo, elegidos, busqueda }
  // Los anchos elegidos a mano ({ clave: píxeles }) y la columna a la que se
  // le está arrastrando el borde.
  const [anchos, setAnchos] = useState(() => leerAnchos(id));
  // Las fijas elegidas en este aparato (null: las de entrada).
  const [fijasElegidas, setFijasElegidas] = useState(() => leerFijas(id));
  const [ajustando, setAjustando] = useState(null);
  const marco = useRef(null);
  const tablaRef = useRef(null);
  const temporizador = useRef(null);
  const arrastreRef = useRef(null);
  const ajusteRef = useRef(null);
  // La fila de la celda activa, por id: si un filtro u orden la mueve, la
  // selección la sigue.
  const idActiva = useRef(null);

  // Columnas nuevas o que ya no están, sin perder el orden elegido.
  useEffect(() => {
    setOrden((actual) => ordenDeColumnas(columnas.map((c) => c.clave), actual));
  }, [columnas]);

  // Las fijas van primero, en su orden; el resto, en el que eligió cada uno.
  const fijasVigentes = fijasElegidas ?? fijas;
  const clavesFijas = useMemo(() => fijasVigentes.filter((clave) => columnas.some((c) => c.clave === clave)), [fijasVigentes, columnas]);
  const visibles = useMemo(() => {
    const porClave = (clave) => columnas.find((c) => c.clave === clave);
    const libres = orden.filter((clave) => !clavesFijas.includes(clave)).map(porClave).filter(Boolean);
    return [...clavesFijas.map(porClave), ...libres];
  }, [orden, columnas, clavesFijas]);
  const visiblesRef = useRef(visibles);
  visiblesRef.current = visibles;
  // El ancho de cada columna que lo tiene: el elegido a mano o, en una fija,
  // el suyo. Las demás se acomodan a lo que tienen adentro.
  const anchosVigentes = useMemo(() => {
    const vigentes = {};
    columnas.forEach((col) => {
      const ancho = anchos[col.clave] ?? (clavesFijas.includes(col.clave) ? col.ancho || ANCHO_FIJA : null);
      if (ancho) vigentes[col.clave] = ancho;
    });
    return vigentes;
  }, [columnas, anchos, clavesFijas]);
  // También lo que miden juntas las fijas: el título de un grupo queda a la
  // vista a la derecha de ellas al correr la tabla.
  const variablesDeAncho = useMemo(
    () => ({
      ...Object.fromEntries(Object.entries(anchosVigentes).map(([clave, ancho]) => [variableDeAncho(clave), `${ancho}px`])),
      "--tabla-datos-ancho-fijas": clavesFijas.length ? `calc(${clavesFijas.map((clave) => `var(${variableDeAncho(clave)})`).join(" + ")})` : "0px",
    }),
    [anchosVigentes, clavesFijas],
  );
  // Lo que lleva cada celda de una columna con ancho (de borde a borde) y,
  // si es fija, dónde queda: a la derecha de las fijas anteriores.
  const estiloDeColumna = useMemo(() => {
    const estilos = {};
    const antes = [];
    clavesFijas.forEach((clave) => {
      estilos[clave] = { left: antes.length ? `calc(${antes.map((otra) => `var(${variableDeAncho(otra)})`).join(" + ")})` : 0 };
      antes.push(clave);
    });
    Object.keys(anchosVigentes).forEach((clave) => {
      const ancho = `var(${variableDeAncho(clave)})`;
      estilos[clave] = { ...estilos[clave], boxSizing: "border-box", width: ancho, minWidth: ancho, maxWidth: ancho };
    });
    return estilos;
  }, [clavesFijas, anchosVigentes]);
  const claseFija = (clave) => (clavesFijas.includes(clave) ? `inmovil ${clave === clavesFijas.at(-1) ? "ultima-inmovil" : ""}`.trim() : "");
  // Con todas las columnas a la vista con su ancho, la tabla mide lo que
  // suman (como en Excel, al lado queda vacío): si se estirara hasta el
  // borde, el navegador repartiría lo que sobra entre ellas.
  const todasConAncho = visibles.length > 0 && visibles.every((col) => anchosVigentes[col.clave]);
  // Sin ninguna columna que se pueda cambiar (solo lectura), Pegar no va.
  const algoEditable = visibles.some((columna) => columna.editable);

  // Los filtros de las columnas que siguen existiendo.
  const filtrosVigentes = useMemo(
    () => Object.fromEntries(Object.entries(filtros).filter(([clave]) => columnas.some((columna) => columna.clave === clave))),
    [filtros, columnas],
  );
  const hayFiltros = Object.keys(filtrosVigentes).length > 0;
  // Las filas que se ven: filtradas y en el orden pedido. Todo lo que es
  // "fila n" (elegir, copiar, pegar, editar) habla de estas.
  // Las pedidas a la vista que siguen a la vista: las que llegaron después
  // del último cambio de filtros.
  const [forzadas, setForzadas] = useState([]);
  const yaPedidas = useRef(new Set());
  useEffect(() => {
    setForzadas([]);
  }, [filtros]);
  useEffect(() => {
    const nuevas = siempreAVista.filter((filaId) => !yaPedidas.current.has(filaId));
    if (nuevas.length === 0) return;
    nuevas.forEach((filaId) => yaPedidas.current.add(filaId));
    setForzadas((previas) => [...previas, ...nuevas]);
  }, [siempreAVista]);
  const filasVista = useMemo(() => {
    const filtradas = filtrarFilas(filas, filtrosVigentes);
    if (forzadas.length === 0 || filtradas.length === filas.length) return ordenarFilas(filtradas, ordenFilas);
    const pasan = new Set(filtradas.map((fila) => fila.id));
    return ordenarFilas(
      filas.filter((fila) => pasan.has(fila.id) || forzadas.includes(fila.id)),
      ordenFilas,
    );
  }, [filas, filtrosVigentes, ordenFilas, forzadas]);
  // Con muchasFilas, las filas que se dibujan: { desde, hasta, alto } (null:
  // todas, como sin muchasFilas o si no se puede medir).
  const cajaRef = useRef(null);
  const cuerpoRef = useRef(null);
  const [ventana, setVentana] = useState(() => (muchasFilas ? { desde: 0, hasta: FILAS_AL_ABRIR, alto: ALTO_FILA } : null));
  const cuantasVista = filasVista.length;
  const medirVentana = useCallback(() => {
    if (!muchasFilas) return;
    const caja = cajaRef.current;
    const cuerpo = cuerpoRef.current;
    if (!caja || !cuerpo || !caja.clientHeight) {
      setVentana(null);
      return;
    }
    const alto = cuerpo.querySelector("tr:not(.tabla-datos-hueco)")?.offsetHeight || ALTO_FILA;
    const inicio = cuerpo.offsetTop;
    const desde = Math.max(0, Math.floor((caja.scrollTop - inicio) / alto) - FILAS_DE_MAS);
    const hasta = Math.max(desde, Math.min(cuantasVista, Math.ceil((caja.scrollTop + caja.clientHeight - inicio) / alto) + FILAS_DE_MAS));
    setVentana((antes) => (antes && antes.desde === desde && antes.hasta === hasta && antes.alto === alto ? antes : { desde, hasta, alto }));
  }, [muchasFilas, cuantasVista]);
  useLayoutEffect(() => {
    medirVentana();
  }, [medirVentana]);
  useEffect(() => {
    const caja = cajaRef.current;
    if (!muchasFilas || !caja) return undefined;
    let cuadro = null;
    const alCorrer = () => {
      if (cuadro !== null) return;
      cuadro = enElProximoCuadro(() => {
        cuadro = null;
        medirVentana();
      });
    };
    caja.addEventListener("scroll", alCorrer, { passive: true });
    window.addEventListener("resize", alCorrer);
    return () => {
      caja.removeEventListener("scroll", alCorrer);
      window.removeEventListener("resize", alCorrer);
      if (cuadro !== null) cancelarCuadro(cuadro);
    };
  }, [muchasFilas, medirVentana]);
  // Con las flechas, la tabla corre hasta la fila elegida (si no, con
  // muchasFilas, podría no estar dibujada).
  const llevarAVista = (f) => {
    const caja = cajaRef.current;
    const cuerpo = cuerpoRef.current;
    if (!muchasFilas || !ventana || !caja || !cuerpo) return;
    const arriba = cuerpo.offsetTop + f * ventana.alto;
    // Lo que tapan las cabeceras, que quedan arriba al correr.
    const tapado = [...(tablaRef.current?.querySelectorAll("tr.tabla-datos-grupos, tr.tabla-datos-cabeceras") || [])].reduce((suma, tr) => suma + tr.offsetHeight, 0);
    if (arriba < caja.scrollTop + tapado) caja.scrollTop = Math.max(0, arriba - tapado);
    else if (arriba + ventana.alto > caja.scrollTop + caja.clientHeight) caja.scrollTop = arriba + ventana.alto - caja.clientHeight;
  };

  // Lo que depende de las filas que se ven: los colores y las filas de arriba.
  const deLaVista = useMemo(() => (vista ? vista(filasVista) : null), [vista, filasVista]);
  const estilosDeCeldas = deLaVista?.estilos || null;
  const filasArriba = deLaVista?.arriba || [];

  // La fila de grupos, si las columnas los traen. El tono de cada grupo sale
  // de su orden en las columnas originales, así no cambia al mover una. Las
  // fijas van juntas en una celda fija como ellas: si no, al correr la tabla
  // en la compu, los grupos pasaban por encima de las fijas.
  const hayGrupos = columnas.some((columna) => columna.grupo);
  const tramos = useMemo(() => {
    if (!hayGrupos) return [];
    const cuantasFijas = clavesFijas.length;
    if (!cuantasFijas) return tramosDeGrupos(visibles);
    const delasFijas = visibles.slice(0, cuantasFijas);
    const unGrupo = delasFijas.every((col) => (col.grupo || "") === (delasFijas[0].grupo || ""));
    const grupo = unGrupo ? delasFijas[0].grupo || "" : "";
    // Si el grupo de las fijas sigue después, ahí va sin repetir el título.
    return [
      { grupo, titulo: grupo ? delasFijas[0].grupoTitulo || "" : "", desde: 0, cantidad: cuantasFijas, fijo: true },
      ...tramosDeGrupos(visibles.slice(cuantasFijas)).map((tramo, i) => ({ ...tramo, titulo: i === 0 && grupo && tramo.grupo === grupo ? "" : tramo.titulo, desde: tramo.desde + cuantasFijas })),
    ];
  }, [hayGrupos, visibles, clavesFijas]);
  const tonoDeGrupo = useMemo(() => tonosDeGrupos(columnas), [columnas]);

  useEffect(() => {
    // Lo que se estaba editando en una fila que ya no se ve se descarta.
    setEditando((actual) => (actual && !filasVista.some((fila) => fila.id === actual.filaId) ? null : actual));
    if (!activa) return;
    const nueva = filasVista.findIndex((fila) => fila.id === idActiva.current);
    if (nueva === -1) {
      setActiva(null);
      setSeleccion(null);
      setEditando(null);
    } else if (nueva !== activa.f) {
      setActiva({ f: nueva, c: activa.c });
      setSeleccion({ f1: nueva, c1: activa.c, f2: nueva, c2: activa.c });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filasVista]);

  useEffect(() => {
    if (!mensaje) return undefined;
    const temp = setTimeout(() => setMensaje(""), 2600);
    return () => clearTimeout(temp);
  }, [mensaje]);

  useEffect(() => {
    if (recordar) memoria.set(recordar, { filtros, orden: ordenFilas });
  }, [recordar, filtros, ordenFilas]);

  // ----------------------------------------------------------- Selección --

  const elegir = (f, c, extender = false) => {
    setEditando(null);
    if (extender && activa) {
      setSeleccion({ f1: activa.f, c1: activa.c, f2: f, c2: c });
      return;
    }
    idActiva.current = filasVista[f]?.id ?? null;
    setActiva({ f, c });
    setSeleccion({ f1: f, c1: c, f2: f, c2: c });
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
      const fila = filasVista[f];
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
      filas: filasVista,
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
    if (respuesta.error) partes.push(t(respuesta.error, respuesta.variables));
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
    // Las teclas de un botón de la cabecera (el filtro) son de ese botón.
    if (evento.target !== evento.currentTarget) return;
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
      const f = Math.min(Math.max(activa.f + df, 0), filasVista.length - 1);
      const c = Math.min(Math.max(activa.c + dc, 0), visibles.length - 1);
      elegir(f, c, evento.shiftKey);
      llevarAVista(f);
    };
    if (evento.key === "ArrowDown") mover(1, 0);
    else if (evento.key === "ArrowUp") mover(-1, 0);
    else if (evento.key === "ArrowRight") mover(0, 1);
    else if (evento.key === "ArrowLeft") mover(0, -1);
    else if (evento.key === " " && evento.shiftKey) {
      // Las filas enteras de lo elegido, como en Excel.
      evento.preventDefault();
      setSeleccion((actual) => ({ f1: actual ? actual.f1 : activa.f, c1: 0, f2: actual ? actual.f2 : activa.f, c2: visibles.length - 1 }));
    } else if (evento.key === "Enter" || evento.key === "F2" || (evento.key === " " && visibles[activa.c]?.tipo === "casilla")) {
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
    const fila = filasVista[f];
    const col = visibles[c];
    if (!fila || !col || !col.editable) return;
    if (col.tipo === "lista") {
      setHoja({ filaId: fila.id, col });
      return;
    }
    // Una casilla no se escribe: se marca o se desmarca.
    if (col.tipo === "casilla") {
      alternarCasilla(fila, col);
      return;
    }
    // Las horas se escriben como en el Excel: "30:14:20"; los tiempos, "3:04".
    let valor = fila.valores?.[col.clave] ?? "";
    if (col.tipo === "horas") valor = textoDeHoras(fila.valores?.[col.clave]);
    if (col.tipo === "tiempo") valor = textoDeMinutos(fila.valores?.[col.clave]);
    setEditando({ filaId: fila.id, clave: col.clave, valor });
  };

  const guardarEdicion = async (valor) => {
    const actual = editando;
    setEditando(null);
    if (!actual) return;
    const fila = filas.find((una) => una.id === actual.filaId);
    const col = columnas.find((una) => una.clave === actual.clave);
    if (!fila || !col) return;
    if (col.tipo === "tiempo") {
      const segundos = interpretarMinutos(valor);
      if (segundos === undefined) {
        setMensaje(t("tabla.tiempoMalEscrito"));
        return;
      }
      if ((fila.valores?.[col.clave] ?? null) === segundos) return;
      setOcupada(true);
      const respuesta = (await onEditar?.(fila.id, col.clave, segundos)) || {};
      setOcupada(false);
      if (respuesta.error) setMensaje(t(respuesta.error, respuesta.variables));
      return;
    }
    if (col.tipo === "horas") {
      const horas = interpretarHoras(valor);
      if (horas === undefined) {
        setMensaje(t("tabla.horasMalEscritas"));
        return;
      }
      if (textoDeHoras(fila.valores?.[col.clave]) === textoDeHoras(horas)) return;
      setOcupada(true);
      const respuesta = (await onEditar?.(fila.id, col.clave, horas)) || {};
      setOcupada(false);
      if (respuesta.error) setMensaje(t(respuesta.error, respuesta.variables));
      return;
    }
    const nuevo = col.tipo === "numero" ? (valor === "" ? null : Number(String(valor).replace(",", "."))) : valor;
    if (col.tipo === "numero" && valor !== "" && !Number.isFinite(nuevo)) return;
    if ((fila.valores?.[col.clave] ?? "") === (nuevo ?? "")) return;
    setOcupada(true);
    const respuesta = (await onEditar?.(fila.id, col.clave, nuevo)) || {};
    setOcupada(false);
    if (respuesta.error) setMensaje(t(respuesta.error, respuesta.variables));
  };

  const marcada = (fila, col) => pendientes[`${fila.id}:${col.clave}`] ?? Boolean(fila.valores?.[col.clave]);
  // Marca o desmarca y guarda al toque. Mientras se guarda, otro toque en la
  // misma casilla no hace nada (no se manda dos veces).
  const alternarCasilla = async (fila, col) => {
    const clave = `${fila.id}:${col.clave}`;
    if (!col.editable || clave in pendientes) return;
    const valor = !marcada(fila, col);
    setPendientes((antes) => ({ ...antes, [clave]: valor }));
    setOcupada(true);
    const respuesta = (await onEditar?.(fila.id, col.clave, valor)) || {};
    setOcupada(false);
    setPendientes(({ [clave]: _guardada, ...resto }) => resto);
    if (respuesta.error) setMensaje(t(respuesta.error, respuesta.variables));
  };

  const elegirDeHoja = async (valor) => {
    const actual = hoja;
    setHoja(null);
    if (!actual) return;
    const fila = filas.find((una) => una.id === actual.filaId);
    if (!fila) return;
    setOcupada(true);
    const respuesta = (await onEditar?.(fila.id, actual.col.clave, valor || null)) || {};
    setOcupada(false);
    if (respuesta.error) setMensaje(t(respuesta.error, respuesta.variables));
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
      const claveDesde = visiblesRef.current[estado.desde]?.clave;
      const claveSobre = visiblesRef.current[estado.sobre]?.clave;
      setOrden((actual) => {
        const nuevo = reordenar(actual, actual.indexOf(claveDesde), actual.indexOf(claveSobre));
        guardarOrden(id, nuevo);
        return nuevo;
      });
      setSeleccion(null);
      setActiva(null);
    }
  }, [id]);

  // La cabecera bajo el dedo (una fija no recibe columnas).
  const columnaBajo = (x, y) => {
    const elemento = document.elementFromPoint(x, y);
    const th = elemento?.closest?.("th[data-columna]");
    if (!th) return null;
    const indice = Number(th.dataset.columna);
    return clavesFijas.includes(visibles[indice]?.clave) ? null : indice;
  };

  const alApretarCabecera = (evento, indice) => {
    if (evento.button !== undefined && evento.button !== 0) return;
    if (clavesFijas.includes(visibles[indice]?.clave)) return;
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

  // ------------------------------------------- El ancho de las columnas --
  // Como en Excel: se arrastra el borde derecho de la cabecera. Mientras se
  // arrastra cambia solo la variable de CSS de esa columna; al soltar, queda
  // guardado. El borde no arrastra la cabecera ni abre nada.

  const empezarAncho = (evento, clave) => {
    evento.stopPropagation();
    // Un borde por vez: otro dedo no le cambia la columna al que ya arrastra.
    if (ajusteRef.current) return;
    if (evento.button !== undefined && evento.button !== 0) return;
    evento.preventDefault();
    const cabecera = evento.currentTarget.closest("th");
    // Desde el ancho que tiene: el guardado o, si se acomoda sola, el que mide.
    const inicial = Math.max(ANCHO_MINIMO, Math.round(anchosVigentes[clave] ?? cabecera?.getBoundingClientRect().width ?? 0));
    ajusteRef.current = { clave, puntero: evento.pointerId, desde: evento.clientX, inicial, actual: inicial, tenia: clave in anchos };
    try {
      evento.currentTarget.setPointerCapture(evento.pointerId);
    } catch {
      // Sin captura igual se sigue mientras el puntero esté sobre el borde.
    }
    setAjustando(clave);
    // Desde ya la columna tiene ancho: el que tiene ahora.
    setAnchos((previos) => (previos[clave] === inicial ? previos : { ...previos, [clave]: inicial }));
  };

  const moverAncho = (evento) => {
    const ajuste = ajusteRef.current;
    if (!ajuste || evento.pointerId !== ajuste.puntero) return;
    evento.stopPropagation();
    evento.preventDefault();
    const ancho = Math.max(ANCHO_MINIMO, Math.round(ajuste.inicial + evento.clientX - ajuste.desde));
    if (ancho === ajuste.actual) return;
    ajuste.actual = ancho;
    tablaRef.current?.style.setProperty(variableDeAncho(ajuste.clave), `${ancho}px`);
  };

  // Al soltar (o si el navegador corta el arrastre: otra ventana, la columna
  // que ya no está), queda el ancho que tenía.
  const terminarAncho = (evento) => {
    const ajuste = ajusteRef.current;
    if (!ajuste || evento.pointerId !== ajuste.puntero) return;
    evento.stopPropagation();
    ajusteRef.current = null;
    setAjustando(null);
    setAnchos((previos) => {
      const { [ajuste.clave]: _antes, ...resto } = previos;
      // Un toque en el borde sin moverlo no le fija el ancho a una columna
      // que no lo tenía.
      const nuevos = ajuste.actual === ajuste.inicial && !ajuste.tenia ? resto : { ...resto, [ajuste.clave]: ajuste.actual };
      guardarEnCelular(CLAVE_ANCHOS, id, nuevos);
      return nuevos;
    });
  };

  // Dos clics en el borde: la columna vuelve a su ancho.
  const anchoDeEntrada = (clave) => {
    setAnchos((previos) => {
      if (!(clave in previos)) return previos;
      const { [clave]: _quitado, ...resto } = previos;
      guardarEnCelular(CLAVE_ANCHOS, id, resto);
      return resto;
    });
  };

  // ------------------------------------------------ Las columnas fijas --
  // Dos clics en una cabecera (en la compu) la dejan fija, al final de las
  // fijas, o la sueltan, y vuelve a su lugar entre las demás. Queda guardado
  // en este aparato para esta tabla. Una fija necesita ancho: si no tenía
  // uno, queda el que mide ahora (así no cambia al fijarla).
  const cambiarFija = (evento, col) => {
    if (!fijasEnEstaPantalla()) return;
    const yaFija = clavesFijas.includes(col.clave);
    const nuevas = yaFija ? fijasVigentes.filter((clave) => clave !== col.clave) : [...fijasVigentes.filter((clave) => clave !== col.clave), col.clave];
    setFijasElegidas(nuevas);
    guardarEnCelular(CLAVE_FIJAS, id, nuevas);
    if (!yaFija && anchos[col.clave] === undefined && !col.ancho) {
      // Para arriba: con un pedazo de píxel menos, el título ya no entra.
      const medido = Math.ceil(evento.currentTarget.getBoundingClientRect?.().width || 0);
      if (medido > 0) {
        setAnchos((previos) => {
          const nuevos = { ...previos, [col.clave]: Math.max(ANCHO_MINIMO, medido) };
          guardarEnCelular(CLAVE_ANCHOS, id, nuevos);
          return nuevos;
        });
      }
    }
    // Las columnas cambian de lugar: lo elegido ya no es lo mismo.
    setSeleccion(null);
    setActiva(null);
    setEditando(null);
    setMensaje(t(yaFija ? "tabla.columnaSuelta" : "tabla.columnaFija", { columna: col.titulo }));
  };

  // ------------------------------------------------- Filtros y orden --

  const olvidarSeleccion = () => {
    setSeleccion(null);
    setActiva(null);
    setEditando(null);
  };

  const abrirFiltro = (col) => {
    const ofrecidos = valoresDeColumna(filtrarFilas(filas, filtrosVigentes, { salvo: col.clave }), col.clave).map((valor) => ({ clave: valor.texto }));
    setHojaFiltro({ clave: col.clave, titulo: col.titulo, elegidos: elegidosAlAbrir(filtrosVigentes[col.clave], ofrecidos), busqueda: "" });
  };

  // Lo que ofrece la hoja: los valores que dejan pasar los otros filtros.
  const valoresDeLaHoja = useMemo(() => {
    if (!hojaFiltro) return [];
    return valoresDeColumna(filtrarFilas(filas, filtrosVigentes, { salvo: hojaFiltro.clave }), hojaFiltro.clave);
  }, [hojaFiltro, filas, filtrosVigentes]);

  // marcados: null con todo marcado (la columna no filtra).
  const aplicarFiltro = (marcados) => {
    const actual = hojaFiltro;
    setHojaFiltro(null);
    if (!actual) return;
    olvidarSeleccion();
    setFiltros((previos) => {
      const siguientes = { ...previos };
      if (marcados === null) delete siguientes[actual.clave];
      else siguientes[actual.clave] = marcados;
      return siguientes;
    });
  };

  const quitarFiltro = () => {
    const actual = hojaFiltro;
    setHojaFiltro(null);
    if (!actual) return;
    olvidarSeleccion();
    setFiltros((previos) => {
      const siguientes = { ...previos };
      delete siguientes[actual.clave];
      return siguientes;
    });
    setOrdenFilas((previo) => (previo?.clave === actual.clave ? null : previo));
  };

  const ordenarPor = (sentido) => {
    const actual = hojaFiltro;
    setHojaFiltro(null);
    if (!actual) return;
    setOrdenFilas({ clave: actual.clave, sentido });
  };

  const quitarFiltros = () => {
    olvidarSeleccion();
    setFiltros({});
    setOrdenFilas(null);
  };

  // ------------------------------------------------------------- Dibujo --

  const filaActiva = activa ? filasVista[activa.f] : null;
  // Las filas de lo elegido (con Shift, varias): las que borra «Borrar fila».
  const [primeraElegida, ultimaElegida] = seleccion ? rango(seleccion.f1, seleccion.f2) : activa ? [activa.f, activa.f] : [0, -1];
  const filasElegidas = filasVista.slice(primeraElegida, ultimaElegida + 1).map((fila) => fila.id);
  const textoDeEstado = ocupada
    ? t("tabla.guardando")
    : mensaje || aviso || (celdasElegidas ? plural("tabla.seleccion", celdasElegidas) : t("tabla.sinSeleccion"));
  // Cuántas filas hay; con filtros, cuántas se ven de cuántas.
  const cuantasFilas = hayFiltros ? plural("tabla.filasDe", filas.length, { n: filasVista.length, total: filas.length }) : plural("tabla.filas", filas.length);
  // El rótulo de las filas de arriba ocupa las fijas de entrada que van
  // adelante (las de quién y de cuándo, sin dato arriba) o, sin ninguna, la
  // primera columna (su dato no se ve). Una columna fijada con dos clics
  // después de esas muestra su dato. Con fijas, el rótulo también queda fijo.
  let fijasDeEntradaAdelante = 0;
  while (fijasDeEntradaAdelante < clavesFijas.length && fijas.includes(clavesFijas[fijasDeEntradaAdelante])) fijasDeEntradaAdelante += 1;
  const columnasDelRotulo = Math.max(fijasDeEntradaAdelante, 1);
  const rotuloSobreFijas = clavesFijas.length > 0;
  const rotuloHastaLaUltimaFija = columnasDelRotulo >= clavesFijas.length;
  // Las filas que se dibujan (con muchasFilas, las que se ven y unas más).
  const desdeFila = ventana ? Math.min(ventana.desde, filasVista.length) : 0;
  const hastaFila = ventana ? Math.min(Math.max(ventana.hasta, desdeFila), filasVista.length) : filasVista.length;
  const filasDibujadas = desdeFila === 0 && hastaFila === filasVista.length ? filasVista : filasVista.slice(desdeFila, hastaFila);

  return (
    <div className="tabla-datos" ref={marco}>
      <div className="tabla-datos-barra">
        <span className="tabla-datos-cuantas">{cuantasFilas}</span>
        <span className="tabla-datos-estado">{textoDeEstado}</span>
        <div className="tabla-datos-acciones">
          {(hayFiltros || ordenFilas) && (
            <button type="button" className="boton-secundario tabla-datos-quitar-filtros" onClick={quitarFiltros}>
              <Icono nombre="filtro" size={15} />
              {t("tabla.quitarFiltros")}
            </button>
          )}
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
          {onBorrarFilas && (
            <button type="button" className="boton-secundario tabla-datos-borrar" onClick={() => filasElegidas.length && onBorrarFilas(filasElegidas)} disabled={!filasElegidas.length || ocupada}>
              <Icono nombre="borrar" size={15} />
              {plural("tabla.borrarFilas", Math.max(filasElegidas.length, 1))}
            </button>
          )}
        </div>
      </div>

      {leyenda && (
        <p className={`tabla-datos-leyenda ${filasVista.some((fila) => fila.apagada) ? "" : "oculta"}`.trim()}>
          <i className="tabla-datos-muestra" aria-hidden="true" />
          {leyenda}
        </p>
      )}

      <div className="tabla-datos-marco" ref={cajaRef} tabIndex={0} onKeyDown={alTeclear} onPaste={alPegarEvento}>
        <table
          ref={tablaRef}
          className={`tabla-datos-tabla ${arrastre ? "arrastrando" : ""} ${ajustando ? "ajustando" : ""} ${todasConAncho ? "con-anchos" : ""} ${hayGrupos ? "con-grupos" : ""}`.trim()}
          style={variablesDeAncho}
        >
          <thead>
            {filasArriba.map((filaArriba) => (
              <tr key={filaArriba.id} className="tabla-datos-arriba">
                {filaArriba.rotulo !== null && (
                  <th
                    scope="row"
                    colSpan={columnasDelRotulo}
                    rowSpan={filaArriba.alto || 1}
                    className={`tabla-datos-arriba-rotulo ${rotuloSobreFijas ? `inmovil ${rotuloHastaLaUltimaFija ? "ultima-inmovil" : ""}` : ""}`.trim()}
                    style={rotuloSobreFijas ? { left: 0 } : undefined}
                  >
                    {/* Sobre las fijas no las ensancha: si no entra, se corta. */}
                    {rotuloSobreFijas ? <div className="tabla-datos-envoltura">{filaArriba.rotulo}</div> : filaArriba.rotulo}
                  </th>
                )}
                {visibles.slice(columnasDelRotulo).map((col) => {
                  const celda = filaArriba.celdas?.[col.clave];
                  const ancho = estiloDeColumna[col.clave];
                  return (
                    <td
                      key={col.clave}
                      className={`tabla-datos-arriba-celda ${col.alinear === "centro" ? "centrada" : ""} ${claseFija(col.clave)}`.trim()}
                      style={ancho && celda?.estilo ? { ...ancho, ...celda.estilo } : ancho || celda?.estilo || undefined}
                    >
                      {celda?.texto ?? ""}
                    </td>
                  );
                })}
              </tr>
            ))}
            {hayGrupos && (
              <tr className="tabla-datos-grupos">
                {tramos.map((tramo) => {
                  // Con una columna del grupo con su ancho (elegido a mano o
                  // fija), el título del grupo no la ensancha: si no entra,
                  // se corta.
                  const achicado = visibles.slice(tramo.desde, tramo.desde + tramo.cantidad).some((col) => anchosVigentes[col.clave]);
                  return (
                    <th
                      key={`${tramo.grupo}-${tramo.desde}`}
                      colSpan={tramo.cantidad}
                      scope="colgroup"
                      className={`tabla-datos-grupo ${tramo.grupo ? `tono-${tonoDeGrupo[tramo.grupo] ?? 0}` : "sin-grupo"} ${tramo.fijo ? "inmovil ultima-inmovil" : ""}`.trim()}
                      style={tramo.fijo ? { left: 0 } : undefined}
                      title={tramo.titulo}
                    >
                      <div className={achicado ? "tabla-datos-envoltura" : undefined}>
                        <span className="tabla-datos-grupo-titulo">{tramo.titulo}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            )}
            <tr className="tabla-datos-cabeceras">
              {visibles.map((col, indice) => {
                const filtrada = Boolean(filtrosVigentes[col.clave]);
                const ordenada = ordenFilas?.clave === col.clave;
                return (
                  <th
                    key={col.clave}
                    data-columna={indice}
                    className={`${arrastre?.desde === indice ? "origen" : ""} ${arrastre?.sobre === indice ? "destino" : ""} ${col.editable ? "" : "fija"} ${col.grupo ? `tono-${tonoDeGrupo[col.grupo] ?? 0}` : ""} ${claseFija(col.clave)} ${ajustando === col.clave ? "ajustada" : ""}`.trim()}
                    style={estiloDeColumna[col.clave] || (col.ancho ? { minWidth: col.ancho } : undefined)}
                    onPointerDown={(evento) => alApretarCabecera(evento, indice)}
                    onPointerMove={alMoverCabecera}
                    onPointerUp={terminarArrastre}
                    onPointerCancel={terminarArrastre}
                    onDoubleClick={(evento) => cambiarFija(evento, col)}
                    title={`${col.titulo}\n${t(clavesFijas.includes(col.clave) ? "tabla.soltarConDosClics" : "tabla.fijarConDosClics")}`}
                  >
                    <span className="tabla-datos-cabecera">
                      <span className="tabla-datos-titulo">{col.titulo}</span>
                      <button
                        type="button"
                        className={`tabla-datos-filtro ${filtrada || ordenada ? "activo" : ""}`.trim()}
                        aria-label={t("tabla.filtrar", { columna: col.titulo })}
                        aria-pressed={filtrada}
                        onPointerDown={(evento) => evento.stopPropagation()}
                        onClick={(evento) => {
                          evento.stopPropagation();
                          abrirFiltro(col);
                        }}
                        onDoubleClick={(evento) => evento.stopPropagation()}
                      >
                        {ordenada ? (
                          <span className="tabla-datos-flecha" aria-hidden="true">
                            {ordenFilas.sentido === "desc" ? "↓" : "↑"}
                          </span>
                        ) : null}
                        <Icono nombre="filtro" size={12} />
                      </button>
                    </span>
                    {/* El borde para achicarla o agrandarla, como en Excel. */}
                    <span
                      className="tabla-datos-borde"
                      aria-hidden="true"
                      title={t("tabla.ancho")}
                      onPointerDown={(evento) => empezarAncho(evento, col.clave)}
                      onPointerMove={moverAncho}
                      onPointerUp={terminarAncho}
                      onPointerCancel={terminarAncho}
                      onLostPointerCapture={terminarAncho}
                      onClick={(evento) => evento.stopPropagation()}
                      onDoubleClick={(evento) => {
                        evento.stopPropagation();
                        anchoDeEntrada(col.clave);
                      }}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody ref={cuerpoRef}>
            {filasVista.length === 0 && (
              <tr>
                <td colSpan={Math.max(visibles.length, 1)} className="tabla-datos-vacia">
                  {filas.length === 0 ? t("tabla.vacio") : t("tabla.sinResultados")}
                </td>
              </tr>
            )}
            {desdeFila > 0 && (
              <tr className="tabla-datos-hueco" aria-hidden="true" style={{ height: desdeFila * ventana.alto }}>
                <td colSpan={Math.max(visibles.length, 1)} />
              </tr>
            )}
            {filasDibujadas.map((fila, i) => {
              const f = desdeFila + i;
              return (
                <tr
                  key={fila.id}
                  className={`${activa?.f === f ? "activa" : ""} ${fila.apagada ? "apagada" : ""}`.trim() || undefined}
                  title={fila.apagada ? rotuloApagada || leyenda || undefined : undefined}
                >
                  {visibles.map((col, c) => {
                    const enEdicion = editando && editando.filaId === fila.id && editando.clave === col.clave;
                    const esActiva = activa?.f === f && activa?.c === c;
                    const formato = estilosDeCeldas?.[fila.id]?.[col.clave] || null;
                    const ancho = estiloDeColumna[col.clave];
                    return (
                      <td
                        key={col.clave}
                        className={`${estaElegida(f, c) ? "elegida" : ""} ${esActiva ? "activa" : ""} ${enEdicion ? "editando" : ""} ${col.editable ? "" : "fija"} ${col.tipo === "casilla" ? "casilla" : ""} ${col.alinear === "centro" ? "centrada" : ""} ${formato ? "con-formato" : ""} ${claseFija(col.clave)}`.trim()}
                        style={ancho && formato ? { ...ancho, ...formato } : ancho || formato || undefined}
                        onClick={(evento) => {
                          if (esActiva && !evento.shiftKey && !enEdicion) empezarEdicion(f, c);
                          else elegir(f, c, evento.shiftKey);
                        }}
                        // En una casilla, el doble toque ya la marcó y desmarcó.
                        onDoubleClick={() => col.tipo !== "casilla" && empezarEdicion(f, c)}
                      >
                        {col.tipo === "casilla" ? (
                          <input
                            type="checkbox"
                            className="tabla-datos-casilla"
                            checked={marcada(fila, col)}
                            disabled={!col.editable}
                            aria-label={`${col.titulo}: ${fila.textos?.[col.clave] ?? ""}`}
                            onClick={(evento) => {
                              // Un toque en la casilla la marca (y elige la celda),
                              // y el teclado sigue en la tabla. Con Mayúscula se
                              // extiende la selección, sin marcar nada.
                              evento.stopPropagation();
                              // (Sin cambiar el estado, React la deja como estaba.)
                              if (evento.shiftKey) {
                                elegir(f, c, true);
                                return;
                              }
                              elegir(f, c);
                              evento.currentTarget.closest(".tabla-datos-marco")?.focus({ preventScroll: true });
                              alternarCasilla(fila, col);
                            }}
                            // Se cambia en el toque (arriba): así Mayúscula no la cambia.
                            onChange={() => {}}
                            onDoubleClick={(evento) => evento.stopPropagation()}
                          />
                        ) : enEdicion ? (
                          <input
                            autoFocus
                            type={col.tipo === "fecha" ? "date" : col.tipo === "fecha_hora" ? "datetime-local" : col.tipo === "numero" ? "number" : "text"}
                            placeholder={col.tipo === "horas" || col.tipo === "tiempo" ? "0:00" : undefined}
                            inputMode={col.tipo === "tiempo" ? "decimal" : undefined}
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
              );
            })}
            {hastaFila < filasVista.length && (
              <tr className="tabla-datos-hueco" aria-hidden="true" style={{ height: (filasVista.length - hastaFila) * ventana.alto }}>
                <td colSpan={Math.max(visibles.length, 1)} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <HojaOpciones
        abierta={Boolean(hoja)}
        titulo={hoja?.col.titulo}
        opciones={hoja ? [{ valor: "", etiqueta: t("comun.sinDato") }, ...(hoja.col.opciones || [])] : []}
        elegida={hoja ? filas.find((una) => una.id === hoja.filaId)?.valores?.[hoja.col.clave] || "" : ""}
        onElegir={elegirDeHoja}
        onCerrar={() => setHoja(null)}
      />

      <HojaDeFiltro
        abierta={Boolean(hojaFiltro)}
        columna={hojaFiltro?.titulo || ""}
        valores={valoresDeLaHoja.map((valor) => ({ clave: valor.texto, texto: valor.texto, cantidad: valor.cantidad }))}
        elegidos={hojaFiltro?.elegidos || []}
        busqueda={hojaFiltro?.busqueda || ""}
        onCambiar={(elegidos) => setHojaFiltro((actual) => ({ ...actual, elegidos }))}
        onBuscar={(busqueda) => setHojaFiltro((actual) => ({ ...actual, busqueda }))}
        onAplicar={aplicarFiltro}
        onQuitar={quitarFiltro}
        onCerrar={() => setHojaFiltro(null)}
      >
        {hojaFiltro && (
          <div className="grilla-criterios tabla-datos-orden">
            <button
              type="button"
              className={`chip-criterio ${ordenFilas?.clave === hojaFiltro.clave && ordenFilas.sentido === "asc" ? "prendido" : ""}`}
              onClick={() => ordenarPor("asc")}
            >
              {t("tabla.ordenarAsc")}
            </button>
            <button
              type="button"
              className={`chip-criterio ${ordenFilas?.clave === hojaFiltro.clave && ordenFilas.sentido === "desc" ? "prendido" : ""}`}
              onClick={() => ordenarPor("desc")}
            >
              {t("tabla.ordenarDesc")}
            </button>
          </div>
        )}
      </HojaDeFiltro>
    </div>
  );
};

export default TablaDatos;
