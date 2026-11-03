import { etiquetaFuente } from "@/nucleo/fuentes";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { conectorATS } from "@/salidas";
import { MAX_ARCHIVOS } from "@/entradas/importador/servicio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Importar CV" };

export default async function Importar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await exigirUsuario("/importar");
  const { error } = await searchParams;
  const [procesos, correspondencias, recientes] = await Promise.all([
    conectorATS().listarProcesos().catch(() => null),
    prisma.correspondencia.findMany({ where: { activa: true }, orderBy: [{ fuente: "asc" }, { externalJobId: "asc" }] }),
    prisma.loteImportacion.findMany({ where: { usuarioId: u.id }, orderBy: { creadoEn: "desc" }, take: 5, include: { _count: { select: { archivos: true } } } }),
  ]);
  const abiertos = (procesos ?? []).filter((p) => p.estado === "INICIADO");

  return (
    <>
      <h1>Importar CV</h1>
      <p className="p-sub">
        Para los CV que descargaste a mano de una vacante (por ejemplo, de LinkedIn). El Puente lee cada PDF y sugiere el correo y el teléfono; tú revisas la tabla y confirmas. Nada llega al ATS sin tu confirmación, y el mismo PDF
        importado dos veces en el mismo proceso no se duplica.
      </p>
      <div role="status" aria-live="polite">
        {error && <div className="alerta alerta-error">{error}</div>}
      </div>

      <section className="p-tarjeta" aria-labelledby="t-subir">
        <h2 id="t-subir">1 · Elige el proceso y los archivos</h2>
        {!procesos ? (
          <p className="alerta alerta-error">No se pudo consultar la lista de procesos del ATS. Revisa la conexión en Conexiones.</p>
        ) : (
          <form action="/api/importador/lotes" method="post" encType="multipart/form-data" data-testid="form-importar">
            <div className="p-campo">
              <label htmlFor="imp-proceso">Proceso del ATS (Simulador BUK)</label>
              <select id="imp-proceso" name="procesoAtsId" required defaultValue="">
                <option value="" disabled>
                  Elige un proceso…
                </option>
                <optgroup label="Procesos iniciados">
                  {abiertos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} · {p.titulo}
                    </option>
                  ))}
                </optgroup>
                {correspondencias.length > 0 && (
                  <optgroup label="Por correspondencia (vacante → proceso)">
                    {correspondencias.map((c) => (
                      <option key={c.id} value={c.procesoAtsId}>
                        {etiquetaFuente(c.fuente)} · {c.vacanteExterna ?? c.externalJobId} → {c.procesoAtsId}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="p-campo">
              <label htmlFor="imp-archivos">Hojas de vida (PDF, hasta {MAX_ARCHIVOS} de 5 MB cada una)</label>
              <input id="imp-archivos" name="archivos" type="file" accept="application/pdf,.pdf" multiple required />
            </div>
            <div className="p-campo">
              <label htmlFor="imp-csv">CSV opcional (columnas archivo, nombres, apellidos, correo, telefono)</label>
              <input id="imp-csv" name="csv" type="file" accept=".csv,text/csv" />
              <p className="p-nota">Lo que trae el CSV gana sobre lo que sugiere el Puente. Sirve para la exportación de Recruiter guardada como CSV.</p>
            </div>
            <button className="p-boton" type="submit">
              Leer y sugerir datos
            </button>
          </form>
        )}
      </section>

      {recientes.length > 0 && (
        <section className="p-tarjeta" aria-labelledby="t-recientes">
          <h2 id="t-recientes">Tus importaciones recientes</h2>
          <ul>
            {recientes.map((l) => (
              <li key={l.id}>
                <Link href={`/importar/${l.id}`}>
                  {fechaHora(l.creadoEn)} · proceso {l.procesoAtsId} · {l._count.archivos} archivo(s)
                </Link>{" "}
                {l.confirmadoEn ? "· confirmada" : "· pendiente de confirmar"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
