import { describe, expect, it } from "vitest";
import { etiqueta, ordenarPorPuntaje, puntaje, urgencia } from "./prioridad";
import { lasTresDeHoy, planearDia } from "./planeador";
import { siguienteRepeticion } from "./recurrentes";
import { riesgoEK, semanaEK } from "./ek";
import { diaSemana, diasEntre, fechaCDMX, lunesDe, sumarDias } from "./fechas";
import type { Bloque, Tarea } from "./tipos";

const HOY = "2026-09-26"; // sábado

let n = 0;
function tarea(p: Partial<Tarea> = {}): Tarea {
  n += 1;
  return {
    id: `t${n}`,
    title: `Tarea ${n}`,
    area: "ek",
    due_date: null,
    est_minutes: 30,
    impact: 2,
    status: "pendiente",
    done_at: null,
    repeat: "none",
    notes: null,
    milestone_id: null,
    ...p
  };
}
function bloque(p: Partial<Bloque> = {}): Bloque {
  n += 1;
  return { id: `b${n}`, weekday: 6, start_time: "10:00:00", end_time: "11:00:00", label: "Bloque", kind: "focus", areas: [], ...p };
}

describe("fechas", () => {
  it("usa la hora de CDMX y no la del servidor", () => {
    // 27 sep 02:00 UTC = 26 sep 20:00 en CDMX
    expect(fechaCDMX(new Date("2026-09-27T02:00:00Z"))).toBe("2026-09-26");
    expect(fechaCDMX(new Date("2026-09-27T07:00:00Z"))).toBe("2026-09-27");
  });
  it("suma días, cuenta diferencias y sabe el día de la semana", () => {
    expect(sumarDias("2026-09-30", 2)).toBe("2026-10-02");
    expect(diasEntre("2026-09-26", "2026-10-03")).toBe(7);
    expect(diaSemana(HOY)).toBe(6);
    expect(lunesDe(HOY)).toBe("2026-09-21");
    expect(lunesDe("2026-09-27")).toBe("2026-09-21");
  });
});

describe("urgencia", () => {
  const u = (due: string | null, status: Tarea["status"] = "pendiente") => urgencia({ due_date: due, status }, HOY);
  it("sigue la escalera por fecha", () => {
    expect(u("2026-09-25")).toBe(100);
    expect(u(HOY)).toBe(80);
    expect(u("2026-09-27")).toBe(60);
    expect(u("2026-09-28")).toBe(45);
    expect(u("2026-09-29")).toBe(45);
    expect(u("2026-09-30")).toBe(30);
    expect(u("2026-10-03")).toBe(30);
    expect(u("2026-10-04")).toBe(15);
    expect(u(null)).toBe(10);
  });
  it("haciendo suma 10", () => {
    expect(u(HOY, "haciendo")).toBe(90);
    expect(u(null, "haciendo")).toBe(20);
  });
});

describe("puntaje y etiqueta", () => {
  it("aplica impacto y peso del frente", () => {
    // (80 + 3×8) × 1.3 = 135.2
    expect(puntaje({ due_date: HOY, status: "pendiente", impact: 3, area: "ek" }, HOY)).toBe(135.2);
    // (10 + 1×8) × 0.8 = 14.4
    expect(puntaje({ due_date: null, status: "pendiente", impact: 1, area: "nietzsche" }, HOY)).toBe(14.4);
    // (30 + 2×8) × 1.0 = 46
    expect(puntaje({ due_date: "2026-10-01", status: "pendiente", impact: 2, area: "rt" }, HOY)).toBe(46);
  });
  it("corta en 90, 60 y 35", () => {
    expect(etiqueta(90)).toBe("Crítico");
    expect(etiqueta(89.99)).toBe("Alta");
    expect(etiqueta(60)).toBe("Alta");
    expect(etiqueta(59.9)).toBe("Media");
    expect(etiqueta(35)).toBe("Media");
    expect(etiqueta(34.9)).toBe("Baja");
  });
  it("ordena de mayor a menor", () => {
    const a = tarea({ due_date: null });
    const b = tarea({ due_date: HOY });
    const c = tarea({ due_date: "2026-09-20" });
    expect(ordenarPorPuntaje([a, b, c], HOY).map((t) => t.id)).toEqual([c.id, b.id, a.id]);
  });
});

