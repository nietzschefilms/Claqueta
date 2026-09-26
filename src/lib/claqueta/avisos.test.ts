import { describe, expect, it } from "vitest";
import { avisosRutina } from "./avisos";
import type { BloquePlaneado } from "./planeador";
import type { Tarea } from "./tipos";

const bloque = (id: string, inicio: number, fin: number, label: string, tareas: Partial<Tarea>[] = []): BloquePlaneado => ({
  bloque: { id, weekday: 1, start_time: "", end_time: "", label, kind: "focus", areas: [] },
  inicio,
  fin,
  capacidad: fin - inicio,
  usados: 0,
  flex: false,
  tareas: tareas.map((t, i) => ({ id: `t${i}`, title: `Tarea ${i}`, area: "ek", due_date: null, est_minutes: 30, impact: 2, status: "pendiente", done_at: null, repeat: "none", notes: null, milestone_id: null, ...t }))
});

describe("avisos de rutina", () => {
  const b = [bloque("ek", 16 * 60, 18 * 60, "EK Bars", [{ title: "Kickoff" }, { title: "Otra" }]), bloque("cena", 20 * 60 + 30, 21 * 60 + 15, "Cena")];

  it("5 min antes dice qué toca", () => {
    expect(avisosRutina(b, 15 * 60 + 55, "2026-09-28")).toEqual([
      { clave: "2026-09-28:ek:antes", titulo: "En 5 min: EK Bars", cuerpo: "16:00 a 18:00 · Toca: Kickoff (+1)" }
    ]);
  });

  it("al empezar avisa el cambio de actividad", () => {
    expect(avisosRutina(b, 16 * 60, "2026-09-28")[0]).toMatchObject({ clave: "2026-09-28:ek:ahora", titulo: "Ahora: EK Bars" });
    expect(avisosRutina(b, 16 * 60 + 2, "2026-09-28")).toHaveLength(1); // tolera 2 min de retraso
    expect(avisosRutina(b, 16 * 60 + 3, "2026-09-28")).toHaveLength(0);
  });

  it("fuera de ventana no avisa", () => {
    expect(avisosRutina(b, 15 * 60 + 50, "2026-09-28")).toHaveLength(0);
  });
});

describe("avisos de clase", () => {
  it("dice salón y piso", () => {
    const clase = bloque("son", 12 * 60, 15 * 60, "Sonido I");
    clase.bloque = { ...clase.bloque, kind: "fixed", salon: "Salón 1", piso: "2" };
    expect(avisosRutina([clase], 11 * 60 + 55, "2026-09-30")[0]).toEqual({
      clave: "2026-09-30:son:antes",
      titulo: "En 5 min: Sonido I",
      cuerpo: "Salón 1, piso 2 · 12:00 a 15:00"
    });
    clase.bloque.piso = null;
    expect(avisosRutina([clase], 12 * 60, "2026-09-30")[0].cuerpo).toBe("Salón 1 · Hasta las 15:00");
  });
});
