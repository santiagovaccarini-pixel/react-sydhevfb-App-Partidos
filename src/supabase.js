import { createClient } from "@supabase/supabase-js";

// La clave publishable está diseñada para ejecutarse en el navegador. La seguridad
// de los datos debe completarse con Auth + RLS en Supabase (ver informe de auditoría).
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://gwzebinonoaaxtdkpqem.supabase.co";
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_Sj4GFkR23dsbe07y04-YRA_JlVDBPan";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
