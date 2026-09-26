# CLAUDE.md · Nietzsche Base

Manual para cualquier sesión de Claude Code en un proyecto del estudio.
Si este archivo vive en un repo de cliente, la sección **Cliente** de abajo manda sobre todo lo demás.

## Cliente
> Llena esta sección al crear el repo desde la plantilla.

- **Cliente:** (nombre, giro, contacto)
- **Qué es la app:** (una línea)
- **Roles:** (ej. alumno, coach, admin)
- **Contrato:** (monto, plazo, fecha de entrega, mantenimiento)
- **Supabase project id:** `...` (confírmalo antes de cualquier escritura)
- **Vercel / dominio:** `...`
- **Diseño:** (paleta, fuentes, referencias; ver src/config/marca.ts y globals.css)
- **Datos sensibles:** (salud, dinero, menores de edad… qué aplica)

## Stack
- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 3.
- Supabase (Postgres + Auth + Storage). Migraciones en `supabase/migrations/`.
- PWA propia (`public/sw.js`) con notificaciones push (web-push, VAPID).
- Vercel para deploy. GitHub: organización `nietzschefilms`.
- Scripts: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run test`, `npm run vapid`, `npm run iconos`.

## Reglas del estudio (romper una = incidente)
1. **Un cliente, un repo, un proyecto de Supabase, un proyecto de Vercel.** Nunca se comparte base de datos entre clientes. Nunca se copian datos reales de un cliente a otro.
2. **Llaves solo en variables de entorno** (`.env.local` y Vercel). Nada de llaves, contraseñas ni datos personales en el código ni en `scripts/`.
3. **En producción el SQL lo corre James.** Claude prepara la migración y la explica; James la aplica. En proyectos de desarrollo sin datos reales Claude puede aplicar migraciones.
4. **Claude no crea cuentas de personas reales.** Las cuentas se crean desde `/app/soporte`.
5. **Nada se borra en duro.** Personas y registros con historial se desactivan (`activo = false`). Antes de cualquier acción destructiva, se confirma con James.
6. **Toda función nueva se audita antes de desplegar:** funciona, y cada rol ve SOLO lo que le toca. Revisar RLS con los advisors de Supabase después de cada migración.
7. **Dinero: cero errores, nunca asumir.** Montos y pagos se verifican contra el dato real antes de escribir.
8. **Confirmar el project id de Supabase** antes de escribir, porque la organización tiene varios proyectos.

## Ramas y deploy
- `main` = producción (Vercel la despliega sola). `desarrollo` = trabajo diario (Vercel crea una vista previa por cada push).
- Features van a `desarrollo` y se pasan a `main` fuera de horario de uso. Bugs urgentes pueden ir directo.
- Pasar a producción:
  ```
  git checkout main && git merge --ff-only desarrollo && git push origin main && git checkout desarrollo
  ```
- Antes de subir: `npm run typecheck` y `npm run build`. Después: revisar que el deploy en Vercel quede en Ready.
- Stage explícito: `git add <archivos>`. **Nunca `git add -A`.**

## Cómo está armada la base
- **Marca y roles:** `src/config/marca.ts` (nombre, colores del sistema, ROLES, MENU). Colores de la interfaz en `src/app/globals.css` (tokens `--c-*`, claro y oscuro).
- **Sesión y permisos:** `src/lib/sesion.ts` → `requerirSesion()`, `requerirRol("admin", ...)`, `requerirSoporte()`. El rol vive en `perfiles.rol` (tabla `roles`), NO en listas de correos.
- **Base de datos:** `0001_base.sql` crea `roles`, `perfiles` (se llena sola con un trigger al crear la cuenta), `notificaciones`, `push_suscripciones` y `cron_token_valido`. Funciones para RLS en el esquema `privado` (no expuesto por la API): `privado.mi_rol()`, `privado.soy_admin()`, `privado.tengo_rol(text[])`.
- **Clientes de Supabase:** `lib/supabase/server.ts` (con la sesión, respeta RLS; úsalo por defecto), `lib/supabase/admin.ts` (service role, salta RLS; solo en servidor y solo cuando haga falta).
- **Avisos:** `notificar(userId, {...})` en `src/lib/notificaciones.ts` deja el aviso en la bandeja y manda push según las preferencias. Categorías en `src/lib/notif-prefs.ts`.
- **Crons:** copia `src/app/api/cron/resumen-diario` y protégelo con `cronAutorizado()`. Se programan con pg_cron (instrucciones en el archivo).
- **Cuentas:** login con correo y contraseña. Soporte crea la cuenta con contraseña temporal aleatoria y la persona pone la suya al entrar (popup obligatorio). Recuperación por link en `/recuperar`.

## Para agregar una función de cliente
1. Migración nueva `supabase/migrations/000N_nombre.sql` con tablas, RLS y políticas usando `privado.soy_admin()` / `privado.tengo_rol(array[...])`.
2. Si hay roles nuevos: insert en `public.roles` en la migración y agrégalos a `ROLES` en `marca.ts`.
3. Páginas en `src/app/app/<modulo>/` con `requerirRol(...)` al inicio.
4. Entrada en `MENU` de `marca.ts` con los roles que la ven.
5. Auditoría por rol y advisors de Supabase antes de subir.

## Tono y diseño
- Español de México, cálido y directo. Sin guiones largos en textos de la interfaz.
- Formularios a prueba de errores: mensajes que dicen qué pasó y cómo arreglarlo.
- Celular primero. Todo control con foco visible.
