import React, { useEffect, useState } from "react";
import { EscudoCAM, EscudoRival } from "./AppChrome";
import { claveEscudo, escudoGuardado, obtenerEscudo } from "../domain/crests";

export const NOMBRE_CAM = "Atlético Mineiro";

const ESPERA_TIPEO = 700;
const MINIMO_LETRAS = 3;

const VACIO = { situacion: "vacio", url: "", nombreOficial: "" };

/**
 * Busca el escudo de un club por su nombre. Sirve tanto para el rival, que se
 * va escribiendo, como para el nuestro o el de un partido ya guardado, que no
 * cambian: para esos conviene demora 0, porque no hay nada que esperar.
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

    // Si ya está guardado no hay nada que esperar ni que pedir.
    const guardado = escudoGuardado(texto);
    if (guardado) {
      setEstado({
        situacion: "listo",
        url: guardado.url,
        nombreOficial: guardado.nombreOficial,
      });
      return undefined;
    }

    let vigente = true;

    const temporizador = window.setTimeout(async () => {
      if (vigente) {
        setEstado({ situacion: "buscando", url: "", nombreOficial: "" });
      }

      try {
        const encontrado = await obtenerEscudo(texto);
        if (!vigente) return;

        setEstado(
          encontrado
            ? {
                situacion: "listo",
                url: encontrado.url,
                nombreOficial: encontrado.nombreOficial || "",
              }
            : { situacion: "sin-resultado", url: "", nombreOficial: "" },
        );
      } catch (error) {
        if (vigente) {
          setEstado({ situacion: "sin-resultado", url: "", nombreOficial: "" });
        }
      }
    }, demora);

    return () => {
      vigente = false;
      window.clearTimeout(temporizador);
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
      className={`escudo-club escudo-real ${mini ? "mini" : ""} ${
        compacto ? "compacto" : ""
      }`}
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

/**
 * Igual que EscudoClub pero se resuelve solo, para donde no hay un nombre que
 * se esté escribiendo: la lista de registros, donde cada fila es un rival
 * distinto. Las búsquedas van coordinadas, de a una por vez.
 */
export const EscudoDeClub = ({
  nombre = "",
  equipo = "rival",
  mini = false,
  compacto = false,
}) => {
  const escudo = useEscudoClub(nombre, { demora: 0 });

  return (
    <EscudoClub
      nombre={nombre}
      url={escudo.url}
      equipo={equipo}
      mini={mini}
      compacto={compacto}
    />
  );
};
