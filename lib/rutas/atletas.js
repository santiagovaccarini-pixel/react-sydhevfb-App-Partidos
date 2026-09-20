import { autenticarCookieOpenField } from "../openfieldAuth.js";
import { leerJsonConnect, OPENFIELD_CONNECT_BASE_DEFAULT } from "../openfieldSnapshot.js";

// Cuántas actividades recientes se recorren si la API no lista atletas directo.
const ACTIVIDADES_RESPALDO = 8;

const lista = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.athletes)) return payload.athletes;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const limpiar = (atleta) => ({
  id: String(atleta?.id || ""),
  first_name: String(atleta?.first_name || "").trim(),
  last_name: String(atleta?.last_name || "").trim(),
  nickname: String(atleta?.nickname || "").trim(),
  jersey: atleta?.jersey ?? null,
  nombre: [atleta?.first_name, atleta?.last_name]
    .map((valor) => String(valor || "").trim())
    .filter(Boolean)
    .join(" "),
});

// Atletas de Catapult de la cuenta, para vincularlos con la lista de jugadores.
// Solo lectura por la Connect API. Primero /athletes; si esa ruta no responde,
// se juntan los atletas de las últimas actividades.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Cookie");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const auth = autenticarCookieOpenField(request);
  if (!auth.ok) {
    return response.status(auth.status).json({ ok: false, error: auth.error });
  }

  const token = process.env.OPENFIELD_API_TOKEN;
  if (!token) {
    return response.status(500).json({
      ok: false,
      error: "OPENFIELD_API_TOKEN no está configurado en el servidor.",
    });
  }

  const base = String(process.env.OPENFIELD_API_BASE_URL || OPENFIELD_CONNECT_BASE_DEFAULT).replace(/\/+$/, "");

  const directo = await leerJsonConnect({ url: `${base}/athletes`, token });
  if (directo.ok) {
    const atletas = lista(directo.payload).map(limpiar).filter((atleta) => atleta.id);
    return response.status(200).json({
      ok: true,
      fuente: "athletes",
      count: atletas.length,
      atletas,
    });
  }

  // Respaldo: los atletas de las últimas actividades. Es la ruta comprobada.
  const actividades = await leerJsonConnect({ url: `${base}/activities`, token });
  if (!actividades.ok) {
    return response.status(502).json({
      ok: false,
      error: "OpenField no devolvió los atletas ni las actividades.",
      upstreamStatus: { athletes: directo.status, activities: actividades.status },
    });
  }

  const recientes = lista(actividades.payload)
    .filter((actividad) => actividad?.id)
    .sort((a, b) => Number(b.start_time || 0) - Number(a.start_time || 0))
    .slice(0, ACTIVIDADES_RESPALDO);

  const lecturas = await Promise.all(
    recientes.map((actividad) =>
      leerJsonConnect({ url: `${base}/activities/${encodeURIComponent(actividad.id)}/athletes`, token }),
    ),
  );

  const porId = new Map();
  lecturas.forEach((lectura) => {
    if (!lectura.ok) return;
    lista(lectura.payload)
      .map(limpiar)
      .filter((atleta) => atleta.id)
      .forEach((atleta) => {
        if (!porId.has(atleta.id)) porId.set(atleta.id, atleta);
      });
  });

  const atletas = [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return response.status(200).json({
    ok: true,
    fuente: "actividades",
    actividadesRecorridas: recientes.length,
    upstreamStatus: { athletes: directo.status },
    count: atletas.length,
    atletas,
  });
}
