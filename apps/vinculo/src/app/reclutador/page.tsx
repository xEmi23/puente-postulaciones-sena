import Link from "next/link";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { fecha } from "@/lib/fechas";
import { etiquetaModalidad } from "@/modules/vacantes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel de reclutador" };

const ESTADO: Record<string, string> = { BORRADOR: "Borrador", PUBLICADA: "Publicada", CERRADA: "Cerrada" };

export default async function PanelReclutador({ searchParams }: { searchParams: Promise<{ mensaje?: string }> }) {
  const u = await exigirUsuario("/reclutador", "RECLUTADOR");
  const { mensaje } = await searchParams;
  const vacantes = await prisma.vacante.findMany({
    where: { empresaId: u.empresaId ?? "00000000-0000-0000-0000-000000000000" },
    orderBy: [{ estado: "asc" }, { publicadaEn: "desc" }],
    include: { aplicacion: { select: { nombre: true } }, _count: { select: { postulaciones: true } }, postulaciones: { where: { estado: "ENVIADA" }, select: { id: true } } },
  });
  return (
    <>
      <h1>Vacantes de la empresa</h1>
      {mensaje && (
        <div className="alerta alerta-exito" role="status">
          {mensaje}
        </div>
      )}
      {vacantes.length === 0 ? (
        <div className="v-tarjeta vacio">
          Tu empresa no tiene vacantes. <Link href="/reclutador/vacantes/nueva">Publica la primera</Link>.
        </div>
      ) : (
        <div className="v-tarjeta v-tabla-contenedor">
          <table className="v-tabla">
            <caption className="visualmente-oculto">Vacantes de la empresa</caption>
            <thead>
              <tr>
                <th scope="col">Vacante</th>
                <th scope="col">Estado</th>
                <th scope="col">Recepción</th>
                <th scope="col">Solicitudes</th>
                <th scope="col">Publicada</th>
              </tr>
            </thead>
            <tbody>
              {vacantes.map((v) => (
                <tr key={v.id} data-testid="fila-vacante" data-external-job-id={v.externalJobId}>
                  <td>
                    <Link href={`/reclutador/vacantes/${v.id}`}>{v.titulo}</Link>
                    <div className="v-meta">
                      <code>{v.externalJobId}</code> · {v.ciudad} ({etiquetaModalidad(v.modalidad)})
                    </div>
                  </td>
                  <td>{ESTADO[v.estado]}</td>
                  <td>
                    {v.solicitudSencilla ? (v.aplicacion ? `Solicitud sencilla → ${v.aplicacion.nombre}` : "Solicitud sencilla (en el Simulador LinkedIn)") : "Sitio de la empresa"}
                  </td>
                  <td>
                    {v._count.postulaciones}
                    {v.postulaciones.length > 0 && <span className="v-chip v-chip-estado"> {v.postulaciones.length} sin revisar</span>}
                  </td>
                  <td>{v.publicadaEn ? fecha(v.publicadaEn) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
