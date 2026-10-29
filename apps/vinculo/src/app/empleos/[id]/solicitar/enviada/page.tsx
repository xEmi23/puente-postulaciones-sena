import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { ActualizarCada } from "@/components/actualizar-cada";
import { ETIQUETA_ESTADO } from "@/modules/estados";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitud enviada" };

const ENTREGA: Record<string, string> = { PENDIENTE: "Enviando a la empresa…", ENVIADO: "Entregada a la empresa", FALLIDO: "No se pudo entregar" };

export default async function SolicitudEnviada({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string }> }) {
  const { id } = await params;
  const { p } = await searchParams;
  const u = await exigirUsuario(`/empleos/${id}/solicitar/enviada?p=${p ?? ""}`, "CANDIDATO");
  if (!p || !/^[0-9a-f-]{36}$/.test(p)) notFound();
  const post = await prisma.postulacion.findFirst({ where: { id: p, candidatoId: u.id }, include: { vacante: { include: { empresa: true } }, outbox: true } });
  if (!post) notFound();
  const entrega = post.outbox[0];
  return (
    <div className="v-tarjeta v-confirmacion" style={{ maxWidth: 640, margin: "0 auto" }}>
      {entrega?.estado === "PENDIENTE" && <ActualizarCada ms={1500} />}
      <p className="v-icono" aria-hidden="true">
        ✓
      </p>
      <h1>¡Tu solicitud fue enviada!</h1>
      <p>
        Postulaste a <strong>{post.vacante.titulo}</strong> en {post.vacante.empresa.nombre}.
      </p>
      <p>
        Estado: <strong>{ETIQUETA_ESTADO[post.estado]}</strong>
      </p>
      {entrega ? (
        <p className="v-ayuda">
          Entrega a la empresa:{" "}
          <span data-estado-entrega={entrega.estado} role="status">
            {ENTREGA[entrega.estado]}
          </span>
        </p>
      ) : (
        <p className="v-ayuda">La empresa revisará tu solicitud directamente en Vínculo.</p>
      )}
      <p className="v-ayuda">
        Referencia: <code data-testid="job-application-id">{post.jobApplicationId}</code>
      </p>
      <p>
        <Link href="/mis-postulaciones" className="v-boton">
          Ver mis postulaciones
        </Link>
      </p>
    </div>
  );
}
