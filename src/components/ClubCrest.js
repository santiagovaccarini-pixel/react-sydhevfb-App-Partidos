import React, { useEffect, useState } from "react";
import { EscudoCAM, EscudoRival } from "./AppChrome";
import {
  buscarEscudo,
  claveEscudo,
  entradaVencida,
  guardarEnCacheEscudos,
  incrustarImagen,
  leerCacheEscudos,
} from "../domain/crests";

export const NOMBRE_CAM = "Atlético Mineiro";

const ESPERA_TIPEO = 700;
const MINIMO_LETRAS = 3;
const TIEMPO_LIMITE = 8000;

const VACIO = { situacion: "vacio", url: "", nombreOficial: "" };

/**
 * Busca el escudo de un club por su nombre. Sirve tanto para el rival, que se
 * va escribiendo, como para el nuestro, que es siempre el mismo: para ese
 * conviene demora 0, porque no hay nada que esperar a que termine de tipear.
 *
 * Lo encontrado queda guardado en el celular, así que a partir de la segunda
 * vez aparece al toque y sin internet. Si no se encuentra nada, el que llama se
 * queda con el escudo dibujado de siempre.
 */
export const useEscudoClub = (nombre, { demora = ESPERA_TIPEO } = {}) => {
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

      const corte = window.setTimeout(() => controlador.abort(), TIEMPO_LIMITE);

      try {
        const encontrado = await buscarEscudo(texto, {
          senal: controlador.signal,
        });

        if (!encontrado) {
          guardarEnCacheEscudos(clave, { url: "", ts: Date.now() });
          if (vigente) {
            setEstado({
              situacion: "sin-resultado",
              url: "",
              nombreOficial: "",
            });
          }
          return;
        }

        const datos = await incrustarImagen(encontrado.url, controlador.signal);

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
    }, demora);

    return () => {
      vigente = false;
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [nombre, demora]);

  return estado;
};

/**
 * El escudo de un club: la imagen real si se encontró, y si no el dibujado de
 * siempre. Si la imagen falla al cargar, también cae al dibujado.
 */
export const EscudoClub = ({
  nombre = "",
  url = "",
  equipo = "rival",
  mini = false,
  compacto = false,
}) => {
  const [falloImagen, setFalloImagen] = useState(false);

  useEffect(() => setFalloImagen(false), [url]);

  if (!url || falloImagen) {
    return equipo === "cam" ? (
      <EscudoCAM compacto={compacto} />
    ) : (
      <EscudoRival nombre={nombre} mini={mini} />
    );
  }

  return (
    <span
      className={`escudo-club escudo-real ${mini ? "mini" : ""}`}
      aria-label={String(nombre).trim() || "Escudo del club"}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFalloImagen(true)}
      />
    </span>
  );
};
