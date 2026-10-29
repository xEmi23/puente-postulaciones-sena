import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Avatar, TarjetaVacante } from "@/components/vacante";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const e = await prisma.empresa.findUnique({ where: { slug: (await params).slug } });
  return { title: e?.nombre ?? "Empresa" };
}

export default async function PaginaEmpresa({ params }: { params: Promise<{ slug: string }> }) {
  const e = await prisma.empresa.findUnique({
    where: { slug: (await params).slug },
    include: { vacantes: { where: { estado: "PUBLICADA" }, orderBy: { publicadaEn: "desc" }, include: { empresa: true } } },
  });
  if (!e) notFound();
  return (
    <>
      <section className="v-tarjeta" aria-labelledby="t-empresa">
        <div className="v-perfil-portada" style={{ background: `linear-gradient(120deg, ${e.color}33, ${e.color})` }} />
        <div className="v-perfil-cabeza">
          <Avatar nombre={e.nombre} color={e.color} grande />
          <h1 id="t-empresa">{e.nombre}</h1>
          <p className="v-meta">
            {e.sector} · {e.ciudad} · {e.tamano}
          </p>
          <p>{e.descripcion}</p>
          <a href={e.sitioWeb} rel="noopener noreferrer" target="_blank">
            Sitio web (ficticio) ↗
          </a>
        </div>
      </section>
      <h2>Vacantes de {e.nombre}</h2>
      {e.vacantes.length === 0 ? (
        <p className="v-tarjeta vacio">Esta empresa no tiene vacantes publicadas en este momento.</p>
      ) : (
        <ul className="v-lista-vacantes">
          {e.vacantes.map((v) => (
            <TarjetaVacante key={v.id} v={v} />
          ))}
        </ul>
      )}
    </>
  );
}
