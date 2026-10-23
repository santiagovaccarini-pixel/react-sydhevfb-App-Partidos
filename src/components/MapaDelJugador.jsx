import React, { useId, useState } from "react";
import cuerpoDeFrente from "../assets/cuerpo-lesiones-frente.webp";
import cuerpoDeEspaldas from "../assets/cuerpo-lesiones-espalda.webp";
import { colorDeCalor } from "./CuerpoConCalor.jsx";
import { claveDeZona, estructuraDe, familiaDeTipo, ladoDeLesion, masAfectadosDe, resumenDelMapa, zonaConMas, zonaPorClave } from "./mapaDelJugador.js";
import { TAMANO, ZONAS, paresDe, puntosDe, tieneLado } from "./zonasDeLaFigura.js";
import { conAltaHoy, esFechaISO } from "../domain/lesiones.js";
import { PERIODOS, diasPerdidos, lesionesDelReporte, periodoDe } from "../domain/reportes.js";
import { t, useIdioma } from "../idioma/index.js";
import { fechaCorta } from "../idioma/formatos.js";

// El mapa corporal del reporte individual de Lesiones (Santiago, 23/10, con
// la foto del reporte oscuro «MAPA CORPORAL DE LESIONES» y la figura que
// mandó): el cuerpo de frente y de espaldas con el calor de cada zona (más
// intenso cuantas más lesiones), las zonas se tocan sobre el cuerpo («las
// tarjetas de abajo podríamos meterlas dentro del cuerpo modelado») y se ve
// su detalle (la zona agrandada, cuántas lesiones, los días perdidos y lo
// más afectado) y su historial; al costado, la dona del tipo de lesión. El
// período, en un desplegable. Oscuro en pantalla y blanco al imprimir.
// lesiones: las del jugador (con fecha); textoDeOpcion(campo, codigo): el
// texto de una opción con lo del club.

const IMAGEN = { frente: cuerpoDeFrente, espalda: cuerpoDeEspaldas };
const VISTAS = ["frente", "espalda"];
const LADOS = ["direito", "esquerdo"];
// Los colores de la dona (como la foto: muscular en rojo, tendinosa en
// naranja, articular en amarillo, otras en gris; la ósea, violeta).
const COLOR_FAMILIA = { muscular: "#ef4444", tendinosa: "#f97316", articular: "#facc15", osea: "#a78bfa", otras: "#94a3b8" };
const DIFUSO = 9;

