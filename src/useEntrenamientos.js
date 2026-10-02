import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  guardarEntrenamientoActualId,
  guardarEntrenamientosLocales,
  leerEntrenamientoActualId,
  leerEntrenamientosLocales,
  migrarSesionesViejas,
  nuevoEntrenamiento,
  ordenarEntrenamientos,
  recortarLocales,
  resumenLocal,
  sinSubir,
  tocar,
} from "./domain/entrenamiento.js";
import {
  borrarEntrenamientoDb,
  guardarEntrenamientoDb,
  leerEntrenamientoDb,
  listarEntrenamientosDb,
} from "./domain/entrenamientosDb.js";
import { horaLocal } from "./domain/sesionEntrenamiento.js";

// Cuánto se espera después del último cambio antes de subirlo a la base.
export const ESPERA_GUARDADO = 1500;

const sinSenal = () => typeof navigator !== "undefined" && navigator.onLine === false;

/**
 * Los entrenamientos, en el celular y en la base. Cada cambio se guarda en el
 * celular al toque y en la base un momento después, solo; sin señal queda
 * pendiente y sube cuando vuelve. La lista mezcla lo de acá con lo que hay en
 * la base; al abrir uno, si la base lo tiene más nuevo, se trae entero.
 *
 * En el celular quedan los de todos los clubes de la cuenta, pero se muestran
 * los del club elegido. Con soloLectura (quien ya se fue del club) se ve la
 * foto de su último día: nada se crea, se cambia, se borra ni se sube.
 */
