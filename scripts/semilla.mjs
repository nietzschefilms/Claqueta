// ─────────────────────────────────────────────────────────────────────────
// SEMILLA DE CLAQUETA
// Carga la rutina, los 12 hitos de EK Bars y las tareas iniciales para la
// cuenta de Jamez. Solo corre contra el proyecto de Supabase de Claqueta.
// No duplica: si una parte ya tiene datos, la salta.
//
// Uso normal (con .env.local lleno):
//   SEMILLA_CORREO=tu@correo npm run semilla
//
// Modo SQL (para pegar en el SQL Editor o correr con el conector):
//   SEMILLA_USER_ID=<uuid de perfiles> node scripts/semilla.mjs --sql
//
// El correo y el id NUNCA se escriben aquí: llegan por variable de entorno.
// ─────────────────────────────────────────────────────────────────────────

const PROYECTO = "ouigbpfyggjbaswyudyu";

// ─── Rutina ───────────────────────────────────────────────────────────────
// weekday: 0 domingo … 6 sábado. areas vacío en un focus = bloque libre (flex).
const f = (inicio, fin, label, areas) => ({ start_time: inicio, end_time: fin, label, kind: "fixed", areas: areas ?? [] });
const foco = (inicio, fin, label, areas) => ({ start_time: inicio, end_time: fin, label, kind: "focus", areas });

// Escuela Superior de Cine · 18ª-2 · 1er trimestre (28 sep – 4 dic 2026).
// Cada clase es un bloque fijo con su salón. Los huecos quedan como bloques
// libres para que el planeador los llene con lo más urgente.
const tarde = [
  foco("16:00", "18:00", "EK Bars", ["ek"]),
  f("18:00", "18:20", "Pausa"),
  foco("18:20", "19:30", "Tarea", ["escuela"]),
  foco("19:30", "20:30", "Top Mart y RT", ["topmart", "rt"]),
  f("20:30", "21:15", "Cena"),
  foco("21:15", "22:15", "Bloque libre", []),
  f("22:15", "22:30", "Cierre del día")
];
const lunes = [
  f("07:00", "08:00", "Arranque"),
  f("08:00", "11:00", "Edición I · Sala de cine"),
  foco("11:00", "12:00", "Hueco libre", []),
  f("12:00", "15:00", "Historia del Cine I · Sala de cine"),
  f("15:00", "16:00", "Comida"),
  ...tarde
];
const martes = [
  f("07:00", "08:00", "Arranque"),
  f("08:00", "12:00", "Cinefotografía I · Foro + Salón 2"),
  f("12:00", "13:00", "Comida"),
  f("13:00", "16:00", "Escritura creativa · Salón 4"),
  ...tarde
];
const miercoles = [
  f("07:00", "08:00", "Arranque"),
  foco("08:00", "12:00", "Mañana libre", []),
  f("12:00", "15:00", "Sonido I · Salón 1"),
  f("15:00", "16:00", "Comida"),
  ...tarde
];
const jueves = [
  f("07:00", "08:00", "Arranque"),
  foco("08:00", "09:00", "Hueco libre", []),
  f("09:00", "12:00", "Literatura I · Sala de cine"),
  f("12:00", "15:00", "Actuación · La Vaquita"),
  f("15:00", "16:00", "Comida"),
  ...tarde
];
// Viernes: Lenguaje I es de 13 a 17, así que EK Bars pasa a la mañana.
const viernes = [
  f("07:00", "08:00", "Arranque"),
  foco("08:00", "09:00", "Mañana libre", []),
  foco("09:00", "11:00", "EK Bars", ["ek"]),
  foco("11:00", "12:00", "Bloque libre", []),
  f("12:00", "13:00", "Comida"),
  f("13:00", "17:00", "Lenguaje I · Salón 3"),
  f("17:00", "18:20", "Regreso y descanso"),
  foco("18:20", "19:30", "Tarea", ["escuela"]),
  foco("19:30", "20:30", "Top Mart y RT", ["topmart", "rt"]),
  f("20:30", "23:30", "Noche libre")
];
const sabado = [
  foco("10:00", "13:00", "EK Bars", ["ek"]),
  foco("14:30", "17:30", "Top Mart", ["topmart"]),
  // Nietzsche es lo más ligero e informal: solo una hora.
  foco("17:30", "18:30", "Nietzsche y spots con Erik", ["nietzsche"])
];
const domingo = [
  foco("11:00", "13:00", "Escuela", ["escuela"]),
  foco("18:00", "19:00", "Planeación semanal y finanzas", ["personal"]),
  foco("19:00", "20:30", "Bloque libre", [])
];

