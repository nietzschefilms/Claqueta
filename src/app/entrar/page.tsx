import Link from "next/link";
import type { Metadata } from "next";
import { MARCA } from "@/config/marca";
import { FormEntrar } from "./FormEntrar";

export const metadata: Metadata = { title: "Entrar" };

const ESTADOS: Record<string, string> = {
  "recuperacion-invalida": "Ese link ya no sirve. Pide uno nuevo en ¿Olvidaste tu contraseña?",
  baja: "Tu cuenta está desactivada. Si es un error, escríbenos."
};

export default async function Entrar({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const aviso = estado ? ESTADOS[estado] : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <Link href="/" className="etiqueta">{MARCA.nombre}</Link>
      <h1 className="mt-2 font-display text-3xl font-bold">Entrar</h1>
      {aviso && <p className="alerta-error mt-4">{aviso}</p>}
      <FormEntrar />
      <Link href="/recuperar" className="mt-4 text-center text-sm text-muted underline-offset-4 hover:underline">
        ¿Olvidaste tu contraseña?
      </Link>
      <p className="mt-8 text-center text-xs text-muted">
        ¿No tienes cuenta? Pídela a {MARCA.correoSoporte}
      </p>
    </main>
  );
}
