import { describe, expect, it } from "vitest";
import { aFountain, deFountain, escenasDe, huecosEnComun, leerSlug, nombrePersonaje, ordenEntre, paginas, pareceEscena, resumenGuion, rotarTipo, sugerirPlan, type Linea, type Ocupado } from "./estudio";

const oc = (user_id: string, inicio: string, fin: string, tipo: Ocupado["tipo"] = "clase", fecha = "2026-10-05"): Ocupado => ({ user_id, fecha, inicio, fin, tipo });

describe("huecos en común", () => {
  it("encuentra lo libre de los dos, sin clases", () => {
    const h = huecosEnComun([oc("j", "08:00", "11:00"), oc("j", "12:00", "15:00"), oc("e", "13:30", "16:30")], ["2026-10-05"], { duracion: 60 });
    expect(h.map((x) => [x.inicio / 60, x.fin / 60])).toEqual([
      [11, 12],
      [16.5, 22]
    ]);
  });
  it("un hueco corto no sirve si no alcanza la duración", () => {
    const h = huecosEnComun([oc("j", "08:00", "11:00"), oc("e", "11:30", "22:00")], ["2026-10-05"], { duracion: 60 });
    expect(h).toEqual([]);
  });
  it("los bloques de foco no bloquean, pero se marcan", () => {
    const h = huecosEnComun([oc("j", "08:00", "20:00"), oc("e", "20:30", "21:30", "bloque")], ["2026-10-05"], { duracion: 60 });
    expect(h).toEqual([{ fecha: "2026-10-05", inicio: 20 * 60, fin: 22 * 60, pisaBloques: true }]);
  });
  it("margen de traslado alrededor de clases y nada antes de ahora", () => {
    const h = huecosEnComun([oc("j", "08:00", "10:00")], ["2026-10-05"], { duracion: 30, margen: 30, hasta: 12 * 60, ahora: { fecha: "2026-10-05", minutos: 7 * 60 } });
    expect(h[0].inicio).toBe(10 * 60 + 30);
    expect(huecosEnComun([], ["2026-10-04"], { duracion: 30, ahora: { fecha: "2026-10-05", minutos: 0 } })).toEqual([]);
  });
});

const L = (tipo: Linea["tipo"], texto: string, orden: number): Linea => ({ id: `l${orden}`, tipo, texto, orden });

const GUION: Linea[] = [
  L("escena", "INT. TAQUERÍA - NOCHE", 1),
  L("accion", "El TAQUERO voltea la tortilla sobre el COMAL. Vapor.", 2),
  L("personaje", "TAQUERO", 3),
  L("dialogo", "¿Con todo, joven?", 4),
  L("personaje", "CLIENTE (V.O.)", 5),
  L("parentesis", "hambriento", 6),
  L("dialogo", "Con todo.", 7),
  L("escena", "EXT. CALLE - DÍA", 8),
  L("accion", "La fila da vuelta a la esquina.", 9),
  L("escena", "INT. TAQUERÍA - NOCHE", 10),
  L("personaje", "TAQUERO", 11),
  L("dialogo", "Se acabó el pastor.", 12)
];

describe("guion", () => {
  it("lee encabezados de escena", () => {
    expect(leerSlug("int. taquería - noche")).toEqual({ intExt: "INT", lugar: "TAQUERÍA", momento: "NOCHE" });
    expect(leerSlug("INT./EXT. COCHE - DÍA")).toEqual({ intExt: "INT/EXT", lugar: "COCHE", momento: "DÍA" });
    expect(leerSlug("EXT. AZOTEA")).toEqual({ intExt: "EXT", lugar: "AZOTEA", momento: null });
    expect(pareceEscena("ext. calle")).toBe(true);
    expect(pareceEscena("Extraño ruido")).toBe(false);
  });
  it("parte en escenas con personajes y posibles elementos", () => {
    const e = escenasDe(GUION);
    expect(e.map((x) => x.numero)).toEqual([1, 2, 3]);
    expect(e[0].personajes).toEqual(["TAQUERO", "CLIENTE"]);
    expect(e[0].mayusculas).toEqual(["TAQUERO", "COMAL"]);
    expect(nombrePersonaje("Ana (cont'd)")).toBe("ANA");
    const r = resumenGuion(e);
    expect(r.escenas).toBe(3);
    expect(r.personajes[0]).toEqual({ nombre: "TAQUERO", escenas: 2 });
    expect(r.lugares[0]).toEqual({ lugar: "TAQUERÍA", escenas: 2 });
  });
  it("plan sugerido junta la misma locación y luz", () => {
    const e = escenasDe(GUION);
    const plan = sugerirPlan(e, 8);
    expect(plan.get("l1")).toBe(plan.get("l10"));
  });
  it("páginas en octavos", () => {
    expect(paginas(3)).toBe("3/8");
    expect(paginas(8)).toBe("1");
    expect(paginas(12)).toBe("1 4/8");
  });
  it("Tab rota el tipo y el orden fraccionario cabe entre vecinos", () => {
    expect(rotarTipo("accion")).toBe("personaje");
    expect(rotarTipo("accion", true)).toBe("escena");
    expect(ordenEntre(1, 2)).toBe(1.5);
    expect(ordenEntre(null, 10)).toBeLessThan(10);
    expect(ordenEntre(10, null)).toBeGreaterThan(10);
  });
  it("ida y vuelta con Fountain", () => {
    const f = aFountain(GUION, "Tacos");
    expect(f).toContain("INT. TAQUERÍA - NOCHE");
    expect(f).toContain("CLIENTE (V.O.)\n(hambriento)\nCon todo.");
    const de = deFountain(f);
    expect(de.filter((x) => x.tipo === "escena").length).toBe(3);
    expect(de.find((x) => x.tipo === "parentesis")?.texto).toBe("hambriento");
    expect(de.filter((x) => x.tipo === "personaje").map((x) => x.texto)).toEqual(["TAQUERO", "CLIENTE (V.O.)", "TAQUERO"]);
  });
});
