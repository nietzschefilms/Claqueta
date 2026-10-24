import { urlAvatar } from "@/lib/perfil";

// Foto de perfil, o la inicial sobre el color que eligió la persona.
export function Avatar({ nombre, color, avatar, tam = "h-10 w-10 text-sm" }: { nombre: string; color?: string | null; avatar?: string | null; tam?: string }) {
  const url = urlAvatar(avatar);
  const fondo = color ?? "#486888";
  const claro = /^#(EBE7E0|F2B705)$/i.test(fondo);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${tam} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${tam} grid shrink-0 place-items-center rounded-full font-bold ${claro ? "text-[#0A0A0A]" : "text-white"}`} style={{ backgroundColor: fondo }} aria-hidden="true">
      {(nombre || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
