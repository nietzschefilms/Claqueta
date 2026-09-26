"use client";

import { useState } from "react";

// Campo de contraseña con botón de "ver / ocultar" (el ojito). Reemplaza a un
// <input type="password"> normal: acepta las mismas props (name, value, onChange,
// required, minLength, placeholder, className, autoComplete, etc.). El botón
// alterna entre texto y puntitos para que la persona confirme que la escribió bien.
type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function CampoContrasena({ className = "", ...props }: Props) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative w-full">
      <input
        {...props}
        type={ver ? "text" : "password"}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? "Ocultar contraseña" : "Ver contraseña"}
        aria-pressed={ver}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted transition-colors hover:text-tinta"
      >
        {ver ? (
          // ojo tachado (ocultar)
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 002.8 2.8" />
            <path d="M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7 0 1-.7 2.3-1.9 3.5M6.1 6.1C3.9 7.5 3 9.5 3 12c0 0 3 7 9 7 1.4 0 2.7-.3 3.8-.8" />
          </svg>
        ) : (
          // ojo (ver)
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        )}
      </button>
    </div>
  );
}
