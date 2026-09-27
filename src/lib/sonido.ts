// Sonidos de Claqueta con el reproductor normal (<audio>) y archivos WAV que la
// app genera sola (ver sonido-wav.ts). En iPhone instalado Web Audio a veces
// queda mudo; <audio> sí suena. iOS solo deja tocar audio después de un toque:
// en el primer toque se "abre" cada sonido (play en mudo y pausa) y a partir
// de ahí pueden sonar solos (cambio de bloque, toma guardada).

import { aWav, SONIDOS_WAV, type NombreSonido } from "./sonido-wav";

const reproductores = new Map<NombreSonido, HTMLAudioElement>();
const abiertos = new Set<NombreSonido>();
// Sonidos pedidos de verdad: el desbloqueo en mudo no debe pausarlos.
const pedidos = new Set<NombreSonido>();

function reproductor(nombre: NombreSonido): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  let a = reproductores.get(nombre);
  if (!a) {
    const wav = aWav(SONIDOS_WAV[nombre]());
    const url = URL.createObjectURL(new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" }));
    a = new Audio(url);
    a.preload = "auto";
    a.setAttribute("playsinline", "");
    reproductores.set(nombre, a);
  }
  return a;
}

// Con la Audio Session API (Safari 16.4+) se pide sonar aunque el iPhone esté
// en silencio ("playback"). Si no, se deja que el sistema decida ("auto").
let ignorarSilencio = false;
export function sonarEnSilencio(si: boolean) {
  ignorarSilencio = si;
  aplicarSesion();
}
function aplicarSesion() {
  const n = typeof navigator !== "undefined" ? (navigator as unknown as { audioSession?: { type: string } }) : null;
  if (n?.audioSession) {
    try {
      n.audioSession.type = ignorarSilencio ? "playback" : "auto";
    } catch {
      /* navegador sin soporte */
    }
  }
}

// Se llama dentro de un toque. `excepto`: el sonido que ya se está tocando en
// ese mismo toque (no se abre en mudo para no cortarlo).
export function desbloquearAudio(excepto?: NombreSonido) {
  aplicarSesion();
  (Object.keys(SONIDOS_WAV) as NombreSonido[]).forEach((nombre) => {
    if (nombre === excepto || abiertos.has(nombre) || pedidos.has(nombre)) return;
    const a = reproductor(nombre);
    if (!a || !a.paused) return;
    a.muted = true;
    a.play()
      .then(() => {
        abiertos.add(nombre);
        if (pedidos.has(nombre)) return;
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      })
      .catch(() => {
        a.muted = false;
      });
  });
}

// Devuelve si de verdad sonó (el navegador puede bloquearlo sin un toque).
function sonar(nombre: NombreSonido): Promise<boolean> {
  const a = reproductor(nombre);
  if (!a) return Promise.resolve(false);
  aplicarSesion();
  pedidos.add(nombre);
  a.muted = false;
  try {
    a.currentTime = 0;
  } catch {
    /* aún sin cargar */
  }
  return a
    .play()
    .then(() => {
      abiertos.add(nombre);
      return true;
    })
    .catch(() => false)
    .finally(() => setTimeout(() => pedidos.delete(nombre), 1500));
}

// ¡Clac! Al empezar un bloque o al guardar una toma.
export const sonarClaqueta = () => sonar("claqueta");
// Aviso suave, 5 minutos antes.
export const sonarPrevio = () => sonar("previo");
// Entrada a la app (al cargar donde se pueda; en iPhone, al tocar la portada).
export const sonarEntrada = () => sonar("entrada");