const RUTINA = [
  ...domingo.map((b) => ({ weekday: 0, ...b })),
  ...[lunes, martes, miercoles, jueves, viernes].flatMap((dia, i) => dia.map((b) => ({ weekday: i + 1, ...b }))),
  ...sabado.map((b) => ({ weekday: 6, ...b }))
];

// ─── Hitos de EK Bars (propuesta que Jamez ajusta) ───────────────────────
const HITOS = [
  "Kickoff y esquema",
  "Base y roles",
  "Reservas (parte 1)",
  "Reservas (parte 2)",
  "Avisos y videos",
  "Comunidad y progreso",
  "Panel de coaches",
  "Pagos y membresías",
  "Empleados y nómina",
  "Reportes",
  "Pruebas con usuarios reales",
  "Publicación y capacitación"
].map((title, i) => ({ project: "ek", week: i + 1, title }));

// ─── Tareas iniciales ─────────────────────────────────────────────────────
// hito: número de semana del hito de EK al que se liga.
const TAREAS = [
  { title: "Confirmar depósito EK de $5,000", area: "ek", due_date: "2026-09-26", est_minutes: 15, impact: 3 },
  { title: "Kickoff con EK Bars", area: "ek", due_date: "2026-09-30", est_minutes: 90, impact: 3, hito: 1 },
  { title: "Proyecto EK sobre la base Nietzsche", area: "ek", due_date: "2026-10-02", est_minutes: 120, impact: 3, hito: 1 },
  { title: "Pasar horario de clases a Claqueta", area: "escuela", due_date: "2026-09-27", est_minutes: 20, impact: 2 },
  { title: "Temario de la primera semana", area: "escuela", due_date: "2026-09-28", est_minutes: 60, impact: 2 },
  { title: "Revisar errores de RT", area: "rt", due_date: "2026-09-30", est_minutes: 45, impact: 2, repeat: "weekly" },
  { title: "Contenido de Instagram RT", area: "rt", due_date: "2026-09-27", est_minutes: 60, impact: 2, repeat: "weekly" },
  { title: "Reels de Top Mart", area: "topmart", due_date: "2026-10-02", est_minutes: 90, impact: 3 },
  { title: "Spot con Erik", area: "nietzsche", due_date: "2026-10-03", est_minutes: 180, impact: 2 },
  { title: "Registrar gastos de la semana", area: "personal", due_date: "2026-09-27", est_minutes: 15, impact: 1, repeat: "weekly" }
];

