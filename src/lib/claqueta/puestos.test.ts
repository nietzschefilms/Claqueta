import { describe, expect, it } from "vitest";
import { permisosDe, ritmoDelDia, textoRitmo, type BloquePlan } from "./puestos";

const b = (id: string, inicio: string, minutos: number, p: Partial<BloquePlan> = {}): BloquePlan => ({ id, inicio, minutos, estado: "pendiente", empezo: null, termino: null, ...p });
const m = (h: string) => Number(h.split(":")[0]) * 60 + Number(h.split(":")[1]);

describe("permisos por puesto", () => {
  it("el admin ve todo", () => expect(permisosDe([], true)).toEqual({ direccion: true, planos: true, productor: true }));
  it("director y asistente de dirección ven el guion, no el dinero", () => {
    expect(permisosDe(["director"], false)).toEqual({ direccion: true, planos: true, productor: false });
    expect(permisosDe(["asistente_direccion"], false).direccion).toBe(true);
  });
  it("fotografía edita planos pero no el guion", () => expect(permisosDe(["fotografia"], false)).toEqual({ direccion: false, planos: true, productor: false }));
  it("asistente de cámara solo ve", () => expect(permisosDe(["asistente_camara"], false)).toEqual({ direccion: false, planos: false, productor: false }));
  it("puestos distintos en proyectos distintos: cuenta solo el de este", () => expect(permisosDe(["fotografia", "sonido"], false).direccion).toBe(false));
});

describe("ritmo del día", () => {
  const plan = [b("a", "07:00", 30), b("b", "07:30", 60), b("c", "08:30", 45)];

  it("sin plan no hay ritmo", () => expect(ritmoDelDia([], m("08:00"))).toBeNull());
  it("antes de empezar vamos a tiempo", () => expect(ritmoDelDia(plan, m("06:50"))?.minutos).toBe(0));
  it("si no ha empezado nada y ya es tarde, cuenta el atraso", () => expect(ritmoDelDia(plan, m("07:12"))).toEqual({ minutos: 12, actual: null, siguiente: "a" }));
  it("bloque que empezó tarde", () => {
    const r = ritmoDelDia([b("a", "07:00", 30, { estado: "en_curso", empezo: m("07:10") }), plan[1], plan[2]], m("07:15"));
    expect(r).toEqual({ minutos: 10, actual: "a", siguiente: "b" });
  });
  it("bloque que se alarga más de lo planeado", () => {
    const r = ritmoDelDia([b("a", "07:00", 30, { estado: "en_curso", empezo: m("07:00") }), plan[1]], m("07:50"));
    expect(r?.minutos).toBe(20);
  });
  it("terminamos antes: vamos adelantados", () => {
    const r = ritmoDelDia([b("a", "07:00", 30, { estado: "hecho", empezo: m("07:00"), termino: m("07:20") }), plan[1]], m("07:21"));
    expect(r).toEqual({ minutos: -10, actual: null, siguiente: "b" });
  });
  it("terminó a tiempo pero no arranca el siguiente", () => {
    const r = ritmoDelDia([b("a", "07:00", 30, { estado: "hecho", empezo: m("07:00"), termino: m("07:30") }), plan[1]], m("07:45"));
    expect(r?.minutos).toBe(15);
  });
  it("textos", () => {
    expect(textoRitmo(3)).toEqual({ texto: "Vamos a tiempo", tono: "ok" });
    expect(textoRitmo(-12).texto).toBe("Vamos 12 min adelantados");
    expect(textoRitmo(15)).toEqual({ texto: "Vamos 15 min atrasados", tono: "aviso" });
    expect(textoRitmo(75)).toEqual({ texto: "Vamos 1 h 15 min atrasados", tono: "rojo" });
  });
});
