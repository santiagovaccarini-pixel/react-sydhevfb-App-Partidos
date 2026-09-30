# Registro Partido

Aplicación operativa para registrar períodos, VAR, hidrataciones, formaciones y
cambios de Atlético Mineiro y su rival. Funciona en escritorio y celular y
mantiene un borrador local mientras sincroniza el partido con Supabase.

## Desarrollo

Requiere Node.js 22.12 o superior (la versión recomendada está en `.nvmrc`).

```bash
npm install
npm run dev
```

Comandos de verificación:

```bash
npm test
npm run build
npm audit
```

## Configuración

La app conserva valores publishable compatibles con la instalación actual. Para
otro proyecto, copiá `.env.example` como `.env.local` y completá:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Antes de publicar esta versión, ejecutá en orden las migraciones de
`supabase/migrations/`. La migración del 8 de septiembre agrega la captura del
modo Transmisión y crea el índice de partido único sólo si no existen duplicados.
La del 20 de septiembre crea `catapult_cuentas` (cuenta de Catapult OpenField
por usuario, con contraseña y pase cifrados) y necesita en Vercel la variable
`CATAPULT_SESSION_KEY` (una frase de al menos 32 caracteres, Production y Preview).
La segunda del 20 de septiembre (`20260920_jugadores_catapult.sql`) agrega a
`jugadores` el vínculo con el atleta de Catapult; Partido no la necesita, Entrenamiento sí.
La del 30 de septiembre (`20260930_cuentas.sql`) crea `perfiles`: quién entra a la
app y qué puede usar. Antes de correrla hay que completar sus dos líneas de
"Semilla" (el correo del administrador y los correos que hasta entonces estaban
en `OPENFIELD_ALLOWED_EMAILS`); la app con esta versión no funciona sin ella.

Variables del servidor (Vercel › Settings › Environment Variables, Production y
Preview; solo los nombres): `OPENFIELD_API_BASE_URL`, `OPENFIELD_API_TOKEN`,
`CATAPULT_SESSION_KEY` y `OPENFIELD_SESSION_SECRET` (una frase al azar de al menos
32 caracteres, con la que se firma la sesión de OpenField; mientras no esté, la
firma se deriva del token de Catapult como antes). `OPENFIELD_ALLOWED_EMAILS` ya
no se usa: se puede borrar.

## Seguridad

La clave publishable puede estar en el navegador: no es una clave administrativa.
La protección efectiva de las filas depende de Supabase Auth y Row Level Security.

Se entra con correo y contraseña antes del portal. Cada cuenta tiene una fila en
`perfiles` (estado pendiente / autorizado / bloqueado, y qué puede usar: Partido,
Flujo diario, administrador). Una cuenta nueva nace pendiente y la autoriza el
administrador; hasta entonces no entra a la app ni ve datos de Flujo diario (las
políticas de `entrenamientos` y `catapult_cuentas` piden `puede_usar('flujo')`).
Nombrar otro administrador es una línea en el SQL Editor:
`update public.perfiles set estado = 'autorizado', admin = true where email = '…';`.
Borrar una cuenta es desde Supabase › Authentication › Users. Con
`20260930_partido_solo_autorizados.sql`, las tablas de Partido también quedan
cerradas: `registros_partido` solo para cuentas con Partido, `equipos` y
`jugadores` para cualquier cuenta autorizada, y el rol anon sin permisos.

Más detalle en [docs/AUDITORIA_2026-09-08.md](docs/AUDITORIA_2026-09-08.md).
