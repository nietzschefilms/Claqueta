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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <Link href="/" className="flex items-center gap-2.5 self-start rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rojo">
        <Logo className="h-8 w-8" />
        <span className="titulo text-2xl">{MARCA.nombre}</span>
      </Link>
      <h1 className="etiqueta mt-10 text-tinta">Entrar</h1>
      {aviso && <p className="alerta-error mt-4">{aviso}</p>}
      <FormEntrar />
      <Link href="/recuperar" className="mt-4 text-center text-sm text-muted underline-offset-4 hover:underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </main>
  );
}