// ─── Modo SQL ─────────────────────────────────────────────────────────────
const lit = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(lit).join(",")}]::text[]`;

function sql(userId) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("SEMILLA_USER_ID no parece un uuid.");
  const u = lit(userId);
  const rutina = RUTINA.map(
    (b) => `(${u}, ${b.weekday}, ${lit(b.start_time)}, ${lit(b.end_time)}, ${lit(b.label)}, ${lit(b.kind)}, ${arr(b.areas)})`
  ).join(",\n    ");
  const hitos = HITOS.map((h) => `(${u}, ${lit(h.project)}, ${h.week}, ${lit(h.title)})`).join(",\n    ");
  const tareas = TAREAS.map(
    (t) =>
      `(${u}, ${lit(t.title)}, ${lit(t.area)}, ${lit(t.due_date)}::date, ${t.est_minutes}, ${t.impact}, ${lit(t.repeat ?? "none")}, ` +
      (t.hito ? `(select id from public.milestones where user_id = ${u} and project = 'ek' and week = ${t.hito} limit 1)` : "null") +
      ")"
  ).join(",\n    ");

  return `-- Semilla de Claqueta (generada por scripts/semilla.mjs --sql)
do $$
begin
  if not exists (select 1 from public.perfiles where id = ${u}) then
    raise exception 'No existe ese perfil. Revisa el id.';
  end if;

  if not exists (select 1 from public.routine_blocks where user_id = ${u}) then
    insert into public.routine_blocks (user_id, weekday, start_time, end_time, label, kind, areas) values
    ${rutina};
  end if;

  if not exists (select 1 from public.milestones where user_id = ${u}) then
    insert into public.milestones (user_id, project, week, title) values
    ${hitos};
  end if;

  if not exists (select 1 from public.tasks where user_id = ${u}) then
    insert into public.tasks (user_id, title, area, due_date, est_minutes, impact, repeat, milestone_id) values
    ${tareas};
  end if;
end $$;
`;
}

// ─── Modo normal (supabase-js con service role) ───────────────────────────
async function sembrar() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const correo = (process.env.SEMILLA_CORREO ?? "").trim().toLowerCase();
  if (!url.includes(PROYECTO)) throw new Error(`Esta semilla solo corre contra el proyecto de Claqueta (${PROYECTO}). Revisa NEXT_PUBLIC_SUPABASE_URL.`);
  if (!llave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  if (!correo) throw new Error("Falta SEMILLA_CORREO. Ejemplo: SEMILLA_CORREO=tu@correo npm run semilla");

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, llave, { auth: { persistSession: false } });

  const { data: perfil, error } = await db.from("perfiles").select("id").ilike("correo", correo).maybeSingle();
  if (error) throw error;
  if (!perfil) throw new Error("No encontré un perfil con ese correo. Crea la cuenta primero desde /app/soporte.");
  const user_id = perfil.id;

  const vacia = async (tabla) => {
    const { count, error: e } = await db.from(tabla).select("id", { count: "exact", head: true }).eq("user_id", user_id);
    if (e) throw e;
    return (count ?? 0) === 0;
  };

  if (await vacia("routine_blocks")) {
    const { error: e } = await db.from("routine_blocks").insert(RUTINA.map((b) => ({ user_id, ...b })));
    if (e) throw e;
    console.log(`Rutina: ${RUTINA.length} bloques.`);
  } else console.log("Rutina: ya había, no toqué nada.");

  if (await vacia("milestones")) {
    const { error: e } = await db.from("milestones").insert(HITOS.map((h) => ({ user_id, ...h })));
    if (e) throw e;
    console.log(`Hitos EK: ${HITOS.length}.`);
  } else console.log("Hitos: ya había, no toqué nada.");

  if (await vacia("tasks")) {
    const { data: hitos } = await db.from("milestones").select("id, week").eq("user_id", user_id).eq("project", "ek");
    const porSemana = new Map((hitos ?? []).map((h) => [h.week, h.id]));
    const filas = TAREAS.map(({ hito, ...t }) => ({ user_id, repeat: "none", ...t, milestone_id: hito ? porSemana.get(hito) ?? null : null }));
    const { error: e } = await db.from("tasks").insert(filas);
    if (e) throw e;
    console.log(`Tareas: ${filas.length}.`);
  } else console.log("Tareas: ya había, no toqué nada.");
}

if (process.argv.includes("--sql")) {
  process.stdout.write(sql(process.env.SEMILLA_USER_ID ?? ""));
} else {
  sembrar().catch((e) => {
    console.error(`No se pudo sembrar: ${e.message ?? e}`);
    process.exit(1);
  });
}
