import React, { useEffect, useRef, useState } from "react";
import { FiguraCuerpo } from "./FiguraCuerpo.jsx";
import { AREAS_POR_TERCIO, especificoQueNoEsDe, especificosDe, estructurasDe, regionDe, regionPorClave, tercioDeArea } from "../domain/mapaCorporal.js";
import { t } from "../idioma/index.js";

// La carga de una lesión con el cuerpo, de lo grande a lo chico:
// ElegirZona (región de la figura → parte del cuerpo, con su lado) y
// ElegirEstructura (en esa parte: grupo muscular → músculo → área, o el
// ligamento). Siempre con las opciones del catálogo que el club tiene a la
// vista; lo que el mapa no conoce queda a mano con "Otro…".

// Las partes que de frente no se ven (o al revés): al elegirlas desde la
// lista, la figura se da vuelta para mostrarlas.
const SOLO_DE_ESPALDAS = ["coluna_lombar"];
const SOLO_DE_FRENTE = ["abdomen"];

export const vistaPara = (parte) => (SOLO_DE_ESPALDAS.includes(parte) ? "espalda" : "frente");

const etiquetasDeLaFigura = () => ({
  figura: t("lesiones.cuerpo.figura"),
  derecha: t("lesiones.cuerpo.derecha"),
  izquierda: t("lesiones.cuerpo.izquierda"),
});

// Unos botones como los de las listas cortas del formulario.
const Chips = ({ opciones, elegida, onElegir, extra = null }) => (
  <div className="grilla-criterios lesiones-chips mapa-cuerpo-chips">
    {opciones.map((opcion) => (
      <button
        type="button"
        key={opcion.valor}
        className={`chip-criterio ${elegida === opcion.valor ? "prendido" : ""}`}
        aria-pressed={elegida === opcion.valor}
        onClick={() => onElegir(elegida === opcion.valor ? null : opcion.valor)}
      >
        {opcion.etiqueta}
      </button>
    ))}
    {extra}
  </div>
);

// --------------------------------------------------------------- Zona --

