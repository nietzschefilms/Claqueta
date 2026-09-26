import { MENU, type ItemMenu, type Rol } from "@/config/marca";

// Qué ve cada persona en el menú, según su rol y si es de soporte.
export function menuPara(rol: Rol, esSoporte: boolean): ItemMenu[] {
  return MENU.filter((i) => {
    if (i.soloSoporte) return esSoporte;
    return i.roles === "todos" || i.roles.includes(rol);
  });
}
