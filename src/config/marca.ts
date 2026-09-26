// ─────────────────────────────────────────────────────────────────────────
// MARCA DEL CLIENTE
// Este es EL archivo que se cambia en cada proyecto nuevo, junto con los
// colores de src/app/globals.css y los íconos de public/icons.
// ─────────────────────────────────────────────────────────────────────────

export const MARCA = {
  // Nombre completo y corto (el corto sale bajo el ícono del celular).
  nombre: "Nietzsche Base",
  nombreCorto: "Base",
  descripcion: "App de Nietzsche Studios.",
  // Color de la barra del sistema en el celular (igual a --c-primario).
  colorTema: "#1F2A44",
  // Fondo de la pantalla de arranque de la PWA (igual a --c-fondo en claro).
  colorFondo: "#F4F5F7",
  // Idioma y zona horaria de todo el proyecto.
  idioma: "es-MX",
  zonaHoraria: "America/Mexico_City",
  // Correo que ve la gente cuando necesita ayuda.
  correoSoporte: "nietzschestudiosss@gmail.com",
  // Firma pequeña al pie de la app.
  firma: "Hecho por Nietzsche Studios"
} as const;

// ─────────────────────────────────────────────────────────────────────────
// ROLES
// Deben coincidir con la tabla public.roles de la base de datos.
// Para un cliente nuevo: agrega aquí sus roles (ej. alumno, coach) y en una
// migración nueva haz el insert en public.roles.
// ─────────────────────────────────────────────────────────────────────────

export const ROLES = {
  admin: { label: "Administrador", inicio: "/app" },
  miembro: { label: "Miembro", inicio: "/app" }
} as const;

export type Rol = keyof typeof ROLES;
export const ROL_POR_DEFECTO: Rol = "miembro";

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && valor in ROLES;
}

// ─────────────────────────────────────────────────────────────────────────
// MENÚ
// Cada entrada dice qué roles la ven. Soporte (IT) se controla aparte con
// perfiles.es_soporte, no con el rol.
// ─────────────────────────────────────────────────────────────────────────

export type ItemMenu = { href: string; label: string; roles: Rol[] | "todos"; soloSoporte?: boolean };

export const MENU: ItemMenu[] = [
  { href: "/app", label: "Inicio", roles: "todos" },
  { href: "/app/notificaciones", label: "Avisos", roles: "todos" },
  { href: "/app/ajustes", label: "Ajustes", roles: "todos" },
  { href: "/app/soporte", label: "Soporte", roles: ["admin"], soloSoporte: true }
];
