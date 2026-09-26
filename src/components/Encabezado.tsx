// Encabezado de página: etiqueta mono arriba y título condensado grande.
export function Encabezado({ etiqueta, titulo, children }: { etiqueta?: string; titulo: string; children?: React.ReactNode }) {
  return (
    <header className="aparecer flex flex-wrap items-end justify-between gap-3">
      <div>
        {etiqueta && <p className="etiqueta">{etiqueta}</p>}
        <h1 className="titulo mt-1 text-6xl md:text-7xl">{titulo}</h1>
      </div>
      {children}
    </header>
  );
}