describe("planearDia", () => {
  it("llena el bloque de su frente con lo de mayor puntaje hasta el tope", () => {
    const b = bloque({ areas: ["ek"], start_time: "10:00", end_time: "11:00" });
    const alta = tarea({ due_date: HOY, est_minutes: 40 });
    const media = tarea({ due_date: "2026-10-01", est_minutes: 30 });
    const chica = tarea({ due_date: null, est_minutes: 20 });
    const otraArea = tarea({ area: "rt", due_date: HOY, est_minutes: 10 });
    const plan = planearDia([b], [media, chica, alta, otraArea], HOY);
    // 40 + 20 = 60; la de 30 ya no cabe
    expect(plan.bloques[0].tareas.map((t) => t.id)).toEqual([alta.id, chica.id]);
    expect(plan.noCupo.map((t) => t.id)).toEqual([otraArea.id]);
  });

  it("primero bloques de frente, al final los flex", () => {
    const flex = bloque({ areas: [], start_time: "09:00", end_time: "10:00" });
    const ek = bloque({ areas: ["ek"], start_time: "12:00", end_time: "13:00" });
    const t = tarea({ due_date: HOY, est_minutes: 60 });
    const plan = planearDia([flex, ek], [t], HOY);
    const [pFlex, pEk] = plan.bloques;
    expect(pEk.tareas.map((x) => x.id)).toEqual([t.id]);
    expect(pFlex.tareas).toEqual([]);
  });

  it("el flex toma lo que sobra de cualquier frente", () => {
    const flex = bloque({ areas: [] });
    const t = tarea({ area: "personal", due_date: HOY, est_minutes: 30 });
    const plan = planearDia([flex], [t], HOY);
    expect(plan.bloques[0].tareas).toHaveLength(1);
    expect(plan.noCupo).toHaveLength(0);
  });

  it("los bloques fijos no reciben tareas", () => {
    const fijo = bloque({ kind: "fixed", areas: ["escuela"] });
    const t = tarea({ area: "escuela", due_date: HOY });
    const plan = planearDia([fijo], [t], HOY);
    expect(plan.bloques[0].tareas).toEqual([]);
    expect(plan.noCupo.map((x) => x.id)).toEqual([t.id]);
  });

  it("una tarea más larga que el bloque entra sola si el bloque está vacío", () => {
    const b = bloque({ areas: ["ek"], start_time: "10:00", end_time: "11:00" });
    const larga = tarea({ due_date: HOY, est_minutes: 180 });
    const otra = tarea({ due_date: "2026-10-10", est_minutes: 10 });
    const plan = planearDia([b], [larga, otra], HOY);
    expect(plan.bloques[0].tareas.map((t) => t.id)).toEqual([larga.id]);
  });

  it("solo lo vencido o de hoy sale en No cupo; lo futuro espera", () => {
    const vencida = tarea({ area: "topmart", due_date: "2026-09-24" });
    const futura = tarea({ area: "topmart", due_date: "2026-10-02" });
    const plan = planearDia([], [vencida, futura], HOY);
    expect(plan.noCupo.map((t) => t.id)).toEqual([vencida.id]);
  });

  it("lo completado hoy se queda en su bloque (tachado) y lo de otros días no aparece", () => {
    const b = bloque({ areas: ["ek"], start_time: "10:00", end_time: "11:00" });
    const hechaHoy = tarea({ status: "hecho", done_at: "2026-09-26T17:00:00Z", est_minutes: 30 });
    const hechaAyer = tarea({ status: "hecho", done_at: "2026-09-25T17:00:00Z", est_minutes: 30 });
    const pendiente = tarea({ due_date: HOY, est_minutes: 30 });
    const plan = planearDia([b], [pendiente, hechaAyer, hechaHoy], HOY);
    expect(plan.bloques[0].tareas.map((t) => t.id)).toEqual([hechaHoy.id, pendiente.id]);
  });

  it("lo completado hoy sin bloque de su frente se lista aparte", () => {
    const hecha = tarea({ area: "rt", status: "hecho", done_at: "2026-09-26T20:00:00Z" });
    const deEk = tarea({ area: "ek", due_date: sumarDias(HOY, 5) }); // el bloque de EK no está vacío: no se presta
    const plan = planearDia([bloque({ areas: ["ek"] })], [hecha, deEk], HOY);
    expect(plan.hechasFuera.map((t) => t.id)).toEqual([hecha.id]);
  });

  it("acomoda los bloques por hora", () => {
    const tarde = bloque({ start_time: "18:00", end_time: "19:00" });
    const temprano = bloque({ start_time: "07:00", end_time: "08:00" });
    const plan = planearDia([tarde, temprano], [], HOY);
    expect(plan.bloques.map((b) => b.inicio)).toEqual([420, 1080]);
  });
});

describe("lasTresDeHoy", () => {
  it("toma las 3 pendientes de mayor puntaje", () => {
    const ts = [
      tarea({ due_date: null }),
      tarea({ due_date: HOY }),
      tarea({ due_date: "2026-09-20" }),
      tarea({ due_date: "2026-09-27" }),
      tarea({ due_date: "2026-09-19", status: "hecho", done_at: "2026-09-26T15:00:00Z" })
    ];
    expect(lasTresDeHoy(ts, HOY).map((t) => t.due_date)).toEqual(["2026-09-20", HOY, "2026-09-27"]);
  });
});

