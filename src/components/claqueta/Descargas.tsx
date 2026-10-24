// Descargas en PDF del proyecto (la ruta /pdf/[doc] arma cada hoja con la
// plantilla de marca). Enlaces normales: en iPhone abren el PDF para compartir
// o guardar en Archivos.
import { IconoDescarga } from "@/components/Iconos";

export function BotonPdf({ proyectoId, doc, texto = "Descargar PDF" }: { proyectoId: string; doc: string; texto?: string }) {
  return (
    <a
      href={`/app/estudio/proyectos/${proyectoId}/pdf/${doc}`}
      download
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-tinta/[0.06] px-3.5 py-1.5 text-xs font-semibold text-tinta transition hover:bg-tinta/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo"
    >
      <IconoDescarga className="h-3.5 w-3.5" />
      {texto}
    </a>
  );
}

export function TarjetaDescargas({ proyectoId, docs }: { proyectoId: string; docs: { doc: string; t: string }[] }) {
  if (!docs.length) return null;
  return (
    <section className="tarjeta">
      <p className="etiqueta">Documentos en PDF</p>
      <p className="mt-1 text-sm text-muted">Listos para imprimir o mandar, con la plantilla de Nietzsche Studios.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {docs.map((d) => (
          <BotonPdf key={d.doc} proyectoId={proyectoId} doc={d.doc} texto={d.t} />
        ))}
      </div>
    </section>
  );
}
