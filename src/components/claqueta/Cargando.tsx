// Carga con la marca: el aro abierto y el punto rojo giran juntos; la línea
// respira y el punto late. Sin JS (solo CSS), así aparece desde el primer instante.
export function LogoCargando({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`logo-carga ${className}`} aria-hidden="true">
      <g className="giro">
        <path className="aro" d="M50 12 A 38 38 0 1 0 81.1 28.2" pathLength={100} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        <circle className="punto" cx="64.7" cy="19.3" r="7.2" fill="rgb(var(--c-rojo))" />
      </g>
    </svg>
  );
}

// Pantalla de carga: el logo al centro y una palabra.
export function Cargando({ texto = "Cargando", pantallaCompleta = false }: { texto?: string; pantallaCompleta?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`grid place-items-center ${pantallaCompleta ? "min-h-[100dvh]" : "min-h-[60vh]"}`}>
      <div className="flex flex-col items-center gap-4">
        <LogoCargando />
        <p className="etiqueta">{texto}</p>
      </div>
    </div>
  );
}
