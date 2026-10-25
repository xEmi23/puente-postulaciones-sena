import Link from "next/link";
import { prisma } from "@/lib/db";
import { fecha } from "@/lib/fechas";

export const dynamic = "force-dynamic";

export default async function CatalogoVacantes() {
  const vacantes = await prisma.vacante.findMany({ where: { estado: "PUBLICADA" }, orderBy: { codigo: "asc" } });
  return (
    <>
      <section className="o-heroe">
        <h1>Encuentra tu próximo empleo</h1>
        <p>Postúlate en minutos, sin crear una cuenta. Solo necesitas tu hoja de vida en PDF.</p>
      </section>
      {vacantes.length === 0 ? (
        <p className="vacio">No hay vacantes publicadas en este momento.</p>
      ) : (
        <ul className="o-lista" aria-label="Vacantes publicadas">
          {vacantes.map((v) => (
            <li key={v.id}>
              <article className="o-tarjeta">
                <h2>
                  <Link href={`/origen/vacantes/${v.codigo}`}>{v.titulo}</Link>
                </h2>
                <ul className="o-meta">
                  <li className="o-chip">{v.area}</li>
                  <li className="o-chip">{v.ciudad}</li>
                  <li className="o-chip">{v.modalidad}</li>
                </ul>
                <p style={{ margin: 0, color: "#57534e", fontSize: "0.92rem" }}>{v.descripcion.slice(0, 140)}…</p>
                <p style={{ margin: "auto 0 0", fontSize: "0.8rem", color: "#57534e" }}>
                  Código {v.codigo}
                  {v.publicadaEn ? ` · Publicada el ${fecha(v.publicadaEn)}` : ""}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
