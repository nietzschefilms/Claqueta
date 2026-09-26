"use client";

// Interruptor estilo iOS sobre un checkbox real (se envía con el formulario y se lee con lector de pantalla).
export function Interruptor(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className="relative inline-flex shrink-0">
      <input type="checkbox" {...props} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="h-7 w-12 rounded-full bg-tinta/15 transition peer-checked:bg-ok peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-rojo peer-disabled:opacity-50"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.25)] transition peer-checked:translate-x-5"
      />
    </span>
  );
}
