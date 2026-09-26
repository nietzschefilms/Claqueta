"use client";

export default function ErrorPagina({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Algo falló al cargar</h1>
      <p className="mt-2 text-muted">Vuelve a intentar. Si sigue pasando, cierra y abre la app.</p>
      <button onClick={reset} className="btn-primario mt-6">Reintentar</button>
    </main>
  );
}
