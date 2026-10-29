import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fecha, fechaHora } from "@/lib/fechas";
import { formatoTamano } from "@/lib/archivos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ficha del postulante" };

export default async function FichaPostulante({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await prisma.postulante.findUnique({
    where: { id },
    include: {
      documentos: { orderBy: { creadoEn: "desc" }, omit: { contenido: true } },
      postulaciones: { include: { proceso: true, etapa: true, historial: { orderBy: { creadoEn: "asc" } } }, orderBy: { creadaEn: "desc" } },
    },
  });
  if (!p) notFound();
  const historial = p.postulaciones
    .flatMap((post) => post.historial.map((h) => ({ ...h, proceso: post.proceso })))
    .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
  const textoMovimiento = (h: (typeof historial)[number]) =>
    h.tipo === "CREADA"
      ? `Ingresó a «${h.aEtapa}»`
      : h.tipo === "MOVIDA"
        ? `Pasó de «${h.deEtapa}» a «${h.aEtapa}»`
        : h.tipo === "DESCARTADA"
          ? `Descartado en «${h.deEtapa}»`
          : `Restaurado en «${h.deEtapa}»`;

  return (
    <>
      <p className="a-migas">
        <Link href="/seleccion/postulantes">Postulantes</Link> / <span aria-current="page">Ficha</span>
      </p>
      <div className="a-encabezado">
        <div>
          <h1>
            {p.nombre} {p.apellido}
          </h1>
          <p className="a-sub">Postulante desde el {fecha(p.creadoEn)}</p>
        </div>
      </div>

      <section className="a-ficha" aria-labelledby="t-datos">
        <h2 id="t-datos">Datos de contacto</h2>
        <dl className="a-datos">
          <dt>Correo</dt>
          <dd>{p.correo}</dd>
          <dt>Teléfono</dt>
          <dd>{p.telefono ?? "—"}</dd>
          <dt>Ciudad</dt>
          <dd>{p.ciudad ?? "—"}</dd>
          <dt>Referencia externa</dt>
          <dd className="mono">{p.referenciaExterna ?? "—"}</dd>
        </dl>
      </section>

      <section className="a-ficha" aria-labelledby="t-procesos">
        <h2 id="t-procesos">Procesos</h2>
        {p.postulaciones.length === 0 ? (
          <p className="vacio">No está en ningún proceso.</p>
        ) : (
          <div className="a-tabla-contenedor">
            <table className="a-tabla">
              <caption className="visualmente-oculto">Procesos del postulante</caption>
              <thead>
                <tr>
                  <th scope="col">Proceso</th>
                  <th scope="col">Etapa</th>
                  <th scope="col">Fuente</th>
                  <th scope="col">Calificación</th>
                  <th scope="col">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {p.postulaciones.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <Link href={`/seleccion/procesos/${post.procesoId}`}>
                        {post.procesoId} · {post.proceso.titulo}
                      </Link>
                    </td>
                    <td>
                      {post.etapa.nombre}
                      {post.descartadaEn && <span className="a-etiqueta a-etiqueta-roja"> Descartado</span>}
                    </td>
                    <td>{post.fuente}</td>
                    <td>{post.calificacion === "SIN_CALIFICAR" ? "Sin calificar" : post.calificacion}</td>
                    <td>{fecha(post.creadaEn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="a-ficha" aria-labelledby="t-docs">
        <h2 id="t-docs">Documentos</h2>
        {p.documentos.length === 0 ? (
          <p className="vacio">No hay documentos.</p>
        ) : (
          <ul className="a-historial">
            {p.documentos.map((d) => (
              <li key={d.id}>
                <a href={`/documentos/${d.id}/descargar`} data-testid="descargar-cv" download>
                  Descargar {d.nombreArchivo}
                </a>{" "}
                · {formatoTamano(d.tamano)} · recibido el {fechaHora(d.creadoEn)}
                <div className="a-ayuda">
                  SHA-256: <code className="mono" data-testid="sha256-documento" style={{ wordBreak: "break-all" }}>{d.sha256}</code>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="a-ficha" aria-labelledby="t-historial">
        <h2 id="t-historial">Historial</h2>
        {historial.length === 0 ? (
          <p className="vacio">Sin movimientos.</p>
        ) : (
          <ol className="a-historial" data-testid="historial">
            {historial.map((h) => (
              <li key={h.id}>
                <strong>{fechaHora(h.creadoEn)}</strong> · Proceso {h.proceso.id}: {textoMovimiento(h)} · <span className="a-sub">{h.autor}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
