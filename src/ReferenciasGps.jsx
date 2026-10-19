import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojasDeOcultar, OcultasArriba, useOcultar } from "./components/Ocultar.jsx";
import { HistorialDeReferencias, TablaDeReferencia } from "./components/TablaDeReferencia.jsx";
import { TerminoDe } from "./components/Guia.jsx";
import { tituloDeColumna } from "./domain/evaluaciones/ajustes.js";
import { CATEGORIAS_DE_UN_VR, CLAVES_DE_LOS_VR, tieneCategorias } from "./domain/gps/informe.js";
import { textoDeCelda } from "./domain/gps/valores.js";
import { interpretarHoras, interpretarValor } from "./domain/tabla.js";
import { cambiosDeEntrada } from "./domain/referencias.js";
import { leerHistorialDeReferencias } from "./domain/referenciasDb.js";
import { borrarReferenciaGps, cambiarValorDeReferenciaGps, marcarDePartidoGps, recalcularReferenciaGps, renombrarReferenciaGps, sumarReferenciaGps } from "./domain/gpsDb.js";
import { armarPlanilla, calcularPlanilla, eleccionDeLaPlanilla, filasDeLaMuestra, medidasDeLaPlanilla, numerosParaGuardar } from "./domain/gps/planillaVr.js";
import PlanillaVrGps from "./PlanillaVrGps.jsx";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";

// GPS › Valores de referencia (Santiago, 14/10: «Todos los vr tienen que
// tener su solapa aparte», «Como esta en evaluaciones»): arriba se elige el
// dispositivo; cada V.R. suyo es una tarjeta con su tabla (Promedio y
// Desvío de cada medida, como la hoja de los V.R. del club). Los cambia
// quien tiene GPS y sigue en el club: un número con dos toques; sumar,
// cambiar el nombre, borrar y marcar el «de partido» (el que usa Cargar para
// el % vs V.R. de partido de ese dispositivo). Abajo, los últimos cambios,
// con «Volver». Los V.R. por jugador (con categorías; Santiago, 15/10: «en
// el caso de jugador ya tiene las 5 categorias») muestran las cinco filas
// del Excel: Excelente, Muy Bueno, Bueno (su promedio), Regular y Malo. Con
// V.R. de más de una tabla en el dispositivo (los de cada jugador van por
// tabla), se puede ver una sola tabla (de entrada, todas, como antes).
// «Agregar V.R.» abre la planilla del club (PlanillaVrGps.jsx; nota 2 de la
// planilla de valor referencial, 19/10): un solo nombre (va en la tabla) y
// la muestra de la Base. Un V.R. calculado así dice cuándo y con qué filas
// y tiene «Recalcular» (con la misma muestra y lo elegido, con los datos de
// ese día; pregunta antes, y los números de antes quedan en los últimos
// cambios, con «Volver»). Sin la actualización 20261108 de la base, «Agregar
// V.R.» sigue como antes: tipo, tabla y grupo, para escribirlo a mano.

const FILAS = ["promedio", "desvio"];
const FILAS_CON_CATEGORIAS = ["excelente", "muy_bueno", "promedio", "regular", "malo"];
const filasDe = (referencia) => {
  if (!tieneCategorias(referencia)) return FILAS;
  return Object.keys(referencia.desvio || {}).length ? [...FILAS_CON_CATEGORIAS, "desvio"] : FILAS_CON_CATEGORIAS;
};
const valoresDe = (referencia, fila) => (CATEGORIAS_DE_UN_VR.includes(fila) ? referencia?.categorias?.[fila] : referencia?.[fila]);
const tituloDeFila = (referencia, fila) => t(fila === "promedio" && tieneCategorias(referencia) ? "gps.vr.bueno" : `gps.vr.${fila}`);
const nombreDe = (referencia) => [referencia?.tipo, referencia?.tabla, referencia?.grupo].filter(Boolean).join(" · ");
const tablaDe = (referencia) => [referencia?.tipo, referencia?.tabla].filter(Boolean).join(" · ");

