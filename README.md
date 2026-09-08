# Registro Partido

Aplicación operativa para registrar períodos, VAR, hidrataciones, formaciones y
cambios de Atlético Mineiro y su rival. Funciona en escritorio y celular,
requiere acceso por correo y mantiene un borrador privado por cuenta mientras
sincroniza el partido con Supabase.

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

Antes de publicar esta versión, ejecutá en orden todos los archivos de
`supabase/migrations/`. La última migración activa Auth + RLS, asigna cada partido
a una cuenta y reemplaza la unicidad global por una unicidad por usuario.

### Activar cuentas y administrador

1. En Supabase, mantené habilitado el proveedor **Email** y el alta de usuarios.
2. En **Authentication > URL Configuration**, configurá la URL pública de la app
   como Site URL y agregá también las URLs de preview que vayas a probar.
3. Ejecutá las migraciones. Desde ese momento el rol anónimo ya no puede leer ni
   modificar `registros_partido`.
4. Entrá una vez en la app con tu correo mediante el enlace mágico.
5. Abrí `supabase/configurar_admin.sql`, reemplazá el texto de ejemplo por tu
   correo y ejecutalo en SQL Editor. No subas esa edición a GitHub.

Cualquier correo puede crear una cuenta. Cada usuario lee, crea, edita y borra
sólo sus partidos. La cuenta agregada a `app_admins` puede además leer los
partidos de todas las cuentas; los registros ajenos aparecen como solo lectura.

## Seguridad

La clave publishable puede estar en el navegador: no es una clave administrativa.
La protección efectiva la aplican Supabase Auth y las políticas RLS de la última
migración. Nunca uses ni copies una `service_role` en la app, GitHub o Excel.

La macro histórica de Excel consulta con el rol anónimo. Al activar RLS esa
consulta queda bloqueada por diseño; para volver a habilitarla hace falta un
puente autenticado del lado servidor. No debilites las políticas ni pongas una
clave administrativa dentro del libro.

Más detalle en [docs/AUDITORIA_2026-09-08.md](docs/AUDITORIA_2026-09-08.md).
