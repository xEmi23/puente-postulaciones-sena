import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Avatar } from "@/components/vacante";

export const dynamic = "force-dynamic";

const mes = (aaaamm: string | null) => {
  if (!aaaamm) return "Actualidad";
  const [a, m] = aaaamm.split("-");
  return `${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][Number(m) - 1] ?? ""} ${a}`;
};

async function cargar(slug: string) {
  return prisma.perfil.findUnique({
    where: { slug },
    include: { user: { select: { name: true, rol: true } }, experiencia: { orderBy: { orden: "asc" } }, educacion: { orderBy: { orden: "asc" } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = await cargar((await params).slug);
  return { title: p?.user.name ?? "Perfil" };
}

/** Perfil público: sin correo ni teléfono (solo los ve la empresa cuando la persona se postula). */
export default async function PerfilPublico({ params }: { params: Promise<{ slug: string }> }) {
  const p = await cargar((await params).slug);
  if (!p) notFound();
  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <section className="v-tarjeta" aria-labelledby="t-perfil">
        <div className="v-perfil-portada" />
        <div className="v-perfil-cabeza">
          <Avatar nombre={p.user.name} persona grande />
          <h1 id="t-perfil">{p.user.name}</h1>
          <p style={{ margin: 0 }}>{p.titular || "Sin titular"}</p>
          <p className="v-meta">{p.ciudad ? `${p.ciudad}, Colombia` : ""}</p>
        </div>
      </section>
      {p.acercaDe && (
        <section className="v-tarjeta" aria-labelledby="t-acerca">
          <h2 id="t-acerca">Acerca de</h2>
          <p>{p.acercaDe}</p>
        </section>
      )}
      <section className="v-tarjeta" aria-labelledby="t-exp">
        <h2 id="t-exp">Experiencia</h2>
        {p.experiencia.length === 0 ? (
          <p className="v-meta">Sin experiencia registrada.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.9rem" }}>
            {p.experiencia.map((e) => (
              <li key={e.id}>
                <strong>{e.cargo}</strong>
                <div className="v-meta">
                  {e.empresa} · {mes(e.desde)} – {mes(e.hasta)}
                </div>
                {e.descripcion && <p style={{ margin: "0.25rem 0 0" }}>{e.descripcion}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="v-tarjeta" aria-labelledby="t-edu">
        <h2 id="t-edu">Educación</h2>
        {p.educacion.length === 0 ? (
          <p className="v-meta">Sin estudios registrados.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.9rem" }}>
            {p.educacion.map((e) => (
              <li key={e.id}>
                <strong>{e.institucion}</strong>
                <div className="v-meta">
                  {e.titulo} · {mes(e.desde)} – {mes(e.hasta)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="v-tarjeta" aria-labelledby="t-hab">
        <h2 id="t-hab">Habilidades</h2>
        {p.habilidades.length === 0 ? (
          <p className="v-meta">Sin habilidades registradas.</p>
        ) : (
          <div className="v-chips">
            {p.habilidades.map((h) => (
              <span key={h} className="v-chip">
                {h}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
