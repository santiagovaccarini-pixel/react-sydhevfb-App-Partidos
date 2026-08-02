from pathlib import Path

path = Path("src/App.js")
app = path.read_text(encoding="utf-8")

old = '''        const normalizado = normalizarEntradaTiempoTransmision(valor);

        if (normalizado) {
          const tipo = campo === "inicioST" ? "ST" : "PT";
          const claveReferencia =
            tipo === "ST" ? "referenciaRealST" : "referenciaRealPT";
          const baseSegundos = tipo === "ST" ? 45 * 60 : 0;
          const marcaSegundos = segundosDesdeHora(normalizado);
          const transcurridos = Math.max(0, marcaSegundos - baseSegundos);

          siguiente[claveReferencia] = Date.now() - transcurridos * 1000;
        }'''

new = '''        const normalizado = normalizarEntradaTiempoTransmision(valor);
        const tipo = campo === "inicioST" ? "ST" : "PT";
        const claveReferencia =
          tipo === "ST" ? "referenciaRealST" : "referenciaRealPT";

        if (normalizado) {
          const baseSegundos = tipo === "ST" ? 45 * 60 : 0;
          const marcaSegundos = segundosDesdeHora(normalizado);
          const transcurridos = Math.max(0, marcaSegundos - baseSegundos);

          siguiente[claveReferencia] = Date.now() - transcurridos * 1000;
        } else if (!String(valor || "").trim()) {
          siguiente[claveReferencia] = null;
        }'''

if app.count(old) != 1:
    raise RuntimeError("No se encontró el bloque de referencia manual esperado")
app = app.replace(old, new, 1)

header = '''              <div>Hora</div>'''
replacement = '''              <div>{registro.modoTiempo === "transmision" ? "Minuto" : "Hora"}</div>'''

if app.count(header) != 2:
    raise RuntimeError(f"Se esperaban 2 encabezados Hora y se encontraron {app.count(header)}")
app = app.replace(header, replacement)

path.write_text(app, encoding="utf-8")
print("Ajustes finales de transmisión aplicados")
