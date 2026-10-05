import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import PortalApp from "./PortalApp.jsx";
import { Portada, TIEMPOS_PORTADA, fotoDePortada, lugarEnPantalla } from "./components/PortalTarjetas.jsx";

// El equipo elegido y la cuenta que entró, cambiables por prueba (vi.mock se
// iza: van con hoisted).
const equipo = vi.hoisted(() => ({
  actual: { id: "eq-1", nombre: "Atlético Mineiro" },
  lista: [{ id: "eq-1", nombre: "Atlético Mineiro" }, { id: "eq-2", nombre: "Cruzeiro" }],
}));
const cuenta = vi.hoisted(() => ({
  email: "dt@club.com",
  userId: "u1",
  permisos: { partido: true, flujo: true, admin: false },
  cerrarSesion: null,
}));

vi.mock("./App", () => ({
  default: ({ intro }) => <div className="partido-de-prueba">Partido de prueba {intro === false ? "sin intro" : "con intro"}</div>,
}));
vi.mock("./TrainingModule", () => ({ default: () => <div className="flujo-de-prueba">Flujo de prueba</div> }));
vi.mock("./AccessGate.jsx", () => ({
  PantallaAcceso: ({ titulo, texto, children }) => (
    <main className="training-access-page">
      <h1>{titulo}</h1>
      <p>{texto}</p>
      {children}
    </main>
  ),
  default: ({ children }) => (
    <div className="puerta-de-prueba">
      {children({ email: cuenta.email, userId: cuenta.userId, permisos: cuenta.permisos, cerrarSesion: cuenta.cerrarSesion })}
    </div>
  ),
}));
vi.mock("./OpenFieldSession.jsx", () => ({
  default: ({ children }) => <div className="acceso-de-prueba">{typeof children === "function" ? children({ rol: "usuario" }) : children}</div>,
}));
vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => equipo.actual,
  guardarEquipoElegido: (elegido) => {
    equipo.actual = elegido;
  },
  cargarEquipos: async () => ({ equipos: equipo.lista }),
  crearEquipo: async (nombre) => ({ equipo: { id: "eq-nuevo", nombre } }),
  esElCam: (nombre) => nombre === "Atlético Mineiro",
}));
vi.mock("./CuentasAdmin.jsx", () => ({ default: ({ onVolver }) => <div className="cuentas-de-prueba"><button type="button" onClick={onVolver}>Volver al portal</button></div> }));
vi.mock("./domain/perfilesDb.js", async () => {
  const real = await vi.importActual("./domain/perfilesDb.js");
  return { permisosEnClub: real.permisosEnClub, contarPendientes: async () => 2 };
});
vi.mock("./DatosBasicos.jsx", () => ({ default: ({ onVolver }) => <div className="datos-de-prueba"><button type="button" onClick={onVolver}>Volver al portal</button></div> }));
vi.mock("./Lesiones.jsx", async () => {
  const { t } = await vi.importActual("./idioma/index.js");
  return {
    default: ({ onVolver, volverA }) => (
      <div className="lesiones-de-prueba">
        <button type="button" onClick={onVolver}>
          {t(volverA)}
        </button>
      </div>
    ),
  };
});

