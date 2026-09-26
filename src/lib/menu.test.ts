import { describe, expect, it } from "vitest";
import { menuPara } from "@/lib/menu";
import { prefsDe } from "@/lib/notif-prefs";

describe("menuPara", () => {
  it("soporte solo aparece para quien tiene es_soporte", () => {
    expect(menuPara("admin", false).some((i) => i.href === "/app/soporte")).toBe(false);
    expect(menuPara("admin", true).some((i) => i.href === "/app/soporte")).toBe(true);
    expect(menuPara("miembro", true).some((i) => i.href === "/app/soporte")).toBe(true);
  });
  it("los items de todos aparecen para cualquier rol", () => {
    expect(menuPara("miembro", false).map((i) => i.href)).toContain("/app/ajustes");
  });
});

describe("prefsDe", () => {
  it("lo obligatorio no se puede apagar y lo que falte queda encendido", () => {
    expect(prefsDe({ operativo: false, novedades: false })).toEqual({ operativo: true, novedades: false });
    expect(prefsDe(null)).toEqual({ operativo: true, novedades: true });
  });
});
