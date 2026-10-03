#!/usr/bin/env bash
# Pruebas de permisos contra una base de verdad: levanta un Postgres
# descartable, le pone lo mínimo de Supabase, corre la instalación desde cero
# y todas las migraciones en orden, y después los escenarios (quién ve qué y
# quién puede cambiar qué). Sirve en una computadora con Postgres instalado y
# en GitHub Actions.
#
#   bash supabase/pruebas/correr.sh            # todo
#   PG_BIN=/ruta/a/postgres/bin bash supabase/pruebas/correr.sh
set -euo pipefail

AQUI=$(cd "$(dirname "$0")" && pwd)
RAIZ=$(cd "$AQUI/../.." && pwd)
BIN=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
PUERTO=${PG_PUERTO:-5499}
DATOS=$(mktemp -d)
SOCKET=$(mktemp -d)

# Postgres no corre como root: si hace falta, los comandos del servidor van
# como el usuario postgres.
if [ "$(id -u)" = "0" ]; then
  chown postgres "$DATOS" "$SOCKET"
  COMO="runuser -u postgres --"
else
  COMO=""
fi

$COMO "$BIN/initdb" -D "$DATOS" -U postgres --auth=trust -E UTF8 >/dev/null
$COMO "$BIN/pg_ctl" -D "$DATOS" -l "$DATOS/servidor.log" -o "-p $PUERTO -k $SOCKET -c listen_addresses=''" -w start >/dev/null
trap '$COMO "$BIN/pg_ctl" -D "$DATOS" -m fast stop >/dev/null 2>&1; rm -rf "$DATOS" "$SOCKET"' EXIT

export PGHOST="$SOCKET" PGPORT="$PUERTO" PGUSER=postgres
"$BIN/createdb" pruebas
PSQL="$BIN/psql -v ON_ERROR_STOP=1 -q -d pruebas"

$PSQL -f "$AQUI/preparar.sql"
$PSQL -f "$RAIZ/supabase/instalar-desde-cero.sql"
# En orden de nombre (la fecha va adelante). Los "revisar" son consultas
# para mirar a mano, no cambian nada. La de cuentas pide el correo del dueño.
for migracion in "$RAIZ"/supabase/migrations/*.sql; do
  case "$migracion" in *revisar*) continue ;; esac
  echo "→ $(basename "$migracion")"
  sed "s/CORREO_DEL_ADMINISTRADOR/duenio@prueba.com/" "$migracion" | $PSQL -f -
done
# La última se corre otra vez: lo que se publica dice que se puede volver a
# correr, y acá se comprueba.
ULTIMA=$(ls "$RAIZ"/supabase/migrations/*.sql | grep -v revisar | sort | tail -1)
echo "→ $(basename "$ULTIMA") (otra vez)"
$PSQL -f "$ULTIMA" >/dev/null
# Las que dicen que se pueden volver a correr, también después de las nuevas.
for otra_vez in 20261008_lesiones_recaida 20261009_lesiones_periodos; do
  echo "→ $otra_vez.sql (otra vez, después de la última)"
  $PSQL -f "$RAIZ/supabase/migrations/$otra_vez.sql" >/dev/null
done
# Una migración vieja corrida después de una nueva desharía lo nuevo: las que
# tienen ese riesgo se tienen que negar solas, con un aviso claro.
for vieja in 20261002b_datos_basicos 20261003_club_miembros 20261004_cuentas_v2 20261006_horas_imagen; do
  echo "→ $vieja.sql después de la última (se tiene que negar)"
  if $PSQL -f "$RAIZ/supabase/migrations/$vieja.sql" >/dev/null 2>"$DATOS/vieja.err"; then
    echo "ERROR: $vieja.sql corrió después de una más nueva"
    exit 1
  fi
  grep -q "Ya está corrida" "$DATOS/vieja.err" || { cat "$DATOS/vieja.err"; exit 1; }
done
echo "→ escenarios"
$PSQL -f "$AQUI/escenarios.sql"
echo "PRUEBAS DE PERMISOS: OK"