describe("el portal", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    vi.useFakeTimers();
    equipo.actual = { id: "eq-1", nombre: "Atlético Mineiro" };
    equipo.lista = [{ id: "eq-1", nombre: "Atlético Mineiro" }, { id: "eq-2", nombre: "Cruzeiro" }];
    cuenta.permisos = { partido: true, flujo: true, admin: false };
    cuenta.cerrarSesion = vi.fn();
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    window.history.replaceState({}, "", "/");
    vi.useRealTimers();
  });

  const montar = async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<PortalApp />);
    });
  };

  const tocar = async (etiqueta) => {
    await act(async () => contenedor.querySelector(`button[aria-label="${etiqueta}"]`).click());
  };

  const portada = () => contenedor.querySelector(".portal-portada");

  test("muestra quién entró, Salir, las tarjetas y el equipo elegido", async () => {
    await montar();

    expect(contenedor.querySelector(".portal-cuenta-correo").textContent).toBe("dt@club.com");
    await act(async () => contenedor.querySelector(".portal-salir").click());
    expect(cuenta.cerrarSesion).toHaveBeenCalledTimes(1);
    expect(contenedor.querySelector(".portal-kicker").textContent).toContain("Atlético Mineiro");
    expect(contenedor.querySelector('button[aria-label="Entrar a Partido"]')).not.toBeNull();
    expect(contenedor.querySelector('button[aria-label="Entrar a Flujo diario"]')).not.toBeNull();
    // Cada tarjeta lleva su foto y su ícono arriba a la izquierda.
    expect(contenedor.querySelector(".tarjeta-partido .portal-foto img").getAttribute("src")).toBe("/portal/partido.webp");
    expect(contenedor.querySelector(".tarjeta-flujo .portal-foto img").getAttribute("src")).toBe("/portal/flujo.webp");
    // Partido, Flujo diario y Datos básicos (que va con cualquier módulo).
    expect(contenedor.querySelectorAll(".portal-tarjeta .portal-icono svg")).toHaveLength(3);
    expect(portada()).toBeNull();
  });

  test("con algún módulo aparece también Datos básicos, con su dibujo, y entra sin portada", async () => {
    cuenta.permisos = { partido: true, flujo: true, datos: true, admin: false };
    await montar();
    expect(contenedor.querySelectorAll(".portal-tarjeta")).toHaveLength(3);
    const tarjeta = contenedor.querySelector('button[aria-label="Entrar a Datos básicos"]');
    expect(tarjeta).not.toBeNull();
    expect(tarjeta.classList.contains("tarjeta-datos")).toBe(true);
    expect(tarjeta.querySelector(".portal-foto img")).toBeNull();
    expect(tarjeta.querySelector(".portal-foto svg")).not.toBeNull();
    await tocar("Entrar a Datos básicos");
    await act(async () => vi.runAllTimers());
    expect(contenedor.querySelector(".datos-de-prueba")).not.toBeNull();
    await act(async () => contenedor.querySelector(".datos-de-prueba button").click());
    expect(contenedor.querySelectorAll(".portal-tarjeta")).toHaveLength(3);
  });

  test("quien ya se fue del club lo ve marcado en el portal y al elegir club; sin membresía no se elige", async () => {
    equipo.lista = [
      { id: "eq-1", nombre: "Atlético Mineiro", hasta: "2026-09-25", miembro: true },
      { id: "eq-2", nombre: "Cruzeiro", hasta: null, miembro: false },
    ];
    await montar();
    await act(async () => Promise.resolve());
    // Al volver al portal se relee la membresía y queda guardada en el celular.
    expect(equipo.actual).toMatchObject({ id: "eq-1", hasta: "2026-09-25" });
    expect(contenedor.querySelector(".portal-club-hasta").textContent).toBe("Hasta el 25/09/2026 · solo lectura");

    await act(async () => contenedor.querySelector(".portal-cambiar-club").click());
    const opciones = [...contenedor.querySelectorAll(".elegir-club-opcion")];
    expect(opciones.map((boton) => boton.querySelector(".elegir-club-detalle")?.textContent)).toEqual(["Hasta el 25/09/2026 · solo lectura", "No estás en este club"]);
    expect(opciones[0].disabled).toBe(false);
    expect(opciones[1].disabled).toBe(true);
  });

  test("si el administrador sacó a la cuenta del club, al volver al portal hay que elegir otro", async () => {
    equipo.lista = [{ id: "eq-2", nombre: "Cruzeiro" }];
    await montar();
    await act(async () => Promise.resolve());
    expect(equipo.actual).toBeNull();
    expect(contenedor.querySelector("h1").textContent).toBe("¿Con qué club trabajás?");
  });

  test("sin club elegido, lo primero es elegir el club; después aparece el portal con ese club", async () => {
    equipo.actual = null;
    await montar();
    await act(async () => Promise.resolve());

    expect(contenedor.querySelector(".portal-encabezado")).toBeNull();
    expect(contenedor.querySelector("h1").textContent).toBe("¿Con qué club trabajás?");
    const opciones = [...contenedor.querySelectorAll(".elegir-club-opcion")];
    expect(opciones.map((boton) => boton.querySelector(".elegir-club-nombre").textContent)).toEqual(["Atlético Mineiro", "Cruzeiro"]);

    await act(async () => opciones[1].click());
    expect(equipo.actual).toEqual({ id: "eq-2", nombre: "Cruzeiro" });
    expect(contenedor.querySelector(".portal-kicker").textContent).toContain("Cruzeiro");
    expect(contenedor.querySelector(".portal-encabezado h1").textContent).toBe("¿Qué vas a hacer hoy?");

    // Desde el portal se puede volver a elegir.
    await act(async () => contenedor.querySelector(".portal-cambiar-club").click());
    expect(contenedor.querySelector("h1").textContent).toBe("¿Con qué club trabajás?");
  });

  test("al tocar Partido muestra la portada con su foto y entra sin la intro", async () => {
    await montar();
    await tocar("Entrar a Partido");

    // La portada tapa la pantalla: atrás la foto de la tarjeta borrosa, adelante
    // la misma foto entera y el nombre...
    const cubierta = portada();
    expect(cubierta).not.toBeNull();
    expect(cubierta.classList.contains("tarjeta-partido")).toBe(true);
    expect(cubierta.querySelector(".portal-portada-fondo img").getAttribute("src")).toBe("/portal/partido.webp");
    expect(cubierta.querySelector(".portal-portada-foto img").getAttribute("src")).toBe("/portal/partido.webp");
    expect(cubierta.querySelector(".portal-portada-texto strong").textContent).toBe("Partido");
    // ...con la foto ya pedida tapando la pantalla entera (el zoom desde la
    // tarjeta lo hace la hoja de estilos).
    expect(cubierta.classList.contains("llena")).toBe(true);
    expect(cubierta.classList.contains("de-una")).toBe(false);
    const lugar = lugarEnPantalla(window.innerWidth, window.innerHeight);
    const caja = cubierta.querySelector(".portal-portada-foto");
    expect(parseFloat(caja.style.width)).toBeCloseTo(lugar.width, 1);
    expect(parseFloat(caja.style.height)).toBeCloseTo(lugar.height, 1);
    expect(parseFloat(caja.style.left)).toBeCloseTo(lugar.left, 1);
    expect(lugar.width).toBeGreaterThanOrEqual(window.innerWidth);
    expect(lugar.height).toBeGreaterThanOrEqual(window.innerHeight);
    // Mientras tanto Partido ya está cargado abajo, sin su propia intro.
    expect(contenedor.querySelector(".partido-de-prueba").textContent).toContain("sin intro");
    expect(contenedor.querySelector(".portal-tarjeta")).toBeNull();

    // Pasado el zoom y la foto quieta, se va...
    await act(async () => vi.advanceTimersByTime(TIEMPOS_PORTADA.zoom + TIEMPOS_PORTADA.quieta));
    expect(portada().classList.contains("saliendo")).toBe(true);

    // ...y al terminar de irse no queda nada encima de Partido.
    await act(async () => vi.advanceTimersByTime(TIEMPOS_PORTADA.salida));
    expect(portada()).toBeNull();
    expect(contenedor.querySelector(".partido-de-prueba")).not.toBeNull();
  });

  test("al tocar Flujo diario muestra su portada y pasa por la puerta de acceso", async () => {
    await montar();
    await tocar("Entrar a Flujo diario");

    const cubierta = portada();
    expect(cubierta.classList.contains("tarjeta-flujo")).toBe(true);
    expect(cubierta.querySelector(".portal-portada-foto img").getAttribute("src")).toBe("/portal/flujo.webp");
    expect(cubierta.querySelector(".portal-portada-texto strong").textContent).toBe("Flujo diario");
    expect(contenedor.querySelector(".acceso-de-prueba .flujo-de-prueba")).not.toBeNull();

    await act(async () =>
      vi.advanceTimersByTime(TIEMPOS_PORTADA.zoom + TIEMPOS_PORTADA.quieta + TIEMPOS_PORTADA.salida),
    );
    expect(portada()).toBeNull();
    expect(contenedor.querySelector(".flujo-de-prueba")).not.toBeNull();
  });

  test("Bases de Datos: entra con su foto y su portada, adentro una tarjeta por base y se vuelve a los módulos", async () => {
    equipo.actual = { id: "eq-1", nombre: "Atlético Mineiro", rol: "staff", partido: true, flujo: false, lesiones: true };
    equipo.lista = [{ ...equipo.actual }];
    await montar();
    await act(async () => Promise.resolve());

    // En el portal ya no está Lesiones: está Bases de Datos, con la foto que tenía.
    expect(contenedor.querySelector('button[aria-label="Entrar a Lesiones"]')).toBeNull();
    const tarjeta = contenedor.querySelector('button[aria-label="Entrar a Bases de Datos"]');
    expect(tarjeta.classList.contains("tarjeta-bases")).toBe(true);
    expect(tarjeta.querySelector(".portal-foto img").getAttribute("src")).toBe("/portal/bases.webp");
    expect(tarjeta.querySelector(".portal-beta").textContent).toBe("Nuevo");

    await tocar("Entrar a Bases de Datos");
    const cubierta = portada();
    expect(cubierta.classList.contains("tarjeta-bases")).toBe(true);
    expect(cubierta.querySelector(".portal-portada-texto strong").textContent).toBe("Bases de Datos");
    await act(async () => vi.runAllTimers());
    expect(portada()).toBeNull();

    // Adentro, la cara del portal: el club, el título y una tarjeta por base.
    expect(contenedor.querySelector(".bases-datos .portal-kicker").textContent).toContain("Atlético Mineiro");
    expect(contenedor.querySelector(".bases-datos h1").textContent).toBe("Bases de Datos");
    expect([...contenedor.querySelectorAll(".bases-datos .portal-tarjeta")].map((boton) => boton.getAttribute("aria-label"))).toEqual(["Entrar a Lesiones"]);

    // Lesiones entra con su portada y vuelve a las bases, no a los módulos.
    await tocar("Entrar a Lesiones");
    expect(portada().classList.contains("tarjeta-lesiones")).toBe(true);
    expect(portada().querySelector(".portal-portada-texto strong").textContent).toBe("Lesiones");
    await act(async () => vi.runAllTimers());
    const volverALasBases = contenedor.querySelector(".lesiones-de-prueba button");
    expect(volverALasBases.textContent).toBe("Bases");
    await act(async () => volverALasBases.click());
    expect(contenedor.querySelector(".bases-datos h1").textContent).toBe("Bases de Datos");

    // Y de las bases, a los módulos.
    await act(async () => contenedor.querySelector(".bases-volver").click());
    expect(contenedor.querySelector(".portal-encabezado h1").textContent).toBe("¿Qué vas a hacer hoy?");
    expect(contenedor.querySelector('button[aria-label="Entrar a Bases de Datos"]')).not.toBeNull();
  });

  test("el administrador ve Cuentas con las pendientes, entra y vuelve; los demás no lo ven", async () => {
    cuenta.permisos = { partido: true, flujo: true, admin: true };
    await montar();
    await act(async () => Promise.resolve());

    const cuentas = contenedor.querySelector(".portal-cuentas");
    expect(cuentas).not.toBeNull();
    expect(cuentas.querySelector(".portal-pendientes").textContent).toBe("2");
    await act(async () => cuentas.click());
    expect(contenedor.querySelector(".cuentas-de-prueba")).not.toBeNull();
    expect(contenedor.querySelector(".portal-tarjeta")).toBeNull();

    await act(async () => contenedor.querySelector(".cuentas-de-prueba button").click());
    expect(contenedor.querySelector(".portal-tarjeta")).not.toBeNull();

    await act(async () => raiz.unmount());
    raiz = null;
    cuenta.permisos = { partido: true, flujo: true, admin: false };
    await montar();
    expect(contenedor.querySelector(".portal-cuentas")).toBeNull();
  });

  test("solo muestra las tarjetas que la cuenta tiene habilitadas (y Datos básicos con cualquiera)", async () => {
    cuenta.permisos = { partido: true, flujo: false, admin: false };
    await montar();

    expect(contenedor.querySelector('button[aria-label="Entrar a Partido"]')).not.toBeNull();
    expect(contenedor.querySelector('button[aria-label="Entrar a Flujo diario"]')).toBeNull();
    expect(contenedor.querySelector('button[aria-label="Entrar a Datos básicos"]')).not.toBeNull();
  });

  test("en cada club valen los módulos de la membresía, y su administrador ve Cuentas", async () => {
    // La cuenta dice Partido y Flujo, pero en este club es admin con solo Lesiones.
    equipo.actual = { id: "eq-1", nombre: "Atlético Mineiro", rol: "admin", partido: false, flujo: false, lesiones: true };
    equipo.lista = [{ ...equipo.actual }];
    cuenta.permisos = { partido: true, flujo: true, admin: false };
    await montar();
    await act(async () => Promise.resolve());

    expect(contenedor.querySelector('button[aria-label="Entrar a Partido"]')).toBeNull();
    expect(contenedor.querySelector('button[aria-label="Entrar a Flujo diario"]')).toBeNull();
    expect(contenedor.querySelector('button[aria-label="Entrar a Bases de Datos"]')).not.toBeNull();
    const cuentas = contenedor.querySelector(".portal-cuentas");
    expect(cuentas).not.toBeNull();
    // Las pendientes de la app son cosa del dueño, no del admin del club.
    expect(cuentas.querySelector(".portal-pendientes")).toBeNull();
    await act(async () => cuentas.click());
    expect(contenedor.querySelector(".cuentas-de-prueba")).not.toBeNull();
  });

  test("si el admin del club cambia los módulos, al volver al portal se ven los nuevos", async () => {
    equipo.actual = { id: "eq-1", nombre: "Atlético Mineiro", rol: "staff", partido: true, flujo: false, lesiones: false };
    equipo.lista = [{ ...equipo.actual, flujo: true }];
    cuenta.permisos = { partido: true, flujo: true, admin: false };
    await montar();
    await act(async () => Promise.resolve());

    expect(equipo.actual.flujo).toBe(true);
    expect(contenedor.querySelector('button[aria-label="Entrar a Flujo diario"]')).not.toBeNull();
    expect(contenedor.querySelector(".portal-cuentas")).toBeNull();
  });

  test("si la foto no carga, la portada muestra el dibujo", async () => {
    await montar();
    await tocar("Entrar a Partido");

    const imagen = portada().querySelector(".portal-portada-foto img");
    await act(async () => imagen.dispatchEvent(new Event("error")));
    expect(portada().querySelector(".portal-portada-foto img")).toBeNull();
    expect(portada().querySelector(".portal-portada-foto .portal-arte")).not.toBeNull();
  });
});

