# Nietzsche Base

Plantilla de Nietzsche Studios para apps de clientes. Sale de lo que ya funciona en Rompiendo Tabúes, limpio y sin nada de la clínica.

**Trae de fábrica:** login con correo y contraseña, recuperar contraseña, roles en base de datos con permisos reales (RLS), página de soporte para crear cuentas, bandeja de avisos, notificaciones push, app instalable (PWA) con actualización automática, modo claro y oscuro, crons y cabeceras de seguridad.

---

## Cliente nuevo, paso a paso

### 1. GitHub
1. Esta plantilla debe estar marcada como **Template repository** (Settings → General).
2. **Use this template → Create a new repository**. Owner `nietzschefilms`, nombre del cliente, **Private**.
3. Clónalo y crea la rama de trabajo: `git checkout -b desarrollo && git push -u origin desarrollo`.

### 2. Supabase
1. En la organización **Nietzsche Studios**: New project, región East US, contraseña generada y guardada en tu gestor.
2. SQL Editor → pega y corre `supabase/migrations/0001_base.sql` (o pídeselo a Claude con el conector).
3. **Authentication → URL Configuration:**
   - Site URL: el dominio de la app (ej. `https://app.cliente.com`).
   - Redirect URLs: `https://app.cliente.com/auth/callback` y `http://localhost:3000/auth/callback`.
4. **Authentication → Email Templates → Reset password:** cambia el link por
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`
   Así el link funciona aunque lo abran desde WhatsApp u otro navegador.
5. **Authentication → Sign In / Providers:** desactiva "Allow new users to sign up". Las cuentas las crea soporte.

### 3. Llaves
1. `cp .env.example .env.local`
2. Supabase → Project Settings → API: copia URL, anon key y service role key.
3. `npm install && npm run vapid` y pega las dos llaves de push.
4. Inventa un `CRON_SECRET` largo. Guárdalo también en el Vault de Supabase:
   `select vault.create_secret('EL_MISMO_VALOR', 'cron_secret');`

### 4. Primera cuenta (tú, como soporte)
1. Supabase → Authentication → Users → **Add user** con tu correo y una contraseña. Marca "Auto Confirm".
2. SQL Editor:
   ```sql
   update perfiles set rol = 'admin', es_soporte = true, nombre = 'Jaime Hernández'
   where correo = 'TU_CORREO';
   ```
3. `npm run dev`, entra en `http://localhost:3000` y ya ves **Soporte** en el menú. De ahí en adelante todas las cuentas se crean desde la app.

### 5. Vestir la app
- `src/config/marca.ts`: nombre, descripción, color del tema, roles y menú.
- `src/app/globals.css`: colores `--c-*` (claro y oscuro) y fuentes.
- Íconos: `npm run iconos` genera provisionales; reemplaza `public/icons/*` con los del cliente (192, 512, maskable 512 y apple-touch 180).
- Llena la sección **Cliente** de `CLAUDE.md`.

### 6. Vercel
1. Add New → Project → importa el repo. Framework: Next.js.
2. Environment Variables: las mismas de `.env.local` (con `NEXT_PUBLIC_SITE_URL` = dominio real).
3. Deploy. Conecta el dominio del cliente en Settings → Domains.

### 7. Construir lo del cliente
Abre Claude Code en el repo. Lee `CLAUDE.md` y trabaja en la rama `desarrollo`. Las funciones del cliente van en migraciones `0002_...` en adelante y en `src/app/app/<modulo>/`.

---

## Qué NO trae (a propósito)
- Nada de datos, textos o módulos de Rompiendo Tabúes.
- Registro abierto: las cuentas las crea soporte. Si un cliente necesita que la gente se registre sola, se agrega por cliente.
- App nativa (App Store / Play Store). Se agrega con Capacitor cuando el cliente lo contrate; la guía de RT sirve de referencia.
