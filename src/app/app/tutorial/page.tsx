import type { Metadata } from "next";
import Link from "next/link";
import { requerirSesion } from "@/lib/sesion";
import { Encabezado } from "@/components/Encabezado";

export const metadata: Metadata = { title: "Recorrido" };

// RECORRIDO · pantalla por pantalla, botón por botón. Las etiquetas entre
// comillas son las que salen en la app; si cambias un botón, cámbialo aquí.

type Paso = [boton: string, que: string];
type Pantalla = { id: string; titulo: string; donde: string; para: string; pasos: Paso[]; quien?: string; ir?: string };

const PANTALLAS: Pantalla[] = [
  {
    id: "entrar",
    titulo: "Entrar por primera vez",
    donde: "app.nietzschefilms.com",
    para: "Te mandamos por WhatsApp tu usuario (correo o celular) y una contraseña temporal.",
    pasos: [
      ["Correo o celular", "Escribe tu correo, o tu celular a 10 dígitos si así te dieron de alta."],
      ["Contraseña", "La temporal que te mandaron. Cópiala tal cual."],
      ["Entrar", "Te pide crear tu propia contraseña: al menos 12 caracteres, con minúsculas, mayúsculas y un número."],
      ["Tu correo (opcional)", "Si entraste con celular, aquí puedes poner tu correo. Puedes seguir entrando con tu celular."],
      ["Guardar contraseña", "Listo, ya estás dentro. Luego sale la bienvenida."],
      ["¿Olvidaste tu contraseña?", "En la pantalla de entrar. Pon tu correo o celular y toca \"Avisar a soporte\": te mandan un acceso nuevo por WhatsApp."]
    ]
  },
  {
    id: "instalar",
    titulo: "Instalarla en tu celular",
    donde: "Safari (iPhone) o Chrome (Android)",
    para: "Así se abre como app y te llegan los avisos.",
    pasos: [
      ["iPhone", "En Safari toca Compartir → \"Agregar a pantalla de inicio\". Abre Claqueta desde el ícono."],
      ["Android", "En Chrome toca ⋮ → \"Instalar app\"."],
      ["Activar notificaciones", "Dentro de la app: Ajustes → \"Activar notificaciones\". En iPhone solo funciona con la app instalada."]
    ]
  },
  {
    id: "menu",
    titulo: "El menú y el botón rojo",
    donde: "En toda la app",
    para: "Cómo moverte y capturar cualquier cosa.",
    pasos: [
      ["Menú", "En compu está a la izquierda: Hoy, Semana, Estudio, Tablero, Dinero, Escuela, Avisos y Ajustes. En celular, abajo salen Hoy, Semana, Estudio, Tablero y Dinero."],
      ["Campana (arriba)", "Tus avisos. El punto rojo dice que hay nuevos."],
      ["Engranaje (arriba)", "Ajustes."],
      ["Luna / sol", "Modo oscuro o claro."],
      ["Botón rojo \"+\" (o \"Nueva toma\", tecla N)", "Captura una tarea: \"¿Qué hay que hacer?\", el \"Frente\", \"Para quién\" (Mía, de un compañero, de todo el equipo o Privada), \"Para cuándo\", \"Tiempo\", \"Impacto\" y si \"Se repite\". Toca \"Guardar toma\"."],
      ["Círculo junto a una tarea", "La marca como hecha (o la regresa)."],
      ["Nombre de una tarea", "La abre para editarla: fecha, \"Recordatorios\" (\"+ Aviso\" a una hora exacta), tiempo, impacto. \"Quitar sin hacer\" la archiva (pide un segundo toque)."]
    ]
  },
  {
    id: "hoy",
    titulo: "Hoy",
    donde: "Menú → Hoy",
    para: "Tu hoja de llamado del día: qué hacer y a qué hora.",
    ir: "/app",
    pasos: [
      ["Tarjeta Ahora / Lo que sigue", "El bloque en el que estás, con salón y profe si es clase, y hasta 3 tareas para hacer ahí."],
      ["Las 3 de hoy", "Lo más importante del día según urgencia e impacto."],
      ["No cupo hoy → \"A mañana →\"", "Pasa esa tarea a mañana."],
      ["Línea de tiempo", "Todo tu día en bloques. \"Cambiar bloque\" te lleva a tu rutina para ajustarlo."]
    ]
  },
  {
    id: "semana",
    titulo: "Semana y Rutina",
    donde: "Menú → Semana",
    para: "Tus 7 días: clases, bloques de foco, citas del Estudio y lo que vence.",
    ir: "/app/semana",
    pasos: [
      ["← / →", "Semana anterior o siguiente. \"Hoy\" te regresa."],
      ["Escuela", "(En celular) abre tu escuela."],
      ["Editar rutina", "Tu semana tipo. Elige el día, toca un bloque para cambiarlo o \"+ Agregar bloque\": nombre, \"Empieza\", \"Termina\", tipo (\"Trabajo\" o \"Fijo\") y frente. \"Guardar\". Aplica a todas las semanas."]
    ]
  },
  {
    id: "tablero",
    titulo: "Tablero",
    donde: "Menú → Tablero",
    para: "Una columna por frente: tu Escuela, Nietzsche Studios y lo personal.",
    ir: "/app/tablero",
    pasos: [
      ["Tarjeta", "Tarea con prioridad, de quién es (\"Tú\", un compañero o \"Todo el equipo\"), fecha y tiempo."],
      ["Estado", "Pendiente, Haciendo o Hecho. Así el equipo ve quién está en qué."],
      ["+ Agregar (abajo de cada columna)", "Escribe, elige fecha y toca \"+\"."],
      ["Quitar", "La archiva (pide confirmar)."]
    ]
  },
  {
    id: "estudio",
    titulo: "Estudio: Agenda",
    donde: "Menú → Estudio",
    para: "Lo que compartimos como Nietzsche Studios. Arriba: \"Agenda\", \"Radar\" y \"Proyectos\".",
    ir: "/app/estudio",
    pasos: [
      ["¿Cuándo podemos?", "Elige duración (30 min a 3 h) y te dice los huecos donde todos están libres. Toca uno y se llena la cita."],
      ["Agendar", "Nombre, tipo (Junta, Rodaje, Scouting, Llamada, Ensayo, Entrega), fecha, horas, lugar y \"Quién va\" (nadie marcado = todos). \"Agendar para el equipo\": les sale en su día con aviso."],
      ["Próximo → ✕", "Cancela una cita."]
    ]
  },
  {
    id: "radar",
    titulo: "Estudio: Radar",
    donde: "Estudio → Radar",
    para: "Prospectos de clientes, en vivo para todos.",
    ir: "/app/estudio/radar",
    pasos: [
      ["Filtros", "\"Activos\", \"Míos\", por estado o \"Todos\". Buscador por nombre o colonia."],
      ["WhatsApp / Correo / @instagram / Copiar DM", "Contacta al prospecto con el mensaje ya armado."],
      ["Abrir tarjeta", "\"Estado\", \"Quién lo lleva\", \"Siguiente paso\" con fecha y \"Notas\"."],
      ["Agregar prospecto", "Nombre, Instagram, colonia, giro y pitch → \"Agregar al Radar\"."]
    ]
  },
  {
    id: "proyectos",
    titulo: "Proyectos",
    donde: "Estudio → Proyectos",
    para: "Todos los proyectos del estudio.",
    ir: "/app/estudio/proyectos",
    pasos: [
      ["Nuevo proyecto", "Nombre, tipo (Spot, Corto, Videoclip, Documental, Serie), cliente → \"Crear proyecto\". Quien lo crea queda de Productor y arranca con la lista de lo que falta."],
      ["Tarjeta de proyecto", "Ábrelo. Arriba cambias el estado: Idea, Preproducción, Rodaje, Post, Entregado."]
    ]
  },
  {
    id: "resumen",
    titulo: "Proyecto: Resumen",
    donde: "Dentro de un proyecto → Resumen",
    para: "Cómo vamos, quién hace qué y qué falta. Lo ve todo el equipo.",
    pasos: [
      ["Tu llamado", "Si te llamaron a rodaje: \"Confirmo, ahí estaré\" o \"No puedo\". Producción se entera al momento."],
      ["Cómo vamos", "El % listo y lo que falta en rojo."],
      ["Falta / En proceso / Listo", "Cambia el estado de cada cosa. Al ponerlo En proceso quedas tú de responsable."],
      ["Nadie lo ha tomado", "Elige quién trabaja en eso. Le llega aviso."],
      ["Fecha", "Fecha límite. Sale en la Línea del tiempo; si se pasa dice \"Vencido\"."],
      ["Agregar algo que falta", "Escríbelo y toca \"Agregar\"."],
      ["Equipo del proyecto", "Los puestos de cada quien. El productor elige \"¿Quién?\" y \"Puesto\" y toca \"Dar puesto\"."],
      ["Documentos", "Pega un link (Drive, PDF, moodboard) con nombre → \"Agregar link\". Dirección puede marcar \"Solo para dirección\"."]
    ]
  },
  {
    id: "guion",
    titulo: "Proyecto: Guion",
    donde: "Proyecto → Guion",
    quien: "Productor, director y asistente de dirección.",
    para: "Guion en vivo con formato profesional, como Final Draft.",
    pasos: [
      ["Escena / Acción / Personaje / Paréntesis / Diálogo / Transición / Nota", "El tipo de renglón. Enter pasa al siguiente, Tab cambia el tipo, ⌘1 a ⌘7 lo elige directo. Escribir \"INT.\" o \"EXT.\" lo vuelve escena."],
      ["Importar", "Pega un guion en Fountain o texto."],
      [".fountain / PDF", "Descarga el guion."],
      ["Panel de escenas", "Toca una para saltar. Ves páginas y minutos aproximados. Se guarda solo y ves quién está escribiendo."]
    ]
  },
  {
    id: "desglose",
    titulo: "Proyecto: Desglose",
    donde: "Proyecto → Desglose",
    quien: "Dirección.",
    para: "El breakdown: qué necesita cada escena.",
    pasos: [
      ["Categoría + Agregar elemento", "Reparto, extras, utilería, vestuario, maquillaje, arte, vehículos, efectos, sonido, cámara."],
      ["Detectado en mayúsculas", "Sugerencias del guion: tócalas para agregarlas."]
    ]
  },
  {
    id: "shotlist",
    titulo: "Proyecto: Shotlist y Storyboard",
    donde: "Proyecto → Shotlist / Storyboard",
    quien: "Todos lo ven; lo editan dirección y fotografía.",
    para: "Cada plano con tamaño, movimiento, lente y minutos; y su cuadro de storyboard.",
    pasos: [
      ["+ Plano", "Tamaño, qué se ve y minutos."],
      ["Modo set", "Botones grandes en rodaje: \"+\" suma toma y eliges la buena."],
      ["Círculo", "Marca el plano como filmado."],
      ["Storyboard → tocar un cuadro", "Toma foto o sube un dibujo o referencia. \"Imprimir / PDF\"."]
    ]
  },
  {
    id: "llamados",
    titulo: "Proyecto: Llamados (crew y casting)",
    donde: "Proyecto → Llamados",
    quien: "Todos lo ven; lo arma dirección.",
    para: "Quién va al rodaje, a qué hora y si ya confirmó.",
    pasos: [
      ["Agregar al crew", "Elige el puesto y a alguien del equipo o de fuera."],
      ["Abrir personaje", "Casting: pon el personaje; si aún no hay actor queda \"Falta quién\"."],
      ["Día / hora", "El llamado. Si la persona tiene cuenta (\"Es …\"), le llega el aviso para confirmar."],
      ["Mandar por WhatsApp", "Para quien no tiene cuenta: abre WhatsApp con el mensaje del llamado ya escrito."],
      ["Confirmo / No puedo", "Si el llamado es tuyo, confírmalo aquí."]
    ]
  },
  {
    id: "plan",
    titulo: "Proyecto: Plan de rodaje",
    donde: "Proyecto → Plan de rodaje",
    quien: "Dirección.",
    para: "Qué escenas se filman cada día.",
    pasos: [
      ["Armar plan", "Elige primer día y páginas por día: reparte las escenas solo."],
      ["▲ / ▼", "Cambia el orden de las escenas del día."],
      ["Agendar rodaje", "Pone cada día de rodaje en la agenda de todo el equipo, con aviso."]
    ]
  },
  {
    id: "dia",
    titulo: "Proyecto: Minuto a minuto",
    donde: "Proyecto → Minuto a minuto",
    quien: "Todos lo ven en vivo; lo avanza dirección.",
    para: "El plan del día de rodaje y si vamos a tiempo.",
    pasos: [
      ["Armar plan del día", "Con la hora de llamado arma: llamado, montaje, cada plano, comida y cierre."],
      ["Empezar / Terminar", "En set, dirección marca cada bloque. Arriba sale \"Vamos a tiempo\" o \"Vamos 15 min atrasados\" y a qué hora terminamos."],
      ["Agregar bloque", "Tipo, hora, minutos y qué se hace."],
      ["Deshacer", "Regresa un bloque a pendiente."]
    ]
  },
  {
    id: "hoja",
    titulo: "Proyecto: Hoja de llamado y Reporte",
    donde: "Proyecto → Hoja de llamado / Reporte diario",
    para: "La hoja para imprimir o mandar en PDF, y lo que pasó cada día.",
    pasos: [
      ["Imprimir / PDF", "La hoja por día: locación, escenas, reparto, crew, planos y lo que debe estar en set."],
      ["Reporte diario", "Horas reales (llamado, primera toma, comida, wrap), clima, incidentes y notas."]
    ]
  },
  {
    id: "presupuesto",
    titulo: "Proyecto: Presupuesto",
    donde: "Proyecto → Presupuesto",
    quien: "Solo el productor.",
    para: "Costos, utilidad y precio al cliente.",
    pasos: [
      ["Cargar plantilla de spot", "Arranca con las cuentas típicas."],
      ["Topsheet", "Imprevistos, utilidad, IVA y \"Precio cerrado con el cliente\"."],
      ["Ver cotización para el cliente", "Vista para imprimir y mandar."]
    ]
  },
  {
    id: "escuela",
    titulo: "Escuela",
    donde: "Menú → Escuela",
    para: "Tus clases y tareas, en orden de prioridad.",
    ir: "/app/escuela",
    pasos: [
      ["Nueva tarea", "\"¿Qué te dejaron?\", materia, dificultad (Fácil, Media, Difícil) y fecha de entrega → \"Agregar tarea\"."],
      ["+ Piso", "Guarda el piso de un salón para que salga en tus avisos."],
      ["En este orden", "Tus tareas ordenadas solas. Márcalas hechas con el círculo."]
    ]
  },
  {
    id: "dinero",
    titulo: "Dinero",
    donde: "Menú → Dinero",
    para: "Tu dinero personal. Nadie más lo ve.",
    ir: "/app/dinero",
    pasos: [
      ["Agregar cuenta", "Débito, efectivo o tarjeta, con lo que tienes hoy."],
      ["Anotar gasto", "Monto, categoría y con qué pagaste → \"Guardar gasto\"."],
      ["Otra entrada", "Lo que te pagaron → \"Guardar entrada\"."],
      ["Agregar cobro fijo", "Lo que te pagan seguido; te avisa cuando toca."]
    ]
  },
  {
    id: "avisos",
    titulo: "Avisos y Ajustes",
    donde: "Campana y engranaje",
    para: "Tus avisos y tu cuenta.",
    ir: "/app/ajustes",
    pasos: [
      ["Avisos → Marcar todo como leído", "Toca un aviso para ir a donde pasó."],
      ["Tus datos", "Nombre y teléfono. Si entras con celular, \"Poner mi correo\"."],
      ["Activar notificaciones / Enviar prueba", "Para que te lleguen al celular."],
      ["Interruptores", "Qué avisos quieres y si suena la claqueta."],
      ["Cerrar sesión", "Para cambiar contraseña: sal y usa \"¿Olvidaste tu contraseña?\"."]
    ]
  }
];

