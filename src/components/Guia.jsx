import React, { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { HojaInferior } from "./SheetPanel.js";
import { Icono } from "./AppChrome";
import { t } from "../idioma/index.js";
import "../guia.css";

// Los textos que guían (Santiago, 14/10; docs/DESIGN_SYSTEM.md, «Textos que
// guían»): para quien usa la app por primera vez, qué se hace en cada
// pantalla, qué es cada palabra propia y una guía de cada módulo.

// Un texto con pasos: cada renglón que empieza con «1.», «2.»… es un paso y
// va en una lista numerada; los demás renglones, como párrafos.
export const TextoConPasos = ({ texto, className = "" }) => {
  const bloques = [];
  String(texto || "")
    .split("\n")
    .map((renglon) => renglon.trim())
    .filter(Boolean)
    .forEach((renglon) => {
      const paso = /^\d+\.\s+(.*)$/.exec(renglon);
      const ultimo = bloques[bloques.length - 1];
      if (!paso) bloques.push({ pasos: null, texto: renglon });
      else if (ultimo?.pasos) ultimo.pasos.push(paso[1]);
      else bloques.push({ pasos: [paso[1]] });
    });
  return (
    <div className={`texto-guia ${className}`.trim()}>
      {bloques.map((bloque, indice) =>
        bloque.pasos ? (
          <ol key={indice}>
            {bloque.pasos.map((paso, numero) => (
              <li key={numero}>{paso}</li>
            ))}
          </ol>
        ) : (
          <p key={indice}>{bloque.texto}</p>
        ),
      )}
    </div>
  );
};

// El «?» al lado de una palabra propia (Team Average, Va…): abre qué es. La
// hoja va al final de la página, así el «?» puede ir dentro de un título.
export const Termino = ({ titulo, texto }) => {
  const [abierta, setAbierta] = useState(false);
  const cerrar = useCallback(() => setAbierta(false), []);
  return (
    <>
      <button
        type="button"
        className="termino-ayuda"
        aria-label={t("guia.queEs", { termino: titulo })}
        title={t("guia.queEs", { termino: titulo })}
        onClick={(evento) => {
          evento.preventDefault();
          setAbierta(true);
        }}
      >
        ?
      </button>
      {abierta &&
        createPortal(
          <HojaInferior
            abierta
            className="hoja-guia"
            titulo={titulo}
            onCerrar={cerrar}
            acciones={
              <button type="button" className="boton-confirmar-hoja" onClick={cerrar}>
                {t("guia.entendido")}
              </button>
            }
          >
            <TextoConPasos texto={texto} />
          </HojaInferior>,
          document.body,
        )}
    </>
  );
};

// El «?» de una palabra con sus textos en el diccionario: `${clave}.titulo` y
// `${clave}.texto`.
export const TerminoDe = ({ clave }) => <Termino titulo={t(`${clave}.titulo`)} texto={t(`${clave}.texto`)} />;

// La guía de un módulo: si ya se ofreció en este aparato y si está abierta.
// La primera vez que se entra al módulo se ofrece una sola vez, se vea o no.
const claveDeVista = (modulo) => `guia_vista:${modulo}`;
const yaSeOfrecio = (modulo) => {
  try {
    return Boolean(localStorage.getItem(claveDeVista(modulo)));
  } catch {
    // Sin dónde anotarlo, no se ofrece: mejor eso que ofrecerla cada vez.
    return true;
  }
};
export const useGuiaDelModulo = (modulo) => {
  const [abierta, setAbierta] = useState(false);
  const [ofrecer, setOfrecer] = useState(() => !yaSeOfrecio(modulo));
  const anotar = useCallback(() => {
    try {
      localStorage.setItem(claveDeVista(modulo), "1");
    } catch {
      // Sin dónde anotarlo, igual deja de ofrecerse mientras esté abierta.
    }
    setOfrecer(false);
  }, [modulo]);
  return {
    abierta,
    ofrecer,
    abrir: useCallback(() => setAbierta(true), []),
    cerrar: useCallback(() => setAbierta(false), []),
    ver: useCallback(() => {
      anotar();
      setAbierta(true);
    }, [anotar]),
    ahoraNo: anotar,
  };
};

// El «?» de arriba, al lado del idioma: abre la guía del módulo.
export const BotonGuia = ({ onClick }) => (
  <button type="button" className="boton-guia" aria-label={t("guia.boton")} title={t("guia.boton")} onClick={onClick}>
    <Icono nombre="ayuda" size={21} />
  </button>
);

// guia: { titulo, intro, secciones: [{ titulo, texto }], terminos: [{ titulo, texto }] }.
export const GuiaDelModulo = ({ guia, abierta, onCerrar }) => (
  <HojaInferior
    abierta={abierta}
    className="hoja-guia"
    titulo={guia.titulo}
    descripcion={guia.intro}
    onCerrar={onCerrar}
    acciones={
      <button type="button" className="boton-confirmar-hoja" onClick={onCerrar}>
        {t("guia.entendido")}
      </button>
    }
  >
    {guia.secciones.map((seccion) => (
      <section key={seccion.titulo} className="guia-seccion">
        <h4>{seccion.titulo}</h4>
        <TextoConPasos texto={seccion.texto} />
      </section>
    ))}
    {guia.terminos?.length > 0 && (
      <section className="guia-seccion">
        <h4>{t("guia.palabras")}</h4>
        <dl className="guia-terminos">
          {guia.terminos.map((termino) => (
            <div key={termino.titulo}>
              <dt>{termino.titulo}</dt>
              <dd>{termino.texto}</dd>
            </div>
          ))}
        </dl>
      </section>
    )}
  </HojaInferior>
);

// La primera vez en el módulo: ver la guía o seguir.
export const OfrecerGuia = ({ abierta, modulo, onVer, onAhoraNo }) => (
  <HojaInferior
    abierta={abierta}
    className="hoja-guia"
    titulo={t("guia.primeraVez", { modulo })}
    descripcion={t("guia.primeraVezTexto")}
    onCerrar={onAhoraNo}
    acciones={
      <>
        <button type="button" className="boton-cancelar-hoja" onClick={onAhoraNo}>
          {t("guia.ahoraNo")}
        </button>
        <button type="button" className="boton-confirmar-hoja" onClick={onVer}>
          {t("guia.ver")}
        </button>
      </>
    }
  />
);
