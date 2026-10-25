import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fecha } from "@/lib/fechas";
import { ActualizarCada } from "@/components/actualizar-cada";

export const dynamic = "force-dynamic";

const CALIFICACION: Record<string, string> = { SIN_CALIFICAR: "Sin calificar" };

export default async function TableroProceso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const procesoId = Number(id);
  if (!Number.isInteger(procesoId)) notFound();
  const proceso = await prisma.proceso.findUnique({
    where: { id: procesoId },
    include: {
      etapas: {
        orderBy: { orden: "asc" },
        include: { postulaciones: { orderBy: { creadaEn: "desc" }, include: { candidato: true } } },
      },
    },
  });
  if (!proceso) notFound();
  const nuevas = proceso.etapas.flatMap((e) => e.postulaciones).filter((p) => !p.vista).length;

  async function marcarVistas() {
    "use server";
    await prisma.postulacionAts.updateMany({ where: { procesoId, vista: false }, data: { vista: true } });
    revalidatePath(`/ats/procesos/${procesoId}`);
  }

  return (
    <>
      <ActualizarCada ms={3000} />
      <nav aria-label="Ruta de navegación" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        <Link href="/ats">Procesos</Link> / <span aria-current="page">{proceso.nombre}</span>
      </nav>
      <div className="a-encabezado">
        <div>
          <h1>{proceso.nombre}</h1>
          <p className="a-sub">
            Proceso <span className="mono">{proceso.id}</span> · {proceso.area} · {proceso.ciudad} ·{" "}
            {proceso.estado === "ABIERTO" ? "Abierto" : "Cerrado"}
          </p>
        </div>
      </div>
      <div role="status" aria-live="polite">
        {nuevas > 0 && (
          <div className="a-aviso-nuevo" data-testid="aviso-nuevos">
            <span>
              {nuevas === 1 ? "1 postulante nuevo fue agregado al proceso" : `${nuevas} postulantes nuevos fueron agregados al proceso`}
            </span>
            <form action={marcarVistas}>
              <button type="submit" className="a-boton a-boton-claro">
                Entendido
              </button>
            </form>
          </div>
        )}
      </div>
      <ol className="a-tablero" aria-label="Etapas del proceso">
        {proceso.etapas.map((etapa) => (
          <li key={etapa.id} className="a-columna" data-etapa={etapa.nombre}>
            <h2>
              <span>{etapa.nombre}</span>
              <span className="a-contador" aria-label={`${etapa.postulaciones.length} postulantes`}>
                {etapa.postulaciones.length}
              </span>
            </h2>
            {etapa.postulaciones.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "#6b7280", textAlign: "center", marginTop: "2rem" }}>Sin postulantes</p>
            ) : (
              <ul className="a-tarjetas">
                {etapa.postulaciones.map((p) => (
                  <li key={p.id} className={`a-tarjeta${p.vista ? "" : " a-tarjeta-nueva"}`} data-testid="tarjeta-postulante">
                    <Link href={`/ats/candidatos/${p.candidatoId}`}>
                      {p.candidato.nombre} {p.candidato.apellido}
                    </Link>
                    <div style={{ marginTop: "0.35rem" }}>
                      <span className="a-insignia">{CALIFICACION[p.calificacion] ?? p.calificacion}</span>
                      <span className="a-insignia a-insignia-fuente">{p.fuente}</span>
                    </div>
                    <p className="a-tarjeta-meta">Postulación: {fecha(p.creadaEn)}</p>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
