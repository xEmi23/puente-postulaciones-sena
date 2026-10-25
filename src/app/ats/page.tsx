import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Procesos" };

export default async function Procesos() {
  const procesos = await prisma.proceso.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { postulaciones: true } }, postulaciones: { where: { vista: false }, select: { id: true } } },
  });
  return (
    <>
      <div className="a-encabezado">
        <div>
          <h1>Procesos de selección</h1>
          <p className="a-sub">Postulaciones recibidas automáticamente desde el portal de origen a través del puente.</p>
        </div>
      </div>
      {procesos.length === 0 ? (
        <p className="vacio">No hay procesos. Ejecuta «npm run demo:reset» para sembrar los procesos de demostración.</p>
      ) : (
        <div className="a-tabla-contenedor">
          <table className="a-tabla">
            <caption className="visualmente-oculto">Procesos de selección</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Proceso</th>
                <th scope="col">Área</th>
                <th scope="col">Ciudad</th>
                <th scope="col">Estado</th>
                <th scope="col">Postulantes</th>
              </tr>
            </thead>
            <tbody>
              {procesos.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.id}</td>
                  <td>
                    <Link href={`/ats/procesos/${p.id}`} style={{ fontWeight: 700 }}>
                      {p.nombre}
                    </Link>
                  </td>
                  <td>{p.area}</td>
                  <td>{p.ciudad}</td>
                  <td>{p.estado === "ABIERTO" ? "Abierto" : "Cerrado"}</td>
                  <td>
                    {p._count.postulaciones}
                    {p.postulaciones.length > 0 && (
                      <span className="a-insignia" style={{ background: "#d1fae5", color: "#065f46", marginLeft: 6 }}>
                        {p.postulaciones.length} nuevo{p.postulaciones.length === 1 ? "" : "s"}
                      </span>
                    )}
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
