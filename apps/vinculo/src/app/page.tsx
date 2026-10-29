import Link from "next/link";
import { prisma } from "@/lib/db";
import { usuarioActual } from "@/lib/sesion-servidor";
import { Avatar, TarjetaVacante } from "@/components/vacante";

export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  "solo-reclutadores": "Esa sección es solo para cuentas de reclutador.",
  "solo-candidatos": "Esa sección es solo para cuentas de candidato.",
};

export default async function Portada({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams;
  const [usuario, destacadas, empresas, total] = await Promise.all([
    usuarioActual(),
    prisma.vacante.findMany({ where: { estado: "PUBLICADA" }, include: { empresa: true }, orderBy: { publicadaEn: "desc" }, take: 6 }),
    prisma.empresa.findMany({ orderBy: { nombre: "asc" }, include: { _count: { select: { vacantes: { where: { estado: "PUBLICADA" } } } } } }),
    prisma.vacante.count({ where: { estado: "PUBLICADA" } }),
  ]);
  return (
    <>
      {aviso && AVISOS[aviso] && (
        <div className="alerta alerta-error" role="alert">
          {AVISOS[aviso]}
        </div>
      )}
      <section className="v-heroe" aria-labelledby="t-heroe">
        <h1 id="t-heroe">{usuario ? `Hola, ${usuario.nombre.split(" ")[0]}. ` : ""}Encuentra tu próximo empleo</h1>
        <p>{total} vacantes publicadas por empresas ficticias. Postúlate con «Solicitud sencilla» en dos pasos.</p>
        <form action="/empleos" className="v-buscador" role="search">
          <label htmlFor="q" className="visualmente-oculto">
            Cargo, habilidad o empresa
          </label>
          <input id="q" name="q" placeholder="Cargo, habilidad o empresa" />
          <label htmlFor="ciudad" className="visualmente-oculto">
            Ciudad
          </label>
          <input id="ciudad" name="ciudad" placeholder="Ciudad" />
          <button type="submit" className="v-boton">
            Buscar empleos
          </button>
        </form>
      </section>
      <div className="v-rejilla">
        <section aria-labelledby="t-destacadas">
          <div className="v-linea">
            <h2 id="t-destacadas">Vacantes recientes</h2>
            <Link href="/empleos">Ver todas</Link>
          </div>
          <ul className="v-lista-vacantes">
            {destacadas.map((v) => (
              <TarjetaVacante key={v.id} v={v} />
            ))}
          </ul>
        </section>
        <aside className="v-tarjeta" aria-labelledby="t-empresas">
          <h2 id="t-empresas">Empresas en Vínculo</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
            {empresas.map((e) => (
              <li key={e.id} style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                <Avatar nombre={e.nombre} color={e.color} />
                <span>
                  <Link href={`/empresas/${e.slug}`}>{e.nombre}</Link>
                  <span className="v-meta" style={{ display: "block" }}>
                    {e._count.vacantes} {e._count.vacantes === 1 ? "vacante" : "vacantes"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
