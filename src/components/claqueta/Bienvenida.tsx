"use client";

import { useEffect, useState, useTransition } from "react";
import { marcarBienvenida } from "@/app/app/ajustes/acciones";
import { FRENTES, type FrenteId } from "@/lib/claqueta/frentes";
import { estiloFrente } from "./frente-ui";

type Escena = { etiqueta: string; titulo: React.ReactNode; texto: React.ReactNode; extra?: React.ReactNode };

// Primera vez en Claqueta: bienvenida a la familia Nietzsche Studios en cinco
// escenas, como abrir una película. Se ve una vez; al final arranca el tutorial de Hoy.
export function Bienvenida({ nombre, companeros, frentes }: { nombre: string; companeros: string[]; frentes: FrenteId[] }) {
  const [i, setI] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const [, iniciar] = useTransition();
  const primer = (nombre || "").split(" ")[0] || "";

  const equipo = companeros.map((c) => c.split(" ")[0]).filter(Boolean);

  const escenas: Escena[] = [
    {
      etiqueta: "Escena 1 · Toma 1",
      titulo: (
        <>
          Bienvenido a la familia{primer ? `, ${primer}` : ""}<span className="text-rojo">.</span>
        </>
      ),
      texto: "Esto es Nietzsche Studios. Aquí vive todo lo que hacemos juntos: proyectos, rodajes, llamados y tu día. Qué bueno tenerte en el set.",
      extra: equipo.length > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <span className="flex -space-x-2" aria-hidden="true">
            {equipo.slice(0, 8).map((n, k) => (
              <span key={k} className="grid h-10 w-10 place-items-center rounded-full bg-f-nietzsche text-sm font-bold text-white ring-2 ring-fondo">
                {n.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </span>
          <span className="text-sm text-muted">Ya están aquí: {new Intl.ListFormat("es-MX").format(equipo.slice(0, 8))}</span>
        </div>
      )
    },
    {
      etiqueta: "Escena 2 · Tu día",
      titulo: "Tu día, en orden",
      texto: "En Hoy ves qué hacer y a qué hora. En Semana, tus clases y bloques. El Tablero junta lo de tu escuela y lo de Nietzsche Studios. Tu dinero es solo tuyo: nadie más lo ve.",
      extra: (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {frentes.map((f) => (
            <span key={f} style={estiloFrente(f)} className="pastilla normal-case tracking-normal">
              <span className="h-2 w-2 rounded-full bg-[rgb(var(--fc))]" aria-hidden="true" />
              <span className="font-sans text-xs font-semibold">{FRENTES[f].nombre}</span>
            </span>
          ))}
        </div>
      )
    },
    {
      etiqueta: "Escena 3 · Estudio",
      titulo: "Donde se hace cine",
      texto: "En Estudio están los proyectos. En cada uno tienes un puesto (dirección, foto, cámara, arte…) y ves lo que falta, quién está en qué, la línea del tiempo, el shotlist, los llamados y el plan minuto a minuto del rodaje."
    },
    {
      etiqueta: "Escena 4 · Avisos",
      titulo: "Te avisamos de todo",
      texto: "Cuando te ponen en un proyecto, te pasan algo o tienes llamado, te llega un aviso. Confirma tu llamado con un toque. Activa los avisos en Ajustes para que te lleguen al celular."
    },
    {
      etiqueta: "Escena 5 · Acción",
      titulo: (
        <>
          El punto rojo lo es todo<span className="text-rojo">.</span>
        </>
      ),
      texto: "Cualquier idea, pendiente o tarea: toca el botón rojo y captúrala. Al terminar te enseño cada pantalla botón por botón, y si te pierdes, toca el ? de arriba.",
      extra: (
        <span className="mx-auto mt-6 grid h-16 w-16 place-items-center rounded-full bg-rojo text-3xl font-light text-white shadow-[0_16px_40px_-12px_rgb(255_0_0/0.7)]" aria-hidden="true">
          +
        </span>
      )
    }
  ];
  const ultima = i === escenas.length - 1;
  const e = escenas[i];

  const terminar = () => {
    setSaliendo(true);
    iniciar(async () => {
      await marcarBienvenida();
    });
  };

  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowRight" || ev.key === "Enter") (ultima ? terminar : () => setI((n) => n + 1))();
      if (ev.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  if (saliendo) return null;

  return (
    <div data-bienvenida role="dialog" aria-modal="true" aria-label="Bienvenida a Nietzsche Studios" className="fixed inset-0 z-[90] flex flex-col bg-fondo text-tinta">
      <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
        <span className="etiqueta">{e.etiqueta}</span>
        <button type="button" onClick={terminar} className="enlace-mono text-muted">
          Saltar
        </button>
      </div>

      <div key={i} className="aparecer mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 text-center">
        <h1 className="titulo text-[clamp(2.6rem,11vw,4.5rem)] leading-[0.95]">{e.titulo}</h1>
        <p className="mx-auto mt-5 max-w-md text-base text-muted">{e.texto}</p>
        {e.extra}
      </div>

      <div className="mx-auto w-full max-w-xl px-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
        <div className="mb-5 flex justify-center gap-1.5" aria-hidden="true">
          {escenas.map((_, n) => (
            <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-8 bg-rojo" : "w-1.5 bg-tinta/20"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {i > 0 && (
            <button type="button" onClick={() => setI(i - 1)} className="btn-secundario px-5">
              Atrás
            </button>
          )}
          <button type="button" autoFocus onClick={ultima ? terminar : () => setI(i + 1)} className="btn-rojo flex-1 py-3.5 text-base">
            {ultima ? "¡Acción!" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