export default function useEntrenamientos({ equipoId = null, email = "", soloLectura = false } = {}) {
  const [lista, setLista] = useState(() => {
    // En un club del que ya se fue no se crea nada, tampoco al migrar.
    const migrados = soloLectura ? [] : migrarSesionesViejas({ equipoId });
    const locales = leerEntrenamientosLocales();
    return migrados.length > 0 ? recortarLocales([...migrados, ...locales]) : locales;
  });
  // Resúmenes de la base (sin tareas), para listar.
  const [remotos, setRemotos] = useState([]);
  const [estadoBase, setEstadoBase] = useState("idle");
  const [actualId, setActualIdEstado] = useState(leerEntrenamientoActualId);
  // idle | guardando | guardado | sin-senal | error
  const [guardado, setGuardado] = useState({ estado: "idle", hora: "" });
  // Solo lectura: el entrenamiento abierto de la foto. No va al celular.
  const [vista, setVista] = useState(null);

  // Los que no tienen club son de antes de que hubiera clubes: se ven en todos.
  const delClub = useCallback(
    (entrenamiento) => !equipoId || !entrenamiento?.equipoId || entrenamiento.equipoId === equipoId,
    [equipoId],
  );

  const listaRef = useRef(lista);
  listaRef.current = lista;
  const pendientes = useRef(new Set());
  const temporizador = useRef(null);
  const subirRef = useRef(null);

  useEffect(() => {
    guardarEntrenamientosLocales(lista);
  }, [lista]);

  const setActualId = useCallback((id) => {
    guardarEntrenamientoActualId(id);
    setActualIdEstado(id);
  }, []);

  // Sube a la base lo que cambió. Lo que falla queda pendiente para la próxima.
  const subir = useCallback(
    async (ids) => {
      if (soloLectura) return;
      const aSubir = [...new Set(ids)]
        .map((id) => listaRef.current.find((entrenamiento) => entrenamiento.id === id))
        .filter(Boolean);
      if (aSubir.length === 0) return;

      setGuardado({ estado: "guardando", hora: "" });
      let fallo = false;

      for (const entrenamiento of aSubir) {
        try {
          await guardarEntrenamientoDb(entrenamiento, { actualizadoPor: email });
          setLista((actual) =>
            actual.map((item) =>
              item.id === entrenamiento.id && item.actualizadoEn === entrenamiento.actualizadoEn
                ? { ...item, guardadoEn: entrenamiento.actualizadoEn }
                : item,
            ),
          );
        } catch {
          fallo = true;
          pendientes.current.add(entrenamiento.id);
        }
      }

      setGuardado(
        fallo ? { estado: sinSenal() ? "sin-senal" : "error", hora: "" } : { estado: "guardado", hora: horaLocal().slice(0, 5) },
      );
    },
    [email, soloLectura],
  );
  subirRef.current = subir;

  const subirPendientes = useCallback(() => {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
    const ids = [...pendientes.current];
    pendientes.current.clear();
    if (ids.length > 0) subirRef.current?.(ids);
  }, []);

  const programarSubida = useCallback(
    (id) => {
      pendientes.current.add(id);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(subirPendientes, ESPERA_GUARDADO);
    },
    [subirPendientes],
  );

  const cambiar = useCallback(
    (id, cambio) => {
      if (soloLectura) return;
      setLista((actual) =>
        actual.map((entrenamiento) =>
          entrenamiento.id === id
            ? tocar(typeof cambio === "function" ? cambio(entrenamiento) : { ...entrenamiento, ...cambio })
            : entrenamiento,
        ),
      );
      programarSubida(id);
    },
    [programarSubida, soloLectura],
  );

  const crear = useCallback(
    ({ fecha, nombre } = {}) => {
      if (soloLectura) return null;
      const entrenamiento = nuevoEntrenamiento({ fecha, nombre, equipoId });
      setLista((actual) => recortarLocales([entrenamiento, ...actual]));
      setActualId(entrenamiento.id);
      programarSubida(entrenamiento.id);
      return entrenamiento;
    },
    [equipoId, programarSubida, setActualId, soloLectura],
  );

  // Abre uno. Si la base lo tiene más nuevo, o no está en este aparato, lo
  // trae entero. Devuelve false si no se pudo (sin señal y sin copia local).
  const abrir = useCallback(
    async (id) => {
      if (soloLectura) {
        try {
          const completo = await leerEntrenamientoDb(id, equipoId);
          if (!completo) return false;
          setVista(completo);
          return true;
        } catch {
          return false;
        }
      }
      const local = listaRef.current.find((entrenamiento) => entrenamiento.id === id);
      const remoto = remotos.find((resumen) => resumen.id === id);
      const hayMasNuevo = Boolean(remoto) && (!local || String(remoto.actualizadoEn) > String(local.actualizadoEn));

      if (!local || hayMasNuevo) {
        try {
          const completo = await leerEntrenamientoDb(id, equipoId);
          if (completo) {
            setLista((actual) =>
              recortarLocales([completo, ...actual.filter((entrenamiento) => entrenamiento.id !== id)], undefined, {
                conservar: id,
              }),
            );
          } else if (!local) {
            return false;
          }
        } catch {
          if (!local) return false;
        }
      }

      setActualId(id);
      return true;
    },
    [equipoId, remotos, setActualId, soloLectura],
  );

  const borrar = useCallback(
    async (id) => {
      if (soloLectura) return;
      setLista((actual) => actual.filter((entrenamiento) => entrenamiento.id !== id));
      setRemotos((actual) => actual.filter((resumen) => resumen.id !== id));
      pendientes.current.delete(id);
      if (leerEntrenamientoActualId() === id) setActualId("");
      try {
        await borrarEntrenamientoDb(id);
      } catch {
        // Sin señal queda en la base; se ve en la lista hasta borrarlo de nuevo.
      }
    },
    [setActualId, soloLectura],
  );

  const recargarBase = useCallback(async () => {
    setEstadoBase("cargando");
    try {
      const filas = await listarEntrenamientosDb(equipoId);
      setRemotos(filas);
      setEstadoBase("listo");
      // La foto no se mezcla con lo del celular ni hace subir nada.
      if (soloLectura) return;

      // Lo que en la base está más nuevo que acá se trae entero.
      const masNuevos = filas.filter((resumen) => {
        const local = listaRef.current.find((entrenamiento) => entrenamiento.id === resumen.id);
        return local && String(resumen.actualizadoEn) > String(local.actualizadoEn);
      });
      for (const resumen of masNuevos) {
        try {
          const completo = await leerEntrenamientoDb(resumen.id, equipoId);
          if (completo) {
            setLista((actual) => actual.map((entrenamiento) => (entrenamiento.id === resumen.id ? completo : entrenamiento)));
          }
        } catch {
          // Se intenta la próxima vez.
        }
      }

      // Y lo de acá que todavía no subió, sube.
      const atrasados = listaRef.current.filter(sinSubir).map((entrenamiento) => entrenamiento.id);
      if (atrasados.length > 0) subirRef.current?.(atrasados);
    } catch {
      setEstadoBase("error");
    }
  }, [equipoId, soloLectura]);

  useEffect(() => {
    recargarBase();
  }, [recargarBase]);

  // Con la señal de vuelta, o al esconder la app (pantalla apagada, otra
  // app), sube lo pendiente sin esperar.
  useEffect(() => {
    const alVolverLaSenal = () => {
      const ids = listaRef.current.filter(sinSubir).map((entrenamiento) => entrenamiento.id);
      if (ids.length > 0) subirRef.current?.(ids);
    };
    const alEsconder = () => {
      if (document.visibilityState === "hidden") subirPendientes();
    };
    window.addEventListener("online", alVolverLaSenal);
    document.addEventListener("visibilitychange", alEsconder);
    return () => {
      window.removeEventListener("online", alVolverLaSenal);
      document.removeEventListener("visibilitychange", alEsconder);
    };
  }, [subirPendientes]);

  // Al cerrar el módulo, lo pendiente sube igual.
  useEffect(() => () => subirPendientes(), [subirPendientes]);

  const resumenes = useMemo(() => {
    const porId = new Map();
    if (!soloLectura) {
      lista
        .filter(delClub)
        .forEach((entrenamiento) => porId.set(entrenamiento.id, { ...resumenLocal(entrenamiento), local: true }));
    }
    remotos.forEach((resumen) => {
      if (!porId.has(resumen.id)) porId.set(resumen.id, { ...resumen, local: false });
    });
    return ordenarEntrenamientos([...porId.values()]);
  }, [lista, remotos, soloLectura, delClub]);

  const actual = useMemo(() => {
    if (soloLectura) return vista;
    return lista.find((entrenamiento) => entrenamiento.id === actualId && delClub(entrenamiento)) || null;
  }, [lista, actualId, soloLectura, vista, delClub]);

  return {
    lista,
    resumenes,
    actual,
    actualId: soloLectura ? vista?.id || "" : actualId,
    estadoBase,
    guardado,
    crear,
    abrir,
    cambiar,
    borrar,
    setActualId,
    recargarBase,
  };
}