export default async function Tutorial() {
  await requerirSesion();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Encabezado etiqueta="Bienvenido a Nietzsche Studios" titulo="Recorrido" />
      <p className="-mt-2 text-muted">Pantalla por pantalla, botón por botón. Toca un tema para abrirlo.</p>

      <nav aria-label="Temas del recorrido" className="flex flex-wrap gap-1.5">
        {PANTALLAS.map((p) => (
          <a key={p.id} href={`#${p.id}`} className="rounded-full bg-tinta/[0.06] px-3 py-1.5 text-xs font-semibold text-muted hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
            {p.titulo.replace("Proyecto: ", "")}
          </a>
        ))}
      </nav>

      <ol className="space-y-3">
        {PANTALLAS.map((p, n) => (
          <li key={p.id} id={p.id} className="scroll-mt-24">
            <details className="tarjeta group" open={n === 0}>
              <summary className="flex cursor-pointer list-none items-start gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
                <span className="cifra grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tinta text-sm font-semibold text-fondo">{n + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="titulo block text-2xl">{p.titulo}</span>
                  <span className="block text-sm text-muted">{p.para}</span>
                </span>
                <span aria-hidden="true" className="text-muted transition group-open:rotate-90">›</span>
              </summary>
              <div className="mt-4 space-y-3 border-t border-borde/60 pt-4">
                <p className="etiqueta">Dónde: {p.donde}</p>
                {p.quien && <p className="text-xs font-semibold text-acento">Quién lo usa: {p.quien}</p>}
                <dl className="space-y-2.5">
                  {p.pasos.map(([b, q]) => (
                    <div key={b}>
                      <dt className="text-sm font-semibold">{b}</dt>
                      <dd className="text-sm text-muted">{q}</dd>
                    </div>
                  ))}
                </dl>
                {p.ir && (
                  <Link href={p.ir} className="enlace-mono inline-block">
                    Ir a {p.titulo.split(":")[0]} →
                  </Link>
                )}
              </div>
            </details>
          </li>
        ))}
      </ol>
      <p className="text-center text-sm text-muted">¿Algo no se entiende o falla? Escríbele a Jamez. Bienvenido al set.</p>
    </div>
  );
}