describe("el lugar de la foto en la portada", () => {
  test("en el celular parado la foto apaisada se agranda hasta tapar la pantalla", () => {
    const lugar = lugarEnPantalla(390, 844);
    // Tan alta como la pantalla y, por la forma de la foto, mucho más ancha:
    // lo que sobra queda afuera, mitad de cada lado.
    expect(lugar.height).toBe(844);
    expect(lugar.width).toBeCloseTo(1500.4, 0);
    expect(lugar.top).toBe(0);
    expect(lugar.left).toBeCloseTo(-555.2, 0);
    expect(lugar.left + lugar.width).toBeCloseTo(390 + 555.2, 0);
  });

  test("el foco elige qué parte queda a la vista", () => {
    // Con el foco a la izquierda casi no se corta de ese lado.
    const lugar = lugarEnPantalla(390, 844, { foco: [0.18, 0.5] });
    expect(lugar.left).toBeCloseTo(-(1500.4 - 390) * 0.18, 0);
    expect(lugarEnPantalla(390, 844, { foco: [0, 0] }).left).toBe(0);
  });

  test("una foto parada tapa la pantalla del celular casi sin recortar", () => {
    const lugar = lugarEnPantalla(390, 844, { proporcion: 9 / 16 });
    expect(lugar.height).toBe(844);
    expect(lugar.width).toBeCloseTo(474.75, 1);
    expect(lugar.left).toBeCloseTo(-42.4, 0);
  });

  test("en la computadora tapa la pantalla entera con un recorte chico", () => {
    const lugar = lugarEnPantalla(1280, 860);
    expect(lugar.height).toBe(860);
    expect(lugar.width).toBeCloseTo(1528.9, 0);
    expect(lugar.top).toBe(0);
    expect(lugar.left).toBeCloseTo(-124.4, 0);
  });
});

