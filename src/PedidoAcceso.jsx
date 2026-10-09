import React, { useCallback, useEffect, useRef, useState } from "react";
import { PantallaAcceso } from "./AccessGate.jsx";
import { cancelarPedido, misPedidos, pedidoAbierto, pedirAcceso } from "./domain/pedidosDb.js";
import { t, useIdioma } from "./idioma/index.js";

// Quien todavía no está en ningún club (o quiere entrar a otro): escribe a
// qué club quiere entrar, manda el pedido y espera a que lo habiliten. Nada
// más. Lo ve la cuenta pendiente (en la puerta), la autorizada que se quedó
// sin clubes (al elegir club) y quien ya está en alguno y toca «Pedir entrar
// a otro club» (al elegir club). La persona ve lo mismo exista o no el club
// en la app: "Esperando autorización de" lo que escribió. Quien entró por
// invitación nunca ve la espera de la puerta: ya está en su club.
//
// Tres estados: sin pedido (el formulario), con uno abierto (la espera, con
// Cancelar pedido) y con el último rechazado (el aviso y el formulario de
// nuevo). Con una base sin pedidos, el texto de espera de siempre.
//
// `enPantalla`: con la pantalla de la puerta (foto, tarjeta, título); sin
// ella, como una sección debajo de la lista de clubes. `tituloSinPedidos` y
// `textoSinPedidos`: lo que dice con una base sin pedidos (la cuenta que ya
// está en un club no está "pendiente").
export default function PedidoAcceso({
  correo = "",
  onComprobar,
  onSalir,
  enPantalla = true,
  error: errorDeAfuera = "",
  tituloSinPedidos = "",
  textoSinPedidos = "",
  children,
}) {
  useIdioma();
  // null: todavía se está leyendo.
  const [pedidos, setPedidos] = useState(null);
  const [sinPedidos, setSinPedidos] = useState(false);
  const [error, setError] = useState("");
  const [club, setClub] = useState("");
  const [pais, setPais] = useState("");
  const [ocupado, setOcupado] = useState("");
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const cargar = useCallback(async () => {
    try {
      const lista = await misPedidos();
      if (!montado.current) return;
      setPedidos(lista);
      setSinPedidos(false);
    } catch (errorLectura) {
      if (!montado.current) return;
      // La base todavía no tiene pedidos: queda la espera de siempre.
      if (errorLectura?.message === "pedidos.error.faltaMigracion") {
        setSinPedidos(true);
        setPedidos([]);
        return;
      }
      setPedidos((actual) => actual || []);
      setError(t(errorLectura?.message || "pedidos.error.generico"));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hacer = async (clave, accion) => {
    setOcupado(clave);
    setError("");
    try {
      await accion();
    } catch (errorAccion) {
      if (montado.current) setError(t(errorAccion?.message || "pedidos.error.generico"));
    } finally {
      if (montado.current) setOcupado("");
    }
  };

  const mandar = (evento) => {
    evento.preventDefault();
    return hacer("mandar", async () => {
      try {
        await pedirAcceso(club, pais);
      } catch (errorPedido) {
        // Ya había uno abierto (desde otra pestaña, por ejemplo): se muestra la espera.
        if (errorPedido?.message === "pedidos.error.yaHayUnPedido") await cargar();
        throw errorPedido;
      }
      if (!montado.current) return;
      setClub("");
      setPais("");
      await cargar();
    });
  };

  const cancelar = (pedido) => hacer("cancelar", async () => {
    await cancelarPedido(pedido.id);
    await cargar();
  });

  // Volver a comprobar: la cuenta (si ya la habilitaron, quien llama la deja
  // entrar) y los pedidos (si lo rechazaron, se ve acá).
  const comprobar = () => hacer("comprobar", async () => {
    await onComprobar?.();
    if (montado.current) await cargar();
  });

  const salir = () => hacer("salir", async () => onSalir?.());

  const ocupada = Boolean(ocupado);
  const ultimo = pedidos?.[0] || null;
  const abierto = pedidoAbierto(pedidos);
  const rechazado = !abierto && ultimo?.estado === "rechazado" ? ultimo : null;
  const mensaje = error || errorDeAfuera;

  const enlaces = (conComprobar) => (
    <div className="training-access-enlaces">
      {conComprobar && (
        <button type="button" className="training-access-enlace" onClick={comprobar} disabled={ocupada}>
          {ocupado === "comprobar" ? t("acceso.comprobando") : t("acceso.comprobar")}
        </button>
      )}
      {onSalir && (
        <button type="button" className="training-access-enlace" onClick={salir} disabled={ocupada}>
          {ocupado === "salir" ? t("comun.saliendo") : t("comun.salir")}
        </button>
      )}
    </div>
  );

  let titulo;
  let texto = "";
  let cuerpo;

  if (pedidos === null) {
    titulo = t("acceso.cargandoTitulo");
    cuerpo = <span className="training-access-espera" aria-hidden="true" />;
  } else if (sinPedidos) {
    titulo = tituloSinPedidos || t("acceso.pendienteTitulo");
    texto = textoSinPedidos || t("acceso.pendienteTexto", { correo });
    cuerpo = (
      <div className="training-access-form">
        {mensaje && <div className="training-access-message error">{mensaje}</div>}
        <button type="button" className="training-access-primary" onClick={comprobar} disabled={ocupada}>
          {ocupado === "comprobar" ? t("acceso.comprobando") : t("acceso.comprobar")}
        </button>
        {children}
        {enlaces(false)}
      </div>
    );
  } else if (abierto) {
    titulo = t("pedidos.esperandoTitulo", { club: abierto.club_escrito });
    texto = t("pedidos.esperandoTexto");
    cuerpo = (
      <div className="training-access-form">
        {mensaje && <div className="training-access-message error">{mensaje}</div>}
        <button type="button" className="training-access-primary" onClick={comprobar} disabled={ocupada}>
          {ocupado === "comprobar" ? t("acceso.comprobando") : t("acceso.comprobar")}
        </button>
        {children}
        <div className="training-access-enlaces">
          <button type="button" className="training-access-enlace" onClick={() => cancelar(abierto)} disabled={ocupada}>
            {ocupado === "cancelar" ? t("pedidos.cancelando") : t("pedidos.cancelar")}
          </button>
          {onSalir && (
            <button type="button" className="training-access-enlace" onClick={salir} disabled={ocupada}>
              {ocupado === "salir" ? t("comun.saliendo") : t("comun.salir")}
            </button>
          )}
        </div>
      </div>
    );
  } else {
    titulo = t("pedidos.titulo");
    texto = t("pedidos.texto");
    cuerpo = (
      <form className="training-access-form pedido-formulario" onSubmit={mandar} noValidate>
        {rechazado && <div className="training-access-message ok">{t("pedidos.rechazado", { club: rechazado.club_escrito })}</div>}
        <label>
          {t("pedidos.club")}
          <input
            type="text"
            value={club}
            maxLength={80}
            placeholder={t("pedidos.clubEjemplo")}
            autoComplete="organization"
            onChange={(evento) => setClub(evento.target.value)}
          />
        </label>
        <label>
          {t("pedidos.pais")}
          <input
            type="text"
            value={pais}
            maxLength={60}
            placeholder={t("pedidos.paisEjemplo")}
            autoComplete="country-name"
            onChange={(evento) => setPais(evento.target.value)}
          />
        </label>
        {mensaje && <div className="training-access-message error">{mensaje}</div>}
        <button type="submit" className="training-access-primary" disabled={ocupada || club.trim().length < 2}>
          {ocupado === "mandar" ? t("pedidos.mandando") : t("pedidos.mandar")}
        </button>
        {children}
        {enlaces(true)}
      </form>
    );
  }

  if (enPantalla) {
    return (
      <PantallaAcceso titulo={titulo} texto={texto}>
        {cuerpo}
      </PantallaAcceso>
    );
  }
  return (
    <section className="pedido-acceso">
      <h2>{titulo}</h2>
      {texto && <p>{texto}</p>}
      {cuerpo}
    </section>
  );
}
