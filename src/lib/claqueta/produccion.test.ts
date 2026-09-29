import { describe, expect, it } from "vitest";
import { dayOutOfDays, grupoDe, idsReparto, resumenDia, topsheet, totalLinea } from "./produccion";

describe("reporte diario", () => {
  it("programado contra filmado, horas reales y pendientes", () => {
    const escenas = [{ id: "e1", numero: 1 }, { id: "e2", numero: 2 }, { id: "e3", numero: 3 }];
    const dia = new Map<string, string | null>([["e1", "2026-10-10"], ["e2", "2026-10-10"], ["e3", "2026-10-11"]]);
    const planos = [
      { escena_id: "e1", numero: 1, minutos: 20, filmado: true, filmado_en: "2026-10-10", tomas: 4 },
      { escena_id: "e1", numero: 2, minutos: 30, filmado: true, filmado_en: "2026-10-10", tomas: 2 },
      { escena_id: "e2", numero: 1, minutos: 40, filmado: false, filmado_en: null, tomas: 0 },
      { escena_id: "e3", numero: 1, minutos: 15, filmado: true, filmado_en: "2026-10-10", tomas: 3 }
    ];
    const r = resumenDia("2026-10-10", escenas, dia, planos, { llamado: "08:00", primera_toma: "09:15", comida_inicio: "14:00", comida_fin: "14:45", fin: "19:30" }, "18:00");
    expect(r).toEqual({
      escenasProgramadas: 2,
      escenasCompletas: 1,
      planosProgramados: 3,
      planosFilmados: 2,
      planosExtra: 1,
      tomas: 9,
      minutosEstimados: 90,
      jornada: 690,
      comida: 45,
      arranque: 75,
      extra: 90,
      pendientes: [{ escena: "2", plano: "2A" }]
    });
    expect(resumenDia("2026-10-12", escenas, dia, planos, null, null).jornada).toBeNull();
  });
});
import { escenasDe, type Linea } from "./estudio";

describe("presupuesto", () => {
  it("línea sin errores de centavos", () => {
    expect(totalLinea({ cantidad: 3, veces: 1, tarifa: "1234.56" })).toBe(370_368);
    expect(totalLinea({ cantidad: "0.5", veces: 2, tarifa: 999.99 })).toBe(99_999);
    expect(totalLinea({ cantidad: 1, veces: 1, tarifa: 0 })).toBe(0);
  });
  it("grupos por cuenta", () => {
    expect(grupoDe("1200")).toBe("atl");
    expect(grupoDe("2900")).toBe("rodaje");
    expect(grupoDe("4100")).toBe("post");
    expect(grupoDe("5300")).toBe("otros");
  });
  it("topsheet: imprevistos, utilidad, IVA y margen contra el precio", () => {
    const t = topsheet(
      [
        { id: "a", cuenta: "2200", descripcion: "Cámara", cantidad: 1, unidad: "día", veces: 1, tarifa: 3000, real: 2800 },
        { id: "b", cuenta: "4100", descripcion: "Edición", cantidad: 1, unidad: "fijo", veces: 1, tarifa: 2000, real: null },
        { id: "c", cuenta: "2200", descripcion: "Lentes", cantidad: 2, unidad: "día", veces: 1, tarifa: 500, real: null }
      ],
      { imprevistos_pct: 10, utilidad_pct: 20, con_iva: true, precio_cliente: 14000 }
    );
    expect(t.directo).toBe(600_000);
    expect(t.porGrupo).toEqual({ atl: 0, rodaje: 400_000, post: 200_000, otros: 0 });
    expect(t.imprevistos).toBe(60_000);
    expect(t.costo).toBe(660_000);
    expect(t.utilidad).toBe(132_000);
    expect(t.precioSugerido).toBe(792_000);
    expect(t.iva).toBe(126_720);
    expect(t.totalConIva).toBe(918_720);
    expect(t.real).toBe(280_000);
    expect(t.margen).toBe(1_400_000 - 660_000);
    expect(t.margenPct).toBe(52.9);
  });
});

const L = (tipo: Linea["tipo"], texto: string, orden: number): Linea => ({ id: `l${orden}`, tipo, texto, orden });
const G = [
  L("escena", "INT. CASA - DÍA", 1),
  L("personaje", "ANA", 2),
  L("dialogo", "Hola", 3),
  L("personaje", "BETO", 4),
  L("dialogo", "Hola", 5),
  L("escena", "EXT. CALLE - DÍA", 6),
  L("personaje", "ANA", 7),
  L("dialogo", "Vámonos", 8),
  L("escena", "INT. CASA - NOCHE", 9),
  L("personaje", "ANA", 10),
  L("dialogo", "Llegué", 11),
  L("personaje", "BETO", 12),
  L("dialogo", "Tarde", 13)
];

describe("reparto", () => {
  it("ID 1 para quien más sale", () => {
    const ids = idsReparto(escenasDe(G));
    expect(ids.get("ANA")).toBe(1);
    expect(ids.get("BETO")).toBe(2);
  });
  it("Day Out of Days con espera", () => {
    const e = escenasDe(G);
    const dia = new Map<string, string | null>([["l1", "2026-10-10"], ["l6", "2026-10-11"], ["l9", "2026-10-12"]]);
    const d = dayOutOfDays(e, dia);
    expect(d.dias).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(d.filas[0]).toEqual({ id: 1, nombre: "ANA", dias: ["SW", "W", "WF"], trabaja: 3, espera: 0 });
    expect(d.filas[1]).toEqual({ id: 2, nombre: "BETO", dias: ["SW", "H", "WF"], trabaja: 2, espera: 1 });
    const unDia = dayOutOfDays(e, new Map([["l1", "2026-10-10"], ["l6", "2026-10-10"], ["l9", "2026-10-10"]]));
    expect(unDia.filas[1].dias).toEqual(["SWF"]);
  });
});
