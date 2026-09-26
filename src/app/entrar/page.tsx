import Link from "next/link";
import type { Metadata } from "next";
import { MARCA } from "@/config/marca";
import { FormEntrar } from "./FormEntrar";
import { Logo } from "@/components/claqueta/Logo";

export const metadata: Metadata = { title: "Entrar" };

const ESTADOS: Record<string, string> = {
  "recuperacion-invalida": "Ese link ya no sirve. Pide uno nuevo en ¿Olvidaste tu contraseña?",
  baja: "Tu cuenta está desactivada. Si es un error, escríbenos.",
  privada: "Esta app es privada. Esa cuenta no tiene acceso."
};

export default async function Entrar({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const aviso = estado ? ESTADOS[estado] : null;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-4 py-12">
      <div className="aparecer mb-8 flex flex-col items-center text-center">
        <Logo className="h-16 w-16" />
        <h1 className="titulo mt-5 text-6xl">{MARCA.nombre}</h1>
        <p className="mt-2 max-w-xs text-sm text-muted">{MARCA.descripcion}</p>
      </div>
      <div className="tarjeta aparecer p-6">
        <p className="etiqueta text-tinta">Entrar</p>
        {aviso && <p className="alerta-error mt-4">{aviso}</p>}
        <FormEntrar />
        <Link href="/recuperar" className="mt-4 block rounded-full text-center text-sm text-muted underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <p className="etiqueta mt-8 text-center">{MARCA.firma}</p>
    </main>
  );
}
