import { createClient } from "@supabase/supabase-js";
import { SIN_ENLACE, leerEnlaceDeAcceso } from "./domain/enlaceAcceso.js";

// Lo que trajo la URL al abrirse (enlace de recuperar la contraseña, error de
// un enlace vencido). Se lee acá, ANTES de crear el cliente, porque Supabase
// procesa el fragmento de la URL al crearse y lo borra si pudo entrar.
export const ENLACE_DE_ACCESO =
  typeof window !== "undefined" ? leerEnlaceDeAcceso(window.location.href) : SIN_ENLACE;

// La clave publishable está diseñada para ejecutarse en el navegador. La seguridad
// de los datos debe completarse con Auth + RLS en Supabase (ver informe de auditoría).
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://gwzebinonoaaxtdkpqem.supabase.co";
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_Sj4GFkR23dsbe07y04-YRA_JlVDBPan";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