// parte, lado: lo cargado. partes: los códigos de parte del cuerpo que el
// club tiene a la vista. lados: [{ valor, etiqueta }]. onCambiar recibe lo
// que cambia ({ parte_cuerpo, lado }). vista y onVista (si se pasan) dejan
// la figura de frente o de espaldas en manos de quien la usa, para que el
// paso siguiente sepa desde dónde se eligió.
export const ElegirZona = ({ parte, lado, partes, lados, textoDeOpcion, onCambiar, vista: vistaDeAfuera, onVista }) => {
  const [vistaPropia, setVistaPropia] = useState(() => vistaPara(parte));
  const vista = vistaDeAfuera || vistaPropia;
  const setVista = (cual) => (onVista ? onVista(cual) : setVistaPropia(cual));
  const [region, setRegion] = useState(() => (parte ? regionDe(parte, lado) : null));
  const actual = region ? regionPorClave(region) : null;
  const regionElegida = parte ? regionDe(parte, lado) : null;
  const nombreDeRegion = (clave) => t(`lesiones.cuerpo.regiones.${clave}`);
  const nombreDeParte = (codigo) => textoDeOpcion("parte_cuerpo", codigo);
  // El lado se elige a mano en las partes del medio, y también cuando la
  // figura no puede decirlo (una parte que agregó el club, o un lado que no
  // es derecho ni izquierdo).
  const ladoAMano = Boolean(parte) && (!regionElegida || !regionPorClave(regionElegida)?.lado);
  // Elegida una zona, el foco va a sus partes (el botón tocado desaparece).
  const lista = useRef(null);
  const enfocarLista = useRef(false);
  const acercar = (clave) => {
    enfocarLista.current = true;
    setRegion(clave);
  };
  useEffect(() => {
    if (!enfocarLista.current) return;
    enfocarLista.current = false;
    lista.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [region]);

  const elegirParte = (codigo, enRegion) => {
    const nueva = regionPorClave(enRegion);
    const anterior = parte ? regionPorClave(regionDe(parte, lado)) : null;
    const cambios = { parte_cuerpo: codigo };
    // Brazo o pierna: el lado sale de la figura. Del medio, se elige abajo
    // (y si venía de un brazo o una pierna, ese lado ya no vale).
    if (nueva?.lado) cambios.lado = nueva.lado;
    else if (anterior?.lado) cambios.lado = null;
    onCambiar(cambios);
    setRegion(enRegion);
    if (SOLO_DE_ESPALDAS.includes(codigo)) setVista("espalda");
    if (SOLO_DE_FRENTE.includes(codigo)) setVista("frente");
  };

  // Lo que tiene cada parte, para ayudar a elegir: los grupos musculares (o
  // los músculos, o los ligamentos) del catálogo.
  const pista = (codigo) => {
    const { musculos, especificos, ligamentos } = estructurasDe(codigo);
    const textos = [
      ...musculos.map((grupo) => textoDeOpcion("musculo", grupo)),
      ...(musculos.length ? [] : especificos.map((uno) => textoDeOpcion("musculo_especifico", uno))),
      ...ligamentos.map((uno) => textoDeOpcion("ligamento", uno)),
    ];
    return textos.length > 3 ? `${textos.slice(0, 3).join(", ")}…` : textos.join(", ");
  };

  return (
    <div className="mapa-cuerpo">
      <div className="mapa-cuerpo-cabeza">
        <nav className="mapa-cuerpo-camino" aria-label={t("lesiones.cuerpo.donde")}>
          <button type="button" onClick={() => setRegion(null)} disabled={!region}>
            {t("lesiones.cuerpo.cuerpo")}
          </button>
          {actual && (
            <>
              <span aria-hidden="true">›</span>
              <b>{nombreDeRegion(actual.clave)}</b>
            </>
          )}
          {parte && regionElegida === region && (
            <>
              <span aria-hidden="true">›</span>
              <b>{nombreDeParte(parte)}</b>
            </>
          )}
        </nav>
        <div className="grilla-criterios mapa-cuerpo-vista" role="group" aria-label={t("lesiones.cuerpo.vista")}>
          {["frente", "espalda"].map((cual) => (
            <button type="button" key={cual} className={`chip-criterio ${vista === cual ? "prendido" : ""}`} aria-pressed={vista === cual} onClick={() => setVista(cual)}>
              {t(`lesiones.cuerpo.${cual}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={`mapa-cuerpo-cuerpo ${actual ? "con-region" : ""}`.trim()}>
        <div className="mapa-cuerpo-panel">
          <FiguraCuerpo
            vista={vista}
            region={region}
            elegida={parte ? { parte, region: regionElegida } : null}
            disponibles={partes}
            nombreDeRegion={nombreDeRegion}
            nombreDeParte={nombreDeParte}
            onRegion={acercar}
            onParte={elegirParte}
            etiquetas={etiquetasDeLaFigura()}
          />
          {!actual && <p className="mapa-cuerpo-ayuda">{t("lesiones.cuerpo.tocaZona")}</p>}
        </div>
        {actual && (
          <ul className="mapa-cuerpo-partes" aria-label={nombreDeRegion(actual.clave)} ref={lista}>
            {actual.partes
              .filter((codigo) => partes.includes(codigo))
              .map((codigo) => {
                const elegida = parte === codigo && regionElegida === actual.clave;
                return (
                  <li key={codigo}>
                    <button type="button" className={elegida ? "elegida" : ""} aria-pressed={elegida} onClick={() => elegirParte(codigo, actual.clave)}>
                      <b>{nombreDeParte(codigo)}</b>
                      {pista(codigo) && <span>{pista(codigo)}</span>}
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      {parte && (
        <div className="mapa-cuerpo-elegido">
          {ladoAMano ? (
            <>
              <p className="rotulo-criterio">{t("lesiones.cuerpo.queLado", { parte: nombreDeParte(parte) })}</p>
              <Chips opciones={lados} elegida={lado} onElegir={(valor) => onCambiar({ lado: valor })} />
            </>
          ) : (
            <p>
              {t("lesiones.cuerpo.elegido", { parte: nombreDeParte(parte), lado: lado ? textoDeOpcion("lado", lado) : "—" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------- Estructura --

export const CAMPOS_DE_ESTRUCTURA = ["musculo", "musculo_especifico", "ligamento", "area"];

// En la parte ya elegida: grupo muscular, músculo específico, ligamento y
// área, con los botones de lo que esa parte tiene en el catálogo. valores:
// lo cargado; opciones(campo): las del club a la vista; visible(campo): si
// la columna se muestra; onCambiar(cambios); onOtro(campo): elegir de la
// lista entera.
export const ElegirEstructura = ({ parte, lado, vista = null, valores, opciones, visible, etiqueta, textoDeOpcion, onCambiar, onOtro }) => {
  const [tercio, setTercio] = useState(() => tercioDeArea(valores.area));
  const delClub = (campo, codigos) => {
    const aLaVista = opciones(campo);
    return codigos.map((codigo) => aLaVista.find((opcion) => opcion.valor === codigo)).filter(Boolean);
  };
  // De espaldas, lo de atrás primero (si la zona se eligió de espaldas). Una
  // parte que solo se ve de un lado se muestra siempre de ese lado.
  const deUnSoloLado = SOLO_DE_ESPALDAS.includes(parte) || SOLO_DE_FRENTE.includes(parte);
  const vistaDeLaParte = deUnSoloLado ? vistaPara(parte) : vista || vistaPara(parte);
  const mapa = estructurasDe(parte, { vista: vistaDeLaParte });
  // El grupo cargado filtra los músculos solo si su columna se ve.
  const grupo = visible("musculo") ? valores.musculo : null;
  const listas = {
    musculo: delClub("musculo", mapa.musculos),
    musculo_especifico: delClub("musculo_especifico", especificosDe(parte, grupo)),
    ligamento: delClub("ligamento", mapa.ligamentos),
    area: tercio ? delClub("area", AREAS_POR_TERCIO[tercio] || []) : [],
  };

  // Un músculo específico que en esta parte es de un solo grupo completa el
  // grupo si estaba vacío (como se carga en el Excel), si esa columna y ese
  // grupo están a la vista en el club.
  const elegirEspecifico = (codigo) => {
    const cambios = { musculo_especifico: codigo };
    if (codigo && !valores.musculo && visible("musculo")) {
      const grupos = listas.musculo.filter((opcion) => especificosDe(parte, opcion.valor).includes(codigo));
      if (grupos.length === 1) cambios.musculo = grupos[0].valor;
    }
    onCambiar(cambios);
  };

  // Otro grupo: el músculo específico de otro grupo de esta parte ya no vale.
  const elegirGrupo = (valor) => {
    const cambios = { musculo: valor };
    if (especificoQueNoEsDe(parte, valor, valores.musculo_especifico)) cambios.musculo_especifico = null;
    onCambiar(cambios);
  };

  const otro = (campo) => (
    <button type="button" className="chip-criterio mapa-cuerpo-otro" onClick={() => onOtro(campo)}>
      {t("lesiones.cuerpo.otro")}
    </button>
  );
  // Lo cargado que no está entre los botones (de otra parte, o una opción
  // que el club agregó) se ve igual, prendido, para poder sacarlo.
  const cargadoAfuera = (campo, lista) => {
    const valor = valores[campo];
    if (!valor || lista.some((opcion) => opcion.valor === valor)) return null;
    return (
      <button type="button" className="chip-criterio prendido" aria-pressed="true" onClick={() => onCambiar({ [campo]: null })}>
        {textoDeOpcion(campo, valor)}
      </button>
    );
  };

  const seccion = (campo, lista, alElegir) =>
    visible(campo) ? (
      <div className="campo-inicio lesiones-campo-paso mapa-cuerpo-seccion" key={campo}>
        <label>
          {etiqueta(campo)} <em className="lesiones-opcional">{t("lesiones.pasos.opcional")}</em>
        </label>
        <Chips
          opciones={lista}
          elegida={valores[campo]}
          onElegir={alElegir}
          extra={
            <>
              {cargadoAfuera(campo, lista)}
              {otro(campo)}
            </>
          }
        />
      </div>
    ) : null;

  const nombreDeParte = textoDeOpcion("parte_cuerpo", parte);
  const conLado = lado && lado !== "nao_se_aplica" ? `${nombreDeParte} · ${textoDeOpcion("lado", lado)}` : nombreDeParte;
  const nada = !mapa.musculos.length && !mapa.especificos.length && !mapa.ligamentos.length;

  return (
    <div className="mapa-cuerpo mapa-cuerpo-estructura">
      <div className="mapa-cuerpo-ubicacion">
        <div className="mapa-cuerpo-panel">
          <FiguraCuerpo chica vista={vistaDeLaParte} elegida={{ parte, region: regionDe(parte, lado) }} etiquetas={{ figura: conLado }} />
        </div>
        <div>
          <p className="rotulo-criterio">{t("lesiones.cuerpo.ubicacion")}</p>
          <b>{conLado}</b>
          <p className="mapa-cuerpo-ayuda">{nada ? t("lesiones.cuerpo.sinEstructuras") : t("lesiones.cuerpo.estructuraTexto")}</p>
        </div>
      </div>

      {seccion("musculo", listas.musculo, elegirGrupo)}
      {seccion("musculo_especifico", listas.musculo_especifico, elegirEspecifico)}
      {seccion("ligamento", listas.ligamento, (valor) => onCambiar({ ligamento: valor }))}

      {visible("area") && (
        <div className="campo-inicio lesiones-campo-paso mapa-cuerpo-seccion">
          <label>
            {etiqueta("area")} <em className="lesiones-opcional">{t("lesiones.pasos.opcional")}</em>
          </label>
          {/* Primero el tercio del músculo, después la unión. */}
          <div className="grilla-criterios lesiones-chips mapa-cuerpo-chips mapa-cuerpo-tercios" role="group" aria-label={t("lesiones.cuerpo.tercio")}>
            {Object.keys(AREAS_POR_TERCIO).map((cual) => (
              <button type="button" key={cual} className={`chip-criterio ${tercio === cual ? "prendido" : ""}`} aria-pressed={tercio === cual} onClick={() => setTercio(tercio === cual ? null : cual)}>
                {t(`lesiones.cuerpo.tercios.${cual}`)}
              </button>
            ))}
          </div>
          {(tercio || valores.area) && (
            <Chips
              opciones={listas.area}
              elegida={valores.area}
              onElegir={(valor) => onCambiar({ area: valor })}
              extra={
                <>
                  {cargadoAfuera("area", listas.area)}
                  {otro("area")}
                </>
              }
            />
          )}
        </div>
      )}
    </div>
  );
};
