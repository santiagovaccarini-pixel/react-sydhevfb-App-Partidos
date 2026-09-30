// Lo que trae la URL cuando se vuelve de un enlace del correo (recuperar la
// contraseña, confirmar la cuenta). Supabase pone los datos en el fragmento
// (#type=recovery&access_token=…) o, si el enlace venció, un error
// (#error=access_denied&error_code=otp_expired&error_description=…).

export const SIN_ENLACE = Object.freeze({ tipo: "", error: "", descripcion: "" });

export const leerEnlaceDeAcceso = (href) => {
  try {
    const url = new URL(href);
    const params = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
    // Lo que viene en la consulta pisa lo del fragmento, como hace Supabase.
    url.searchParams.forEach((valor, clave) => params.set(clave, valor));
    return {
      tipo: params.get("type") || "",
      error: params.get("error_code") || params.get("error") || "",
      descripcion: params.get("error_description") || "",
    };
  } catch {
    return SIN_ENLACE;
  }
};

export const esEnlaceDeRecuperacion = (enlace) => enlace?.tipo === "recovery";

// Qué decirle a la persona cuando el enlace no sirvió.
export const textoDeEnlaceFallido = (enlace) => {
  if (!enlace?.error) return "";
  if (/expired|otp_expired/i.test(`${enlace.error} ${enlace.descripcion}`)) {
    return "El enlace del correo venció o ya se usó. Pedí uno nuevo.";
  }
  return "El enlace del correo no es válido. Pedí uno nuevo.";
};
