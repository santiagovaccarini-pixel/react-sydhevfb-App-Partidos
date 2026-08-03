from pathlib import Path

app_path = Path("src/App.js")
version_path = Path("public/version.json")

app = app_path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global app
    count = app.count(old)
    if count != 1:
        raise RuntimeError(
            f"{label}: se esperaba 1 coincidencia y se encontraron {count}"
        )
    app = app.replace(old, new, 1)


replace_once(
    'const APP_VERSION = "2026.08.03.2";',
    'const APP_VERSION = "2026.08.03.3";',
    "versión de la aplicación",
)

indicator = "          <IndicadorModoTiempo />\n"
indicator_count = app.count(indicator)
if indicator_count != 2:
    raise RuntimeError(
        f"indicadores actuales: se esperaban 2 y se encontraron {indicator_count}"
    )
app = app.replace(indicator, "")

version_footer = "        <VersionApp />\n"
version_count = app.count(version_footer)
if version_count != 1:
    raise RuntimeError(
        f"versión actual al pie: se esperaba 1 y se encontraron {version_count}"
    )
app = app.replace(version_footer, "", 1)

replace_once(
    '''        <header className="encabezado">
          <h1>Formación del partido</h1>
          <p>Elegí la fecha e importá o cargá los datos manualmente.</p>
        </header>
        <button''',
    '''        <header className="encabezado">
          <h1>Formación del partido</h1>
          <p>Elegí la fecha e importá o cargá los datos manualmente.</p>
        </header>

        <IndicadorModoTiempo />

        <button''',
    "cartel en Formación del partido",
)

replace_once(
    '''        </section>
      </div>
    </div>
  );

  const actualizarAplicacion = async () => {''',
    '''        </section>

        <VersionApp />
      </div>
    </div>
  );

  const actualizarAplicacion = async () => {''',
    "versión al pie de Formación del partido",
)

version_path.write_text(
    '{\n  "version": "2026.08.03.3"\n}\n',
    encoding="utf-8",
)
app_path.write_text(app, encoding="utf-8")

print("Cartel y versión movidos a la pantalla principal")
