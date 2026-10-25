import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ActualizarCada } from "@/components/actualizar-cada";

export const dynamic = "force-dynamic";

const ETIQUETA_ENTREGA = {
  PENDIENTE: "Enviando a la empresa…",
  ENVIADO: "Entregada a la empresa",
  FALLIDO: "No se pudo entregar",
} as const;

export default async function PostulacionEnviada({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await prisma.postulacionOrigen.findUnique({
    where: { id },
    include: { vacante: true, outbox: { orderBy: { creadoEn: "desc" }, take: 1 } },
  });
  if (!p) notFound();
  const entrega = p.outbox[0]?.estado ?? "PENDIENTE";

  return (
    <section className="o-confirmacion o-panel">
      {entrega === "PENDIENTE" && <ActualizarCada ms={2000} />}
      <div className="o-icono" aria-hidden="true">
        ✓
      </div>
      <h1 style={{ marginTop: 0 }}>¡Tu postulación fue enviada!</h1>
      <p>
        Te postulaste a <strong>{p.vacante.titulo}</strong>. La empresa recibirá tu hoja de vida directamente en su sistema de
        selección.
      </p>
      <p role="status" aria-live="polite">
        <span className="o-estado-entrega" data-estado-entrega={entrega}>
          {ETIQUETA_ENTREGA[entrega]}
        </span>
      </p>
      <p style={{ fontSize: "0.85rem", color: "#78716c" }}>
        Referencia de la postulación: <code data-testid="job-application-id">{p.jobApplicationId}</code>
      </p>
      <Link href="/origen" className="o-boton o-boton-secundario">
        Ver más vacantes
      </Link>
    </section>
  );
}
