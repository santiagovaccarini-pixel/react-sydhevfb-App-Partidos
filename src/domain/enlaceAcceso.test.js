import { describe, expect, it } from "vitest";
import { esEnlaceDeRecuperacion, leerEnlaceDeAcceso, textoDeEnlaceFallido } from "./enlaceAcceso.js";

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

  it("ante una URL rota no explota", () => {
    expect(leerEnlaceDeAcceso("no es una url")).toEqual({ tipo: "", error: "", descripcion: "" });
  });
});