// Un cambio de un objeto entero (una categoría que aparece o se va), número
// por número: así se muestra y se vuelve atrás como los demás.
const esObjeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);
const numeroPorNumero = (cambio) => {
  const { ruta, antes, despues } = cambio;
  if (!esObjeto(antes) && !esObjeto(despues)) return [cambio];
  const de = (lado, clave) => (esObjeto(lado) && lado[clave] !== undefined ? lado[clave] : null);
  const claves = [...new Set([...Object.keys(esObjeto(antes) ? antes : {}), ...Object.keys(esObjeto(despues) ? despues : {})])];
  return claves.flatMap((clave) => numeroPorNumero({ ruta: [...ruta, clave], antes: de(antes, clave), despues: de(despues, clave) }));
};
const ordenar = (lista) =>
  [...lista].sort((a, b) => a.orden - b.orden || nombreDe(a).localeCompare(nombreDe(b)));

export default function ReferenciasGps({
  gps,
  config,
  idioma,
  equipoId,
  referencias,
  dispositivos,
  sinEdicion,
  faltaTabla,
  soloLectura,
  seFue = soloLectura,
  enLinea,
  encabezado,
  arriba = null,
  onCambiadas,
  onRecargar,
  onAviso,
  // La planilla: sin la actualización de la base, no; las filas del GPS (como
  // vienen de la base) y si ya llegaron todas; cómo se arma cada una en la
  // Base, sus columnas y cómo se ve un valor guardado de una columna.
  sinPlanilla = true,
  filasGps = [],
  todasLasFilas = true,
  armarFilaDeLaBase = null,
  columnasDeLaBase = [],
  fijasDeLaBase = [],
  textoDeValorDeLaBase = (_clave, valor) => String(valor ?? ""),
  sentidoDeAjustes = () => null,
  onGuia = null,
}) {
  const { plural } = useIdioma();
  // Los dispositivos de la lista del club y, si hay V.R. de uno que ya no
  // está en la lista, también.
  const opciones = useMemo(() => {
    const deLaLista = dispositivos.map((opcion) => ({ valor: opcion.valor, etiqueta: opcion.etiqueta }));
    const conocidos = new Set(deLaLista.map((opcion) => opcion.valor));
    const sueltos = [...new Set(referencias.map((referencia) => referencia.dispositivo))].filter((codigo) => codigo && !conocidos.has(codigo)).map((codigo) => ({ valor: codigo, etiqueta: codigo }));
    return [...deLaLista, ...sueltos];
  }, [dispositivos, referencias]);
  const [elegido, setElegido] = useState("");
  const dispositivo = opciones.some((opcion) => opcion.valor === elegido) ? elegido : opciones.find((opcion) => referencias.some((referencia) => referencia.dispositivo === opcion.valor))?.valor || opciones[0]?.valor || "";
  const nombreDelDispositivo = opciones.find((opcion) => opcion.valor === dispositivo)?.etiqueta || dispositivo;
  const suyas = useMemo(() => ordenar(referencias.filter((referencia) => referencia.dispositivo === dispositivo)), [referencias, dispositivo]);
  const tablas = useMemo(() => [...new Set(suyas.map(tablaDe))], [suyas]);
  const [tablaElegida, setTablaElegida] = useState("");
  const tabla = tablas.length > 1 && tablas.includes(tablaElegida) ? tablaElegida : "";
  const aLaVista = tabla ? suyas.filter((referencia) => tablaDe(referencia) === tabla) : suyas;
  // Ocultar a mano (Santiago, 15/10): lo mismo en todas las tablas (tienen
  // las mismas columnas y filas).
  const ocultar = useOcultar("vr-gps");

  // Se cambian con la base al día, con señal y siguiendo en el club.
  const puedeCambiar = !soloLectura && !sinEdicion && !faltaTabla && enLinea;

  // Las columnas: las de la hoja de los V.R. y, si un V.R. tiene otra, también.
  const columnasGps = useMemo(() => {
    const porClave = new Map(gps.columnas.map((columna) => [columna.clave, columna]));
    const claves = [...CLAVES_DE_LOS_VR];
    suyas.forEach((referencia) =>
      [...Object.keys(referencia.promedio), ...Object.keys(referencia.desvio), ...CATEGORIAS_DE_UN_VR.flatMap((categoria) => Object.keys(referencia.categorias?.[categoria] || {}))].forEach((clave) => {
        if (!claves.includes(clave) && porClave.has(clave)) claves.push(clave);
      }),
    );
    return claves.filter((clave) => porClave.has(clave)).map((clave) => porClave.get(clave));
  }, [gps, suyas]);
  const columnas = useMemo(
    () => columnasGps.map((columna) => ({ clave: columna.clave, titulo: tituloDeColumna(gps, columna, config, idioma), teclado: columna.tipo === "tiempo" ? "text" : "decimal", gps: columna })),
    [columnasGps, gps, config, idioma],
  );
  const tituloDe = (clave) => columnas.find((columna) => columna.clave === clave)?.titulo || clave;
  const columnasAVista = columnas.filter((columna) => !ocultar.columnaOculta(columna.clave));
  // Las filas de todas las tablas a la vista, una vez cada una.
  const filasParaOcultar = aLaVista
    .flatMap((referencia) => filasDe(referencia).map((clave) => ({ clave, texto: tituloDeFila(referencia, clave) })))
    .filter((fila, indice, todas) => todas.findIndex((otra) => otra.clave === fila.clave) === indice);

  // Como en la Base, salvo los por minuto: sus V.R. son chicos (0,48 por
  // minuto) y con un decimal se perderían; van con dos.
  const textoDe = (columna, valor) => textoDeCelda(columna.tipo === "porMinuto" ? { ...columna, formato: "0.00" } : columna, valor, idioma);
  const interpretar = (_fila, columna, escrito) => {
    if (columna.gps.tipo === "tiempo") {
      const horas = interpretarHoras(escrito);
      return horas === null || horas === undefined ? horas : Math.round(horas * 3600 * 1000) / 1000;
    }
    return interpretarValor({ tipo: "numero" }, escrito);
  };

  // Lo que devuelve la base reemplaza lo que se veía (sin esperar a releer).
  const reemplazar = useCallback((cambiadas) => onCambiadas(cambiadas), [onCambiadas]);

  // ------------------------------------------------------------ Historial --
  const [historial, setHistorial] = useState({ cambios: [], error: "", leido: false });
  const leerHistorial = useCallback(async () => {
    if (seFue || sinEdicion || faltaTabla || !equipoId) return;
    const respuesta = await leerHistorialDeReferencias(equipoId, "gps_referencias");
    setHistorial({ cambios: respuesta.cambios, error: respuesta.error, leido: true });
  }, [equipoId, seFue, sinEdicion, faltaTabla]);
  // Cada vez que cambian los V.R. (acá o en otro aparato), el historial también.
  useEffect(() => {
    leerHistorial();
  }, [leerHistorial, referencias]);

  const vacio = t("referencias.historial.vacioValor");
  const textoDeCambio = (entrada, cambio) => {
    const fila = entrada.despues || entrada.antes || {};
    const [parte] = cambio.ruta;
    const [cual, clave] = parte === "categorias" ? cambio.ruta.slice(1) : cambio.ruta;
    if (parte === "promedio" || parte === "desvio" || (parte === "categorias" && CATEGORIAS_DE_UN_VR.includes(cual))) {
      const columna = columnasGps.find((una) => una.clave === clave) || gps.columnas.find((una) => una.clave === clave);
      const de = (valor) => (valor === null ? vacio : columna ? textoDe(columna, valor) : String(valor));
      return t("gps.vr.cambio.valor", { nombre: nombreDe(fila), medida: tituloDe(clave), fila: tituloDeFila(fila, cual), antes: de(cambio.antes), despues: de(cambio.despues) });
    }
    if (parte === "de_partido") return t(cambio.despues ? "gps.vr.cambio.dePartido" : "gps.vr.cambio.noDePartido", { nombre: nombreDe(fila) });
    return null;
  };
  const entradas = useMemo(
    () =>
      historial.cambios
        .filter((entrada) => (entrada.despues || entrada.antes)?.dispositivo === dispositivo)
        .map((entrada) => {
          if (entrada.accion === "creada") return { ...entrada, lineas: [t("gps.vr.cambio.sumado", { nombre: nombreDe(entrada.despues) })], volver: referencias.some((una) => una.id === entrada.filaId) };
          if (entrada.accion === "borrada") return { ...entrada, lineas: [t("gps.vr.cambio.borrado", { nombre: nombreDe(entrada.antes) })], volver: true };
          const cambios = cambiosDeEntrada(entrada)
            .flatMap(numeroPorNumero)
            .filter((cambio) => cambio.ruta[0] !== "orden");
          // «Recalcular» cambia todos los números de un saque: una sola línea.
          if (cambios.some((cambio) => cambio.ruta[0] === "planilla")) {
            return { ...entrada, cambios, recalculo: true, lineas: [t("gps.vr.cambio.recalculado", { nombre: nombreDe(entrada.despues) })], volver: true };
          }
          const lineas = [];
          if (cambios.some((cambio) => ["tipo", "tabla", "grupo"].includes(cambio.ruta[0]))) lineas.push(t("gps.vr.cambio.nombre", { antes: nombreDe(entrada.antes), despues: nombreDe(entrada.despues) }));
          cambios.forEach((cambio) => {
            const texto = textoDeCambio(entrada, cambio);
            if (texto) lineas.push(texto);
          });
          return { ...entrada, cambios, lineas, volver: cambios.length > 0 };
        })
        .filter((entrada) => entrada.lineas.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historial.cambios, dispositivo, referencias, columnas, idioma],
  );

  // Volver atrás: lo cambiado, a como estaba; lo borrado, otra vez; lo
  // sumado, se borra.
  const volver = async (id) => {
    const entrada = entradas.find((una) => una.id === id);
    if (!entrada) return { error: "" };
    let respuesta = { error: "" };
    if (entrada.accion === "creada") {
      respuesta = await borrarReferenciaGps(entrada.filaId);
    } else if (entrada.accion === "borrada") {
      const antes = entrada.antes;
      respuesta = await sumarReferenciaGps(equipoId, {
        dispositivo: antes.dispositivo,
        tipo: antes.tipo,
        tabla: antes.tabla,
        grupo: antes.grupo,
        orden: antes.orden || 0,
        promedio: antes.promedio || {},
        desvio: antes.desvio || {},
        categorias: antes.categorias || {},
        planilla: antes.planilla || null,
      });
      if (!respuesta.error && antes.de_partido) respuesta = await marcarDePartidoGps(respuesta.referencia.id, true);
    } else if (entrada.recalculo) {
      if (!referencias.some((una) => una.id === entrada.filaId)) return { error: "gps.vr.yaNoEsta" };
      const antes = entrada.antes;
      respuesta = await recalcularReferenciaGps(entrada.filaId, { promedio: antes.promedio || {}, desvio: antes.desvio || {}, categorias: antes.categorias || {}, planilla: antes.planilla || null });
    } else {
      if (!referencias.some((una) => una.id === entrada.filaId)) return { error: "gps.vr.yaNoEsta" };
      const nombre = entrada.cambios.some((cambio) => ["tipo", "tabla", "grupo"].includes(cambio.ruta[0]));
      if (nombre) respuesta = await renombrarReferenciaGps(entrada.filaId, entrada.antes);
      for (const cambio of entrada.cambios) {
        if (respuesta.error) break;
        const [parte, clave, deLaCategoria] = cambio.ruta;
        if (parte === "promedio" || parte === "desvio") respuesta = await cambiarValorDeReferenciaGps(entrada.filaId, parte, clave, cambio.antes);
        else if (parte === "categorias") respuesta = await cambiarValorDeReferenciaGps(entrada.filaId, clave, deLaCategoria, cambio.antes);
        else if (parte === "de_partido") respuesta = await marcarDePartidoGps(entrada.filaId, Boolean(cambio.antes));
      }
    }
    if (respuesta.error) return respuesta;
    await onRecargar();
    onAviso(t("referencias.historial.volvio"));
    return { error: "" };
  };

  // ------------------------------------------- Sumar, nombrar y borrar --
  const [hoja, setHoja] = useState(null);
  const [errorHoja, setErrorHoja] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  const abrirHoja = (referencia = null) => {
    setErrorHoja("");
    setHoja(
      referencia
        ? { id: referencia.id, tipo: referencia.tipo, tabla: referencia.tabla, grupo: referencia.grupo, deLaPlanilla: Boolean(referencia.planilla) }
        : { id: null, tipo: "", tabla: "", grupo: "", deLaPlanilla: false },
    );
  };
  const guardarHoja = async () => {
    if (!hoja) return;
    // Uno de la planilla tiene un solo nombre (en la tabla).
    const completo = hoja.deLaPlanilla ? String(hoja.tabla || "").trim() : [hoja.tipo, hoja.tabla, hoja.grupo].every((texto) => String(texto || "").trim());
    if (!completo) {
      setErrorHoja(t(hoja.deLaPlanilla ? "gps.vr.planilla.faltaNombre" : "gps.vr.faltaNombre"));
      return;
    }
    setOcupado(true);
    const orden = referencias.reduce((mayor, referencia) => Math.max(mayor, referencia.orden), 0) + 1;
    const nombre = hoja.deLaPlanilla ? { tipo: "", tabla: hoja.tabla, grupo: "" } : hoja;
    const respuesta = hoja.id ? await renombrarReferenciaGps(hoja.id, nombre) : await sumarReferenciaGps(equipoId, { dispositivo, tipo: hoja.tipo, tabla: hoja.tabla, grupo: hoja.grupo, orden });
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    reemplazar([respuesta.referencia]);
    // Con una tabla elegida, se pasa a la del V.R. (para que se vea).
    if (tabla) setTablaElegida(tablaDe(respuesta.referencia));
    setHoja(null);
    onAviso(t(hoja.id ? "gps.vr.renombrado" : "gps.vr.sumado"));
  };
  const borrar = async () => {
    const referencia = aBorrar;
    setABorrar(null);
    if (!referencia) return;
    const respuesta = await borrarReferenciaGps(referencia.id);
    if (respuesta.error) {
      onAviso(t(respuesta.error), { error: true });
      return;
    }
    await onRecargar();
    onAviso(t("gps.vr.borrado"));
  };
  const marcar = async (referencia, valor) => {
    const respuesta = await marcarDePartidoGps(referencia.id, valor);
    if (respuesta.error) {
      onAviso(t(respuesta.error), { error: true });
      return;
    }
    reemplazar(respuesta.referencias);
  };

  // ------------------------------------------------- La planilla del club --
  const [calculando, setCalculando] = useState(false);
  const [aRecalcular, setARecalcular] = useState(null);
  const [recalculando, setRecalculando] = useState(false);
  const medidas = useMemo(() => medidasDeLaPlanilla(gps.columnas), [gps]);
  const tituloDeMedida = (clave) => {
    const columna = gps.columnas.find((una) => una.clave === clave);
    return columna ? tituloDeColumna(gps, columna, config, idioma) : clave;
  };
  // Las filas del dispositivo, armadas como en la Base (solo para calcular).
  const conFilas = calculando || Boolean(aRecalcular);
  const filasDelDispositivo = useMemo(
    () => (conFilas && armarFilaDeLaBase ? filasGps.filter((fila) => (fila.datos?.dispositivo || "") === dispositivo).map(armarFilaDeLaBase) : []),
    [conFilas, armarFilaDeLaBase, filasGps, dispositivo],
  );
  const puedeCalcular = puedeCambiar && !sinPlanilla && Boolean(armarFilaDeLaBase);

  const guardarDeLaPlanilla = async ({ nombre, promedio, desvio, categorias, planilla }) => {
    const orden = referencias.reduce((mayor, referencia) => Math.max(mayor, referencia.orden), 0) + 1;
    const respuesta = await sumarReferenciaGps(equipoId, { dispositivo, tipo: "", tabla: nombre, grupo: "", orden, promedio, desvio, categorias, planilla });
    if (respuesta.error) return respuesta;
    reemplazar([respuesta.referencia]);
    if (tabla) setTablaElegida(tablaDe(respuesta.referencia));
    setCalculando(false);
    onAviso(t("gps.vr.sumado"));
    return { error: "" };
  };

  // Cómo se armó la muestra: cada filtro con lo elegido (hasta tres, con su
  // nombre; más, cuántos).
  const textoDeLaMuestra = (planilla) => {
    const filtros = Object.entries(planilla?.muestra || {});
    if (!filtros.length) return t("gps.vr.planilla.conTodas");
    return filtros
      .map(([clave, valores]) => {
        const columna = columnasDeLaBase.find((una) => una.clave === clave);
        const textos = valores.map((valor) => (valor === "" || valor === null ? t("gps.vr.planilla.vacio") : textoDeValorDeLaBase(clave, valor)));
        return t("gps.vr.planilla.filtro", { columna: columna?.titulo || clave, valores: textos.length <= 3 ? textos.join(", ") : plural("gps.vr.planilla.elegidos", textos.length) });
      })
      .join(" · ");
  };
  const textoDelCalculo = (planilla) =>
    [
      t("gps.vr.planilla.calculado", { fecha: planilla.calculado ? fechaCorta(planilla.calculado) : "—", filas: plural("gps.vr.planilla.filas", planilla.filas ?? 0) }),
      textoDeLaMuestra(planilla),
    ].join(" · ");

  // «Recalcular»: la misma muestra y lo elegido, con los datos de hoy.
  const recalculo = useMemo(() => {
    if (!aRecalcular?.planilla) return null;
    const muestra = filasDeLaMuestra(filasDelDispositivo, aRecalcular.planilla.muestra);
    const eleccion = eleccionDeLaPlanilla(aRecalcular.planilla, medidas, sentidoDeAjustes);
    return { muestra, eleccion };
  }, [aRecalcular, filasDelDispositivo, medidas, sentidoDeAjustes]);
  const textoDeLaDiferencia = (antes, ahora) => {
    if (antes === null || antes === undefined || antes === ahora) return t("gps.vr.planilla.igualQueAntes");
    return ahora > antes ? plural("gps.vr.planilla.masQueAntes", ahora - antes) : plural("gps.vr.planilla.menosQueAntes", antes - ahora);
  };
  const recalcular = async () => {
    const referencia = aRecalcular;
    if (!referencia || !recalculo || recalculando) return;
    const numeros = numerosParaGuardar(calcularPlanilla(recalculo.muestra.map((fila) => fila.gps), medidas, recalculo.eleccion));
    if (!Object.keys(numeros.promedio).length) {
      setARecalcular(null);
      onAviso(t("gps.vr.planilla.ningunaMedida"), { error: true });
      return;
    }
    setRecalculando(true);
    const planilla = armarPlanilla({ muestra: referencia.planilla.muestra, eleccion: recalculo.eleccion, filas: recalculo.muestra.length, calculado: hoyISO() });
    const respuesta = await recalcularReferenciaGps(referencia.id, { ...numeros, planilla });
    setRecalculando(false);
    setARecalcular(null);
    if (respuesta.error) {
      onAviso(t(respuesta.error), { error: true });
      return;
    }
    reemplazar([respuesta.referencia]);
    onAviso(t("gps.vr.planilla.recalculado"));
  };

  const cambiarNumero = (referencia) => async (fila, columna, valor) => {
    const respuesta = await cambiarValorDeReferenciaGps(referencia.id, fila.clave, columna.clave, valor);
    if (!respuesta.error) reemplazar([respuesta.referencia]);
    return respuesta;
  };

  // ------------------------------------------------------------ Pantalla --
  if (calculando && puedeCalcular)
    return (
      <PlanillaVrGps
        dispositivo={{ valor: dispositivo, etiqueta: nombreDelDispositivo }}
        filas={filasDelDispositivo}
        columnas={columnasDeLaBase}
        fijas={fijasDeLaBase}
        medidas={medidas}
        tituloDe={tituloDeMedida}
        textoDe={textoDe}
        sentidoDeAjustes={sentidoDeAjustes}
        onGuardar={guardarDeLaPlanilla}
        onCancelar={() => setCalculando(false)}
        onGuia={onGuia}
      />
    );

  let aviso = null;
  if (faltaTabla) aviso = t("gps.vr.faltaMigracion");
  else if (sinEdicion && !soloLectura) aviso = t("gps.vr.faltaActualizacion");

  return (
    <div className="app">
      <div className="contenedor contenedor-base">
        {encabezado(t("gps.vr.titulo"), t("gps.vr.texto"))}
        {arriba}
        {aviso && <p className="lesiones-estado evaluaciones-sin-referencias">{aviso}</p>}
        {!faltaTabla && (
          <>
            {opciones.length ? (
              <label className="campo-inicio evaluaciones-elegir-test">
                <span>{t("gps.vr.dispositivo")}</span>
                <select className="evaluaciones-elegir-test-lista" value={dispositivo} onChange={(evento) => setElegido(evento.target.value)}>
                  {opciones.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="lesiones-estado">{t("gps.vr.sinDispositivos")}</p>
            )}
            {tablas.length > 1 && (
              <label className="campo-inicio evaluaciones-elegir-test">
                <span>{t("gps.vr.tabla")}</span>
                <select className="evaluaciones-elegir-test-lista" value={tabla} onChange={(evento) => setTablaElegida(evento.target.value)}>
                  <option value="">{t("gps.vr.todasLasTablas")}</option>
                  {tablas.map((una) => (
                    <option key={una} value={una}>
                      {una}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {dispositivo && !suyas.length && <p className="lesiones-estado">{t("gps.vr.ningunoDelDispositivo", { dispositivo: nombreDelDispositivo })}</p>}
            {puedeCambiar && suyas.length > 0 && <p className="lesiones-ayuda referencias-ayuda">{t("referencias.comoSeCambia")}</p>}
            {aLaVista.length > 0 && <OcultasArriba ocultar={ocultar} columnas={columnas.map((columna) => ({ clave: columna.clave, texto: columna.titulo }))} filas={filasParaOcultar} />}
            {aLaVista.map((referencia) => (
              <section key={referencia.id} className="tarjeta evaluaciones-bloque referencias-bloque">
                <div className="evaluaciones-bloque-cabeza">
                  <h2>{nombreDe(referencia)}</h2>
                  {referencia.dePartido && (
                    <span className="referencias-de-partido">
                      {t("gps.vr.esDePartido")}
                      <TerminoDe clave="gps.terminos.vrPartido" />
                    </span>
                  )}
                </div>
                {referencia.planilla && <p className="lesiones-ayuda referencias-calculado">{textoDelCalculo(referencia.planilla)}</p>}
                <TablaDeReferencia
                  ocultar={ocultar}
                  columnas={columnas}
                  filas={filasDe(referencia).map((clave) => ({ clave, titulo: tituloDeFila(referencia, clave) }))}
                  minimo={Math.max(520, 96 + columnasAVista.length * 78)}
                  texto={(fila, columna) => {
                    const valor = valoresDe(referencia, fila.clave)?.[columna.clave];
                    return valor === undefined || valor === null ? "" : textoDe(columna.gps, valor);
                  }}
                  interpretar={interpretar}
                  onCambiar={puedeCambiar ? cambiarNumero(referencia) : undefined}
                />
                {puedeCambiar && (
                  <div className="referencias-acciones">
                    {referencia.planilla && puedeCalcular && (
                      <button type="button" className="boton-secundario" onClick={() => setARecalcular(referencia)} disabled={!todasLasFilas}>
                        {t("gps.vr.planilla.recalcular")}
                      </button>
                    )}
                    <button type="button" className="boton-secundario" onClick={() => marcar(referencia, !referencia.dePartido)}>
                      {referencia.dePartido ? t("gps.vr.noUsarDePartido") : t("gps.vr.usarDePartido")}
                    </button>
                    <button type="button" className="boton-secundario" onClick={() => abrirHoja(referencia)}>
                      {t("gps.vr.cambiarNombre")}
                    </button>
                    <button type="button" className="boton-secundario boton-peligro" onClick={() => setABorrar(referencia)}>
                      {t("gps.vr.borrar")}
                    </button>
                  </div>
                )}
              </section>
            ))}
            {puedeCambiar && dispositivo && (
              <button type="button" className="boton-principal referencias-sumar" onClick={() => (puedeCalcular ? setCalculando(true) : abrirHoja())} disabled={puedeCalcular && !todasLasFilas}>
                {t("gps.vr.sumar", { dispositivo: nombreDelDispositivo })}
              </button>
            )}
            {puedeCalcular && dispositivo && !todasLasFilas && <p className="lesiones-ayuda referencias-ayuda">{t("gps.vr.planilla.faltanFilas")}</p>}
            {historial.leido && !seFue && !sinEdicion && <HistorialDeReferencias entradas={entradas} onVolver={enLinea && !soloLectura ? volver : undefined} error={historial.error} />}
          </>
        )}
      </div>

      {hoja && (
        <HojaInferior
          abierta
          className="lesiones-hoja"
          titulo={hoja.id ? t("gps.vr.cambiarNombre") : t("gps.vr.sumar", { dispositivo: nombreDelDispositivo })}
          descripcion={hoja.deLaPlanilla ? t("gps.vr.planilla.nombreAyuda") : t("gps.vr.nombreAyuda")}
          onCerrar={() => setHoja(null)}
          acciones={
            <>
              <button type="button" className="boton-cancelar-hoja" onClick={() => setHoja(null)} disabled={ocupado}>
                {t("comun.cancelar")}
              </button>
              <button type="button" className="boton-confirmar-hoja" onClick={guardarHoja} disabled={ocupado}>
                {ocupado ? t("comun.guardando") : t("comun.guardar")}
              </button>
            </>
          }
        >
          {errorHoja && <div className="aviso-hoja">{errorHoja}</div>}
          {hoja.deLaPlanilla ? (
            <div className="campo-inicio">
              <label htmlFor="vr-nombre">{t("gps.vr.planilla.nombre")}</label>
              <input id="vr-nombre" type="text" maxLength={120} value={hoja.tabla} onChange={(evento) => setHoja({ ...hoja, tabla: evento.target.value })} />
            </div>
          ) : (
            ["tipo", "tabla", "grupo"].map((campo) => (
              <div className="campo-inicio" key={campo}>
                <label htmlFor={`vr-${campo}`}>{t(`gps.vr.${campo}`)}</label>
                <input id={`vr-${campo}`} type="text" maxLength={campo === "tipo" ? 80 : 120} value={hoja[campo]} onChange={(evento) => setHoja({ ...hoja, [campo]: evento.target.value })} />
              </div>
            ))
          )}
        </HojaInferior>
      )}

      <HojaConfirmar
        abierta={Boolean(aRecalcular && recalculo)}
        titulo={aRecalcular ? t("gps.vr.planilla.recalcularTitulo", { nombre: nombreDe(aRecalcular) }) : ""}
        icono="documento"
        descripcion={
          aRecalcular && recalculo
            ? t("gps.vr.planilla.recalcularTexto", {
                muestra: textoDeLaMuestra(aRecalcular.planilla),
                filas: plural("gps.vr.planilla.filas", recalculo.muestra.length),
                diferencia: textoDeLaDiferencia(aRecalcular.planilla.filas, recalculo.muestra.length),
              })
            : ""
        }
        etiquetaConfirmar={recalculando ? t("gps.vr.planilla.guardando") : t("gps.vr.planilla.recalcular")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={recalcular}
        onCancelar={() => setARecalcular(null)}
      />
      <HojaConfirmar
        abierta={Boolean(aBorrar)}
        titulo={t("gps.vr.borrarTitulo")}
        descripcion={t("gps.vr.borrarTexto", { nombre: nombreDe(aBorrar), dispositivo: nombreDelDispositivo })}
        etiquetaConfirmar={t("referencias.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={borrar}
        onCancelar={() => setABorrar(null)}
      />
      <HojasDeOcultar ocultar={ocultar} />
    </div>
  );
}
