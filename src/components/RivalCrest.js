import React, { useEffect, useState } from "react";
import { EscudoRival } from "./AppChrome";
import {
  buscarEscudo,
  claveEscudo,
  entradaVencida,
  guardarEnCacheEscudos,
  incrustarImagen,
  leerCacheEscudos,
} from "../domain/crests";

const ESPERA_TIPEO = 700;
const MINIMO_LETRAS = 3;
const TIEMPO_LIMITE = 8000;

const VACIO = { situacion: "vacio", url: "", nombreOficial: "" };

/**
 * Busca el escudo del rival mientras se escribe el nombre. Lo encontrado queda
 * guardado en el celular, así que a partir de la segunda vez aparece al toque y
 * sin internet. Si no se encuentra nada, el que llama se queda con el escudo
 * dibujado de siempre.
 */
export const useEscudoRival = (nombre) => {
  const [estado, setEstado] = useState(VACIO);

  useEffect(() => {
    const clave = claveEscudo(nombre);
    const texto = String(nombre || "").trim();

    if (!clave || texto.length < MINIMO_LETRAS) {
      setEstado(VACIO);
      return undefined;
    }

    const guardado = leerCacheEscudos()[clave];

    if (guardado?.datos || guardado?.url) {
      setEstado({
        situacion: "listo",
        url: guardado.datos || guardado.url,
        nombreOficial: guardado.nombreOficial || "",
      });
      return undefined;
    }

    // Ya se buscó hace poco y no apareció: no insistir en cada tecla.
    if (guardado && !entradaVencida(guardado)) {
      setEstado({ situacion: "sin-resultado", url: "", nombreOficial: "" });
      return undefined;
    }

    const controlador = new AbortController();
    let vigente = true;

    const temporizador = window.setTimeout(async () => {
      setEstado({ situacion: "buscando", url: "", nombreOficial: "" });

      const corte = window.setTimeout(
        () => controlador.abort(),
        TIEMPO_LIMITE,
      );

      try {
        const encontrado = await buscarEscudo(texto, {
          senal: controlador.signal,
        });

        if (!encontrado) {
          guardarEnCacheEscudos(clave, { url: "", ts: Date.now() });
          if (vigente) {
            setEstado({ situacion: "sin-resultado", url: "", nombreOficial: "" });
          }
          return;
        }

        const datos = await incrustarImagen(
          encontrado.url,
          controlador.signal,
        );

        guardarEnCacheEscudos(clave, {
          url: encontrado.url,
          datos: datos || "",
          fuente: encontrado.fuente,
          nombreOficial: encontrado.nombreOficial,
          ts: Date.now(),
        });

        if (vigente) {
          setEstado({
            situacion: "listo",
            url: datos || encontrado.url,
            nombreOficial: encontrado.nombreOficial || "",
          });
        }
      } catch (error) {
        if (vigente && error?.name !== "AbortError") {
          setEstado({ situacion: "sin-resultado", url: "", nombreOficial: "" });
        }
      } finally {
        window.clearTimeout(corte);
      }
    }, ESPERA_TIPEO);

    return () => {
      vigente = false;
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [nombre]);

  return estado;
};

/**
 * El escudo del rival: la imagen real si se encontró, y si no el dibujado con
 * la inicial. Si la imagen falla al cargar, también cae al dibujado.
 */
export const EscudoRivalAuto = ({ nombre = "", url = "", mini = false }) => {
  const [falloImagen, setFalloImagen] = useState(false);

  useEffect(() => setFalloImagen(false), [url]);

  if (!url || falloImagen) {
    return <EscudoRival nombre={nombre} mini={mini} />;
  }

  return (
    <span className={`escudo-rival escudo-real ${mini ? "mini" : ""}`}>
      <img
        src={url}
        alt={String(nombre).trim() || "Rival"}
        loading="lazy"
        onError={() => setFalloImagen(true)}
      />
    </span>
  );
};
