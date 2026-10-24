import { describe, expect, it } from "vitest";
import { TUTORIALES, tutorialPara } from "./tutoriales";

describe("tutoriales", () => {
  it("cada pantalla principal tiene su tutorial", () => {
    expect(tutorialPara("miembro", "/app")?.clave).toBe("hoy");
    expect(tutorialPara("miembro", "/app/estudio")?.clave).toBe("agenda");
    expect(tutorialPara("miembro", "/app/estudio/proyectos")?.clave).toBe("proyectos");
    expect(tutorialPara("admin", "/app/estudio/proyectos/7ee1318f-175b-4538-9c7b-b7fb854196ed")?.clave).toBe("proyecto");
    expect(tutorialPara("miembro", "/app/semana")?.clave).toBe("semana");
  });
  it("las subpantallas sin tutorial no agarran el de su papá", () => {
    expect(tutorialPara("miembro", "/app/estudio/radar")).toBeNull();
    expect(tutorialPara("miembro", "/app/estudio/proyectos/7ee1318f-175b-4538-9c7b-b7fb854196ed/pdf/guion")).toBeNull();
  });
  it("claves únicas y pasos con texto", () => {
    const claves = TUTORIALES.map((t) => t.clave);
    expect(new Set(claves).size).toBe(claves.length);
    for (const t of TUTORIALES) for (const p of t.pasos) expect(p.titulo && p.texto).toBeTruthy();
  });
});
