# Registro Partido

Aplicación operativa para registrar períodos, VAR, hidrataciones, formaciones y
cambios de Atlético Mineiro y su rival. Funciona en escritorio y celular y
mantiene un borrador local mientras sincroniza el partido con Supabase.

## Instrucciones para trabajar en el proyecto

- [CLAUDE.md](CLAUDE.md): alcance, protección de funcionalidad y formato obligatorio
  para explicar cambios en lenguaje simple.
- [Sistema de diseño](docs/DESIGN_SYSTEM.md): criterios visuales, mobile-first y
  reutilización de componentes.
- [Decisiones de interfaz](docs/UI_DECISIONS.md): índice de decisiones cerradas y
  cómo registrar descartes sin duplicar la documentación existente.
- [Pendientes y acuerdos del producto](docs/PENDIENTES.md): conservar sus decisiones;
  los pendientes no autorizan cambios fuera del pedido.

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
La segunda del 30 de septiembre (`20260930_partido_solo_autorizados.sql`) cierra
las tablas de Partido a cuentas autorizadas y le saca todo al rol anon; ya está
aplicada en producción. Si alguna vez hiciera falta volver atrás,
`20260930_partido_abierto_de_nuevo.sql` las deja abiertas como antes.

En Supabase › Authentication hay que tener "Confirm email" prendido (Providers ›
Email) y, en URL Configuration, el Site URL de producción y
`https://react-sydhevfb-app-partidos.vercel.app/**` en Redirect URLs, para que
el correo de "Olvidé mi contraseña" vuelva a la app.

Los mails (invitación, confirmar el correo, recuperar la contraseña, cambiar el
correo) salen del SMTP propio del proyecto, un solo remitente ("ARK") para todos
los clubes. Sus textos están en [docs/correos](docs/correos/README.md) y se pegan
en Authentication › Emails › Templates. Las invitaciones por mail necesitan
"Confirm email" prendido: mientras esté apagado, la app no las manda (quien sepa
el correo invitado se quedaría con la cuenta) y le dice al administrador que use
"Copiar mensaje".

Variables del servidor (Vercel › Settings › Environment Variables, Production y
Preview; solo los nombres): `OPENFIELD_API_BASE_URL`, `OPENFIELD_API_TOKEN`,
`CATAPULT_SESSION_KEY` y `OPENFIELD_SESSION_SECRET` (una frase al azar de al menos
32 caracteres, con la que se firma la sesión de OpenField; mientras no esté, la
firma se deriva del token de Catapult como antes). `OPENFIELD_ALLOWED_EMAILS` ya
no se usa: se puede borrar.

El plan de Vercel admite hasta 12 funciones en `api/` por publicación: con una
más, la publicación falla entera y queda la versión anterior. Por eso las
pruebas técnicas de Flujo diario van todas por `api/openfield/diagnostico`
(`?prueba=`), y `lib/funcionesVercel.test.js` controla el tope.

`SUPABASE_SECRET_KEY` (Production y Preview) es la clave secreta de Supabase con
la que el servidor manda los mails de invitación (`api/invitar`). Se saca de
Supabase › Project Settings › API Keys, pestaña "Publishable and secret API
keys", Secret keys (si solo hay claves legacy, primero "Create new API keys").
Es solo del servidor: nunca con prefijo `VITE_` (esas terminan en el navegador),
ni en el código ni en un chat. Si falta, se usa `SUPABASE_SERVICE_ROLE_KEY` (la
legacy) y, sin ninguna, la invitación se guarda igual y la app pide usar "Copiar
mensaje". Opcional: `APP_URL`, adónde vuelve el enlace del mail (por defecto, la
URL de producción).

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
Borrar una cuenta es desde Supabase › Authentication › Users. Las tablas de
Partido también están cerradas (`20260930_partido_solo_autorizados.sql`):
`registros_partido` solo para cuentas con Partido, `equipos`, `jugadores` y
`ajustes` para cualquier cuenta autorizada, y el rol anon sin permisos.

Más detalle en [docs/AUDITORIA_2026-09-08.md](docs/AUDITORIA_2026-09-08.md).
