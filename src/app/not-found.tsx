import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <p className="etiqueta">Error 404</p>
      <h1 className="mt-2 titulo text-5xl">Esta página no existe</h1>
      <p className="mt-2 text-muted">Puede que el link esté mal escrito o que la página se haya movido.</p>
      <Link href="/app" className="btn-primario mt-6">Ir al inicio</Link>
    </main>
  );
}
