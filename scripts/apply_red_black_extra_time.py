from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


app_path = Path("src/App.js")
style_path = Path("src/style.css")
version_path = Path("public/version.json")

app = app_path.read_text(encoding="utf-8")
style = style_path.read_text(encoding="utf-8")
version = version_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    'const APP_VERSION = "2026.08.03.7";',
    'const APP_VERSION = "2026.08.03.8";',
    "app version",
)
version = replace_once(
    version,
    '"version": "2026.08.03.7"',
    '"version": "2026.08.03.8"',
    "version json",
)

old_css = '''.tarjeta-prorroga {
  border: 1px solid rgba(245, 158, 11, 0.6);
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.98),
    rgba(255, 247, 237, 0.98)
  );
  scroll-margin-top: 14px;
}

.cabecera-prorroga {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.cabecera-prorroga h2 {
  margin: 4px 0 3px;
  color: #431407;
}

.cabecera-prorroga p {
  margin: 0;
  color: #9a3412;
  font-size: 12px;
  font-weight: 700;
}

.etiqueta-prorroga {
  display: inline-flex;
  padding: 5px 9px;
  border-radius: 999px;
  background: linear-gradient(135deg, #111827, #d97706);
  color: #ffffff;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.boton-quitar-prorroga {
  flex: 0 0 auto;
  min-height: 38px;
  padding: 0 13px;
  background: rgba(127, 29, 29, 0.09);
  color: #991b1b;
  border: 1px solid rgba(185, 28, 28, 0.24);
}

.grid-prorroga {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.periodo-prorroga {
  min-width: 0;
  padding: 14px;
  border-radius: 22px;
  border: 1px solid rgba(251, 146, 60, 0.34);
  background: rgba(255, 255, 255, 0.82);
}

.titulo-periodo-prorroga {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 13px;
}

.titulo-periodo-prorroga > span {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 12px;
  background: linear-gradient(135deg, #111827, #d97706);
  color: #ffffff;
  font-weight: 900;
}

.titulo-periodo-prorroga div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.titulo-periodo-prorroga strong {
  color: #431407;
  font-size: 14px;
}

.titulo-periodo-prorroga small {
  color: #9a3412;
  font-size: 10px;
  font-weight: 700;
}

.periodo-prorroga .bloque-evento {
  background: rgba(255, 251, 235, 0.72);
  border-color: rgba(251, 146, 60, 0.28);
}

.periodo-prorroga .titulo-evento span,
.periodo-prorroga .var-chip.activo {
  background: linear-gradient(135deg, #111827, #d97706);
}

.tarjeta-accion-prorroga {
  padding: 12px;
  background: rgba(255, 255, 255, 0.9);
}

.boton-cargar-prorroga {
  width: 100%;
  min-height: 70px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  background: linear-gradient(135deg, #111827, #d97706);
  color: #ffffff;
  text-align: left;
  box-shadow: 0 10px 24px rgba(217, 119, 6, 0.26);
}

.boton-cargar-prorroga.activa {
  background: linear-gradient(135deg, #431407, #f59e0b);
}

.boton-cargar-prorroga strong {
  font-size: 15px;
}

.boton-cargar-prorroga span {
  font-size: 11px;
  opacity: 0.86;
  line-height: 1.35;
}

.detalle-prorroga .periodo-prorroga h3 {
  margin: 0 0 12px;
  color: #431407;
}
'''

new_css = '''.tarjeta-prorroga {
  border: 1px solid rgba(220, 38, 38, 0.65);
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.98),
    rgba(254, 242, 242, 0.98)
  );
  scroll-margin-top: 14px;
}

.cabecera-prorroga {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.cabecera-prorroga h2 {
  margin: 4px 0 3px;
  color: #111827;
}

.cabecera-prorroga p {
  margin: 0;
  color: #111827;
  font-size: 12px;
  font-weight: 700;
}

.etiqueta-prorroga {
  display: inline-flex;
  padding: 5px 9px;
  border-radius: 999px;
  background: linear-gradient(135deg, #050505, #dc2626);
  color: #ffffff;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.boton-quitar-prorroga {
  flex: 0 0 auto;
  min-height: 38px;
  padding: 0 13px;
  background: rgba(220, 38, 38, 0.1);
  color: #111827;
  border: 1px solid rgba(220, 38, 38, 0.36);
}

.grid-prorroga {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.periodo-prorroga {
  min-width: 0;
  padding: 14px;
  border-radius: 22px;
  border: 1px solid rgba(220, 38, 38, 0.34);
  background: rgba(255, 255, 255, 0.88);
}

.titulo-periodo-prorroga {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 13px;
}

.titulo-periodo-prorroga > span {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 12px;
  background: linear-gradient(135deg, #050505, #dc2626);
  color: #ffffff;
  font-weight: 900;
}

.titulo-periodo-prorroga div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.titulo-periodo-prorroga strong {
  color: #111827;
  font-size: 14px;
}

.titulo-periodo-prorroga small {
  color: #111827;
  font-size: 10px;
  font-weight: 700;
}

.periodo-prorroga .bloque-evento {
  background: rgba(254, 242, 242, 0.72);
  border-color: rgba(220, 38, 38, 0.28);
}

.periodo-prorroga .titulo-evento span,
.periodo-prorroga .var-chip.activo {
  background: linear-gradient(135deg, #050505, #dc2626);
}

.tarjeta-accion-prorroga {
  padding: 12px;
  background: rgba(255, 255, 255, 0.9);
}

.boton-cargar-prorroga {
  width: 100%;
  min-height: 70px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  background: linear-gradient(135deg, #050505, #dc2626);
  color: #ffffff;
  text-align: left;
  box-shadow: 0 10px 24px rgba(220, 38, 38, 0.28);
}

.boton-cargar-prorroga.activa {
  background: linear-gradient(135deg, #050505, #ef4444);
}

.boton-cargar-prorroga strong {
  font-size: 15px;
}

.boton-cargar-prorroga span {
  font-size: 11px;
  opacity: 0.9;
  line-height: 1.35;
}

.detalle-prorroga .periodo-prorroga h3 {
  margin: 0 0 12px;
  color: #111827;
}
'''

style = replace_once(style, old_css, new_css, "extra time color section")

app_path.write_text(app, encoding="utf-8")
style_path.write_text(style, encoding="utf-8")
version_path.write_text(version, encoding="utf-8")
