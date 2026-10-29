import Link from "next/link";
import { prisma } from "@/lib/db";
import { fecha } from "@/lib/fechas";
import { listarProcesos } from "@/modules/seleccion";
import { etiquetaEstadoProceso, textoVigencia, vigenciaDias } from "@/modules/procesos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Procesos" };

export default async function Procesos({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [procesos, nuevas] = await Promise.all([
    listarProcesos(),
    prisma.postulacion.groupBy({ by: ["procesoId"], where: { vista: false, descartadaEn: null }, _count: { _all: true } }),
  ]);
  const nuevasPorProceso = new Map(nuevas.map((n) => [n.procesoId, n._count._all]));
  return (
    <>
      <p className="a-migas">Desarrollo organizacional / Selección / Procesos</p>
      <div className="a-encabezado">
        <div>
          <h1>Procesos de selección</h1>
          <p className="a-sub">Andina Software S.A.S. · Las postulaciones de Vínculo llegan solas a la etapa «Postulantes» a través del puente.</p>
        </div>
        <Link href="/seleccion/procesos/nuevo" className="a-boton">
          Nuevo proceso
        </Link>
      </div>
      {error === "permiso" && (
        <div className="alerta alerta-error" role="alert">
          Tu rol no tiene acceso a esa sección.
        </div>
      )}
      {procesos.length === 0 ? (
        <p className="vacio">No hay procesos. Crea uno con «Nuevo proceso».</p>
      ) : (
        <div className="a-tabla-contenedor">
          <table className="a-tabla">
            <caption className="visualmente-oculto">Procesos de selección</caption>
            <thead>
              <tr>
                <th scope="col">N.º</th>
                <th scope="col">Título</th>
                <th scope="col">Prioridad</th>
                <th scope="col">Inicio</th>
                <th scope="col">Vigencia</th>
                <th scope="col">Estado</th>
                <th scope="col">Postulantes</th>
              </tr>
            </thead>
            <tbody>
              {procesos.map((p) => (
                <tr key={p.id} data-testid="fila-proceso" data-proceso={p.id}>
                  <td className="mono">{p.id}</td>
                  <td>
                    <Link href={`/seleccion/procesos/${p.id}`}>{p.titulo}</Link>
                    <div className="a-sub">
                      {p.area} · {p.ciudad}
                    </div>
                  </td>
                  <td>
                    <span className={`a-prioridad a-prioridad-${p.prioridad}`}>{p.prioridad}</span>
                  </td>
                  <td>{fecha(p.fechaInicio)}</td>
                  <td>{textoVigencia(vigenciaDias(p.fechaInicio))}</td>
                  <td>
                    <span className="a-estado-proceso">{etiquetaEstadoProceso(p.estado)}</span>
                  </td>
                  <td>
                    {p._count.postulaciones}
                    {(nuevasPorProceso.get(p.id) ?? 0) > 0 && <span className="a-etiqueta a-etiqueta-verde"> {nuevasPorProceso.get(p.id)} nuevas</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