// Un id que sirve adentro de url(#…).
const useIdLimpio = () => `mapa-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

// El área de un polígono (para que lo chico quede arriba de lo grande al
// tocar).
const areaDe = (pares) => Math.abs(pares.reduce((suma, [x, y], i) => suma + x * pares[(i + 1) % pares.length][1] - pares[(i + 1) % pares.length][0] * y, 0)) / 2;

// Lo que se pinta de una zona en una vista: cada forma, de cada lado con
// lesiones (las que no tienen lado van en los dos), con cuántas.
const pintadasDe = (datos, vista) =>
  (datos.zona.formas[vista] || []).flatMap((forma) =>
    tieneLado(vista, forma)
      ? LADOS.map((lado) => ({ forma, lado, cantidad: datos.porLado[lado] + datos.porLado.ambos })).filter((una) => una.cantidad > 0)
      : [{ forma, lado: null, cantidad: datos.cantidad }],
  );

// Las formas de una zona en una vista, de los dos lados.
const formasDe = (zona, vista) => (zona.formas[vista] || []).flatMap((forma) => (tieneLado(vista, forma) ? LADOS.map((lado) => ({ forma, lado })) : [{ forma, lado: null }]));

// Dónde se agranda una zona: la vista donde está (si está en las dos, de
// frente) y el cuadrado que la rodea; si las lesiones son de un solo lado,
// ese lado.
const cajaDe = (zona, datos) => {
  const vista = VISTAS.find((una) => zona.formas[una]?.length);
  const soloUnLado = datos && !datos.porLado.ambos && (datos.porLado.direito === 0) !== (datos.porLado.esquerdo === 0) ? (datos.porLado.direito ? "direito" : "esquerdo") : null;
  const pares = formasDe(zona, vista)
    .filter(({ lado }) => !soloUnLado || !lado || lado === soloUnLado)
    .flatMap(({ forma, lado }) => paresDe(vista, forma, lado));
  const xs = pares.map(([x]) => x);
  const ys = pares.map(([, y]) => y);
  const { ancho, alto } = TAMANO[vista];
  const lado = Math.min(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.25, 300, ancho, alto) || 170;
  const tam = Math.max(lado, 130);
  const x = Math.min(Math.max((Math.min(...xs) + Math.max(...xs)) / 2 - tam / 2, 0), ancho - tam);
  const y = Math.min(Math.max((Math.min(...ys) + Math.max(...ys)) / 2 - tam / 2, 0), alto - tam);
  return { vista, x, y, ancho: tam, alto: tam };
};

// Una vista del cuerpo: la figura, el calor de cada zona (difuso, recortado a
// su forma y a la figura), el borde de la zona elegida y, si se puede tocar,
// las zonas encima. caja: la parte que se ve (para agrandar una zona).
const Vista = ({ vista, resumen, elegida, tope, caja = null, toques = null, titulo = "" }) => {
  const id = useIdLimpio();
  const { ancho, alto } = TAMANO[vista];
  const pintadas = [...resumen.zonas.values()].flatMap((datos) => pintadasDe(datos, vista).map((una) => ({ ...una, clave: claveDeZona(datos.zona) })));
  // Las de menos lesiones primero: la más intensa queda arriba.
  pintadas.sort((a, b) => a.cantidad - b.cantidad);
  const zonaElegida = zonaPorClave(elegida);
  const bordes = zonaElegida ? formasDe(zonaElegida, vista) : [];
  return (
    <svg
      className="mapa-jugador-svg"
      viewBox={caja ? `${caja.x} ${caja.y} ${caja.ancho} ${caja.alto}` : `0 0 ${ancho} ${alto}`}
      data-vista={vista}
      role={toques ? "group" : "img"}
      aria-label={titulo}
    >
      <defs>
        <filter id={`${id}-difuso`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={DIFUSO} />
        </filter>
        {/* El calor no pasa de la figura. */}
        <mask id={`${id}-figura`} maskUnits="userSpaceOnUse" x={0} y={0} width={ancho} height={alto} style={{ maskType: "alpha" }}>
          <image href={IMAGEN[vista]} width={ancho} height={alto} />
        </mask>
        {pintadas.map((una, indice) => (
          <React.Fragment key={indice}>
            <clipPath id={`${id}-forma-${indice}`}>
              <polygon points={puntosDe(vista, una.forma, una.lado)} />
            </clipPath>
            {/* Como calor: más fuerte en el medio de la zona y suave hacia los bordes. */}
            <radialGradient id={`${id}-brillo-${indice}`} cx="50%" cy="50%" r="62%">
              <stop offset="0%" stopColor={colorDeCalor(una.cantidad, tope)} stopOpacity={1} />
              <stop offset="55%" stopColor={colorDeCalor(una.cantidad, tope)} stopOpacity={0.8} />
              <stop offset="100%" stopColor={colorDeCalor(una.cantidad, tope)} stopOpacity={0.15} />
            </radialGradient>
          </React.Fragment>
        ))}
      </defs>
      <image className="mapa-jugador-figura" href={IMAGEN[vista]} width={ancho} height={alto} />
      {/* Mezclado con la figura (el grupo entero: la máscara lo aísla): se sigue viendo el relieve. */}
      <g className="mapa-jugador-calores" mask={`url(#${id}-figura)`}>
        {pintadas.map((una, indice) => (
          <g key={`${una.clave}-${una.forma}-${una.lado}`} className="mapa-jugador-calor" data-zona={una.clave} data-cantidad={una.cantidad} clipPath={`url(#${id}-forma-${indice})`}>
            <polygon points={puntosDe(vista, una.forma, una.lado)} fill={`url(#${id}-brillo-${indice})`} filter={`url(#${id}-difuso)`} />
          </g>
        ))}
      </g>
      {/* El borde de la zona elegida, sin salir de la figura. */}
      <g mask={`url(#${id}-figura)`}>
        {bordes.map(({ forma, lado }) => (
          <polygon key={`${forma}-${lado}`} className="mapa-jugador-borde" points={puntosDe(vista, forma, lado)} />
        ))}
      </g>
      {toques && toques.filter((toque) => toque.vista === vista).map((toque) => <Toque key={toque.clave} toque={toque} />)}
    </svg>
  );
};

