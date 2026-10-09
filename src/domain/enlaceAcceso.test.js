import { describe, expect, it } from "vitest";
import {
  claveDeEnlaceFallido,
  esEnlaceDeInvitacion,
  esEnlaceDeRecuperacion,
  leerEnlaceDeAcceso,
  textoDeEnlaceFallido,
  vieneDeInvitacion,
} from "./enlaceAcceso.js";

describe("el enlace del correo", () => {
  it("reconoce el de recuperar la contraseña, venga en el fragmento o en la consulta", () => {
    const porFragmento = leerEnlaceDeAcceso("https://app/?training_recovery=1#access_token=a&refresh_token=b&type=recovery");
    expect(porFragmento).toEqual({ tipo: "recovery", error: "", descripcion: "" });
    expect(esEnlaceDeRecuperacion(porFragmento)).toBe(true);

    const porConsulta = leerEnlaceDeAcceso("https://app/?code=xyz&type=recovery");
    expect(esEnlaceDeRecuperacion(porConsulta)).toBe(true);

    expect(esEnlaceDeRecuperacion(leerEnlaceDeAcceso("https://app/"))).toBe(false);
    expect(esEnlaceDeRecuperacion(leerEnlaceDeAcceso("https://app/#type=signup&access_token=a"))).toBe(false);
  });

  it("lee el error de un enlace vencido y lo cuenta en criollo", () => {
    const vencido = leerEnlaceDeAcceso(
      "https://app/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(vencido.error).toBe("otp_expired");
    expect(vencido.descripcion).toBe("Email link is invalid or has expired");
    expect(textoDeEnlaceFallido(vencido)).toBe("El enlace del correo venció o ya se usó. Pedí uno nuevo.");

    expect(textoDeEnlaceFallido(leerEnlaceDeAcceso("https://app/#error=access_denied"))).toBe(
      "El enlace del correo no es válido. Pedí uno nuevo.",
    );
    expect(textoDeEnlaceFallido(leerEnlaceDeAcceso("https://app/"))).toBe("");
  });

  it("reconoce el de una invitación: por su tipo o por la marca con la que vuelve a la app", () => {
    const aceptada = leerEnlaceDeAcceso("https://app/?invitacion=1#access_token=a&refresh_token=b&type=invite");
    expect(aceptada).toEqual({ tipo: "invite", error: "", descripcion: "" });
    expect(esEnlaceDeInvitacion(aceptada)).toBe(true);
    expect(esEnlaceDeRecuperacion(aceptada)).toBe(false);
    // Supabase ya limpió el fragmento (la pestaña se recargó): la marca sigue.
    expect(esEnlaceDeInvitacion(leerEnlaceDeAcceso("https://app/?invitacion=1"))).toBe(true);
    expect(esEnlaceDeInvitacion(leerEnlaceDeAcceso("https://app/?invitacion=2"))).toBe(false);
    expect(esEnlaceDeInvitacion(leerEnlaceDeAcceso("https://app/"))).toBe(false);
  });

  it("una invitación también vuelve como confirmación de correo, si el invitado usó Crear una cuenta", () => {
    const confirmacion = leerEnlaceDeAcceso("https://app/#access_token=a&type=signup");
    expect(vieneDeInvitacion(confirmacion, { invited_at: "2026-10-09T10:00:00Z" })).toBe(true);
    // Una cuenta que se registró sola (sin invitación) entra como siempre.
    expect(vieneDeInvitacion(confirmacion, { invited_at: null })).toBe(false);
    expect(vieneDeInvitacion(confirmacion, undefined)).toBe(false);
    expect(vieneDeInvitacion(leerEnlaceDeAcceso("https://app/?invitacion=1#type=invite"), undefined)).toBe(true);
    expect(vieneDeInvitacion(leerEnlaceDeAcceso("https://app/#type=recovery"), { invited_at: "2026-10-09" })).toBe(false);
  });

  it("si el enlace de la invitación venció, dice que pida que se lo reenvíen", () => {
    const vencida = leerEnlaceDeAcceso(
      "https://app/?invitacion=1#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(vencida.tipo).toBe("invite");
    expect(claveDeEnlaceFallido(vencida)).toBe("acceso.error.invitacionVencida");
    expect(claveDeEnlaceFallido(leerEnlaceDeAcceso("https://app/?invitacion=1#error=access_denied"))).toBe("acceso.error.invitacionInvalida");
    // Los demás enlaces, como siempre.
    expect(claveDeEnlaceFallido(leerEnlaceDeAcceso("https://app/#error_code=otp_expired"))).toBe("acceso.error.enlaceVencido");
    expect(claveDeEnlaceFallido(leerEnlaceDeAcceso("https://app/"))).toBe("");
  });

  it("ante una URL rota no explota", () => {
    expect(leerEnlaceDeAcceso("no es una url")).toEqual({ tipo: "", error: "", descripcion: "" });
  });
});
