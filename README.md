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

## Seguridad

La clave publishable puede estar en el navegador: no es una clave administrativa.
La protección efectiva de las filas depende de Supabase Auth y Row Level Security.
Antes de exponer la app públicamente hay que definir qué usuarios o roles podrán
leer, crear, editar y borrar partidos y aplicar políticas RLS para esa lista.

Más detalle en [docs/AUDITORIA_2026-09-08.md](docs/AUDITORIA_2026-09-08.md).
