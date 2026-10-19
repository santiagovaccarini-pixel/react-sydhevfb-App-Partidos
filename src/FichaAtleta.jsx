import React, { useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { HojaInferior } from "./components/SheetPanel.js";
import { descargarArchivo } from "./domain/descargar.js";
import { hojasDeLaExportacion, jsonDeLaExportacion, nombreDeArchivo } from "./domain/exportarAtleta.js";
import { exportarAtleta } from "./domain/privacidadDb.js";
import { TIPO_XLSX, crearXlsx } from "./domain/xlsx.js";
import { hoyISO } from "./idioma/formatos.js";
import { t, useIdioma } from "./idioma/index.js";

// Datos básicos › «Ver ficha» (solo el administrador; Santiago, 18/10, en un
// cuestionario: «Datos básicos, en la ficha»): lo que el atleta le pide al
// club sobre sus datos. Exportarlos todos: un Excel con una hoja por base y
// un JSON con lo guardado tal cual (20261104).
export default function FichaAtleta({ jugador, onCerrar }) {
  const { idioma } = useIdioma();
  // Qué se está preparando ("xlsx" o "json"), el error y lo último bajado.
  const [estado, setEstado] = useState({ preparando: "", error: "", bajado: "" });
  // Lo que contestó la base: para el segundo archivo no se vuelve a pedir.
  const leido = useRef(null);

  const bajar = async (formato) => {
    if (estado.preparando) return;
    setEstado({ preparando: formato, error: "", bajado: "" });
    let datos = leido.current;
    if (!datos) {
      const respuesta = await exportarAtleta(jugador.id);
      if (respuesta.error) {
        setEstado({ preparando: "", error: respuesta.error, bajado: "" });
        return;
      }
      datos = respuesta.datos;
      leido.current = datos;
    }
    const nombre = nombreDeArchivo(t("exportar.archivo"), jugador.nombre, hoyISO());
    if (formato === "xlsx") descargarArchivo(`${nombre}.xlsx`, crearXlsx(hojasDeLaExportacion(datos, { idioma, t })), TIPO_XLSX);
    else descargarArchivo(`${nombre}.json`, jsonDeLaExportacion(datos), "application/json");
    setEstado({ preparando: "", error: "", bajado: formato });
  };

  const boton = (formato, etiqueta) => (
    <button type="button" className="boton-secundario" onClick={() => bajar(formato)} disabled={Boolean(estado.preparando)}>
      <Icono nombre="documento" size={15} />
      {estado.preparando === formato ? t("exportar.preparando") : t(etiqueta)}
    </button>
  );

  return (
    <HojaInferior
      abierta={Boolean(jugador)}
      titulo={jugador?.nombre || ""}
      descripcion={t("exportar.ficha")}
      className="ficha-atleta"
      onCerrar={onCerrar}
      acciones={
        <button type="button" className="boton-cancelar-hoja" onClick={onCerrar}>
          {t("comun.cerrar")}
        </button>
      }
    >
      <section className="ficha-atleta-bloque" aria-labelledby="ficha-atleta-exportar">
        <b id="ficha-atleta-exportar">{t("exportar.titulo")}</b>
        <p>{t("exportar.texto")}</p>
        <div className="ficha-atleta-botones">
          {boton("xlsx", "exportar.excel")}
          {boton("json", "exportar.json")}
        </div>
        {estado.error && (
          <p className="ficha-atleta-aviso error" role="alert">
            {t(estado.error)}
          </p>
        )}
        {estado.bajado && (
          <p className="ficha-atleta-aviso" role="status">
            {t(estado.bajado === "xlsx" ? "exportar.bajadoExcel" : "exportar.bajadoJson")}
          </p>
        )}
      </section>
    </HojaInferior>
  );
}
