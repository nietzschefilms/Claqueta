// Guiones de los tutoriales (tipo videojuego) de cada pantalla, como en EK Bars.
// el: qué se ilumina. "nav:/ruta" = botón del menú; "nav:mas" = botón Más;
// "texto:etiquetas|regex" = elemento por su texto; o un selector CSS.
// caja: ilumina la tarjeta completa que contiene al elemento.
// siempre: el paso sale aunque el elemento no esté (al centro, sin foco).
// Si el elemento no está en pantalla (celular vs compu, permisos), el paso se salta.

export type Paso = { el?: string; caja?: boolean; siempre?: boolean; titulo: string; texto: string; cuando?: string; tip?: string };
export type Tour = { clave: string; titulo: string; roles: string[]; ruta: RegExp; pasos: Paso[] };

const TODOS = ["admin", "miembro"];

const AYUDA: Paso = { el: "[data-tour=ayuda]", titulo: "El botón de ayuda", texto: "Si se te olvida algo, toca este “?” en cualquier pantalla y te la vuelvo a explicar, botón por botón.", tip: "En Ajustes puedes volver a ver todos los tutoriales." };
const AVISOS: Paso = { el: "[aria-label^=Avisos]", titulo: "Tus avisos", texto: "Aquí llega todo: llamados, guion o shotlist publicados, cosas que te tocan y recordatorios. El punto rojo dice que hay algo sin leer.", cuando: "Te llegue una notificación y quieras volver a verla." };
const CAPTURA: Paso = { el: "[aria-label='Capturar tarea']", titulo: "El botón rojo", texto: "Cualquier idea, pendiente o tarea: tócalo y captúrala en segundos. Claqueta la acomoda en tu día según su urgencia.", cuando: "Se te ocurra algo y no quieras olvidarlo.", tip: "Ponle fecha y cuánto tarda: así la acomoda mejor." };
const MAS: Paso = { el: "nav:mas", titulo: "Más", texto: "Todo lo que no cabe abajo: Tablero, Equipo, Escuela, Dinero, Avisos y Ajustes.", cuando: "Busques algo que no ves en la barra de abajo." };
const TEMA: Paso = { el: "[aria-label^='Cambiar a modo']", titulo: "Claro u oscuro", texto: "Cambia Claqueta entre modo oscuro y modo claro.", cuando: "Estés en exteriores y no veas bien la pantalla." };