describe("la foto de la portada", () => {
  const tarjeta = { foto: "/portal/x.webp", fotoParada: "/portal/x-parada.webp" };

  test("en el celular parado usa la foto parada si la tarjeta la tiene", () => {
    expect(fotoDePortada(tarjeta, 390, 844)).toEqual({ src: "/portal/x-parada.webp", parada: true });
    expect(fotoDePortada({ ...tarjeta, fotoParada: null }, 390, 844)).toEqual({ src: "/portal/x.webp", parada: false });
  });

  test("apaisado usa siempre la foto de la tarjeta", () => {
    expect(fotoDePortada(tarjeta, 1280, 860)).toEqual({ src: "/portal/x.webp", parada: false });
  });
});

describe("la portada con foto parada", () => {
  let contenedor;
  let raiz;
  let tamano;

  beforeEach(() => {
    vi.useFakeTimers();
    tamano = [window.innerWidth, window.innerHeight];
    window.innerWidth = 390;
    window.innerHeight = 844;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    [window.innerWidth, window.innerHeight] = tamano;
    vi.useRealTimers();
  });

  test("arranca desde la foto de la tarjeta y se funde con la parada, que tapa la pantalla", async () => {
    const tarjeta = {
      clase: "tarjeta-prueba",
      foto: "/portal/x.webp",
      fotoParada: "/portal/x-parada.webp",
      foco: [0.5, 0.5],
      focoParada: [0.2, 0.5],
      Arte: () => <svg className="portal-arte" />,
      Icono: () => <svg />,
      titulo: "Prueba",
    };
    const terminar = vi.fn();
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<Portada tarjeta={tarjeta} desde={{ top: 100, left: 14, width: 362, height: 204 }} onTerminar={terminar} />);
    });

    const cubierta = contenedor.querySelector(".portal-portada");
    expect(cubierta.classList.contains("llena")).toBe(true);
    // Abajo la foto de la tarjeta (de donde arranca el zoom), arriba la parada.
    const fotos = cubierta.querySelectorAll(".portal-portada-foto .portal-foto");
    expect(fotos).toHaveLength(2);
    expect(fotos[0].querySelector("img").getAttribute("src")).toBe("/portal/x.webp");
    expect(fotos[1].classList.contains("foto-parada")).toBe(true);
    expect(fotos[1].querySelector("img").getAttribute("src")).toBe("/portal/x-parada.webp");
    // Y atrás, borrosa, la parada.
    expect(cubierta.querySelector(".portal-portada-fondo img").getAttribute("src")).toBe("/portal/x-parada.webp");
    // La caja termina tan alta como la pantalla y apenas más ancha, corrida
    // según el foco de la foto parada.
    const caja = cubierta.querySelector(".portal-portada-foto");
    expect(parseFloat(caja.style.height)).toBe(844);
    expect(parseFloat(caja.style.width)).toBeCloseTo(474.75, 1);
    expect(parseFloat(caja.style.left)).toBeCloseTo(-(474.75 - 390) * 0.2, 1);

    await act(async () =>
      vi.advanceTimersByTime(TIEMPOS_PORTADA.zoom + TIEMPOS_PORTADA.quieta + TIEMPOS_PORTADA.salida),
    );
    expect(terminar).toHaveBeenCalledTimes(1);
  });
});

describe("el portal en el celular, parado", () => {
  let contenedor;
  let raiz;
  let tamano;

  beforeEach(() => {
    vi.useFakeTimers();
    tamano = [window.innerWidth, window.innerHeight];
    window.innerWidth = 390;
    window.innerHeight = 844;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    [window.innerWidth, window.innerHeight] = tamano;
    vi.useRealTimers();
  });

  test("la portada de cada tarjeta usa su foto parada", async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<PortalApp />);
    });
    await act(async () => contenedor.querySelector('button[aria-label="Entrar a Flujo diario"]').click());

    const cubierta = contenedor.querySelector(".portal-portada");
    expect(cubierta.querySelector(".portal-portada-foto .foto-parada img").getAttribute("src")).toBe("/portal/flujo-parada.webp");
    expect(cubierta.querySelector(".portal-portada-fondo img").getAttribute("src")).toBe("/portal/flujo-parada.webp");
    const caja = cubierta.querySelector(".portal-portada-foto");
    expect(parseFloat(caja.style.height)).toBe(844);
    expect(parseFloat(caja.style.width)).toBeCloseTo(474.75, 1);
  });
});
