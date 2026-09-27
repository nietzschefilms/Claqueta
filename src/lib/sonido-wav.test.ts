import { describe, expect, it } from "vitest";
import { aWav, MUESTREO, SONIDOS_WAV } from "./sonido-wav";

describe("sonidos WAV", () => {
  it("cada sonido es un WAV válido, con audio y sin saturar", () => {
    for (const [nombre, gen] of Object.entries(SONIDOS_WAV)) {
      const p = gen();
      const wav = aWav(p);
      const v = new DataView(wav.buffer);
      expect(String.fromCharCode(...wav.slice(0, 4)), nombre).toBe("RIFF");
      expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE");
      expect(v.getUint32(24, true)).toBe(MUESTREO);
      expect(wav.length).toBe(44 + p.length * 2);
      const pico = Math.max(...Array.from(p, Math.abs));
      expect(pico, `${nombre} tiene sonido`).toBeGreaterThan(0.2);
      expect(pico, `${nombre} no satura`).toBeLessThanOrEqual(1.2);
    }
  });
});
