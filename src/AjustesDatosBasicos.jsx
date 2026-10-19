import React, { useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaInferior } from "./components/SheetPanel.js";
import { VinculosCatapult } from "./components/VinculosCatapult.jsx";
import { COLUMNAS_DE_DATOS_BASICOS, campoPorClave, codigoNuevo, etiquetaDeCampo, opcionesDeCampo } from "./domain/lesionesCampos.js";
import { guardarCampo, guardarColumnaDatos, guardarOpcion } from "./domain/lesionesDb.js";
import { t, useIdioma } from "./idioma/index.js";

// Datos básicos › Ajustes (nota del 14/10; Santiago, 17/10: Listas,
// Cabeceras y Catapult). Las columnas del jugador que comparte con Lesiones
// se llaman igual en los dos lados y sus listas son las mismas; esconder una
// acá la saca solo de la tabla de Datos básicos. Hasta que haya niveles de
// permiso por módulo, lo cambia cualquiera que sigue en el club.
//
// columnas: [{ clave, titulo, porDefecto, compartida, fija, oculta, etiquetas }]
// (las de la tabla de Datos básicos, con su nombre de hoy y el original).

const LISTAS = COLUMNAS_DE_DATOS_BASICOS.filter((clave) => campoPorClave(clave)?.lista);

