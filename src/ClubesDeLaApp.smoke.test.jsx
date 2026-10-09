import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// La base de mentira: lo que devuelve cada RPC del panel y las llamadas que
// se hicieron. Cada prueba la arma a su gusto.
const base = vi.hoisted(() => ({
  llamadas: [],
  clubes: [],
  duenos: [],
  pedidos: [],
  movimientos: [],
  // Errores por función: { panel_clubes: { code, message } }.
  errores: {},
}));

vi.mock("./supabase.js", () => ({
  supabase: {
    rpc: (funcion, parametros) => {
      base.llamadas.push({ funcion, parametros });
      const error = base.errores[funcion] || null;
      const datos = {
        panel_clubes: base.clubes,
        panel_duenos: base.duenos,
        pedidos_sin_club: base.pedidos,
        panel_historial: base.movimientos,
        crear_club: "nuevo-id",
      };
      return Promise.resolve(error ? { data: null, error } : { data: datos[funcion] ?? null, error: null });
    },
  },
}));

const { default: ClubesDeLaApp } = await import("./ClubesDeLaApp.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");
const { ZONAS_DE_CLUB } = await import("./domain/plataformaDb.js");

const CLUB_UNO = { equipo_id: "c1", nombre: "Club Uno", correo_entidad: "ent@uno.com", correo_admin: "ana@uno.com", personas: 3 };
const CLUB_DOS = { equipo_id: "c2", nombre: "Club Dos", correo_entidad: null, correo_admin: null, personas: 1 };
const PRINCIPAL = { user_id: "p", email: "duenio@prueba.com", principal: true, es_mia: true };
const SUB = { user_id: "s", email: "subduenia@prueba.com", principal: false, es_mia: false };

