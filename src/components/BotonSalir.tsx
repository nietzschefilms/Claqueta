"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function BotonSalir({ className = "btn-secundario" }: { className?: string }) {
  const [saliendo, setSaliendo] = useState(false);
  async function salir() {
    setSaliendo(true);
    await createClient().auth.signOut();
    window.location.href = "/entrar";
  }
  return (
    <button type="button" onClick={salir} disabled={saliendo} className={className}>
      {saliendo ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
