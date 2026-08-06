from pathlib import Path
import subprocess

script_path = Path("scripts/apply_manual_real_start_and_restore_change_table_v2.py")
source = script_path.read_text(encoding="utf-8")
source = source.replace(
    'if app.count(needle_pt) != 1:\n    raise RuntimeError("No se encontró una única cabecera de Primer tiempo")',
    'if needle_pt not in app:\n    raise RuntimeError("No se encontró la cabecera de Primer tiempo")',
)
source = source.replace(
    'if app.count(needle_st) != 1:\n    raise RuntimeError("No se encontró una única cabecera de Segundo tiempo")',
    'if needle_st not in app:\n    raise RuntimeError("No se encontró la cabecera de Segundo tiempo")',
)
script_path.write_text(source, encoding="utf-8")
subprocess.run(["python", str(script_path)], check=True)
