import React from "react";

// Los gráficos de "Informes gráficos" (Lesiones › Reportes): columnas,
// barras apiladas y tortas, hechos a mano (HTML y CSS; la torta, en SVG),
// como los otros gráficos de los reportes. Los textos llegan hechos.

// Los colores de las series (una parte del cuerpo, por ejemplo): el mismo
// color para lo mismo en todos los gráficos. Probados para que se distingan
// también con daltonismo. Después de los ocho, los mismos más oscuros y
// después más claros (como el Excel con sus colores de acento): 24 sin
// repetir, más que las partes del cuerpo del catálogo. Si hubiera más, se
// arman otros que tampoco repiten.
export const COLORES_DE_SERIE = Object.freeze(["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]);
const COLORES_OSCUROS = Object.freeze(["#1b5296", "#b04718", "#127a55", "#a87200", "#b8547a", "#005c00", "#30247a", "#a82e2e"]);
const COLORES_CLAROS = Object.freeze(["#7fb0ea", "#f4a07e", "#6fd3ae", "#f5c55c", "#f2b3cb", "#4fb14f", "#8f84d0", "#ef8f8e"]);
const PALETAS = [COLORES_DE_SERIE, COLORES_OSCUROS, COLORES_CLAROS];
// El texto que se lee arriba de cada color.
const TINTA_CLARA = "#ffffff";
const TINTA_OSCURA = "#0f172a";
const CON_TINTA_OSCURA = new Set(["#1baf7a", "#eda100", "#e87ba4", ...COLORES_CLAROS]);
export const COLOR_SIN_DATO = "#94a3b8";

export const tintaDe = (color) => (CON_TINTA_OSCURA.has(color) ? TINTA_OSCURA : TINTA_CLARA);

// Un color por clave, en el orden en que llegan (la clave vacía, "Sin dato",
// en gris). Así el color no depende de los filtros: se arma una vez con todas.
export const coloresDeSeries = (claves) => {
  const colores = new Map();
  let siguiente = 0;
  claves.forEach((clave) => {
    if (colores.has(clave)) return;
    if (clave === "" || clave === null || clave === undefined) {
      colores.set(clave ?? "", COLOR_SIN_DATO);
      return;
    }
    // Cada vuelta corre los colores tres lugares: así la novena no es la
    // primera más oscura (dos tonos del mismo color, uno al lado del otro).
    const vuelta = Math.floor(siguiente / COLORES_DE_SERIE.length);
    const paleta = PALETAS[vuelta];
    colores.set(clave, paleta ? paleta[(siguiente + vuelta * 3) % COLORES_DE_SERIE.length] : `hsl(${Math.round((siguiente * 137.508) % 360)} 55% 40%)`);
    siguiente += 1;
  });
  return (clave) => colores.get(clave ?? "") || COLOR_SIN_DATO;
};

// La leyenda: de qué es cada color. Con una sola serie, solo si se pide (en
// los bloques 1 y 2 la serie es el título del gráfico, como en el Excel).
const Leyenda = ({ series, mostrar = series.length > 1 }) =>
  mostrar && series.length ? (
    <p className="reporte-leyenda">
      {series.map((serie) => (
        <span key={serie.clave}>
          <i style={{ background: serie.color }} />
          {serie.etiqueta}
        </span>
      ))}
    </p>
  ) : null;

// Columnas: filas [{ clave, etiqueta, detalle?, valores: { serie: número | null } }]
// y series [{ clave, etiqueta, color }]. Varias series van una al lado de la
// otra. null es que no hay valor (no se dibuja la columna; dice "—"), no un
// cero. formato(valor) escribe el número. leyenda: si va la leyenda (de
// entrada, con más de una serie).
//
// Es una sola grilla: las barras, los nombres y los detalles de todas las
// columnas van en las mismas filas, así todas tienen la misma base y la misma
// escala aunque un nombre ocupe más renglones. El número va arriba de su
// barra, sin quitarle alto.
export const Columnas = ({ filas, series, formato = (valor) => (valor === null || valor === undefined ? "—" : String(valor)), titulo = "", vacio = "", leyenda = series.length > 1 }) => {
  if (!filas.length) return <p className="vacio-ficha">{vacio}</p>;
  const valores = filas.flatMap((fila) => series.map((serie) => fila.valores?.[serie.clave])).filter((valor) => typeof valor === "number" && Number.isFinite(valor));
  // Sin piso en 1: valores cada 1000 horas menores que 1 también se ven.
  const tope = Math.max(0, ...valores) || 1;
  // Lo que dice cada columna, al pasar el mouse y para quien no ve la pantalla.
  const textoDe = (fila) =>
    [
      fila.etiqueta,
      ...series.map((serie) => {
        const texto = formato(fila.valores?.[serie.clave] ?? null);
        return texto === "" ? "" : `${leyenda ? `${serie.etiqueta}: ` : ""}${texto}`;
      }),
      fila.detalle,
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <div className="reporte-columnas">
      <div className="reporte-columnas-grafico" role="group" aria-label={titulo} style={{ "--minimo-columna": `${Math.max(44, series.length * 14)}px` }}>
        {filas.map((fila) => {
          const texto = textoDe(fila);
          return (
            <React.Fragment key={fila.clave}>
              <div className="reporte-columnas-barras" role="img" aria-label={texto} title={texto}>
                {series.map((serie) => {
                  const valor = fila.valores?.[serie.clave];
                  const hay = typeof valor === "number" && Number.isFinite(valor);
                  return (
                    <div className="reporte-columnas-lugar" key={serie.clave}>
                      {hay ? (
                        <span className="reporte-columnas-barra" style={{ height: `${(valor / tope) * 100}%`, background: serie.color }}>
                          <span className="reporte-columnas-valor">{formato(valor)}</span>
                        </span>
                      ) : (
                        <span className="reporte-columnas-valor">{formato(null)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <small className="reporte-columnas-etiqueta" aria-hidden="true" title={texto}>
                {fila.etiqueta}
              </small>
              <small className="reporte-columnas-detalle" aria-hidden="true">
                {fila.detalle || ""}
              </small>
            </React.Fragment>
          );
        })}
      </div>
      <Leyenda series={series} mostrar={leyenda} />
    </div>
  );
};

// Barras horizontales apiladas: filas [{ clave, etiqueta, total, valores: { serie: n } }].
// Cada tramo dice su número (si entra) y el total va al final. La leyenda va
// siempre (aunque sea una sola serie: si no, el color no dice de qué es).
const PARTE_PARA_NUMERO = 0.08;
export const BarrasApiladas = ({ filas, series, vacio = "" }) => {
  if (!filas.length) return <p className="vacio-ficha">{vacio}</p>;
  const tope = Math.max(1, ...filas.map((fila) => fila.total));
  return (
    <div className="reporte-apiladas">
      <ul className="reporte-barras">
        {filas.map((fila) => (
          <li key={fila.clave}>
            <span className="reporte-barras-etiqueta">{fila.etiqueta}</span>
            <span className="reporte-barras-pista">
              {series
                .filter((serie) => fila.valores?.[serie.clave])
                .map((serie) => {
                  const valor = fila.valores[serie.clave];
                  return (
                    <span
                      key={serie.clave}
                      className="reporte-apiladas-tramo"
                      title={`${serie.etiqueta}: ${valor}`}
                      style={{ width: `${(valor / tope) * 100}%`, background: serie.color, color: tintaDe(serie.color) }}
                    >
                      {valor / tope >= PARTE_PARA_NUMERO ? valor : ""}
                    </span>
                  );
                })}
            </span>
            <b>{fila.total}</b>
          </li>
        ))}
      </ul>
      <Leyenda series={series} mostrar />
    </div>
  );
};

// Los caminos SVG de una torta: desde las 12 en el sentido del reloj (como
// el Excel). Una sola porción es el círculo entero (sin camino).
const redondear = (numero) => Math.round(numero * 100) / 100;
export const arcosDeTorta = (valores, { centro = 90, radio = 80 } = {}) => {
  const total = valores.reduce((suma, valor) => suma + valor, 0);
  if (!total) return [];
  const punto = (angulo) => `${redondear(centro + radio * Math.sin(angulo))} ${redondear(centro - radio * Math.cos(angulo))}`;
  let angulo = 0;
  return valores.map((valor) => {
    const desde = angulo;
    angulo += (valor / total) * Math.PI * 2;
    if (valor === total) return null;
    const grande = angulo - desde > Math.PI ? 1 : 0;
    return `M${centro} ${centro} L${punto(desde)} A${radio} ${radio} 0 ${grande} 1 ${punto(angulo)} Z`;
  });
};

// La torta y, al lado, de qué es cada porción con su porcentaje y cuántas:
// porciones [{ clave, etiqueta, valor, porcentaje, color, detalle }].
export const Torta = ({ porciones, titulo = "", vacio = "", formatoPorcentaje = (porcentaje) => `${Math.round(porcentaje)}%` }) => {
  if (!porciones.length) return <p className="vacio-ficha">{vacio}</p>;
  const caminos = arcosDeTorta(porciones.map((porcion) => porcion.valor));
  return (
    <figure className="reporte-torta">
      <svg viewBox="0 0 180 180" role="img" aria-label={titulo}>
        {porciones.map((porcion, indice) =>
          caminos[indice] === null ? (
            <circle key={porcion.clave} className="reporte-torta-porcion" cx="90" cy="90" r="80" fill={porcion.color}>
              <title>{`${porcion.etiqueta}: ${formatoPorcentaje(porcion.porcentaje)}`}</title>
            </circle>
          ) : (
            <path key={porcion.clave} className="reporte-torta-porcion" d={caminos[indice]} fill={porcion.color}>
              <title>{`${porcion.etiqueta}: ${formatoPorcentaje(porcion.porcentaje)}`}</title>
            </path>
          ),
        )}
      </svg>
      <ul className="reporte-torta-leyenda">
        {porciones.map((porcion) => (
          <li key={porcion.clave}>
            <i style={{ background: porcion.color }} />
            <span>{porcion.etiqueta}</span>
            <b>{formatoPorcentaje(porcion.porcentaje)}</b>
            {porcion.detalle && <small>{porcion.detalle}</small>}
          </li>
        ))}
      </ul>
    </figure>
  );
};
