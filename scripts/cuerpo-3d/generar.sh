#!/usr/bin/env bash
# Arma las dos imágenes con relieve del mapa corporal de los reportes
# (src/assets/cuerpo-frente.webp y cuerpo-espalda.webp) a partir de la figura
# del cuerpo de la app. Hay que volver a correrlo si cambia el dibujo del
# cuerpo (siluetaCuerpo.js o anatomiaCuerpo.js): las manchas de calor se
# ubican con esas mismas coordenadas.
# Necesita Python 3 con numpy, scipy, opencv-python-headless y Pillow.
set -euo pipefail
raiz="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
node "$raiz/scripts/cuerpo-3d/volcar-geometria.mjs" "$tmp/geometria.json"
for vista in frente espalda; do
  python3 "$raiz/scripts/cuerpo-3d/render.py" "$tmp/geometria.json" "$vista" "$raiz/src/assets/cuerpo-$vista.webp"
done
