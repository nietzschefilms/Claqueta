// Categorías de notificaciones que la persona puede prender o apagar en Ajustes.
// Cada cliente agrega las suyas (ej. "reservas", "pagos", "comunidad").
// `obligatoria` = no se puede apagar (avisos críticos de operación).

export type Categoria = "operativo" | "rutina" | "novedades";

export const CATEGORIAS: { clave: Categoria; label: string; desc: string; obligatoria?: boolean }[] = [
  { clave: "operativo", label: "Avisos importantes", desc: "Cambios en tu cuenta y recordatorios.", obligatoria: true },
  { clave: "rutina", label: "Rutina", desc: "5 minutos antes de cada bloque y cuando toca cambiar de actividad." },
  { clave: "novedades", label: "Novedades", desc: "Anuncios y cosas nuevas en la app." }
];

export type NotifPrefs = Record<Categoria, boolean>;

// Normaliza lo guardado en perfiles.notif_prefs: lo que falte queda encendido.
export function prefsDe(raw: unknown): NotifPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = {} as NotifPrefs;
  for (const c of CATEGORIAS) {
    const v = r[c.clave];
    out[c.clave] = c.obligatoria ? true : typeof v === "boolean" ? v : true;
  }
  return out;
}
