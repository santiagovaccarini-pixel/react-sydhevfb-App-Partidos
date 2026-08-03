from pathlib import Path

path = Path("src/App.js")
app = path.read_text(encoding="utf-8")

old = '''    const { data, error } = await supabase
      .from("registros_partido")
      .update(registroSupabase)
      .eq("id", idRegistro)
      .select();
  
    if (error) {
      console.error("Error editando registro en Supabase:", error);
      alert("No se pudieron guardar los cambios en Supabase");
      return false;
    }'''

new = '''    let { data, error } = await supabase
      .from("registros_partido")
      .update(registroSupabase)
      .eq("id", idRegistro)
      .select();

    if (
      error &&
      esErrorColumnasExtendidas(error) &&
      !tieneDatosExtendidos(registroConTiempos)
    ) {
      const reintento = await supabase
        .from("registros_partido")
        .update(quitarCamposExtendidos(registroSupabase))
        .eq("id", idRegistro)
        .select();

      data = reintento.data;
      error = reintento.error;
    }
  
    if (error) {
      if (esErrorColumnasExtendidas(error)) {
        alert(
          "Falta ejecutar la migración de prórroga en Supabase antes de guardar estos datos."
        );
        return false;
      }

      console.error("Error editando registro en Supabase:", error);
      alert("No se pudieron guardar los cambios en Supabase");
      return false;
    }'''

count = app.count(old)
if count != 1:
    raise RuntimeError(f"Se esperaba un bloque de actualización y se encontraron {count}")

path.write_text(app.replace(old, new, 1), encoding="utf-8")
print("Compatibilidad de edición aplicada")