export default function AjustesDatosBasicos({ equipoId, config, columnas, soloLectura = false, conCatapult = false, onRecargar, onAviso }) {
  const { idioma, plural } = useIdioma();
  // inicio | cabeceras | listas | lista:<clave> | catapult
  const [vista, setVista] = useState("inicio");
  const [hojaCabecera, setHojaCabecera] = useState(null);
  const [hojaOpcion, setHojaOpcion] = useState(null);
  const [errorHoja, setErrorHoja] = useState("");
  const [ocupado, setOcupado] = useState(false);

  // Lo mismo que las filas de Ajustes de Lesiones: un botón por cosa, con su
  // pantalla adentro y "Volver a Ajustes".
  const filaAjuste = ({ id, icono, titulo, detalle, alTocar, extra = null, deshabilitada = soloLectura }) => (
    <button key={id} type="button" className="opcion-ajuste" onClick={alTocar} disabled={deshabilitada}>
      {icono && (
        <span className="icono-ajuste">
          <Icono nombre={icono} size={18} />
        </span>
      )}
      <span className="texto-ajuste">
        <b>{titulo}</b>
        <span>{detalle}</span>
      </span>
      {extra}
      <span className="flecha-ajuste">›</span>
    </button>
  );

  // Los botones de abajo van fuera de la tarjeta, como en Lesiones (en el
  // celular quedan fijos arriba de la navegación).
  const seccion = (titulo, texto, contenido, volver) => (
    <>
      <section className="tarjeta tarjeta-ficha datos-ajustes">
        <div className="cabeza-ficha">
          <b>{titulo}</b>
        </div>
        <p className="pista-equipo">{texto}</p>
        {contenido}
      </section>
      {volver && <div className="acciones-dobles">{volver}</div>}
    </>
  );

  const cerrarHojas = () => {
    if (ocupado) return;
    setHojaCabecera(null);
    setHojaOpcion(null);
    setErrorHoja("");
  };

  // El nombre de una columna y si se esconde en esta tabla. El de una
  // compartida va a la configuración de Lesiones (se llama igual en los dos
  // lados); el de una propia, a la de Datos básicos (vacío: el de la app).
  const guardarHojaCabecera = async () => {
    const hoja = hojaCabecera;
    const columna = columnas.find((una) => una.clave === hoja?.clave);
    if (!hoja || !columna) return;
    const nombre = String(hoja.etiquetas[idioma] || "").trim();
    if (!nombre) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    setOcupado(true);
    let respuesta = { error: "" };
    if (columna.compartida) {
      if (nombre !== columna.titulo) {
        const guardada = config?.campos?.[hoja.clave];
        respuesta = await guardarCampo(equipoId, hoja.clave, { etiquetas: hoja.etiquetas, oculto: Boolean(guardada?.oculto), orden: guardada?.orden ?? 0 });
      }
      if (!respuesta.error && !columna.fija && hoja.oculto !== columna.oculta) {
        respuesta = await guardarColumnaDatos(equipoId, hoja.clave, { etiquetas: {}, oculto: hoja.oculto });
      }
    } else {
      // El nombre de la app no se guarda: así sigue el idioma de cada uno.
      const etiquetas = { ...hoja.etiquetas, [idioma]: nombre === columna.porDefecto ? "" : nombre };
      respuesta = await guardarColumnaDatos(equipoId, hoja.clave, { etiquetas, oculto: columna.fija ? false : hoja.oculto });
    }
    if (!respuesta.error) await onRecargar?.();
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    setHojaCabecera(null);
    onAviso?.(t("lesiones.ajustes.guardado"));
  };

  const guardarHojaOpcion = async () => {
    const hoja = hojaOpcion;
    if (!hoja) return;
    const propio = String(hoja.etiquetas[idioma] || "").trim();
    if (!propio) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    setOcupado(true);
    const respuesta = await guardarOpcion(equipoId, hoja.campo, { ...hoja, codigo: hoja.codigo || codigoNuevo(propio) });
    if (!respuesta.error) await onRecargar?.();
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    setHojaOpcion(null);
    onAviso?.(t("lesiones.ajustes.guardado"));
  };

  const abrirCabecera = (columna) => {
    setErrorHoja("");
    const guardada = config?.campos?.[columna.clave]?.etiquetas;
    setHojaCabecera({
      clave: columna.clave,
      etiquetas: columna.compartida
        ? { ...(guardada || campoPorClave(columna.clave)?.etiquetas || {}), [idioma]: columna.titulo }
        : { "es-AR": "", "pt-BR": "", ...(columna.etiquetas || {}), [idioma]: columna.titulo },
      oculto: columna.oculta,
    });
  };

  const abrirOpcion = (clave, opcion, cuantas) => {
    setErrorHoja("");
    const guardada = (config?.listas?.[clave] || []).find((una) => una.codigo === opcion?.valor);
    setHojaOpcion({
      campo: clave,
      codigo: opcion?.valor || null,
      etiquetas: { "es-AR": "", "pt-BR": "", ...(guardada?.etiquetas || {}), ...(opcion && !guardada ? { [idioma]: opcion.etiqueta } : {}) },
      oculto: Boolean(guardada?.oculto),
      orden: guardada?.orden ?? cuantas,
    });
  };

  const volverAAjustes = <BotonVolver onClick={() => setVista("inicio")}>{t("lesiones.ajustes.volver")}</BotonVolver>;
  let contenido;

  if (vista === "catapult" && conCatapult) {
    contenido = (
      <>
        <VinculosCatapult equipoId={equipoId} soloLectura={soloLectura} onAviso={onAviso} />
        <div className="acciones-dobles">{volverAAjustes}</div>
      </>
    );
  } else if (vista === "cabeceras") {
    contenido = seccion(
      t("lesiones.ajustes.cabeceras"),
      t("datos.ajustes.cabecerasAyuda"),
      <div className="lista-opciones">
        {columnas.map((columna) =>
          filaAjuste({
            id: columna.clave,
            titulo: columna.titulo,
            detalle: [t("lesiones.ajustes.porDefecto", { texto: columna.porDefecto }), columna.compartida ? t("datos.ajustes.tambienEnLesiones") : ""].filter(Boolean).join(" · "),
            extra: columna.oculta ? <span className="lesiones-oculta">{t("lesiones.ajustes.oculto")}</span> : null,
            alTocar: () => abrirCabecera(columna),
          }),
        )}
      </div>,
      volverAAjustes,
    );
  } else if (vista.startsWith("lista:")) {
    const clave = vista.slice("lista:".length);
    const todas = opcionesDeCampo(clave, config, idioma, { conOcultas: true });
    contenido = seccion(
      etiquetaDeCampo(clave, config, idioma),
      plural("lesiones.ajustes.opciones", todas.length),
      <div className="lista-opciones">
        {todas.map((opcion) =>
          filaAjuste({
            id: opcion.valor,
            titulo: opcion.etiqueta,
            detalle: opcion.oculto ? t("lesiones.ajustes.oculto") : t("lesiones.ajustes.mostrar"),
            extra: opcion.oculto ? <span className="lesiones-oculta">{t("lesiones.ajustes.oculto")}</span> : null,
            alTocar: () => abrirOpcion(clave, opcion, todas.length),
          }),
        )}
      </div>,
      <>
        <BotonVolver onClick={() => setVista("listas")}>{t("lesiones.ajustes.volverListas")}</BotonVolver>
        <button type="button" className="boton-principal" onClick={() => abrirOpcion(clave, null, todas.length)} disabled={soloLectura}>
          {t("lesiones.ajustes.nuevaOpcion")}
        </button>
      </>,
    );
  } else if (vista === "listas") {
    contenido = seccion(
      t("lesiones.ajustes.listas"),
      t("datos.ajustes.listasAyuda"),
      <div className="lista-opciones">
        {LISTAS.map((clave) =>
          filaAjuste({
            id: clave,
            titulo: etiquetaDeCampo(clave, config, idioma),
            detalle: plural("lesiones.ajustes.opciones", opcionesDeCampo(clave, config, idioma).length),
            alTocar: () => setVista(`lista:${clave}`),
          }),
        )}
      </div>,
      volverAAjustes,
    );
  } else {
    contenido = seccion(
      t("lesiones.ajustes.titulo"),
      t("datos.ajustes.texto"),
      <div className="lista-opciones">
        {filaAjuste({ id: "cabeceras", icono: "documento", titulo: t("lesiones.ajustes.cabeceras"), detalle: t("datos.ajustes.cabecerasTexto"), alTocar: () => setVista("cabeceras") })}
        {filaAjuste({ id: "listas", icono: "filtro", titulo: t("lesiones.ajustes.listas"), detalle: t("datos.ajustes.listasTexto"), alTocar: () => setVista("listas") })}
        {/* Los dispositivos se buscan con la cuenta de Flujo diario: solo
            para quien tiene ese módulo. Se miran también en solo lectura. */}
        {conCatapult && filaAjuste({ id: "catapult", icono: "llave", titulo: "Catapult", detalle: t("datos.ajustes.catapultTexto"), alTocar: () => setVista("catapult"), deshabilitada: false })}
      </div>,
    );
  }

  const columnaDeLaHoja = hojaCabecera ? columnas.find((una) => una.clave === hojaCabecera.clave) : null;
  const hoja = hojaCabecera || hojaOpcion;
  const setHoja = hojaCabecera ? setHojaCabecera : setHojaOpcion;

  return (
    <>
      {contenido}
      {hoja && (
        <HojaInferior
          abierta
          className="lesiones-hoja"
          titulo={
            hojaCabecera
              ? `${t("lesiones.ajustes.editarCabecera")}: ${columnaDeLaHoja?.titulo || ""}`
              : hojaOpcion.codigo
                ? `${t("lesiones.ajustes.editarOpcion")}: ${etiquetaDeCampo(hojaOpcion.campo, config, idioma)}`
                : t("lesiones.ajustes.nuevaOpcion")
          }
          onCerrar={cerrarHojas}
          acciones={
            <>
              <button type="button" className="boton-cancelar-hoja" onClick={cerrarHojas} disabled={ocupado}>
                {t("comun.cancelar")}
              </button>
              <button type="button" className="boton-confirmar-hoja" onClick={hojaCabecera ? guardarHojaCabecera : guardarHojaOpcion} disabled={ocupado}>
                {ocupado ? t("comun.guardando") : t("comun.guardar")}
              </button>
            </>
          }
        >
          {errorHoja && <div className="aviso-hoja">{errorHoja}</div>}
          <div className="campo-inicio">
            <label htmlFor="datos-ajuste-nombre">{t("lesiones.ajustes.nombre")}</label>
            <input
              id="datos-ajuste-nombre"
              type="text"
              maxLength={120}
              value={hoja.etiquetas[idioma] || ""}
              onChange={(evento) => setHoja({ ...hoja, etiquetas: { ...hoja.etiquetas, [idioma]: evento.target.value } })}
            />
            <small className="lesiones-ayuda">{t("lesiones.ajustes.nombreAyuda")}</small>
          </div>
          {columnaDeLaHoja?.compartida && <p className="lesiones-ayuda">{t("datos.ajustes.compartida")}</p>}
          {columnaDeLaHoja?.fija ? (
            <p className="lesiones-ayuda lesiones-nota-fija">{t("datos.ajustes.noSeOculta")}</p>
          ) : (
            <div className="grilla-criterios">
              <button type="button" className={`chip-criterio ${!hoja.oculto ? "prendido" : ""}`} aria-pressed={!hoja.oculto} onClick={() => setHoja({ ...hoja, oculto: false })}>
                {t("lesiones.ajustes.mostrar")}
              </button>
              <button type="button" className={`chip-criterio ${hoja.oculto ? "prendido" : ""}`} aria-pressed={hoja.oculto} onClick={() => setHoja({ ...hoja, oculto: true })}>
                {t("lesiones.ajustes.oculto")}
              </button>
            </div>
          )}
        </HojaInferior>
      )}
    </>
  );
}
