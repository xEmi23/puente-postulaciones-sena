import Link from "next/link";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { fecha } from "@/lib/fechas";
import { ETIQUETA_ESTADO } from "@/modules/estados";
import { Avatar } from "@/components/vacante";
import { ActualizarCada } from "@/components/actualizar-cada";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis postulaciones" };

const PASOS = ["ENVIADA", "VISTA", "CV_DESCARGADO"] as const;

export default async function MisPostulaciones() {
  const u = await exigirUsuario("/mis-postulaciones", "CANDIDATO");
  const posts = await prisma.postulacion.findMany({ where: { candidatoId: u.id }, include: { vacante: { include: { empresa: true } } }, orderBy: { aplicadaEn: "desc" } });
  return (
    <>
      <ActualizarCada ms={5000} />
      <h1>Mis postulaciones</h1>
      <p className="v-subtitulo">Sigue el avance de cada solicitud: Enviada → Vista por la empresa → CV descargado.</p>
      {posts.length === 0 ? (
        <div className="v-tarjeta vacio">
          Aún no te has postulado. <Link href="/empleos">Busca empleos</Link> con «Solicitud sencilla».
        </div>
      ) : (
        <ul className="v-lista-vacantes">
          {posts.map((p) => {
            const alcanzado = p.estado === "NO_SELECCIONADO" ? -1 : PASOS.indexOf(p.estado);
            return (
              <li key={p.id} className="v-vacante" data-testid="mi-postulacion" data-job-application-id={p.jobApplicationId}>
                <Avatar nombre={p.vacante.empresa.nombre} color={p.vacante.empresa.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3>
                    <Link href={`/empleos/${p.vacanteId}`}>{p.vacante.titulo}</Link>
                  </h3>
                  <p className="v-meta">
                    {p.vacante.empresa.nombre} · Enviada el {fecha(p.aplicadaEn)}
                  </p>
                  <p style={{ margin: "0.4rem 0 0" }}>
                    Estado:{" "}
                    <strong className="v-chip v-chip-estado" data-testid="estado-postulacion">
                      {ETIQUETA_ESTADO[p.estado]}
                    </strong>
                  </p>
                  {p.estado !== "NO_SELECCIONADO" && (
                    <ol className="v-pasos" aria-label="Avance" style={{ marginTop: "0.5rem", flexWrap: "wrap" }}>
                      {PASOS.map((paso, i) => (
                        <li key={paso} aria-current={i === alcanzado ? "step" : undefined} style={i < alcanzado ? { background: "var(--v-primario-suave)", color: "var(--v-primario-oscuro)" } : undefined}>
                          {ETIQUETA_ESTADO[paso]}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
