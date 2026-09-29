// Íconos de línea para el menú. Trazo fino, esquinas redondas, 24×24.
// El activo se rellena un poco (como las pestañas de iOS).
type P = { activo?: boolean; className?: string };

const base = (className = "h-6 w-6") => ({
  viewBox: "0 0 24 24",
  className,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true
});

export function IconoHoy({ activo, className }: P) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.5" fill={activo ? "currentColor" : "none"} fillOpacity={0.12} />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconoSemana({ activo, className }: P) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="5" width="17" height="15" rx="3.5" fill={activo ? "currentColor" : "none"} fillOpacity={0.12} />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 16.8h.01M12 16.8h.01" strokeWidth={2.4} />
    </svg>
  );
}

export function IconoTablero({ activo, className }: P) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="4" width="5" height="16" rx="2" fill={activo ? "currentColor" : "none"} fillOpacity={0.12} />
      <rect x="9.5" y="4" width="5" height="11" rx="2" fill={activo ? "currentColor" : "none"} fillOpacity={0.12} />
      <rect x="15.5" y="4" width="5" height="13.5" rx="2" fill={activo ? "currentColor" : "none"} fillOpacity={0.12} />
    </svg>
  );
}

export function IconoAvisos({ activo, className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" fill={activo ? "currentColor" : "none"} fillOpacity={0.12} />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

export function IconoAjustes({ activo, className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.2" fill={activo ? "currentColor" : "none"} fillOpacity={0.2} />
      <circle cx="9" cy="17" r="2.2" fill={activo ? "currentColor" : "none"} fillOpacity={0.2} />
    </svg>
  );
}

export function IconoSoporte({ activo, className }: P) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.5" fill={activo ? "currentColor" : "none"} fillOpacity={0.12} />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M6 6l3.5 3.5M14.5 14.5L18 18M18 6l-3.5 3.5M9.5 14.5L6 18" />
    </svg>
  );
}

export function IconoDinero({ activo, className }: P) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="6" width="18" height="13" rx="3.5" fill={activo ? "currentColor" : "none"} fillOpacity={0.12} />
      <path d="M3 10h18" />
      <path d="M16.5 14.5h1.5" strokeWidth={2.2} />
      <path d="M6 6l9.5-2.5a1.5 1.5 0 0 1 1.8 1.1L17.7 6" />
    </svg>
  );
}

export function IconoEscuela({ activo, className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M2.5 9L12 4.5 21.5 9 12 13.5z" fill={activo ? "currentColor" : "none"} fillOpacity={0.12} />
      <path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11M21.5 9v5" />
    </svg>
  );
}

// Claqueta de cine: el estudio del equipo.
export function IconoEstudio({ activo, className }: P) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="9.5" width="17" height="11" rx="2.5" fill={activo ? "currentColor" : "none"} fillOpacity={0.12} />
      <path d="M3.8 9.3 19 5.2l.8 3-15.2 4.1z" />
      <path d="m8 8.2 1.6 2.4M12.4 7l1.6 2.4" />
    </svg>
  );
}

export function IconoMas({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export const ICONO_MENU: Record<string, (p: P) => React.ReactElement> = {
  "/app": IconoHoy,
  "/app/semana": IconoSemana,
  "/app/estudio": IconoEstudio,
  "/app/escuela": IconoEscuela,
  "/app/tablero": IconoTablero,
  "/app/dinero": IconoDinero,
  "/app/notificaciones": IconoAvisos,
  "/app/ajustes": IconoAjustes,
  "/app/soporte": IconoSoporte
};
