// Cuentas por celular: quien no da correo entra con su número. Por dentro la
// cuenta usa un correo interno que nunca recibe nada (el dominio no tiene buzón)
// y la persona puede poner su correo real cuando quiera.
export const DOMINIO_CELULAR = "cel.nietzschefilms.com";

const soloDigitos = (t: string) => t.replace(/\D/g, "");

// 10 dígitos = celular de México; se le pone el 52.
export function correoDeCelular(tel: string): string | null {
  const d = soloDigitos(tel);
  if (d.length < 10 || d.length > 13) return null;
  return `${d.length === 10 ? `52${d}` : d}@${DOMINIO_CELULAR}`;
}

export const esCorreoDeCelular = (correo: string | null | undefined) => !!correo && correo.toLowerCase().endsWith(`@${DOMINIO_CELULAR}`);

// "55 1234 5678" o "ana@x.com" → el correo con el que vive la cuenta.
export function identificadorDeAcceso(texto: string): string | null {
  const t = texto.trim().toLowerCase();
  if (t.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
  return correoDeCelular(t);
}

// Para mostrar: "55 1234 5678" en vez del correo interno.
export function celularDeCorreo(correo: string): string {
  const d = correo.split("@")[0].replace(/^52(?=\d{10}$)/, "");
  return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : d;
}

export const comoSeEntra = (correo: string) => (esCorreoDeCelular(correo) ? celularDeCorreo(correo) : correo);
