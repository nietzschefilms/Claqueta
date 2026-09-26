// Sonido de Claqueta, sintetizado con Web Audio (sin archivos): el golpe de
// una claqueta de cine = dos chasquidos secos de madera muy seguidos.
// iOS solo deja sonar audio después de un toque: desbloquearAudio() se llama
// en el primer toque de la sesión y a partir de ahí suena solo.

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// iOS calla el Web Audio cuando el iPhone está en silencio. Con la Audio
// Session API (Safari 16.4+) se puede pedir que suene igual ("playback").
let ignorarSilencio = false;
export function sonarEnSilencio(si: boolean) {
  ignorarSilencio = si;
  aplicarSesion();
}
function aplicarSesion() {
  const n = typeof navigator !== "undefined" ? (navigator as unknown as { audioSession?: { type: string } }) : null;
  if (n?.audioSession) {
    try {
      n.audioSession.type = ignorarSilencio ? "playback" : "ambient";
    } catch {
      /* navegador sin soporte: sigue el modo silencio */
    }
  }
}

export function desbloquearAudio() {
  aplicarSesion();
  const c = contexto();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

// Un chasquido: ruido filtrado con caída rapidísima + un "tok" grave de madera.
function chasquido(c: AudioContext, t: number, volumen: number) {
  const dur = 0.09;
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / datos.length, 4);
  const ruido = c.createBufferSource();
  ruido.buffer = buffer;
  const banda = c.createBiquadFilter();
  banda.type = "bandpass";
  banda.frequency.value = 2200;
  banda.Q.value = 0.9;
  const g = c.createGain();
  g.gain.setValueAtTime(volumen, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  ruido.connect(banda).connect(g).connect(c.destination);
  ruido.start(t);

  const tok = c.createOscillator();
  tok.type = "triangle";
  tok.frequency.setValueAtTime(420, t);
  tok.frequency.exponentialRampToValueAtTime(160, t + 0.06);
  const gt = c.createGain();
  gt.gain.setValueAtTime(volumen * 0.6, t);
  gt.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  tok.connect(gt).connect(c.destination);
  tok.start(t);
  tok.stop(t + 0.08);
}

// ¡Clac! Al empezar un bloque.
export function sonarClaqueta() {
  const c = contexto();
  if (!c) return;
  desbloquearAudio();
  const t = c.currentTime + 0.02;
  chasquido(c, t, 0.9);
  chasquido(c, t + 0.045, 0.6);
}

// Aviso suave: un solo chasquido bajito (5 minutos antes).
export function sonarPrevio() {
  const c = contexto();
  if (!c) return;
  desbloquearAudio();
  chasquido(c, c.currentTime + 0.02, 0.35);
}

// Entrada a la app: dos notas cálidas que suben, seguidas del chasquido del
// logo (el punto rojo). Suena una vez por sesión, en el primer toque.
export function sonarEntrada() {
  const c = contexto();
  if (!c) return;
  desbloquearAudio();
  const t = c.currentTime + 0.03;
  const nota = (frec: number, inicio: number, dur: number, vol: number) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(frec, inicio);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, inicio);
    g.gain.exponentialRampToValueAtTime(vol, inicio + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    o.connect(g).connect(c.destination);
    o.start(inicio);
    o.stop(inicio + dur + 0.02);
  };
  nota(523.25, t, 0.35, 0.18); // Do
  nota(783.99, t + 0.11, 0.5, 0.16); // Sol
  chasquido(c, t + 0.26, 0.4);
}