export const TUTORIALES: Tour[] = [
  {
    clave: "hoy", titulo: "Hoy", roles: TODOS, ruta: /^\/app\/?$/,
    pasos: [
      { titulo: "Esta es tu hoja de llamado", texto: "Hoy junta lo que te toca: a qué hora, qué sigue y qué es lo más importante. Te enseño cada parte en un minuto." },
      { el: "section[aria-label='Ahora'], section[aria-label='Lo que sigue']", titulo: "Lo que estás haciendo", texto: "El bloque en el que estás ahora (clase, rodaje, trabajo) y cuánto falta para que termine. Cuando acaba, pasa solo al que sigue.", tip: "Si activas los avisos, suena la claqueta al empezar cada bloque." },
      { el: "#mi-llamado", caja: true, titulo: "Tu próximo llamado", texto: "La hora y el proyecto de tu siguiente rodaje. Desde aquí lo confirmas y abres la hoja de llamado.", cuando: "Te llegue un llamado nuevo: confírmalo para que producción sepa que vas." },
      { el: "texto:p,h2,h3|^Te toca en producción", caja: true, titulo: "Te toca en producción", texto: "Lo que tienes asignado en los proyectos: tu parte del avance y sus fechas.", cuando: "Quieras saber qué falta de tu lado." },
      { el: "#tres", caja: true, titulo: "Las 3 de hoy", texto: "Tus tres tareas más importantes, ordenadas por puntaje (urgencia, peso del frente y fecha). Márcalas con el círculo cuando las termines.", tip: "Si algo no te da tiempo, muévelo a mañana y no pasa nada." },
      { el: "#linea", caja: true, titulo: "Tu día completo", texto: "La línea de tiempo con tus clases, rodajes y bloques de trabajo, hora por hora." },
      CAPTURA,
      { el: "nav:/app/estudio", titulo: "Estudio", texto: "Los proyectos de Nietzsche Studios y los tuyos, la agenda del equipo y todas las herramientas de producción." },
      { el: "nav:/app/semana", titulo: "Semana", texto: "Tu semana completa: escuela, rodajes y lo que vence." },
      MAS, AVISOS, TEMA, AYUDA
    ]
  },
  {
    clave: "agenda", titulo: "Agenda del equipo", roles: TODOS, ruta: /^\/app\/estudio\/?$/,
    pasos: [
      { titulo: "La agenda del equipo", texto: "Juntas, rodajes y citas de todo el estudio, cruzadas con los horarios de la escuela de cada quien." },
      { el: "nav[aria-label=Estudio]", titulo: "Las pestañas del Estudio", texto: "Agenda para las citas del equipo y Proyectos para todo lo de producción." },
      { el: "texto:button|Lo que me toca", titulo: "Solo lo tuyo", texto: "Filtra la agenda para ver solo las citas en las que vas tú.", cuando: "Quieras saber rápido a qué tienes que llegar." },
      { el: "texto:h2,h3,p|^Agendar", caja: true, titulo: "Agendar algo", texto: "Pon qué es, el día y la hora, y marca quién va. Si alguien tiene clase a esa hora, te avisa antes de guardar.", tip: "Si no marcas a nadie, va todo el equipo." },
      AYUDA
    ]
  },
  {
    clave: "proyectos", titulo: "Proyectos", roles: TODOS, ruta: /^\/app\/estudio\/proyectos\/?$/,
    pasos: [
      { titulo: "Tus proyectos", texto: "Aquí viven los proyectos del estudio en los que trabajas y los tuyos personales." },
      { el: "texto:h2|^Del estudio", titulo: "Del estudio", texto: "Los proyectos de Nietzsche Studios. Ves lo que te toca según tu puesto en cada uno." },
      { el: "texto:h2|^Mis proyectos", titulo: "Mis proyectos", texto: "Tus proyectos personales: un guion propio, un corto, una tarea. Solo tú los ves y tienen todas las herramientas.", cuando: "Quieras desarrollar algo tuyo o hacer tu versión de un ejercicio." },
      { el: "texto:button,a|^Nuevo proyecto", titulo: "Nuevo proyecto", texto: "Crea un proyecto: ponle nombre, tipo (estudiantil, comercial, personal…) y quién lo ve." },
      AYUDA
    ]
  },
  {
    clave: "proyecto", titulo: "Un proyecto", roles: TODOS, ruta: /^\/app\/estudio\/proyectos\/[0-9a-f-]{36}\/?$/,
    pasos: [
      { titulo: "Todo el proyecto en un lugar", texto: "Guion, rodaje, gente y dinero, como en StudioBinder. Lo que ves depende de tu puesto." },
      { el: "nav[aria-label='Secciones del proyecto']", titulo: "Las secciones", texto: "Resumen, Guion, Rodaje (shotlist, storyboard, guion técnico, floor plan, minuto a minuto, hoja de llamado), Gente y Dinero.", tip: "Dentro de cada sección salen sus herramientas en una segunda fila." },
      { el: "texto:button|^Preproducción$", titulo: "En qué etapa va", texto: "Idea, preproducción, rodaje, post o entregado. Lo cambia dirección." },
      { el: "texto:p|^Documentos en PDF", caja: true, titulo: "Todo en PDF", texto: "Cada documento del proyecto, listo para imprimir o mandar, con la plantilla de Nietzsche Studios.", cuando: "Tengas que mandar el guion, la hoja de llamado o el shotlist a alguien." },
      { el: "texto:p,h2,h3|^Lineamientos", caja: true, titulo: "Lineamientos", texto: "Las reglas de la tarea o del cliente. Las que se pueden revisar solas (tope de planos, movimientos) se palomean solas con el shotlist." },
      { el: "texto:p,h2,h3|^Cómo vamos", caja: true, titulo: "Cómo vamos", texto: "El avance del proyecto: qué falta, quién lo tiene y para cuándo.", tip: "Si algo es tuyo, también te sale en Hoy." },
      { el: "texto:h2,h3,p|^Equipo del proyecto", caja: true, titulo: "El equipo", texto: "Quién tiene qué puesto. El productor los reparte." },
      { el: "texto:a|^Rodaje$", titulo: "Rodaje", texto: "Shotlist, storyboard, guion técnico con foto de tu toma, floor plan por escena, minuto a minuto en vivo y la hoja de llamado." },
      { el: "texto:a|^Gente$", titulo: "Gente", texto: "Crew call y casting con confirmación: cada quien confirma desde su app." },
      AYUDA
    ]
  },
  {
    clave: "semana", titulo: "Semana", roles: TODOS, ruta: /^\/app\/semana\/?$/,
    pasos: [
      { titulo: "Tu semana", texto: "Los siete días con tus clases, rodajes y bloques, más lo que vence." },
      { el: "texto:a|^Editar rutina", titulo: "Tu rutina", texto: "Aquí cambias tu horario fijo: escuela, trabajo y lo que se repite cada semana.", cuando: "Cambie tu horario de clases." },
      AYUDA
    ]
  },
  {
    clave: "tablero", titulo: "Tablero", roles: TODOS, ruta: /^\/app\/tablero\/?$/,
    pasos: [
      { titulo: "Tu tablero", texto: "Todas tus tareas por frente (escuela, Nietzsche, personal…), ordenadas por puntaje." },
      { el: "nav[aria-label='Ir a frente']", titulo: "Salta a un frente", texto: "Toca un frente para ir directo a sus tareas." },
      CAPTURA, AYUDA
    ]
  },
  {
    clave: "equipo", titulo: "Equipo", roles: TODOS, ruta: /^\/app\/equipo\/?$/,
    pasos: [
      { titulo: "El equipo", texto: "La gente de Nietzsche Studios: su perfil filmmaker, su Instagram, su reel y qué hacen en cada proyecto." },
      { el: "texto:a|Tu perfil filmmaker", titulo: "Tu perfil", texto: "Ponle foto o color, tu frase, Instagram, sitio, reel, Spotify y Letterboxd.", cuando: "Quieras que el equipo vea tu trabajo." },
      AYUDA
    ]
  }
];

export function tutorialPara(rol: string, ruta: string): Tour | null {
  return TUTORIALES.find((t) => t.roles.includes(rol) && t.ruta.test(ruta)) ?? null;
}
