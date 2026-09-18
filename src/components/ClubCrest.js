import React, { useEffect, useState } from "react";
import { EscudoCAM, EscudoRival } from "./AppChrome";
import {
  alVaciarEscudos,
  claveEscudo,
  escudoGuardado,
  escudoVencido,
  obtenerEscudo,
} from "../domain/crests";
import { esElCam } from "../domain/equipo";

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
  // Vaciar los escudos desde Ajustes tiene que verse en el momento, sin
  // recargar la app.
  const [vaciados, setVaciados] = useState(0);

  useEffect(
    () => alVaciarEscudos(() => setVaciados((cuenta) => cuenta + 1)),
    [],
  );

  useEffect(() => {
    const clave = claveEscudo(nombre);
    const texto = String(nombre || "").trim();

    if (!clave || texto.length < MINIMO_LETRAS) {
      setEstado(VACIO);
      return undefined;
    }

    // Lo guardado se muestra al toque. Si ya cumplió su tiempo igual se sale a
    // buscarlo por atrás y recién se reemplaza cuando llega otro: así no
    // parpadea, y sin señal te quedás con el de antes en vez de con ninguno.
    const guardado = escudoGuardado(texto);
    if (guardado) {
      setEstado({
        situacion: "listo",
        url: guardado.url,
        nombreOficial: guardado.nombreOficial,
      });
      if (!escudoVencido(texto)) return undefined;
    }

    let vigente = true;

    const temporizador = window.setTimeout(async () => {
      if (vigente && !guardado) {
        setEstado({ situacion: "buscando", url: "", nombreOficial: "" });
      }

      try {
        const encontrado = await obtenerEscudo(texto);
        if (!vigente) return;
        // Si no vino nada nuevo, se queda el que ya estaba a la vista.
        if (!encontrado && guardado) return;

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
        if (vigente && !guardado) {
          setEstado({ situacion: "sin-resultado", url: "", nombreOficial: "" });
        }
      }
    }, demora);

    return () => {
      vigente = false;
      window.clearTimeout(temporizador);
    };
  }, [nombre, demora, vaciados]);

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
    // El dibujado es el del Mineiro: si el equipo propio es otro, mientras no
    // aparezca su escudo real va el genérico y no el ajeno.
    return equipo === "cam" && esElCam(nombre) ? (
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
