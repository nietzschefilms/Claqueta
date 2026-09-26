import type { Config } from "tailwindcss";

// Todos los colores salen de variables CSS (canales R G B) definidas en
// src/app/globals.css. Para vestir la app de un cliente se cambian ahí, no aquí.
const c = (v: string) => `rgb(var(--c-${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: ["selector", '[data-tema="oscuro"]'],
  theme: {
    extend: {
      colors: {
        fondo: c("fondo"),
        superficie: c("superficie"),
        borde: c("borde"),
        tinta: c("tinta"),
        muted: c("muted"),
        primario: { DEFAULT: c("primario"), texto: c("primario-texto") },
        acento: c("acento"),
        ok: c("ok"),
        aviso: c("aviso"),
        peligro: c("peligro"),
        rojo: c("rojo"),
        f: {
          ek: c("f-ek"),
          escuela: c("f-escuela"),
          topmart: c("f-topmart"),
          rt: c("f-rt"),
          nietzsche: c("f-nietzsche"),
          personal: c("f-personal")
        }
      },
      fontFamily: {
        display: ["var(--fuente-display)", "system-ui", "sans-serif"],
        sans: ["var(--fuente-texto)", "system-ui", "sans-serif"],
        mono: ["var(--fuente-mono)", "ui-monospace", "monospace"]
      },
      borderRadius: {
        tarjeta: "var(--radio-tarjeta)",
        control: "var(--radio-control)"
      },
      boxShadow: {
        suave: "0 10px 30px -14px rgb(var(--c-tinta) / 0.25)"
      }
    }
  },
  plugins: []
};
export default config;
