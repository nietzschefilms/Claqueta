// Fechas de calendario (YYYY-MM-DD) siempre en hora de la Ciudad de México.
// El servidor de Vercel vive en UTC: sin esto, a las 7 pm "hoy" ya sería mañana.

export const ZONA = "America/Mexico_City";

const partes = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function trozos(fecha: Date) {
  const p = Object.fromEntries(partes.formatToParts(fecha).map((x) => [x.type, x.value]));
  return p as Record<string, string>;
}

// "2026-09-26" del instante dado, en CDMX.
export function fechaCDMX(instante: Date | string = new Date()): string {
  const p = trozos(typeof instante === "string" ? new Date(instante) : instante);
  return `${p.year}-${p.month}-${p.day}`;
}

// Minutos desde medianoche en CDMX (para marcar "ahora" en la línea de tiempo).
export function minutosAhoraCDMX(instante: Date = new Date()): number {
  const p = trozos(instante);
  return Number(p.hour) * 60 + Number(p.minute);
}

function aUTC(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(aUTC(iso) + dias * 86_400_000).toISOString().slice(0, 10);
}

// Días de a hasta b (b - a). Positivo si b es después.
export function diasEntre(a: string, b: string): number {
  return Math.round((aUTC(b) - aUTC(a)) / 86_400_000);
}

// 0 domingo … 6 sábado.
export function diaSemana(iso: string): number {
  return new Date(aUTC(iso)).getUTCDay();
}

// Lunes de la semana de esa fecha.
export function lunesDe(iso: string): string {
  const d = diaSemana(iso);
  return sumarDias(iso, d === 0 ? -6 : 1 - d);
}

// "16:00:00" o "16:00" → 960
export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutosAHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function esFechaISO(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(aUTC(v)) && sumarDias(v, 0) === v;
}

const largo = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const corto = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function fechaLarga(iso: string): string {
  return largo.format(new Date(aUTC(iso)));
}
export function fechaCorta(iso: string): string {
  return corto.format(new Date(aUTC(iso))).replace(/\./g, "");
}

// "hoy", "mañana", "ayer", "en 3 días", "hace 2 días" o la fecha corta.
export function fechaRelativa(iso: string, hoy: string): string {
  const d = diasEntre(hoy, iso);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d === -1) return "ayer";
  if (d > 1 && d <= 6) return `en ${d} días`;
  if (d < -1 && d >= -6) return `hace ${-d} días`;
  return fechaCorta(iso);
}
