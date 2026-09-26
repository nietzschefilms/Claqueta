import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MARCA } from "@/config/marca";

// Portada mínima. Cada cliente la reemplaza por su landing (o la deja así si
// la app es solo para su equipo). Con sesión iniciada, va directo a la app.
export default async function Portada() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <p className="etiqueta">{MARCA.firma}</p>
      <h1 className="mt-2 text-balance font-display text-4xl font-bold">{MARCA.nombre}</h1>
      <p className="mt-3 text-muted">{MARCA.descripcion}</p>
      <div className="mt-8 flex flex-col gap-2">
        <Link href="/entrar" className="btn-primario">Entrar</Link>
      </div>
    </main>
  );
}
