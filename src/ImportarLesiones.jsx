import React, { useMemo, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { ESTADOS, leerLesionesPegadas, ordenDeCarga, planDeImportacion } from "./domain/importarLesiones.js";
import { etiquetaDeCampo, etiquetaDeOpcion } from "./domain/lesionesCampos.js";
import { importarLesion } from "./domain/lesionesDb.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// Pegar desde Excel, en Lesiones › Base: se pega la tabla de la hoja
// "Antecedentes BD" (con su fila de cabeceras) y antes de guardar nada se ve
// qué pasa con cada fila: si se carga, si ya está en la app, si no tiene
// fecha de inicio (no se carga) o qué le impide cargarse. Se ve igual que
// Pegar desde Excel en Datos básicos (ImportarJugadores.jsx).

// Cómo se ve cada estado (las clases del de Datos básicos).
const CLASE_DEL_ESTADO = {
  [ESTADOS.nueva]: "nuevo",
  [ESTADOS.yaEsta]: "existe",
  [ESTADOS.sinFecha]: "fuera",
  [ESTADOS.conProblemas]: "problema",
};

export default function ImportarLesiones({ equipoId, plantel, lesiones, config, onVolver, onRecargar, onListo }) {
  const { idioma, plural } = useIdioma();
  const [texto, setTexto] = useState("");
  const [progreso, setProgreso] = useState(null);
  const [fallas, setFallas] = useState([]);

  const columna = (campo) => etiquetaDeCampo(campo, config, idioma);
  const textoDeOpcion = (campo, codigo) => etiquetaDeOpcion(campo, codigo, config, idioma);

  const leido = useMemo(() => (texto.trim() ? leerLesionesPegadas(texto, { config }) : null), [texto, config]);
  const hoy = hoyISO();
  const plan = useMemo(
    () => (leido && !leido.error ? planDeImportacion(leido.filas, { plantel, lesiones, config, hoy }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leido, plantel, lesiones, config],
  );
  const aCargar = useMemo(() => ordenDeCarga(plan), [plan]);
  const cuantas = (estado) => plan.filter((fila) => fila.estado === estado).length;

  const pegarTexto = (nuevo) => {
    setTexto(nuevo);
    setFallas([]);
  };

  // Un problema en palabras: los de la carga a mano dicen la parte y el lado.
  const textoDelProblema = (fila, clave) =>
    t(clave, {
      parte: textoDeOpcion("parte_cuerpo", fila.lesion.datos.parte_cuerpo),
      lado: textoDeOpcion("lado", fila.lesion.datos.lado),
    });

  const casoDe = (fila) => (fila.numeroCaso !== null ? t("lesiones.importar.caso", { n: fila.numeroCaso }) : t("lesiones.importar.sinCaso"));

  // Qué lesión es: la parte, el lado y desde cuándo.
  const detalleDe = (fila) => {
    const { datos, fecha_lesion: fecha } = fila.lesion;
    return [
      [textoDeOpcion("parte_cuerpo", datos.parte_cuerpo), datos.lado ? `(${textoDeOpcion("lado", datos.lado)})` : ""].filter(Boolean).join(" "),
      textoDeOpcion("tipo_lesion", datos.tipo_lesion),
      fecha ? t("lesiones.desde", { fecha: fechaCorta(fecha) }) : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const cargar = async () => {
    const lista = aCargar;
    if (lista.length === 0) return;
    const errores = [];
    let cargadas = 0;
    setFallas([]);
    for (let i = 0; i < lista.length; i++) {
      const fila = lista[i];
      setProgreso({ n: i + 1, total: lista.length });
      const guardado = await importarLesion(equipoId, fila.lesion); // eslint-disable-line no-await-in-loop
      if (guardado.error) errores.push({ caso: casoDe(fila), nombre: fila.nombre, error: textoDelProblema(fila, guardado.error) });
      else cargadas += 1;
    }
    // Con las lesiones de nuevo, las que ya quedaron se ven como "Ya está en
    // la app" y las que fallaron se pueden volver a intentar.
    await onRecargar();
    setProgreso(null);
    if (errores.length === 0) {
      onListo({ cargadas });
      return;
    }
    setFallas(errores);
  };

  const ocupado = Boolean(progreso);

  return (
    <div className="app">
      <div className="contenedor datos-importar">
        <header className="encabezado lesiones-encabezado">
          <div className="lesiones-encabezado-texto">
            <h1>{t("lesiones.importar.titulo")}</h1>
            <p>{t("lesiones.importar.texto")}</p>
          </div>
          <SelectorIdioma className="lesiones-idioma" />
        </header>

        <section className="tarjeta datos-importar-pegado">
          <textarea
            rows={5}
            value={texto}
            placeholder={t("lesiones.importar.pegarAca")}
            aria-label={t("lesiones.importar.pegarAca")}
            spellCheck={false}
            disabled={ocupado}
            onChange={(evento) => pegarTexto(evento.target.value)}
          />
          {texto && (
            <button type="button" className="boton-secundario" onClick={() => pegarTexto("")} disabled={ocupado}>
              <Icono nombre="borrar" size={15} />
              {t("lesiones.importar.borrar")}
            </button>
          )}
        </section>

        {leido?.error && <div className="lesiones-estado error">{t(leido.error)}</div>}

        {fallas.length > 0 && (
          <div className="lesiones-estado error datos-importar-fallas" role="alert">
            <b>{plural("lesiones.importar.fallaron", fallas.length)}</b>
            <ul>
              {fallas.map((falla, i) => (
                <li key={`${falla.caso}-${i}`}>{t("lesiones.importar.fallo", falla)}</li>
              ))}
            </ul>
          </div>
        )}

        {plan.length > 0 && (
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{plural("lesiones.importar.filas", plan.length)}</b>
            </div>
            <p className="datos-importar-resumen">
              {[
                plural("lesiones.importar.nuevas", cuantas(ESTADOS.nueva)),
                plural("lesiones.importar.yaEstan", cuantas(ESTADOS.yaEsta)),
                ...(cuantas(ESTADOS.sinFecha) ? [plural("lesiones.importar.sinFechas", cuantas(ESTADOS.sinFecha))] : []),
                ...(cuantas(ESTADOS.conProblemas) ? [plural("lesiones.importar.conProblemas", cuantas(ESTADOS.conProblemas))] : []),
              ].join(" · ")}
            </p>
            <ul className="datos-importar-lista">
              {plan.map((fila) => (
                <li key={fila.indice} className={fila.estado === ESTADOS.sinFecha || fila.estado === ESTADOS.yaEsta ? "apagada" : ""}>
                  <div className="datos-importar-fila">
                    <b>
                      {casoDe(fila)} · {fila.nombre}
                    </b>
                    <span className={`datos-importar-destino ${CLASE_DEL_ESTADO[fila.estado]}`}>
                      <span>{t(`lesiones.importar.estado.${fila.estado}`)}</span>
                    </span>
                  </div>
                  {fila.estado !== ESTADOS.sinFecha && detalleDe(fila) && <p className="datos-importar-detalle">{detalleDe(fila)}</p>}
                  {fila.problemas.map((clave) => (
                    <p className="datos-importar-problema" key={clave}>
                      {textoDelProblema(fila, clave)}
                    </p>
                  ))}
                  {fila.estado !== ESTADOS.sinFecha &&
                    fila.estado !== ESTADOS.yaEsta &&
                    fila.avisos.map((aviso) => (
                      <p className="datos-importar-aviso" key={aviso.campo}>
                        {t("lesiones.importar.aviso", { valor: aviso.valor, columna: columna(aviso.campo) })}
                      </p>
                    ))}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="acciones-dobles">
          <BotonVolver onClick={onVolver}>{t("comun.volver")}</BotonVolver>
          <button type="button" className="boton-principal" onClick={cargar} disabled={ocupado || aCargar.length === 0}>
            {progreso
              ? t("lesiones.importar.cargando", progreso)
              : aCargar.length === 0
                ? t("lesiones.importar.nadaQueCargar")
                : plural("lesiones.importar.cargar", aCargar.length)}
          </button>
        </div>
      </div>
    </div>
  );
}
