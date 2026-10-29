import Link from "next/link";
import { prisma } from "@/lib/db";
import { MODALIDADES, NIVELES, buscarVacantes } from "@/modules/vacantes";
import { TarjetaVacante } from "@/components/vacante";

export const dynamic = "force-dynamic";
export const metadata = { title: "Empleos" };

type Filtros = { q?: string; ciudad?: string; modalidad?: string; nivel?: string; empresa?: string; pagina?: string };

export default async function Empleos({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams;
  const [r, empresas] = await Promise.all([
    buscarVacantes({ ...f, pagina: Number(f.pagina) || 1 }),
    prisma.empresa.findMany({ orderBy: { nombre: "asc" }, select: { slug: true, nombre: true } }),
  ]);
  const enlace = (pagina: number) => {
    const p = new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== "pagina") as [string, string][]);
    p.set("pagina", String(pagina));
    return `/empleos?${p}`;
  };
  return (
    <>
      <h1>Empleos</h1>
      <form className="v-tarjeta" role="search" aria-label="Filtrar empleos">
        <div className="v-filtros">
          <div className="v-campo">
            <label htmlFor="f-q">Cargo o palabra clave</label>
            <input id="f-q" name="q" defaultValue={f.q} />
          </div>
          <div className="v-campo">
            <label htmlFor="f-ciudad">Ciudad</label>
            <input id="f-ciudad" name="ciudad" defaultValue={f.ciudad} />
          </div>
          <div className="v-campo">
            <label htmlFor="f-modalidad">Modalidad</label>
            <select id="f-modalidad" name="modalidad" defaultValue={f.modalidad ?? ""}>
              <option value="">Todas</option>
              {Object.entries(MODALIDADES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="v-campo">
            <label htmlFor="f-nivel">Nivel</label>
            <select id="f-nivel" name="nivel" defaultValue={f.nivel ?? ""}>
              <option value="">Todos</option>
              {Object.entries(NIVELES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="v-campo">
            <label htmlFor="f-empresa">Empresa</label>
            <select id="f-empresa" name="empresa" defaultValue={f.empresa ?? ""}>
              <option value="">Todas</option>
              {empresas.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="v-campo">
            <button type="submit" className="v-boton">
              Filtrar
            </button>
          </div>
        </div>
      </form>
      <p className="v-subtitulo" role="status">
        {r.total === 1 ? "1 resultado" : `${r.total} resultados`}
      </p>
      {r.vacantes.length === 0 ? (
        <div className="v-tarjeta vacio">
          No encontramos vacantes con esos filtros. <Link href="/empleos">Ver todas las vacantes</Link>
        </div>
      ) : (
        <ul className="v-lista-vacantes">
          {r.vacantes.map((v) => (
            <TarjetaVacante key={v.id} v={v} />
          ))}
        </ul>
      )}
      {r.paginas > 1 && (
        <nav className="v-paginacion" aria-label="Paginación">
          {r.pagina > 1 && <Link href={enlace(r.pagina - 1)}>← Anterior</Link>}
          <span>
            Página {r.pagina} de {r.paginas}
          </span>
          {r.pagina < r.paginas && <Link href={enlace(r.pagina + 1)}>Siguiente →</Link>}
        </nav>
      )}
    </>
  );
}