// Una zona que se toca (con el teclado, solo las que tienen lesiones: una
// vez por zona).
const Toque = ({ toque }) => {
  const elegir = (evento) => {
    if (evento.type === "keydown" && evento.key !== "Enter" && evento.key !== " ") return;
    evento.preventDefault();
    toque.onElegir();
  };
  return (
    <polygon
      className={`mapa-jugador-toque ${toque.elegida ? "elegida" : ""}`.trim()}
      points={toque.puntos}
      data-zona={toque.zona}
      role={toque.conTeclado ? "button" : undefined}
      tabIndex={toque.conTeclado ? 0 : undefined}
      aria-label={toque.conTeclado ? toque.nombre : undefined}
      aria-pressed={toque.conTeclado ? toque.elegida : undefined}
      aria-hidden={toque.conTeclado ? undefined : true}
      onClick={elegir}
      onKeyDown={elegir}
    >
      <title>{toque.nombre}</title>
    </polygon>
  );
};

// La dona del tipo de lesión: cada familia con su %.
const Dona = ({ tipos, titulo }) => {
  const radio = 15.915;
  let antes = 0;
  return (
    <figure className="mapa-jugador-dona">
      <svg viewBox="0 0 42 42" role="img" aria-label={titulo}>
        <circle cx="21" cy="21" r={radio} className="mapa-jugador-dona-fondo" />
        {tipos.map((tipo) => {
          const arco = (
            <circle
              key={tipo.familia}
              cx="21"
              cy="21"
              r={radio}
              fill="none"
              stroke={COLOR_FAMILIA[tipo.familia]}
              strokeWidth="6"
              strokeDasharray={`${tipo.porcentaje} ${100 - tipo.porcentaje}`}
              strokeDashoffset={25 - antes}
            />
          );
          antes += tipo.porcentaje;
          return arco;
        })}
      </svg>
      <ul className="mapa-jugador-dona-leyenda">
        {tipos.map((tipo) => (
          <li key={tipo.familia}>
            <i style={{ background: COLOR_FAMILIA[tipo.familia] }} />
            <span>{t(`lesiones.reportes.mapaJugador.familias.${tipo.familia}`)}</span>
            <b>{`${Math.round(tipo.porcentaje)}%`}</b>
          </li>
        ))}
      </ul>
    </figure>
  );
};

