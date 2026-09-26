// Categorías de notificaciones que la persona puede prender o apagar en Ajustes.
// `obligatoria` = no se puede apagar (avisos críticos de operación).
// Además, dos preferencias de sonido para los avisos de rutina.

export type Categoria = "operativo" | "rutina" | "rutina_previo" | "novedades";

export const CATEGORIAS: { clave: Categoria; label: string; desc: string; obligatoria?: boolean }[] = [
  { clave: "operativo", label: "Avisos importantes", desc: "Cobros del día y recordatorios.", obligatoria: true },
  { clave: "rutina", label: "Al empezar un bloque", desc: "Cuando toca cambiar de actividad (clases, EK, publicar el carrusel)." },
  { clave: "rutina_previo", label: "5 minutos antes", desc: "Un aviso previo a cada bloque, con salón y piso si es clase." },
  { clave: "novedades", label: "Novedades", desc: "Anuncios y cosas nuevas en la app." }
];

export type Sonido = "sonido_ahora" | "sonido_previo" | "sonido_entrada" | "sonido_en_silencio";

export const SONIDOS: { clave: Sonido; label: string; desc: string; porDefecto: boolean }[] = [
  { clave: "sonido_ahora", label: "Que suene al empezar", desc: "Con la app abierta suena la claqueta; cerrada, el tono del iPhone.", porDefecto: true },
  { clave: "sonido_previo", label: "Que suene el de 5 minutos antes", desc: "Si lo apagas, llega en silencio.", porDefecto: false },
  { clave: "sonido_entrada", label: "Sonido al entrar a la app", desc: "Suena en tu primer toque al abrirla (el iPhone no deja que suene antes).", porDefecto: true },
  { clave: "sonido_en_silencio", label: "Sonar aunque el iPhone esté en silencio", desc: "Solo los sonidos de Claqueta con la app abierta. Ojo en clase.", porDefecto: false }
];

export type NotifPrefs = Record<Categoria, boolean> & Record<Sonido, boolean>;

// Normaliza lo guardado en perfiles.notif_prefs: lo que falte queda con su valor por defecto.
export function prefsDe(raw: unknown): NotifPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = {} as NotifPrefs;
  for (const c of CATEGORIAS) {
    const v = r[c.clave];
    out[c.clave] = c.obligatoria ? true : typeof v === "boolean" ? v : true;
  }
  for (const s of SONIDOS) {
    const v = r[s.clave];
    out[s.clave] = typeof v === "boolean" ? v : s.porDefecto;
  }
  return out;
}
