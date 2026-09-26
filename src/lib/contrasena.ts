// Regla de contraseñas de Claqueta. Debe coincidir con Supabase Auth
// (mínimo 12, minúscula, mayúscula y número). Supabase la vuelve a revisar;
// esto solo da el mensaje en español antes de mandarla.
export const MIN_CONTRASENA = 12;

export function errorContrasena(pass: string): string | null {
  if (pass.length < MIN_CONTRASENA) return `Usa al menos ${MIN_CONTRASENA} caracteres.`;
  if (!/[a-z]/.test(pass) || !/[A-Z]/.test(pass) || !/[0-9]/.test(pass))
    return "Mezcla minúsculas, mayúsculas y al menos un número.";
  return null;
}