describe("Clubes de la app", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    base.llamadas = [];
    base.clubes = [CLUB_UNO, CLUB_DOS];
    base.duenos = [PRINCIPAL, SUB];
    base.pedidos = [];
    base.movimientos = [];
    base.errores = {};
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    fijarIdiomaParaPruebas("es-AR");
  });

  const montar = async (props = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<ClubesDeLaApp miUserId="p" esPrincipal onVolver={() => {}} {...props} />);
    });
    await act(async () => Promise.resolve());
  };

  const texto = () => contenedor.textContent;
  const fila = (selector, contenido) => [...contenedor.querySelectorAll(selector)].find((li) => li.querySelector(".cuenta-correo").textContent === contenido);
  const boton = (dentro, etiqueta) => [...dentro.querySelectorAll("button")].find((b) => b.textContent.trim() === etiqueta);
  const tocar = async (elemento) => {
    expect(elemento, "no se encontró el botón").toBeTruthy();
    await act(async () => elemento.click());
    await act(async () => Promise.resolve());
  };
  const escribir = async (input, valor) => {
    const prototipo = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototipo, "value").set.call(input, valor);
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
  };
  const llamadasA = (funcion) => base.llamadas.filter((llamada) => llamada.funcion === funcion);
  // El aviso de arriba: lo que salió bien no lleva el rojo del error.
  const tonoDelAviso = () => (contenedor.querySelector('.cuentas-aviso[role="status"]')?.classList.contains("ok") ? "ok" : "error");

  test("cada club muestra solo nombre, entidad, administrador y cantidad de personas", async () => {
    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe("Clubes de la app");
    const uno = fila(".panel-club", "Club Uno");
    expect([...uno.querySelectorAll(".panel-club-datos span")].map((s) => s.textContent)).toEqual([
      "Entidad: ent@uno.com",
      "Administrador: ana@uno.com",
      "3 personas",
    ]);
    const dos = fila(".panel-club", "Club Dos");
    expect(dos.querySelector(".panel-club-datos").textContent).toBe("Sin entidadSin administrador1 persona");
    // Desde acá no se entra al club ni se ve su gente: la entidad y el nombre.
    // Cada botón dice sobre qué es (no un «Cambiar» suelto al lado de «Cambiar nombre»).
    expect(boton(uno, "Cambiar entidad")).toBeTruthy();
    expect(boton(uno, "Sacar entidad")).toBeTruthy();
    expect(boton(uno, "Cambiar nombre")).toBeTruthy();
    expect(boton(dos, "Asignar entidad")).toBeTruthy();
    expect(boton(dos, "Cambiar nombre")).toBeTruthy();
    expect(uno.querySelectorAll("button")).toHaveLength(3);
    // Cambiar el nombre es una acción secundaria, como Sacar.
    expect(boton(uno, "Cambiar nombre").className).toBe("cuenta-quitar");
    expect(llamadasA("panel_clubes")).toHaveLength(1);

    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    expect([...fila(".panel-club", "Club Uno").querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      "Trocar entidade",
      "Remover entidade",
      "Trocar nome",
    ]);
    expect(boton(fila(".panel-club", "Club Dos"), "Definir entidade")).toBeTruthy();
  });

  test("el principal ve los botones de los dueños; el sub-dueño, solo el aviso", async () => {
    await montar();
    const sub = fila(".panel-dueno", "subduenia@prueba.com");
    const principal = fila(".panel-dueno", "duenio@prueba.com");
    expect([...principal.querySelectorAll(".cuenta-etiqueta")].map((e) => e.textContent)).toEqual(["Dueño principal", "Tu cuenta"]);
    expect(principal.querySelector("button")).toBeNull();
    expect(boton(sub, "Quitar")).toBeTruthy();
    expect(boton(sub, "Pasar el rol de dueño principal")).toBeTruthy();
    expect(contenedor.querySelector(".panel-sumar")).not.toBeNull();
    expect(texto()).not.toContain("Solo el dueño principal suma o quita dueños.");

    await act(async () => raiz.unmount());
    base.duenos = [
      { ...PRINCIPAL, es_mia: false },
      { ...SUB, es_mia: true },
    ];
    await montar({ miUserId: "s", esPrincipal: false });
    expect(contenedor.querySelector(".panel-dueno button")).toBeNull();
    expect(contenedor.querySelector(".panel-sumar")).toBeNull();
    expect(texto()).toContain("Solo el dueño principal suma o quita dueños.");
    // El sub-dueño igual crea clubes, asigna entidades y cambia nombres.
    expect(contenedor.querySelector(".panel-crear")).not.toBeNull();
    expect(boton(fila(".panel-club", "Club Dos"), "Asignar entidad")).toBeTruthy();
    expect(boton(fila(".panel-club", "Club Dos"), "Cambiar nombre")).toBeTruthy();
  });

  test("crear un club con nombre, entidad y zona; no se suma a quien lo crea", async () => {
    await montar();
    const formulario = contenedor.querySelector(".panel-crear");
    const [nombre, correo] = formulario.querySelectorAll("input");
    await escribir(nombre, "Club Tres");
    await escribir(correo, "Ent@Tres.com");
    await escribir(formulario.querySelector("select"), "America/Montevideo");
    await tocar(boton(formulario, "Crear club"));
    expect(llamadasA("crear_club")).toEqual([
      { funcion: "crear_club", parametros: { p_nombre: "Club Tres", p_correo_entidad: "ent@tres.com", p_zona: "America/Montevideo" } },
    ]);
    expect(texto()).toContain("Club Tres quedó creado. Vos no quedás adentro");
    // Se vuelve a leer el panel.
    expect(llamadasA("panel_clubes")).toHaveLength(2);
    expect(nombre.value).toBe("");
    expect(formulario.querySelector("select").value).toBe("America/Sao_Paulo");
  });

  test("la zona horaria se elige por su nombre escrito a mano, en el idioma de la app; se guarda la zona", async () => {
    await montar();
    const opciones = () => [...contenedor.querySelectorAll(".panel-crear select option")].map((opcion) => [opcion.value, opcion.textContent]);
    expect(opciones()).toEqual([
      ["America/Sao_Paulo", "São Paulo"],
      ["America/Argentina/Buenos_Aires", "Buenos Aires"],
      ["America/Montevideo", "Montevideo"],
      ["America/Santiago", "Santiago"],
      ["America/Asuncion", "Asunción"],
      ["America/Bogota", "Bogotá"],
      ["America/Lima", "Lima"],
      ["America/Mexico_City", "Ciudad de México"],
      ["Europe/Madrid", "Madrid"],
      ["Europe/Lisbon", "Lisboa"],
    ]);

    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    expect(opciones().map(([, nombre]) => nombre)).toEqual([
      "São Paulo",
      "Buenos Aires",
      "Montevidéu",
      "Santiago",
      "Assunção",
      "Bogotá",
      "Lima",
      "Cidade do México",
      "Madri",
      "Lisboa",
    ]);
    // Lo que se guarda no cambia: la zona.
    expect(opciones().map(([valor]) => valor)).toEqual([...ZONAS_DE_CLUB]);
  });

  test("asignar, cambiar (confirmando el anterior y el nuevo) y sacar la entidad", async () => {
    await montar();
    await tocar(boton(fila(".panel-club", "Club Dos"), "Asignar entidad"));
    await escribir(contenedor.querySelector("#panel-correo-entidad"), "nueva@dos.com");
    await tocar(boton(contenedor.querySelector(".cuentas-hoja"), "Guardar"));
    expect(llamadasA("asignar_entidad").at(-1).parametros).toEqual({ p_equipo: "c2", p_correo: "nueva@dos.com" });
    expect(texto()).toContain("Listo: la entidad de Club Dos es nueva@dos.com.");

    await tocar(boton(fila(".panel-club", "Club Uno"), "Cambiar entidad"));
    await escribir(contenedor.querySelector("#panel-correo-entidad"), "otra@uno.com");
    await tocar(boton(contenedor.querySelector(".cuentas-hoja"), "Guardar"));
    // Todavía no cambió: pide confirmar mostrando los dos correos.
    expect(llamadasA("asignar_entidad")).toHaveLength(1);
    expect(contenedor.querySelector(".hoja-confirmar").textContent).toContain("Antes: ent@uno.com. Ahora: otra@uno.com.");
    await tocar(boton(contenedor.querySelector(".hoja-confirmar"), "Sí, cambiar"));
    expect(llamadasA("asignar_entidad").at(-1).parametros).toEqual({ p_equipo: "c1", p_correo: "otra@uno.com" });

    await tocar(boton(fila(".panel-club", "Club Uno"), "Sacar entidad"));
    expect(contenedor.querySelector(".hoja-confirmar").textContent).toContain("ent@uno.com deja de figurar como entidad del club.");
    await tocar(boton(contenedor.querySelector(".hoja-confirmar"), "Sí, sacar"));
    expect(llamadasA("asignar_entidad").at(-1).parametros).toEqual({ p_equipo: "c1", p_correo: null });
  });

  test("cambiar el nombre de un club: se escribe, se confirma con el anterior y el nuevo, y llama a renombrar_club", async () => {
    await montar();
    await tocar(boton(fila(".panel-club", "Club Uno"), "Cambiar nombre"));
    const hoja = contenedor.querySelector(".cuentas-hoja");
    expect(hoja.textContent).toContain("Nombre de Club Uno");
    const campo = contenedor.querySelector("#panel-nombre-club");
    expect(campo.value).toBe("Club Uno");
    expect(campo.maxLength).toBe(60);
    // Sin cambios o vacío, no hay nada que guardar.
    expect(boton(hoja, "Guardar").disabled).toBe(true);
    await escribir(campo, "   ");
    expect(boton(hoja, "Guardar").disabled).toBe(true);

    // Cancelar no cambia nada.
    await escribir(campo, "Club Unido");
    await tocar(boton(contenedor.querySelector(".cuentas-hoja"), "Guardar"));
    expect(llamadasA("renombrar_club")).toHaveLength(0);
    const confirmar = contenedor.querySelector(".hoja-confirmar");
    expect(confirmar.textContent).toContain("¿Cambiar el nombre de Club Uno?");
    expect(confirmar.textContent).toContain("Antes: Club Uno. Ahora: Club Unido.");
    await tocar(boton(confirmar, "Cancelar"));
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(llamadasA("renombrar_club")).toHaveLength(0);

    await tocar(boton(fila(".panel-club", "Club Uno"), "Cambiar nombre"));
    await escribir(contenedor.querySelector("#panel-nombre-club"), "  Club Unido ");
    await tocar(boton(contenedor.querySelector(".cuentas-hoja"), "Guardar"));
    await tocar(boton(contenedor.querySelector(".hoja-confirmar"), "Sí, cambiar"));
    expect(llamadasA("renombrar_club")).toEqual([{ funcion: "renombrar_club", parametros: { p_equipo: "c1", p_nombre: "Club Unido" } }]);
    expect(texto()).toContain("Listo: Club Uno ahora se llama Club Unido.");
    expect(tonoDelAviso()).toBe("ok");
    // Se vuelve a leer el panel.
    expect(llamadasA("panel_clubes")).toHaveLength(2);
  });

  test("cambiar el nombre: los espacios de más se limpian como en la base (el mismo nombre no se guarda)", async () => {
    await montar();
    await tocar(boton(fila(".panel-club", "Club Uno"), "Cambiar nombre"));
    const campo = contenedor.querySelector("#panel-nombre-club");
    // Solo con espacios de más en el medio es el mismo nombre: la base no
    // cambiaría nada ni lo anotaría.
    await escribir(campo, "Club  Uno");
    expect(boton(contenedor.querySelector(".cuentas-hoja"), "Guardar").disabled).toBe(true);
    await escribir(campo, "  Club   Uno ");
    expect(boton(contenedor.querySelector(".cuentas-hoja"), "Guardar").disabled).toBe(true);

    // Con un nombre distinto, la confirmación y el aviso muestran el nombre limpio.
    await escribir(campo, " Club   Unido ");
    await tocar(boton(contenedor.querySelector(".cuentas-hoja"), "Guardar"));
    expect(contenedor.querySelector(".hoja-confirmar").textContent).toContain("Antes: Club Uno. Ahora: Club Unido.");
    await tocar(boton(contenedor.querySelector(".hoja-confirmar"), "Sí, cambiar"));
    expect(llamadasA("renombrar_club")).toEqual([{ funcion: "renombrar_club", parametros: { p_equipo: "c1", p_nombre: "Club Unido" } }]);
    expect(texto()).toContain("Listo: Club Uno ahora se llama Club Unido.");
  });

  test("cambiar el nombre: los errores de la base se leen en el idioma de la app", async () => {
    const intentar = async (nombre) => {
      await tocar(boton(fila(".panel-club", "Club Uno"), "Cambiar nombre"));
      await escribir(contenedor.querySelector("#panel-nombre-club"), nombre);
      await tocar(boton(contenedor.querySelector(".cuentas-hoja"), "Guardar"));
      await tocar(contenedor.querySelector(".hoja-confirmar .boton-confirmar-hoja"));
    };
    await montar();
    const casos = [
      ["nombre_repetido", "P0001", "Ya hay un club con ese nombre."],
      ["nombre_invalido", "P0001", "Escribí el nombre del club (hasta 60 letras)."],
      ["solo_duenos", "42501", "Este panel es solo para los dueños de la app."],
      ["club_inexistente", "P0001", "Ese club ya no existe."],
    ];
    for (const [codigo, code, esperado] of casos) {
      base.errores.renombrar_club = { code, message: codigo };
      await intentar("Club Dos");
      expect(contenedor.querySelector(".cuentas-aviso").textContent, codigo).toBe(esperado);
      expect(tonoDelAviso(), codigo).toBe("error");
    }
    expect(llamadasA("renombrar_club")).toHaveLength(4);

    await act(async () => raiz.unmount());
    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    await montar();
    base.errores.renombrar_club = { code: "P0001", message: "nombre_repetido" };
    await tocar(boton(fila(".panel-club", "Club Uno"), "Trocar nome"));
    await escribir(contenedor.querySelector("#panel-nombre-club"), "CLUB  dós");
    await tocar(boton(contenedor.querySelector(".cuentas-hoja"), "Salvar"));
    expect(contenedor.querySelector(".hoja-confirmar").textContent).toContain("Trocar o nome de Club Uno?");
    await tocar(boton(contenedor.querySelector(".hoja-confirmar"), "Sim, trocar"));
    expect(texto()).toContain("Já existe um clube com esse nome.");
    expect(texto()).not.toContain("nombre_repetido");
  });

  test("los errores de la base se leen en el idioma de la app", async () => {
    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    base.errores.asignar_entidad = { code: "P0001", message: "entidad_es_dueno" };
    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe("Clubes do app");
    await tocar(boton(fila(".panel-club", "Club Dos"), "Definir entidade"));
    await escribir(contenedor.querySelector("#panel-correo-entidad"), "duenio@prueba.com");
    await tocar(boton(contenedor.querySelector(".cuentas-hoja"), "Salvar"));
    expect(texto()).toContain("Um dono do app não pode ser a entidade de um clube.");
    expect(texto()).not.toContain("entidad_es_dueno");
  });

  test("si falta la migración, lo dice y deja reintentar", async () => {
    base.errores.panel_clubes = { code: "PGRST202", message: "Could not find the function public.panel_clubes without parameters" };
    await montar();
    expect(contenedor.querySelector(".cuentas-aviso").textContent).toContain("Falta actualizar la base (dueños y pedidos).");
    expect(contenedor.querySelector(".panel-crear")).toBeNull();
    delete base.errores.panel_clubes;
    await tocar(boton(contenedor, "Reintentar"));
    expect(fila(".panel-club", "Club Uno")).toBeTruthy();
  });

  test("los pedidos a clubes que no están: se mandan a un club o se rechazan con confirmación", async () => {
    base.pedidos = [
      { id: "p1", email: "nadie@prueba.com", club_escrito: "Club Seis", pais_escrito: "Uruguay", creado_en: "2026-10-05T12:00:00Z" },
      { id: "p2", email: "otra@prueba.com", club_escrito: "Club Siete", pais_escrito: null, creado_en: "2026-10-04T12:00:00Z" },
    ];
    await montar();
    const pedido = fila(".panel-pedido", "nadie@prueba.com");
    expect(pedido.querySelector(".cuenta-meta").textContent).toContain("Escribió: Club Seis");
    expect(pedido.querySelector(".cuenta-meta").textContent).toContain("País: Uruguay");

    await tocar(boton(pedido, "Mandar a un club"));
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Club Uno"));
    expect(llamadasA("derivar_pedido")).toEqual([{ funcion: "derivar_pedido", parametros: { p_id: "p1", p_equipo: "c1" } }]);
    expect(texto()).toContain("El pedido de nadie@prueba.com pasó a Club Uno: ahora decide su administrador.");

    await tocar(boton(fila(".panel-pedido", "otra@prueba.com"), "Rechazar"));
    expect(llamadasA("rechazar_pedido_sin_club")).toHaveLength(0);
    await tocar(boton(contenedor.querySelector(".hoja-confirmar"), "Sí, rechazar"));
    expect(llamadasA("rechazar_pedido_sin_club")).toEqual([{ funcion: "rechazar_pedido_sin_club", parametros: { p_id: "p2" } }]);
    // Los dueños nunca aceptan a nadie en un club.
    expect(texto()).not.toContain("Aceptar");
  });

  test("al mandar un pedido, un club sin administrador se ve deshabilitado y no se elige", async () => {
    base.pedidos = [{ id: "p1", email: "nadie@prueba.com", club_escrito: "Club Dos", pais_escrito: null, creado_en: "2026-10-05T12:00:00Z" }];
    await montar();
    expect(texto()).toContain("o que todavía no tiene administrador");
    await tocar(boton(fila(".panel-pedido", "nadie@prueba.com"), "Mandar a un club"));
    const opciones = [...contenedor.querySelectorAll(".opcion-hoja")];
    const dos = opciones.find((b) => b.textContent.startsWith("Club Dos"));
    const uno = opciones.find((b) => b.textContent.startsWith("Club Uno"));
    expect(dos.disabled).toBe(true);
    expect(dos.querySelector(".opcion-hoja-detalle").textContent).toBe("Sin administrador");
    expect(uno.disabled).toBe(false);
    expect(uno.querySelector(".opcion-hoja-detalle")).toBeNull();
    await act(async () => dos.click());
    expect(llamadasA("derivar_pedido")).toHaveLength(0);
    await tocar(uno);
    expect(llamadasA("derivar_pedido")).toEqual([{ funcion: "derivar_pedido", parametros: { p_id: "p1", p_equipo: "c1" } }]);
  });

  test("si el club se quedó sin administrador mientras tanto, la base no deja y lo dice", async () => {
    base.pedidos = [{ id: "p1", email: "nadie@prueba.com", club_escrito: "Club Seis", pais_escrito: null, creado_en: "2026-10-05T12:00:00Z" }];
    base.errores.derivar_pedido = { code: "P0001", message: "club_sin_admin" };
    await montar();
    await tocar(boton(fila(".panel-pedido", "nadie@prueba.com"), "Mandar a un club"));
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Club Uno"));
    expect(texto()).toContain("Ese club todavía no tiene administrador: el pedido no se puede mandar ahí.");
    expect(texto()).not.toContain("club_sin_admin");
    // El pedido sigue esperando en el panel.
    expect(fila(".panel-pedido", "nadie@prueba.com")).toBeTruthy();

    await act(async () => raiz.unmount());
    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    await montar();
    await tocar(boton(fila(".panel-pedido", "nadie@prueba.com"), "Enviar a um clube"));
    const dos = [...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.startsWith("Club Dos"));
    expect(dos.querySelector(".opcion-hoja-detalle").textContent).toBe("Sem administrador");
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Club Uno"));
    expect(texto()).toContain("Esse clube ainda não tem administrador: o pedido não pode ser enviado para lá.");
  });

  test("sumar y quitar un sub-dueño; pasar el rol se confirma escribiendo el correo", async () => {
    await montar();
    const sumar = contenedor.querySelector(".panel-sumar");
    await escribir(sumar.querySelector("input"), "Otro@Prueba.com");
    await tocar(boton(sumar, "Sumar"));
    expect(llamadasA("agregar_subdueno")).toEqual([{ funcion: "agregar_subdueno", parametros: { p_correo: "otro@prueba.com" } }]);

    await tocar(boton(fila(".panel-dueno", "subduenia@prueba.com"), "Quitar"));
    await tocar(boton(contenedor.querySelector(".hoja-confirmar"), "Sí, quitar"));
    expect(llamadasA("quitar_subdueno")).toEqual([{ funcion: "quitar_subdueno", parametros: { p_user: "s" } }]);

    await tocar(boton(fila(".panel-dueno", "subduenia@prueba.com"), "Pasar el rol de dueño principal"));
    const confirmar = boton(contenedor.querySelector(".cuentas-hoja"), "Sí, pasar el rol");
    expect(confirmar.disabled).toBe(true);
    await escribir(contenedor.querySelector("#panel-traspaso"), "otra@prueba.com");
    expect(confirmar.disabled).toBe(true);
    await escribir(contenedor.querySelector("#panel-traspaso"), "SubDuenia@prueba.com ");
    expect(confirmar.disabled).toBe(false);
    // Después del traspaso, la base dice que ya no es principal: se le van los botones.
    base.duenos = [
      { ...PRINCIPAL, principal: false },
      { ...SUB, principal: true },
    ];
    await tocar(confirmar);
    expect(llamadasA("traspasar_principal")).toEqual([{ funcion: "traspasar_principal", parametros: { p_user: "s" } }]);
    expect(texto()).toContain("subduenia@prueba.com es el dueño principal. Vos quedaste como sub-dueño.");
    expect(contenedor.querySelector(".panel-sumar")).toBeNull();
    expect(texto()).toContain("Solo el dueño principal suma o quita dueños.");
  });

  test("Movimientos: qué pasó, en qué club y quién lo hizo", async () => {
    base.movimientos = [
      {
        id: 3,
        cuando: "2026-10-09T12:00:00Z",
        quien_email: "duenio@prueba.com",
        accion: "renombrar_club",
        equipo_id: "c1",
        email: null,
        detalle: { antes: "Club Viejo", nombre: "Club Uno" },
      },
      { id: 2, cuando: "2026-10-05T12:00:00Z", quien_email: "subduenia@prueba.com", accion: "entidad", equipo_id: "c1", email: "ent@uno.com" },
      { id: 1, cuando: "2026-10-01T12:00:00Z", quien_email: null, accion: "semilla", equipo_id: null, email: null },
    ];
    await montar();
    const lineas = [...contenedor.querySelectorAll(".panel-movimientos li")];
    expect(lineas.map((li) => li.querySelector("b").textContent)).toEqual([
      "Nombre: Club Viejo → Club Uno",
      "Entidad · Club Uno · ent@uno.com",
      "Arrancó la plataforma",
    ]);
    expect(lineas[0].textContent).toContain("por duenio@prueba.com");
    expect(lineas[1].textContent).toContain("por subduenia@prueba.com");
    expect(lineas[2].textContent).toContain("automático");
  });
});