export default function MapaDelJugador({ lesiones, hoy, textoDeOpcion }) {
  const { idioma, plural } = useIdioma();
  const [periodo, setPeriodo] = useState("todo");
  const [rango, setRango] = useState(() => periodoDe("todo", hoy, lesiones));
  const [elegidaAMano, setElegidaAMano] = useState("");
  const { desde, hasta } = rango;
  const delPeriodo = lesionesDelReporte(lesiones, { desde, hasta });
  const resumen = resumenDelMapa(delPeriodo, hoy);
  const tope = resumen.maximo;
  const elegida = elegidaAMano || zonaConMas(resumen.zonas);
  const zona = zonaPorClave(elegida);
  const datos = zona ? resumen.zonas.get(elegida) || null : null;
  const nombreDe = (unaZona) => textoDeOpcion(unaZona.campo, unaZona.codigo);
  const numero = (valor) => Number(valor).toLocaleString(idioma);

  const elegirPeriodo = (cual) => {
    setPeriodo(cual);
    if (cual !== "medida") setRango(periodoDe(cual, hoy, lesiones));
  };

  // Las zonas que se tocan: las de cada código, en cada vista y cada lado.
  // Arriba, lo que tiene lesiones; después, el músculo sobre la parte; y lo
  // chico sobre lo grande.
  const conTeclado = new Set();
  const toques = ZONAS.flatMap((unaZona) => {
    const clave = claveDeZona(unaZona);
    const deLaZona = resumen.zonas.get(clave);
    const nombre = `${nombreDe(unaZona)}: ${plural("lesiones.reportes.mapaJugador.lesiones", deLaZona?.cantidad || 0)}`;
    return VISTAS.flatMap((vista) =>
      formasDe(unaZona, vista).map(({ forma, lado }) => ({
        clave: `${clave}-${forma}-${lado}`,
        zona: clave,
        vista,
        nombre,
        puntos: puntosDe(vista, forma, lado),
        area: areaDe(paresDe(vista, forma, lado)),
        conLesiones: Boolean(deLaZona),
        esMusculo: unaZona.campo === "musculo",
        elegida: clave === elegida,
        onElegir: () => setElegidaAMano(clave),
      })),
    );
  })
    .sort((a, b) => Number(a.conLesiones) - Number(b.conLesiones) || Number(a.esMusculo) - Number(b.esMusculo) || b.area - a.area)
    .map((toque) => {
      if (!toque.conLesiones || conTeclado.has(toque.zona)) return toque;
      conTeclado.add(toque.zona);
      return { ...toque, conTeclado: true };
    });

  const titulo = t("lesiones.reportes.mapaJugador.titulo");
  const historial = datos ? [...datos.lesiones].sort((a, b) => String(b.fecha_lesion).localeCompare(String(a.fecha_lesion))) : [];
  const masAfectados = datos ? masAfectadosDe(datos.lesiones).slice(0, 4) : [];
  const caja = zona ? cajaDe(zona, datos) : null;

  return (
    <section className="mapa-jugador" aria-label={titulo}>
      <header className="mapa-jugador-cabecera">
        <div>
          <h2>{titulo}</h2>
          <p className="no-imprimir">{t("lesiones.reportes.mapaJugador.tocar")}</p>
        </div>
        <div className="mapa-jugador-periodo">
          <label className="no-imprimir">
            <span>{t("lesiones.reportes.periodo")}</span>
            <select value={periodo} onChange={(evento) => elegirPeriodo(evento.target.value)}>
              {[...PERIODOS, "medida"].map((cual) => (
                <option key={cual} value={cual}>
                  {t(`lesiones.reportes.periodos.${cual}`)}
                </option>
              ))}
            </select>
          </label>
          {periodo === "medida" && (
            <div className="mapa-jugador-fechas no-imprimir">
              <label>
                <span>{t("lesiones.reportes.desde")}</span>
                <input type="date" value={desde} max={hasta} onChange={(evento) => esFechaISO(evento.target.value) && setRango({ desde: evento.target.value, hasta })} />
              </label>
              <label>
                <span>{t("lesiones.reportes.hasta")}</span>
                <input type="date" value={hasta} min={desde} onChange={(evento) => esFechaISO(evento.target.value) && setRango({ desde, hasta: evento.target.value })} />
              </label>
            </div>
          )}
          <p className="mapa-jugador-rango">{`${t(`lesiones.reportes.periodos.${periodo}`)} · ${fechaCorta(desde)} – ${fechaCorta(hasta)}`}</p>
        </div>
      </header>

      <div className="mapa-jugador-cuerpo">
        <aside className="mapa-jugador-tipos">
          <h3>{t("lesiones.reportes.mapaJugador.tipo")}</h3>
          {resumen.tipos.length ? <Dona tipos={resumen.tipos} titulo={t("lesiones.reportes.mapaJugador.tipo")} /> : <p className="mapa-jugador-vacio">{t("lesiones.reportes.mapaJugador.sinLesiones")}</p>}
        </aside>

        <div className="mapa-jugador-figuras">
          <div className="mapa-jugador-vistas">
            {VISTAS.map((vista) => (
              <figure key={vista} className="mapa-jugador-vista">
                <Vista vista={vista} resumen={resumen} elegida={elegida} tope={tope} toques={toques} titulo={`${titulo} · ${t(`lesiones.reportes.vistas.${vista}`)}`} />
                <figcaption>{t(`lesiones.reportes.vistas.${vista}`)}</figcaption>
              </figure>
            ))}
          </div>
          <p className="mapa-jugador-escala">
            <i aria-hidden="true" />
            {t("lesiones.reportes.mapaNota")}
          </p>
          {resumen.sinZona > 0 && <p className="mapa-jugador-nota">{plural("lesiones.reportes.mapaJugador.sinZona", resumen.sinZona)}</p>}
        </div>

        <div className="mapa-jugador-detalle" aria-live="polite">
          <h3>{t("lesiones.reportes.mapaJugador.detalle")}</h3>
          {!zona ? (
            <p className="mapa-jugador-vacio">{t(delPeriodo.length ? "lesiones.reportes.mapaJugador.tocar" : "lesiones.reportes.mapaJugador.sinLesiones")}</p>
          ) : (
            <>
              <div className="mapa-jugador-zona">
                <div className="mapa-jugador-zoom">
                  <Vista vista={caja.vista} resumen={resumen} elegida={elegida} tope={tope} caja={caja} titulo={nombreDe(zona)} />
                </div>
                <div className="mapa-jugador-zona-datos">
                  <h4>{nombreDe(zona)}</h4>
                  <p className="mapa-jugador-cuenta">
                    <i style={{ background: datos ? colorDeCalor(datos.cantidad, tope) : "transparent" }} aria-hidden="true" />
                    <span>
                      <b>{plural("lesiones.reportes.mapaJugador.lesiones", datos?.cantidad || 0)}</b>
                      {datos && <small>{plural("lesiones.reportes.mapaJugador.dias", datos.dias)}</small>}
                    </span>
                  </p>
                </div>
                {masAfectados.length > 0 && (
                  <div className="mapa-jugador-afectados">
                    <p className="mapa-jugador-rotulo">{t("lesiones.reportes.mapaJugador.masAfectados")}</p>
                      <ul className="mapa-jugador-barras">
                        {masAfectados.map((uno) => (
                          <li key={`${uno.campo}:${uno.codigo}`}>
                            <span>{textoDeOpcion(uno.campo, uno.codigo)}</span>
                            <i aria-hidden="true">
                              <em style={{ width: `${(uno.cantidad / masAfectados[0].cantidad) * 100}%`, background: colorDeCalor(uno.cantidad, Math.max(tope, masAfectados[0].cantidad)) }} />
                            </i>
                            <b>{uno.cantidad}</b>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>

              <h3>{t("lesiones.reportes.mapaJugador.historial")}</h3>
              {historial.length === 0 ? (
                <p className="mapa-jugador-vacio">{t("lesiones.reportes.mapaJugador.sinLesionesZona")}</p>
              ) : (
                <div className="mapa-jugador-tabla-marco">
                  <table className="mapa-jugador-tabla">
                    <thead>
                      <tr>
                        <th scope="col">{t("lesiones.reportes.mapaJugador.columnas.fecha")}</th>
                        <th scope="col">{t("lesiones.reportes.mapaJugador.columnas.tipo")}</th>
                        <th scope="col">{t("lesiones.reportes.mapaJugador.columnas.estructura")}</th>
                        <th scope="col" className="numero">
                          {t("lesiones.reportes.mapaJugador.columnas.dias")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((lesion) => {
                        const estructura = estructuraDe(lesion);
                        const tipo = lesion.datos?.tipo_lesion;
                        const lado = ladoDeLesion(lesion) || lesion.datos?.lado;
                        const abierta = !conAltaHoy(lesion, hoy);
                        return (
                          <tr key={lesion.id}>
                            <td className="fecha">{fechaCorta(lesion.fecha_lesion)}</td>
                            <td>
                              <span className="mapa-jugador-tipo">
                                <i style={{ background: COLOR_FAMILIA[familiaDeTipo(tipo)] }} aria-hidden="true" />
                                {tipo ? textoDeOpcion("tipo_lesion", tipo) : "—"}
                              </span>
                            </td>
                            <td>
                              {estructura ? textoDeOpcion(estructura.campo, estructura.codigo) : "—"}
                              {lado && <small>{textoDeOpcion("lado", lado)}</small>}
                            </td>
                            <td className="numero" data-rotulo={t("lesiones.reportes.mapaJugador.columnas.dias")}>
                              {numero(diasPerdidos(lesion, hoy))}
                              {abierta && <small>{t("lesiones.reportes.mapaJugador.enCurso")}</small>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

