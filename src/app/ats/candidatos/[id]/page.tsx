import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fecha, fechaHora } from "@/lib/fechas";
import { formatoTamano } from "@/lib/archivos";

export const dynamic = "force-dynamic";

export default async function DetalleCandidato({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await prisma.candidato.findUnique({
    where: { id },
    include: {
      documentos: { orderBy: { creadoEn: "desc" } },
      postulaciones: { include: { proceso: true, etapa: true }, orderBy: { creadaEn: "desc" } },
    },
  });
  if (!c) notFound();

  return (
    <>
      <nav aria-label="Ruta de navegación" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        <Link href="/ats">Procesos</Link>
        {c.postulaciones[0] && (
          <>
            {" / "}
            <Link href={`/ats/procesos/${c.postulaciones[0].procesoId}`}>{c.postulaciones[0].proceso.nombre}</Link>
          </>
        )}{" "}
        / <span aria-current="page">Candidato</span>
      </nav>
      <div className="a-encabezado">
        <div>
          <h1>
            {c.nombre} {c.apellido}
          </h1>
          <p className="a-sub">Candidato desde el {fecha(c.creadoEn)}</p>
        </div>
      </div>

      <section className="a-ficha" aria-labelledby="t-datos">
        <h2 id="t-datos">Información general</h2>
        <dl className="a-datos">
          <dt>Correo</dt>
          <dd>{c.correo}</dd>
          <dt>Teléfono</dt>
          <dd>{c.telefono ?? "—"}</dd>
          <dt>Ciudad</dt>
          <dd>{c.ciudad ?? "—"}</dd>
        </dl>
      </section>

      <section className="a-ficha" aria-labelledby="t-postulaciones">
        <h2 id="t-postulaciones">Postulaciones</h2>
        <div className="a-tabla-contenedor">
          <table className="a-tabla">
            <thead>
              <tr>
                <th scope="col">Proceso</th>
                <th scope="col">Etapa</th>
                <th scope="col">Calificación</th>
                <th scope="col">Fuente</th>
                <th scope="col">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {c.postulaciones.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/ats/procesos/${p.procesoId}`}>{p.proceso.nombre}</Link>
                  </td>
                  <td>{p.etapa.nombre}</td>
                  <td>{p.calificacion === "SIN_CALIFICAR" ? "Sin calificar" : p.calificacion}</td>
                  <td>{p.fuente}</td>
                  <td>{fechaHora(p.creadaEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="a-ficha" aria-labelledby="t-docs">
        <h2 id="t-docs">Documentos</h2>
        {c.documentos.length === 0 ? (
          <p className="vacio">Sin documentos.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
            {c.documentos.map((d) => (
              <li key={d.id}>
                <a className="a-boton" href={`/ats/documentos/${d.id}/descargar`} download data-testid="descargar-cv">
                  Descargar {d.tipo} ({d.nombreArchivo}, {formatoTamano(d.tamano)})
                </a>
                <p className="a-tarjeta-meta">
                  SHA-256: <code data-testid="sha256-documento">{d.sha256}</code>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
