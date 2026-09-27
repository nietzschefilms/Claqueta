// Genera los sonidos de Claqueta como archivos WAV (PCM 16 bits, mono) en
// código puro, sin Web Audio: iOS toca <audio> con WAV de forma confiable en
// apps instaladas, mientras que Web Audio a veces queda mudo.

export const MUESTREO = 44100;

type Pista = Float32Array;

function pista(segundos: number): Pista {
  return new Float32Array(Math.ceil(segundos * MUESTREO));
}

// Chasquido de madera: ruido que cae rapidísimo (pasado por un filtro simple
// para quitarle graves) + un "tok" grave que baja de tono.
function chasquido(p: Pista, inicio: number, volumen: number, semilla = 1) {
  let s = semilla;
  const aleatorio = () => {
    s = (s * 16807) % 2147483647;
    return (s / 2147483647) * 2 - 1;
  };
  const i0 = Math.floor(inicio * MUESTREO);
  const n = Math.floor(0.09 * MUESTREO);
  let previo = 0;
  for (let i = 0; i < n && i0 + i < p.length; i++) {
    const caida = Math.pow(1 - i / n, 4);
    const ruido = aleatorio();
    const agudo = ruido - previo * 0.85; // quita graves: suena más "clac"
    previo = ruido;
    const t = i / MUESTREO;
    const frec = 420 * Math.pow(160 / 420, Math.min(1, t / 0.06));
    const tok = Math.sin(2 * Math.PI * frec * t) * Math.max(0, 1 - t / 0.07);
    p[i0 + i] += volumen * (0.55 * agudo * caida + 0.45 * tok);
  }
}

function nota(p: Pista, frec: number, inicio: number, dur: number, volumen: number) {
  const i0 = Math.floor(inicio * MUESTREO);
  const n = Math.floor(dur * MUESTREO);
  const ataque = Math.floor(0.02 * MUESTREO);
  for (let i = 0; i < n && i0 + i < p.length; i++) {
    const env = i < ataque ? i / ataque : Math.pow(1 - (i - ataque) / (n - ataque), 2.2);
    p[i0 + i] += volumen * env * Math.sin((2 * Math.PI * frec * i) / MUESTREO);
  }
}

export const SONIDOS_WAV = {
  // ¡Clac! Dos chasquidos seguidos, como una claqueta de cine.
  claqueta: () => {
    const p = pista(0.2);
    chasquido(p, 0, 0.9, 7);
    chasquido(p, 0.045, 0.6, 11);
    return p;
  },
  // Aviso suave de 5 minutos antes.
  previo: () => {
    const p = pista(0.12);
    chasquido(p, 0, 0.4, 3);
    return p;
  },
  // Entrada: do y sol que suben y el chasquido del punto rojo.
  entrada: () => {
    const p = pista(0.7);
    nota(p, 523.25, 0, 0.35, 0.3);
    nota(p, 783.99, 0.11, 0.5, 0.26);
    chasquido(p, 0.26, 0.45, 5);
    return p;
  }
} as const;

export type NombreSonido = keyof typeof SONIDOS_WAV;

// Float32 [-1, 1] → WAV 16 bits mono.
export function aWav(p: Pista): Uint8Array {
  const bytes = new Uint8Array(44 + p.length * 2);
  const v = new DataView(bytes.buffer);
  const texto = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  texto(0, "RIFF");
  v.setUint32(4, 36 + p.length * 2, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, MUESTREO, true);
  v.setUint32(28, MUESTREO * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, "data");
  v.setUint32(40, p.length * 2, true);
  for (let i = 0; i < p.length; i++) {
    const x = Math.max(-1, Math.min(1, p[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return bytes;
}
