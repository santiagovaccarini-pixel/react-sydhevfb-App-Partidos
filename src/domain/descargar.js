// Bajar un archivo armado en la app (el Excel o el JSON de un atleta). En el
// celular, el navegador lo guarda o lo ofrece para compartir.
export const descargarArchivo = (nombre, contenido, tipo) => {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = "noopener";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Un rato después: algunos celulares tardan en empezar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};
