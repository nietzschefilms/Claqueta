import { describe, expect, it } from "vitest";
import { ALTO, ANCHO, MAX_ELEMENTOS, anguloHacia, normalizarGrados, personajesSugeridos, punta, rotar, siguienteNumeroCamara, validarElementos } from "./floorplan";

const persona = (id: string, extra: Record<string, unknown> = {}) => ({ id, tipo: "personaje", x: 100, y: 100, rot: 90, etiqueta: "JUAN", ...extra });

describe("floor plan: validar elementos", () => {
  it("acepta una escena completa y deja solo los campos que van", () => {
    const r = validarElementos([
      persona("a", { basura: "<script>" }),
      { id: "b", tipo: "camara", x: 400, y: 500, rot: -90, etiqueta: "Cámara A", numero: 3, fov: 50 },
      { id: "c", tipo: "luz", x: 50, y: 50, rot: 45, etiqueta: "" },
      { id: "d", tipo: "mueble", x: 300, y: 300, rot: 0, etiqueta: "Mesa", w: 80, h: 60 },
      { id: "e", tipo: "pared", x: 0, y: 0, x2: 800, y2: 0, rot: 0, etiqueta: "" },
      { id: "f", tipo: "flecha", x: 100, y: 100, x2: 200, y2: 100, rot: 0, etiqueta: "", de: "camara" }
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.elementos).toHaveLength(6);
    expect(r.elementos[0]).toEqual({ id: "a", tipo: "personaje", x: 100, y: 100, rot: 90, etiqueta: "JUAN" });
    expect(r.elementos[1]).toMatchObject({ rot: 270, numero: 3, fov: 50 });
    expect(r.elementos[5].de).toBe("camara");
  });

  it("acomoda lo que se sale del lienzo y redondea", () => {
    const r = validarElementos([persona("a", { x: -50, y: 99999, rot: 725.123 }), { id: "m", tipo: "mueble", x: 10.04, y: 10, rot: 0, etiqueta: "", w: 5, h: 9000 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.elementos[0]).toMatchObject({ x: 0, y: ALTO, rot: 5.1 });
    expect(r.elementos[1]).toMatchObject({ x: 10, w: 10, h: 600 });
  });

  it("rechaza lo que no tiene forma", () => {
    expect(validarElementos({}).ok).toBe(false);
    expect(validarElementos("[]").ok).toBe(false);
    expect(validarElementos([null]).ok).toBe(false);
    expect(validarElementos([persona("a"), persona("a")]).ok).toBe(false);
    expect(validarElementos([persona("a b")]).ok).toBe(false);
    expect(validarElementos([{ ...persona("a"), tipo: "dragon" }]).ok).toBe(false);
    expect(validarElementos([{ ...persona("a"), x: "100" }]).ok).toBe(false);
    expect(validarElementos([{ ...persona("a"), x: Number.NaN }]).ok).toBe(false);
    expect(validarElementos([persona("a", { etiqueta: "x".repeat(41) })]).ok).toBe(false);
    expect(validarElementos([{ id: "p", tipo: "pared", x: 0, y: 0, rot: 0, etiqueta: "" }]).ok).toBe(false);
    expect(validarElementos([{ id: "c", tipo: "camara", x: 0, y: 0, rot: 0, etiqueta: "", numero: 1.5 }]).ok).toBe(false);
    expect(validarElementos([{ id: "c", tipo: "camara", x: 0, y: 0, rot: 0, etiqueta: "", numero: 0 }]).ok).toBe(false);
  });

  it(`máximo ${MAX_ELEMENTOS} elementos`, () => {
    const muchos = Array.from({ length: MAX_ELEMENTOS }, (_, i) => persona(`p${i}`));
    expect(validarElementos(muchos).ok).toBe(true);
    const r = validarElementos([...muchos, persona("otro")]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/200/);
  });

  it("vacío vale (escena sin plano)", () => {
    expect(validarElementos([])).toEqual({ ok: true, elementos: [] });
  });
});

describe("floor plan: números de cámara", () => {
  it("la primera toma sin cámara dibujada", () => {
    expect(siguienteNumeroCamara([], [1, 2, 3])).toBe(1);
    expect(siguienteNumeroCamara([{ tipo: "camara", numero: 1 }, { tipo: "camara", numero: 3 }], [1, 2, 3])).toBe(2);
  });
  it("si todas tienen cámara (o no hay tomas), la que sigue", () => {
    expect(siguienteNumeroCamara([{ tipo: "camara", numero: 1 }, { tipo: "camara", numero: 2 }], [1, 2])).toBe(3);
    expect(siguienteNumeroCamara([], [])).toBe(1);
    expect(siguienteNumeroCamara([{ tipo: "camara", numero: 4 }, { tipo: "personaje", numero: 9 }], [])).toBe(5);
  });
});

describe("floor plan: personajes sugeridos", () => {
  it("los de la escena, sin los que ya están", () => {
    expect(personajesSugeridos(["JUAN", "ANA"], ["RICARDO"], [{ tipo: "personaje", etiqueta: "juan " }])).toEqual(["ANA"]);
  });
  it("sin acceso al guion: el reparto", () => {
    expect(personajesSugeridos([], ["RICARDO", "RICARDO", " "], [])).toEqual(["RICARDO"]);
  });
});

describe("floor plan: ángulos", () => {
  it("normaliza y gira", () => {
    expect(normalizarGrados(-90)).toBe(270);
    expect(normalizarGrados(360)).toBe(0);
    expect(rotar(350, 15)).toBe(5);
    expect(rotar(0, -15)).toBe(345);
  });
  it("asa de giro: punta y ángulo de regreso", () => {
    const p = punta(100, 100, 90, 50);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(150);
    expect(anguloHacia(100, 100, 100, 50)).toBe(270);
    expect(anguloHacia(0, 0, ANCHO, 0)).toBe(0);
  });
});
