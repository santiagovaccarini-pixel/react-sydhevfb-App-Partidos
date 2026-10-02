import React, { useEffect, useRef, useState } from "react";
import { FiguraCuerpo } from "./FiguraCuerpo.jsx";
import { DE_ESPALDAS_PRIMERO, PARTES, REGIONES, TERCIOS, regionPorClave } from "../domain/mapaCorporal.js";
import { t } from "../idioma/index.js";

// La carga de una lesión con el cuerpo, de lo grande a lo chico:
// ElegirZona (región de la figura → parte del cuerpo, con su lado) y
// ElegirEstructura (en esa parte: grupo muscular → músculo → área, o el
// ligamento). Siempre y solo con las opciones de las listas del club que
// están a la vista; `mapa` (crearMapa) dice dónde va cada una, también las
// que agregó el club.

// Las partes que de frente no se ven (o al revés): al elegirlas desde la
// lista, la figura se da vuelta para mostrarlas.
const SOLO_DE_ESPALDAS = ["coluna_lombar"];
const SOLO_DE_FRENTE = ["abdomen"];

export const vistaPara = (parte) => (SOLO_DE_ESPALDAS.includes(parte) ? "espalda" : "frente");

// Cómo mostrar una lesión ya cargada: de espaldas si la parte solo se ve de
// atrás o si el músculo es de los de atrás (isquiotibiales, glúteos…).
export const vistaDeLesion = (pieza, musculo) => (SOLO_DE_ESPALDAS.includes(pieza) || (DE_ESPALDAS_PRIMERO[pieza] || []).includes(musculo) ? "espalda" : "frente");

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
// club tiene a la vista. lados: [{ valor, etiqueta }]. mapa: el del club.
// onCambiar recibe lo que cambia ({ parte_cuerpo, lado }). vista y onVista
// (si se pasan) dejan la figura de frente o de espaldas en manos de quien la
// usa, para que el paso siguiente sepa desde dónde se eligió.
export const ElegirZona = ({ parte, lado, partes, lados, mapa, textoDeOpcion, onCambiar, vista: vistaDeAfuera, onVista }) => {
  const [vistaPropia, setVistaPropia] = useState(() => vistaPara(parte));
  const vista = vistaDeAfuera || vistaPropia;
  const setVista = (cual) => (onVista ? onVista(cual) : setVistaPropia(cual));
  const [region, setRegion] = useState(() => (parte ? mapa.regionDe(parte, lado) : null));
  const actual = region ? regionPorClave(region) : null;
  const regionElegida = parte ? mapa.regionDe(parte, lado) : null;
  const nombreDeRegion = (clave) => t(`lesiones.cuerpo.regiones.${clave}`);
  const nombreDeParte = (codigo) => textoDeOpcion("parte_cuerpo", codigo);
  // Lo que se ofrece en cada región: sus partes a la vista, también las que
  // agregó el club. Se toca una región si tiene alguna.
  const deLaRegion = (clave) => mapa.partesDeRegion(clave).filter((codigo) => partes.includes(codigo));
  const regionesConPartes = REGIONES.filter((una) => deLaRegion(una.clave).length).map((una) => una.clave);
  // El lado se elige a mano en las partes del medio, y también cuando la
  // figura no puede decirlo (una parte que no se sabe dónde va, o un lado
  // que no es derecho ni izquierdo).
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
    const anterior = parte ? regionPorClave(mapa.regionDe(parte, lado)) : null;
    const cambios = { parte_cuerpo: codigo };
    // Brazo o pierna: el lado sale de la figura. Del medio, se elige abajo
    // (y si venía de un brazo o una pierna, ese lado ya no vale).
    if (nueva?.lado) cambios.lado = nueva.lado;
    else if (anterior?.lado) cambios.lado = null;
    onCambiar(cambios);
    setRegion(enRegion);
    const pieza = mapa.piezaDe(codigo, enRegion);
    if (SOLO_DE_ESPALDAS.includes(pieza)) setVista("espalda");
    if (SOLO_DE_FRENTE.includes(pieza)) setVista("frente");
  };

  // Lo que tiene cada parte, para ayudar a elegir: los grupos musculares (o
  // los músculos, o los ligamentos) de las listas.
  const pista = (codigo) => {
    const { musculos, especificos, ligamentos } = mapa.estructurasDe(codigo);
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
            elegida={parte ? { parte: mapa.piezaDe(parte, regionElegida), region: regionElegida } : null}
            disponibles={PARTES.filter((codigo) => partes.includes(codigo))}
            regionesDisponibles={regionesConPartes}
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
            {deLaRegion(actual.clave).map((codigo) => {
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
// área, con los botones de lo que va en esa parte. valores: lo cargado;
// opciones(campo): las del club a la vista; visible(campo): si la columna
// se muestra; mapa: el del club; onCambiar(cambios).
export const ElegirEstructura = ({ parte, lado, vista = null, valores, opciones, visible, mapa, etiqueta, textoDeOpcion, onCambiar }) => {
  const region = mapa.regionDe(parte, lado);
  const pieza = mapa.piezaDe(parte, region) || parte;
  const delClub = (campo, codigos) => {
    const aLaVista = opciones(campo);
    return codigos.map((codigo) => aLaVista.find((opcion) => opcion.valor === codigo)).filter(Boolean);
  };
  // De espaldas, lo de atrás primero (si la zona se eligió de espaldas). Una
  // parte que solo se ve de un lado se muestra siempre de ese lado.
  const deUnSoloLado = SOLO_DE_ESPALDAS.includes(pieza) || SOLO_DE_FRENTE.includes(pieza);
  const vistaDeLaParte = deUnSoloLado ? vistaPara(pieza) : vista || vistaPara(pieza);
  const enLaParte = mapa.estructurasDe(parte, { vista: vistaDeLaParte });
  // El grupo cargado filtra los músculos solo si su columna se ve.
  const grupo = visible("musculo") ? valores.musculo : null;
  const listas = {
    musculo: delClub("musculo", enLaParte.musculos),
    musculo_especifico: delClub("musculo_especifico", mapa.especificosDe(parte, grupo)),
    ligamento: delClub("ligamento", enLaParte.ligamentos),
  };
  // El área es la de un músculo: se ofrece si en esta parte hay músculos (o
  // si ya hay algo cargado). Primero las del músculo entero y después las de
  // cada tercio, bajo su título.
  const conMusculos = Boolean(listas.musculo.length || listas.musculo_especifico.length || valores.musculo || valores.musculo_especifico || valores.area);
  const areas = opciones("area");
  const areasPorTercio = [null, ...TERCIOS]
    .map((tercio) => ({ tercio, lista: areas.filter((opcion) => (tercio ? mapa.tercioDeArea(opcion.valor) === tercio : !TERCIOS.includes(mapa.tercioDeArea(opcion.valor)))) }))
    .filter((conAreas) => conAreas.lista.length);

  // Un músculo específico que en esta parte es de un solo grupo completa el
  // grupo si estaba vacío (como se carga en el Excel), si esa columna y ese
  // grupo están a la vista en el club.
  const elegirEspecifico = (codigo) => {
    const cambios = { musculo_especifico: codigo };
    if (codigo && !valores.musculo && visible("musculo")) {
      const grupos = mapa.gruposDe(parte, codigo).filter((uno) => listas.musculo.some((opcion) => opcion.valor === uno));
      if (grupos.length === 1) cambios.musculo = grupos[0];
    }
    onCambiar(cambios);
  };

  // Otro grupo: el músculo específico de otro grupo de esta parte ya no vale.
  const elegirGrupo = (valor) => {
    const cambios = { musculo: valor };
    if (mapa.especificoQueNoEsDe(parte, valor, valores.musculo_especifico)) cambios.musculo_especifico = null;
    onCambiar(cambios);
  };

  // Lo cargado que no está entre los botones (de otra parte, o una opción
  // que se escondió) se ve igual, prendido, para poder sacarlo.
  const cargadoAfuera = (campo, lista) => {
    const valor = valores[campo];
    if (!valor || lista.some((opcion) => opcion.valor === valor)) return null;
    return (
      <button type="button" className="chip-criterio prendido" aria-pressed="true" onClick={() => onCambiar({ [campo]: null })}>
        {textoDeOpcion(campo, valor)}
      </button>
    );
  };

  const titulo = (campo) => (
    <label>
      {etiqueta(campo)} <em className="lesiones-opcional">{t("lesiones.pasos.opcional")}</em>
    </label>
  );
  // Una columna sin nada para esta parte (ni cargado) no se muestra.
  const seccion = (campo, lista, alElegir) =>
    visible(campo) && (lista.length || valores[campo]) ? (
      <div className="campo-inicio lesiones-campo-paso mapa-cuerpo-seccion" key={campo}>
        {titulo(campo)}
        <Chips opciones={lista} elegida={valores[campo]} onElegir={alElegir} extra={cargadoAfuera(campo, lista)} />
      </div>
    ) : null;
  const secciones = [
    seccion("musculo", listas.musculo, elegirGrupo),
    seccion("musculo_especifico", listas.musculo_especifico, elegirEspecifico),
    seccion("ligamento", listas.ligamento, (valor) => onCambiar({ ligamento: valor })),
  ].filter(Boolean);
  const conArea = visible("area") && conMusculos && Boolean(areasPorTercio.length || valores.area);
  const areaAfuera = cargadoAfuera("area", areas);

  const nombreDeParte = textoDeOpcion("parte_cuerpo", parte);
  const conLado = lado && lado !== "nao_se_aplica" ? `${nombreDeParte} · ${textoDeOpcion("lado", lado)}` : nombreDeParte;

  return (
    <div className="mapa-cuerpo mapa-cuerpo-estructura">
      <div className="mapa-cuerpo-ubicacion">
        <div className="mapa-cuerpo-panel">
          <FiguraCuerpo chica vista={vistaDeLaParte} elegida={{ parte: mapa.piezaDe(parte, region), region }} etiquetas={{ figura: conLado }} />
        </div>
        <div>
          <p className="rotulo-criterio">{t("lesiones.cuerpo.ubicacion")}</p>
          <b>{conLado}</b>
          <p className="mapa-cuerpo-ayuda">{secciones.length || conArea ? t("lesiones.cuerpo.estructuraTexto") : t("lesiones.cuerpo.sinEstructuras")}</p>
        </div>
      </div>

      {secciones}

      {conArea && (
        <div className="campo-inicio lesiones-campo-paso mapa-cuerpo-seccion">
          {titulo("area")}
          {areasPorTercio.map(({ tercio, lista }) => (
            <div className="mapa-cuerpo-tercio" key={tercio || "musculo"} role="group" aria-label={tercio ? t(`lesiones.cuerpo.tercios.${tercio}`) : etiqueta("area")}>
              {tercio && <p className="mapa-cuerpo-tercio-titulo">{t(`lesiones.cuerpo.tercios.${tercio}`)}</p>}
              <Chips opciones={lista} elegida={valores.area} onElegir={(valor) => onCambiar({ area: valor })} />
            </div>
          ))}
          {areaAfuera && <div className="grilla-criterios lesiones-chips mapa-cuerpo-chips">{areaAfuera}</div>}
        </div>
      )}
    </div>
  );
};
