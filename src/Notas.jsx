import React, { useCallback, useEffect, useState } from "react";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { FlechaVolver } from "./components/PortalTarjetas.jsx";
import { LARGO_MAXIMO_NOTA, agregarNota, borrarNota, cambiarNota, listarNotas, ordenarNotas } from "./domain/notasDb.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaYHora } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// Notas: las mejoras que se quieren hacer en la app, anotadas adentro de la
// app. Cada nota es del club: la escribe y la ve la gente que sigue en el
// club (lo cuida la base). Arriba se escribe una nueva; abajo, las que faltan
// hacer y las hechas, cada una con quién la escribió y cuándo. Cualquiera la
// marca como hecha; la corrige quien la escribió y la borra quien la escribió
// o el administrador del club.

const Grupo = ({ titulo, cantidad, vacio, children }) => (
  <section className="cuentas-grupo">
    <h2>
      {titulo} <span className="cuentas-cantidad">{cantidad}</span>
    </h2>
    {cantidad === 0 ? <p className="cuentas-vacio">{vacio}</p> : <ul className="cuentas-lista">{children}</ul>}
  </section>
);

const FilaNota = ({ nota, ocupada, puedeCorregir, puedeBorrar, onCambiar, onBorrar }) => {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota.texto);

  const empezar = () => {
    setTexto(nota.texto);
    setEditando(true);
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    const listo = await onCambiar(nota, { texto });
    if (listo) setEditando(false);
  };

  return (
    <li className={`cuenta-fila nota-fila${nota.hecha ? " hecha" : ""}`}>
      {editando ? (
        <form className="nota-editar" onSubmit={guardar}>
          <textarea
            className="nota-texto-campo"
            value={texto}
            maxLength={LARGO_MAXIMO_NOTA}
            rows={4}
            aria-label={t("notas.editarTitulo")}
            autoFocus
            onChange={(evento) => setTexto(evento.target.value)}
          />
          <div className="cuenta-acciones">
            <button type="submit" className="cuenta-autorizar" disabled={ocupada || !texto.trim()}>
              {ocupada ? t("comun.guardando") : t("notas.guardar")}
            </button>
            <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => setEditando(false)}>
              {t("comun.cancelar")}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="nota-texto">{nota.texto}</p>
          <div className="cuenta-meta">
            {nota.creado_email && <span>{nota.creado_email}</span>}
            {nota.creado_en && <span>{fechaYHora(nota.creado_en)}</span>}
          </div>
          <div className="cuenta-acciones">
            <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onCambiar(nota, { hecha: !nota.hecha })}>
              {nota.hecha ? t("notas.volverAPendientes") : t("notas.marcarHecha")}
            </button>
            {puedeCorregir && (
              <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={empezar}>
                {t("notas.editar")}
              </button>
            )}
            {puedeBorrar && (
              <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onBorrar(nota)}>
                {t("notas.borrar")}
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
};

// club: el club elegido; userId: quién entró; adminClub: si administra el club.
export default function Notas({ club, userId, adminClub = false, onVolver }) {
  useIdioma();
  const [notas, setNotas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [nueva, setNueva] = useState("");
  const [ocupada, setOcupada] = useState("");
  const [aBorrar, setABorrar] = useState(null);

  const equipoId = club?.id;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setNotas(await listarNotas(equipoId));
    } catch (errorCarga) {
      setError(errorCarga.message || "notas.errorCargar");
    } finally {
      setCargando(false);
    }
  }, [equipoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const agregar = async (evento) => {
    evento.preventDefault();
    if (!nueva.trim() || ocupada) return;
    setOcupada("nueva");
    setAviso("");
    try {
      const nota = await agregarNota(equipoId, nueva);
      setNotas((actuales) => ordenarNotas([nota, ...actuales]));
      setNueva("");
    } catch (errorNueva) {
      setAviso(errorNueva.message || "notas.errorGuardar");
    } finally {
      setOcupada("");
    }
  };

  // Devuelve si se guardó (la fila sale del modo edición solo entonces).
  const cambiar = async (nota, cambios) => {
    setOcupada(nota.id);
    setAviso("");
    try {
      const cambiada = await cambiarNota(nota.id, cambios);
      setNotas((actuales) => ordenarNotas(actuales.map((una) => (una.id === nota.id ? cambiada : una))));
      return true;
    } catch (errorCambio) {
      setAviso(errorCambio.message || "notas.errorGuardar");
      return false;
    } finally {
      setOcupada("");
    }
  };

  const confirmarBorrar = async () => {
    const nota = aBorrar;
    setABorrar(null);
    if (!nota) return;
    setOcupada(nota.id);
    setAviso("");
    try {
      await borrarNota(nota.id);
      setNotas((actuales) => actuales.filter((una) => una.id !== nota.id));
    } catch (errorBorrar) {
      setAviso(errorBorrar.message || "notas.errorBorrar");
    } finally {
      setOcupada("");
    }
  };

  const pendientes = notas.filter((nota) => !nota.hecha);
  const hechas = notas.filter((nota) => nota.hecha);
  const filas = (lista) =>
    lista.map((nota) => {
      const propia = Boolean(userId) && nota.creado_por === userId;
      return (
        <FilaNota
          key={nota.id}
          nota={nota}
          ocupada={ocupada === nota.id}
          puedeCorregir={propia}
          puedeBorrar={propia || adminClub}
          onCambiar={cambiar}
          onBorrar={setABorrar}
        />
      );
    });

  return (
    <main className="cuentas-pantalla notas-pantalla">
      <div className="cuentas-contenido">
        <div className="cuentas-cabecera">
          <button type="button" className="portal-salir cuentas-volver" onClick={onVolver}>
            <FlechaVolver /> {t("acceso.volverPortal")}
          </button>
          <div className="cuentas-cabecera-derecha">
            <button type="button" className="portal-salir cuentas-actualizar" onClick={cargar} disabled={cargando}>
              {cargando ? t("comun.actualizando") : t("comun.actualizar")}
            </button>
            <SelectorIdioma />
          </div>
        </div>

        <header className="cuentas-titulo">
          <span className="portal-kicker">{club?.nombre || t("notas.kicker")}</span>
          <h1>{t("notas.titulo")}</h1>
          <p>{t("notas.texto", { club: club?.nombre || "" })}</p>
        </header>

        {error ? (
          <div className="cuentas-aviso">
            {t(error)}{" "}
            <button type="button" className="cuentas-reintentar" onClick={cargar}>
              {t("comun.reintentar")}
            </button>
          </div>
        ) : (
          <>
            <section className="cuentas-grupo">
              <h2>{t("notas.nuevaTitulo")}</h2>
              <form className="cuentas-invitar nota-nueva" onSubmit={agregar}>
                <textarea
                  className="nota-texto-campo"
                  value={nueva}
                  maxLength={LARGO_MAXIMO_NOTA}
                  rows={3}
                  placeholder={t("notas.placeholder")}
                  aria-label={t("notas.nuevaTitulo")}
                  onChange={(evento) => setNueva(evento.target.value)}
                />
                <button type="submit" className="cuenta-autorizar" disabled={ocupada === "nueva" || !nueva.trim()}>
                  {ocupada === "nueva" ? t("comun.guardando") : t("notas.agregar")}
                </button>
              </form>
            </section>

            {aviso && (
              <div className="cuentas-aviso" role="status">
                {t(aviso)}
              </div>
            )}

            <Grupo titulo={t("notas.pendientesTitulo")} cantidad={pendientes.length} vacio={cargando ? t("comun.cargando") : t("notas.vacioPendientes")}>
              {filas(pendientes)}
            </Grupo>

            {hechas.length > 0 && (
              <Grupo titulo={t("notas.hechasTitulo")} cantidad={hechas.length}>
                {filas(hechas)}
              </Grupo>
            )}
          </>
        )}
      </div>

      <HojaConfirmar
        abierta={Boolean(aBorrar)}
        titulo={t("notas.borrarTitulo")}
        descripcion={t("notas.borrarTexto")}
        detalle={aBorrar?.texto}
        etiquetaConfirmar={t("notas.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBorrar}
        onCancelar={() => setABorrar(null)}
      />
    </main>
  );
}