describe("siguienteRepeticion", () => {
  it("crea la siguiente a +7 días desde su fecha", () => {
    const t = tarea({ repeat: "weekly", due_date: "2026-09-30", area: "rt", impact: 3 });
    const sig = siguienteRepeticion(t, HOY);
    expect(sig).toMatchObject({ due_date: "2026-10-07", area: "rt", impact: 3, status: "pendiente", repeat: "weekly" });
  });
  it("sin fecha cuenta desde hoy", () => {
    expect(siguienteRepeticion(tarea({ repeat: "weekly" }), HOY)?.due_date).toBe("2026-10-03");
  });
  it("las que no se repiten no generan nada", () => {
    expect(siguienteRepeticion(tarea(), HOY)).toBeNull();
  });
});

describe("riesgo EK", () => {
  const hitos = (hechos: number) => Array.from({ length: 12 }, (_, i) => ({ week: i + 1, done: i < hechos }));
  it("cuenta la semana del contrato desde el 25 de septiembre", () => {
    expect(semanaEK("2026-09-24")).toBe(0);
    expect(semanaEK("2026-09-25")).toBe(1);
    expect(semanaEK("2026-10-01")).toBe(1);
    expect(semanaEK("2026-10-02")).toBe(2);
    expect(semanaEK("2026-12-18")).toBe(12);
    expect(semanaEK("2026-12-19")).toBe(13);
  });
  it("en tiempo, 1 semana atrás y 2+ atrás", () => {
    expect(riesgoEK(hitos(0), HOY).semaforo).toBe("en-tiempo");
    expect(riesgoEK(hitos(0), "2026-10-02").semaforo).toBe("atras-1");
    expect(riesgoEK(hitos(1), "2026-10-02").semaforo).toBe("en-tiempo");
    const r = riesgoEK(hitos(1), "2026-10-16");
    expect(r.semaforo).toBe("atras-2");
    expect(r.texto).toBe("2 semanas atrás");
  });
  it("barras de avance y de tiempo", () => {
    const r = riesgoEK(hitos(6), "2026-12-18");
    expect(r.avance).toBe(0.5);
    expect(r.tiempo).toBe(1);
  });
});

describe("dificultad", () => {
  it("lo difícil se prioriza antes", () => {
    const facil = tarea({ area: "escuela", due_date: sumarDias(HOY, 3), dificultad: 1 });
    const dificil = tarea({ area: "escuela", due_date: sumarDias(HOY, 3), dificultad: 3 });
    expect(urgencia(facil, HOY)).toBe(45);
    expect(urgencia(dificil, HOY)).toBe(60); // 3 días - 2 de anticipo = mañana
    expect(ordenarPorPuntaje([facil, dificil], HOY)[0].id).toBe(dificil.id);
  });
  it("el anticipo no la vuelve vencida", () => {
    expect(urgencia(tarea({ due_date: sumarDias(HOY, 1), dificultad: 3 }), HOY)).toBe(80);
  });
});

describe("tareas diarias", () => {
  it("nace la de mañana al completar la de hoy", () => {
    const t = tarea({ area: "rt", due_date: HOY, repeat: "daily" });
    expect(siguienteRepeticion(t, HOY)?.due_date).toBe(sumarDias(HOY, 1));
  });
  it("si se completa tarde la de ayer, la siguiente es la de hoy", () => {
    const t = tarea({ area: "rt", due_date: sumarDias(HOY, -3), repeat: "daily" });
    expect(siguienteRepeticion(t, HOY)?.due_date).toBe(HOY);
  });
});

describe("bloques prestados", () => {
  it("un bloque de frente sin nada de ese frente se llena con otros", () => {
    const spots = bloque({ areas: ["nietzsche"], start_time: "17:30", end_time: "18:30" });
    const rt = tarea({ area: "rt", due_date: HOY, est_minutes: 30 });
    const plan = planearDia([spots], [rt], HOY);
    expect(plan.bloques[0].prestado).toBe(true);
    expect(plan.bloques[0].tareas.map((t) => t.id)).toEqual([rt.id]);
  });
  it("si hay algo de su frente, no se presta", () => {
    const spots = bloque({ areas: ["nietzsche"], start_time: "17:30", end_time: "18:30" });
    const n = tarea({ area: "nietzsche", due_date: sumarDias(HOY, 10) });
    const rt = tarea({ area: "rt", due_date: HOY });
    const plan = planearDia([spots], [n, rt], HOY);
    expect(plan.bloques[0].prestado).toBeFalsy();
    expect(plan.bloques[0].tareas.map((t) => t.id)).toEqual([n.id]);
  });
});
