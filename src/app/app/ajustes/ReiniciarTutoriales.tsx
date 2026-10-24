"use client";

import { useState } from "react";
import { reiniciarTutoriales } from "@/components/claqueta/Tutorial";

export function ReiniciarTutoriales() {
  const [hecho, setHecho] = useState(false);
  return (
    <button type="button" className="btn-secundario" aria-live="polite" onClick={() => { reiniciarTutoriales(); setHecho(true); }}>
      {hecho ? "Listo: te los enseño otra vez en cada pantalla" : "Volver a ver los tutoriales"}
    </button>
  );
}
