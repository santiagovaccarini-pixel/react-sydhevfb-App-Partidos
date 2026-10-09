import { fechaCorta } from "../../idioma/formatos.js";
import { textoDeMinutos } from "../tabla.js";
import { LISTA_SELECCION, etiquetaDeOpcion } from "./ajustes.js";
import { textoDeValor } from "./excel.js";

// Cómo se ve cada celda de una evaluación, igual en la Base y en los
// reportes: lo cargado (la fecha, el jugador, la opción de una lista, el
// tiempo en minutos y segundos) y lo calculado con el formato del Excel.

// La lista de una columna de tipo lista (Selección, si no dice otra).
export const listaDeColumna = (columna) => columna.lista || LISTA_SELECCION;

// { valores, textos, orden } de una fila calculada ({ fila, celdas }).
// valores: lo que se edita; textos: lo que se ve; orden: lo que se usa para
// ordenar (si no es el texto). jugador: el de Datos básicos (o null).
export const celdasDeLaFila = ({ test, columnas, fila, celdas, jugador, config, idioma }) => {
  const valores = {};
  const textos = {};
  const orden = {};
  columnas.forEach((columna) => {
    const { clave } = columna;
    switch (columna.tipo) {
      case "fecha":
        valores[clave] = fila.fecha;
        textos[clave] = fechaCorta(fila.fecha);
        break;
      case "jugador":
        valores[clave] = fila.jugador_id ? String(fila.jugador_id) : "";
        textos[clave] = jugador?.nombre || fila.persona || "";
        orden[clave] = textos[clave];
        break;
      case "lista":
        valores[clave] = fila.datos?.[clave] || "";
        textos[clave] = etiquetaDeOpcion(listaDeColumna(columna), fila.datos?.[clave], config, idioma, test);
        break;
      case "dato_jugador":
        if (clave === "fecha_nac") {
          textos[clave] = fechaCorta(jugador?.fecha_nacimiento);
          orden[clave] = jugador?.fecha_nacimiento || "";
        }
        break;
      case "tiempo":
        valores[clave] = typeof fila.datos?.[clave] === "number" ? fila.datos[clave] : null;
        textos[clave] = textoDeMinutos(valores[clave]);
        if (valores[clave] !== null) orden[clave] = valores[clave];
        break;
      case "numero":
        valores[clave] = typeof fila.datos?.[clave] === "number" ? fila.datos[clave] : null;
        textos[clave] = valores[clave] === null ? "" : textoDeValor(valores[clave], columna.formato, idioma);
        if (valores[clave] !== null) orden[clave] = valores[clave];
        break;
      case "texto":
        valores[clave] = fila.datos?.[clave] || "";
        textos[clave] = valores[clave];
        break;
      default:
        // Un resultado de texto con su nombre en cada idioma (PD / PI / Sin
        // Deficit), o como lo da el Excel.
        textos[clave] = typeof celdas[clave] === "string" && columna.valores?.[celdas[clave]] ? columna.valores[celdas[clave]][idioma] : textoDeValor(celdas[clave], columna.formato, idioma);
        if (typeof celdas[clave] === "number") orden[clave] = celdas[clave];
    }
  });
  return { valores, textos, orden };
};

// Una celda del informe como se ve: con su formato y, si tiene, su rótulo
// adelante (en Curl Nórdico, "PD 12").
export const textoDeCeldaDelInforme = (celda, idioma) => {
  if (!celda) return "";
  const texto = textoDeValor(celda.valor, celda.formato, idioma);
  return celda.rotulo && texto !== "" ? `${celda.rotulo[idioma]} ${texto}` : texto;
};
