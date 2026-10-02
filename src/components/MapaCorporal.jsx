import React, { useEffect, useRef, useState } from "react";
import { FiguraCuerpo } from "./FiguraCuerpo.jsx";
import { EsquemaAnatomico, VistaAnatomica } from "./FiguraAnatomica.jsx";
import { ESQUEMAS, cajaDeParte, esquemasDe, estructurasDe } from "./anatomiaCuerpo.js";
import { ORDEN_DE_REGIONES, espejadaEn } from "./siluetaCuerpo.js";
import { DE_ESPALDAS_PRIMERO, PARTES, REGIONES, TERCIOS, regionPorClave } from "../domain/mapaCorporal.js";
import { t } from "../idioma/index.js";

// La carga de una lesión con el cuerpo, de lo grande a lo chico:
// ElegirZona (región de la figura → parte del cuerpo, con su lado) y
// ElegirEstructura (en esa parte, de cerca: los músculos, tendones y
// ligamentos dibujados, y abajo sus botones: grupo muscular → músculo →
// área, o el ligamento). Siempre y solo con las opciones de las listas del
// club que están a la vista; `mapa` (crearMapa) dice dónde va cada una,
// también las que agregó el club.

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
// club tiene a la vista. lados: [{ valor, etiqueta }]. opciones(campo): las
// del club a la vista. mapa: el del club. onCambiar recibe lo que cambia
// ({ parte_cuerpo, lado }). vista y onVista (si se pasan) dejan la figura de
// frente o de espaldas en manos de quien la usa, para que el paso siguiente
// sepa desde dónde se eligió.
export const ElegirZona = ({ parte, lado, partes, lados, opciones, mapa, textoDeOpcion, onCambiar, vista: vistaDeAfuera, onVista }) => {
  const [vistaPropia, setVistaPropia] = useState(() => vistaPara(parte));
  const vista = vistaDeAfuera || vistaPropia;
  const setVista = (cual) => (onVista ? onVista(cual) : setVistaPropia(cual));
  const [region, setRegion] = useState(() => (parte ? mapa.regionDe(parte, lado) : null));
  const actual = region ? regionPorClave(region) : null;
  const nombreDeRegion = (clave) => t(`lesiones.cuerpo.regiones.${clave}`);
  const nombreDeParte = (codigo) => textoDeOpcion("parte_cuerpo", codigo);
  // Lo que se ofrece en cada región: sus partes a la vista, también las que
  // agregó el club. Se toca una región si tiene alguna.
  const deLaRegion = (clave) => mapa.partesDeRegion(clave).filter((codigo) => partes.includes(codigo));
  const regionesConPartes = REGIONES.filter((una) => deLaRegion(una.clave).length).map((una) => una.clave);
  // La región de lo elegido: la que se está mirando, si la parte está ahí y
  // es de ese lado (una parte del club puede estar en más de una: un dedo,
  // de la mano o del pie); si no, la que dice el mapa.
  const regionElegida = !parte
    ? null
    : actual && deLaRegion(actual.clave).includes(parte) && (!actual.lado || actual.lado === lado)
      ? actual.clave
      : mapa.regionDe(parte, lado);
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
    const anterior = regionElegida ? regionPorClave(regionElegida) : null;
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
  // los músculos, o los ligamentos) de las listas que están a la vista. Una
  // parte que no se sabe dónde va ofrece de todo: no hay nada que adelantar.
  const pista = (codigo) => {
    if (!mapa.partesDeOpcion("parte_cuerpo", codigo)) return "";
    const aLaVista = (campo, codigos) => {
      const vistas = opciones(campo).map((opcion) => opcion.valor);
      return codigos.filter((uno) => vistas.includes(uno));
    };
    const enLaParte = mapa.estructurasDe(codigo);
    const [musculos, especificos, ligamentos] = [aLaVista("musculo", enLaParte.musculos), aLaVista("musculo_especifico", enLaParte.especificos), aLaVista("ligamento", enLaParte.ligamentos)];
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

const LADOS_DE_UN_LADO = ["direito", "esquerdo"];

// En la parte ya elegida: grupo muscular, músculo específico, ligamento y
// área, con los botones de lo que va en esa parte. valores: lo cargado;
// opciones(campo): las del club a la vista; visible(campo): si la columna
// se muestra; mapa: el del club; onCambiar(cambios).
export const ElegirEstructura = ({ parte, lado, vista = null, valores, opciones, visible, mapa, etiqueta, textoDeOpcion, onCambiar }) => {
  const [capa, setCapa] = useState("superficie");
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
  // grupo están a la vista en el club. Si es de otro grupo (se tocó en la
  // figura), pasa a su grupo, o queda sin grupo si no se sabe cuál.
  const cambiosDeEspecifico = (codigo) => {
    const cambios = { musculo_especifico: codigo };
    if (codigo && visible("musculo")) {
      const suyos = mapa.gruposDe(parte, codigo);
      const aLaVista = suyos.filter((uno) => listas.musculo.some((opcion) => opcion.valor === uno));
      if (!valores.musculo) {
        if (aLaVista.length === 1) cambios.musculo = aLaVista[0];
      } else if (!suyos.includes(valores.musculo)) {
        cambios.musculo = aLaVista.length === 1 ? aLaVista[0] : null;
      }
    }
    return cambios;
  };
  const elegirEspecifico = (codigo) => onCambiar(cambiosDeEspecifico(codigo));

  // Otro grupo: el músculo específico de otro grupo de esta parte ya no vale.
  const cambiosDeGrupo = (valor) => {
    const cambios = { musculo: valor };
    if (mapa.especificoQueNoEsDe(parte, valor, valores.musculo_especifico)) cambios.musculo_especifico = null;
    return cambios;
  };
  const elegirGrupo = (valor) => onCambiar(cambiosDeGrupo(valor));

  // ------------------------------------------------- La figura de cerca --
  // Se toca lo que va en esta parte según las listas (de cualquier grupo:
  // tocar un músculo de otro grupo cambia el grupo). En un brazo o una
  // pierna, solo de su lado; en el tronco, de los dos (y tocar un lado elige
  // ese lado).
  const ladoDeLaParte = region ? regionPorClave(region)?.lado || null : null;
  const ofrecidas = new Set([
    ...(visible("musculo") ? listas.musculo : []).map((opcion) => `musculo:${opcion.valor}`),
    ...(visible("musculo_especifico") ? delClub("musculo_especifico", mapa.especificosDe(parte, null)) : []).map((opcion) => `musculo_especifico:${opcion.valor}`),
    ...(visible("ligamento") ? listas.ligamento : []).map((opcion) => `ligamento:${opcion.valor}`),
  ]);
  const ladoDe = (estructura, enRegion) => estructura.lado || regionPorClave(enRegion)?.lado || null;
  const sePuedeTocar = (estructura, enRegion) => {
    if (!ofrecidas.has(`${estructura.campo}:${estructura.codigo}`)) return false;
    const suLado = ladoDe(estructura, enRegion);
    return !ladoDeLaParte || !suLado || suLado === ladoDeLaParte;
  };
  // Pintada: la elegida (en el tronco, del lado cargado) y, más suave, los
  // músculos del grupo elegido.
  const estadoDe = (estructura, enRegion) => {
    if (!sePuedeTocar(estructura, enRegion)) return "apagada";
    const suLado = ladoDe(estructura, enRegion);
    const delLado = Boolean(ladoDeLaParte) || !suLado || !LADOS_DE_UN_LADO.includes(lado) || suLado === lado;
    if (!delLado) return "";
    if (valores[estructura.campo] === estructura.codigo) return "elegida";
    if (estructura.campo === "musculo_especifico" && grupo && mapa.especificosDe(parte, grupo).includes(estructura.codigo)) return "del-grupo";
    return "";
  };
  const tocarEnLaFigura = (estructura, enRegion) => {
    const valor = estadoDe(estructura, enRegion) === "elegida" ? null : estructura.codigo;
    const cambios =
      estructura.campo === "musculo" ? cambiosDeGrupo(valor) : estructura.campo === "musculo_especifico" ? cambiosDeEspecifico(valor) : { [estructura.campo]: valor };
    const suLado = ladoDe(estructura, enRegion);
    if (valor && !ladoDeLaParte && suLado && (!lado || LADOS_DE_UN_LADO.includes(lado)) && opciones("lado").some((opcion) => opcion.valor === suLado)) {
      cambios.lado = suLado;
    }
    onCambiar(cambios);
  };
  const nombreDe = (estructura) => textoDeOpcion(estructura.campo, estructura.codigo);

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

  // La figura de cerca: de frente y de espaldas (primero desde donde se
  // eligió la zona; una parte que se ve de un solo lado, de ese lado), los
  // esquemas de la articulación y, si hay músculos debajo de otros, la capa
  // profunda. Solo si hay algo para tocar.
  const esquemas = region ? esquemasDe(pieza) : [];
  const tocablesEn = (cual) =>
    (region ? ORDEN_DE_REGIONES.flatMap((clave) => estructurasDe(clave, cual).map((estructura) => ({ estructura, clave }))) : []).filter(({ estructura, clave }) => sePuedeTocar(estructura, clave));
  // Con esquemas (el pie), una vista sin nada para tocar no se muestra.
  const vistas = (deUnSoloLado ? [vistaDeLaParte] : vistaDeLaParte === "espalda" ? ["espalda", "frente"] : ["frente", "espalda"]).filter((cual) => !esquemas.length || tocablesEn(cual).length);
  const dibujadas = [
    ...vistas.flatMap(tocablesEn),
    ...esquemas.flatMap((cual) => ESQUEMAS[cual].piezas.filter((una) => una.codigo && sePuedeTocar(una, region)).map((estructura) => ({ estructura, clave: region }))),
  ];
  const conFigura = Boolean(region && (esquemas.length || cajaDeParte(pieza, region, vistas[0]))) && dibujadas.length > 0;
  const conProfundos = conFigura && dibujadas.some(({ estructura }) => estructura.capa === "profunda");
  const capaVisible = conProfundos ? capa : "superficie";

  return (
    <div className="mapa-cuerpo mapa-cuerpo-estructura">
      <div className="mapa-cuerpo-ubicacion">
        <div className="mapa-cuerpo-panel">
          <FiguraCuerpo chica vista={vistaDeLaParte} elegida={{ parte: mapa.piezaDe(parte, region), region }} etiquetas={{ figura: conLado }} />
        </div>
        <div>
          <p className="rotulo-criterio">{t("lesiones.cuerpo.ubicacion")}</p>
          <b>{conLado}</b>
          <p className="mapa-cuerpo-ayuda">
            {conFigura ? t("lesiones.cuerpo.estructuraFigura") : secciones.length || conArea ? t("lesiones.cuerpo.estructuraTexto") : t("lesiones.cuerpo.sinEstructuras")}
          </p>
        </div>
      </div>

      {conFigura && (
        <div className="mapa-cuerpo-anatomia">
          {conProfundos && (
            <div className="grilla-criterios mapa-cuerpo-vista" role="group" aria-label={t("lesiones.cuerpo.capa")}>
              {["superficie", "profunda"].map((cual) => (
                <button type="button" key={cual} className={`chip-criterio ${capaVisible === cual ? "prendido" : ""}`} aria-pressed={capaVisible === cual} onClick={() => setCapa(cual)}>
                  {t(`lesiones.cuerpo.capas.${cual}`)}
                </button>
              ))}
            </div>
          )}
          {vistas.length > 0 && (
            <div className={`mapa-cuerpo-anatomia-vistas ${vistas.length === 1 ? "una" : ""}`.trim()}>
              {vistas.map((cual) => (
                <VistaAnatomica
                  key={cual}
                  pieza={pieza}
                  region={region}
                  vista={cual}
                  capa={capaVisible}
                  titulo={t(`lesiones.cuerpo.${cual}`)}
                  estadoDe={estadoDe}
                  nombreDe={nombreDe}
                  onTocar={tocarEnLaFigura}
                />
              ))}
            </div>
          )}
          {esquemas.length > 0 && (
            <div className="mapa-cuerpo-anatomia-esquemas">
              {esquemas.map((cual) => (
                <EsquemaAnatomico
                  key={cual}
                  cual={cual}
                  region={region}
                  espejado={espejadaEn(region, "frente")}
                  titulo={t(`lesiones.cuerpo.esquemas.${cual}`)}
                  rotulo={(clave) => t(`lesiones.cuerpo.rotulos.${clave}`)}
                  estadoDe={estadoDe}
                  nombreDe={nombreDe}
                  onTocar={tocarEnLaFigura}
                />
              ))}
            </div>
          )}
          <p className="mapa-cuerpo-leyenda" aria-hidden="true">
            {["musculos", "tendones", "ligamentos"].map((cual) => (
              <span key={cual} className={cual}>
                {t(`lesiones.cuerpo.leyenda.${cual}`)}
              </span>
            ))}
          </p>
        </div>
      )}

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
