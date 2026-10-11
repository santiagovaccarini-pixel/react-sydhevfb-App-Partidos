import { useEffect, useRef } from "react";
import { supabase } from "../supabase.js";

// Lo nuevo sin recargar (Santiago, 11/10: «si se cargan datos nuevos tengo
// que poder verlos sin recargar la página»): una pantalla escucha los cambios
// de sus tablas en la base (Realtime de Supabase, solo las filas de su club)
// y, cuando alguien carga, cambia o borra algo, vuelve a leer en silencio.
// Cada cuenta recibe solo lo que ya puede leer: lo deciden las políticas de
// cada tabla. Las tablas tienen que estar en la publicación de Realtime
// (migración 20261017_en_vivo.sql); si no están, o sin señal, no pasa nada:
// la pantalla queda como hasta ahora.
//
//   useEnVivo({ nombre, tablas, equipoId, activo, alCambiar })
//
// nombre: de qué pantalla (para el canal); tablas: las que mira; activo: si
// escucha (quien ya se fue del club mira la foto de su último día: no);
// alCambiar(): vuelve a leer, sin "Cargando…" (si devuelve una promesa, se
// espera: las lecturas van de a una y, si algo cambió mientras se leía, se
// lee otra vez al terminar; así nunca queda una lectura vieja encima de una
// nueva). Varios cambios seguidos (un pegado de muchas filas) se leen una
// sola vez, al terminar. Al volver la conexión después de un corte, también
// lee: pudo haber cambios en el medio.
// Los borrados Supabase no los puede filtrar por club (de la fila borrada
// solo manda su id): se escuchan los de toda la tabla y, ante cualquiera, se
// vuelve a leer lo del club. Para filtrarlos, la tabla tendría que mandar la
// fila entera al borrarla (replica identity full) y, como en los borrados
// Supabase no mira las políticas, la vería cualquier cuenta: no se hace.

export const ESPERA_EN_VIVO = 800;

// En las pruebas no se conecta a nada (las pantallas usan el cliente de
// verdad): las que prueban esto lo prenden a mano.
export const enVivo = { prendido: import.meta.env?.MODE !== "test" };

export const useEnVivo = ({ nombre, tablas = [], equipoId, activo = true, alCambiar, espera = ESPERA_EN_VIVO }) => {
  const ultimo = useRef(alCambiar);
  ultimo.current = alCambiar;
  const lista = tablas.join(",");

  useEffect(() => {
    if (!enVivo.prendido || !activo || !equipoId || !lista || typeof supabase?.channel !== "function") return undefined;
    let temporizador = null;
    let conectado = false;
    let vigente = true;
    let leyendo = false;
    let otraVez = false;
    const leer = async () => {
      if (!vigente) return;
      if (leyendo) {
        otraVez = true;
        return;
      }
      leyendo = true;
      try {
        await ultimo.current?.();
      } catch {
        // En silencio: lo que no se pudo leer queda como se veía.
      } finally {
        leyendo = false;
      }
      if (otraVez) {
        otraVez = false;
        leer();
      }
    };
    const leerDeNuevo = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(leer, espera);
    };
    let canal = supabase.channel(`en-vivo:${nombre}:${equipoId}`);
    lista.split(",").forEach((tabla) => {
      canal = canal
        .on("postgres_changes", { event: "*", schema: "public", table: tabla, filter: `equipo_id=eq.${equipoId}` }, leerDeNuevo)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: tabla }, leerDeNuevo);
    });
    canal.subscribe((estado) => {
      if (estado !== "SUBSCRIBED") return;
      if (conectado) leerDeNuevo();
      conectado = true;
    });
    return () => {
      vigente = false;
      clearTimeout(temporizador);
      supabase.removeChannel?.(canal);
    };
  }, [nombre, lista, equipoId, activo, espera]);
};
