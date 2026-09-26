// Marca de Nietzsche Studios: aro abierto con el punto rojo en la abertura.
// El aro toma el color del texto; el punto siempre es rojo puro.
export function Logo({ className = "h-7 w-7", titulo = "Claqueta" }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={titulo}>
      <path
        d="M50 12 A 38 38 0 1 0 81.1 28.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="64.7" cy="19.3" r="7.2" fill="rgb(var(--c-rojo))" />
    </svg>
  );
}
