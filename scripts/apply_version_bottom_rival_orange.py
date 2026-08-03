from pathlib import Path

app_path = Path("src/App.js")
style_path = Path("src/style.css")
version_path = Path("public/version.json")

app = app_path.read_text(encoding="utf-8")
style = style_path.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"{label}: se esperaba 1 coincidencia y se encontraron {count}"
        )
    return text.replace(old, new, 1)


app = replace_once(
    app,
    'const APP_VERSION = "2026.08.03.4";',
    'const APP_VERSION = "2026.08.03.5";',
    "versión de la app",
)

app = replace_once(
    app,
    '''        </header>

        <EstadoVersionApp />

        <button''',
    '''        </header>

        <button''',
    "quita versión de arriba",
)

app = replace_once(
    app,
    '''          )}
        </section>

      </div>
    </div>
  );

  const actualizarAplicacion = async () => {''',
    '''          )}
        </section>

        <EstadoVersionApp />
      </div>
    </div>
  );

  const actualizarAplicacion = async () => {''',
    "mueve versión al final",
)

app = replace_once(
    app,
    '''  const IndicadorModoTiempo = () => {
    const esTransmision = registro.modoTiempo === "transmision";''',
    '''  const IndicadorModoTiempo = ({ variante = "" } = {}) => {
    const esTransmision = registro.modoTiempo === "transmision";''',
    "prop variante del indicador",
)

app = replace_once(
    app,
    '''          className={`indicador-modo-activo ${
            esTransmision ? "transmision" : "en-vivo"
          }`}''',
    '''          className={`indicador-modo-activo ${
            esTransmision ? "transmision" : "en-vivo"
          } ${variante === "rival" ? "rival" : ""}`}''',
    "clase rival del indicador",
)

app = replace_once(
    app,
    '''          </header>

          <IndicadorModoTiempo />
  
          <section className="tarjeta">
          <h2 className="titulo-cambios-rival">Cambios del rival</h2>''',
    '''          </header>

          <IndicadorModoTiempo variante="rival" />
  
          <section className="tarjeta">
          <h2 className="titulo-cambios-rival">Cambios del rival</h2>''',
    "indicador Rival naranja",
)

css_anchor = '''.indicador-modo-activo.transmision,
.indicador-version-app {
  border-color: rgba(22, 163, 74, 0.5);
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.97),
    rgba(22, 163, 74, 0.96)
  );
  color: #ffffff;
}
'''

css_rival = css_anchor + '''
.indicador-modo-activo.rival {
  border-color: rgba(245, 158, 11, 0.72);
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.98),
    rgba(217, 119, 6, 0.97)
  );
  color: #ffffff;
  box-shadow: 0 8px 22px rgba(217, 119, 6, 0.24);
}

.indicador-modo-activo.rival .indicador-modo-punto {
  background: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.24);
}
'''

style = replace_once(
    style,
    css_anchor,
    css_rival,
    "estilo naranja y negro Rival",
)

version_path.write_text(
    '{\n  "version": "2026.08.03.5"\n}\n',
    encoding="utf-8",
)
app_path.write_text(app, encoding="utf-8")
style_path.write_text(style, encoding="utf-8")

print("Versión movida al final y modo Rival estilizado")
