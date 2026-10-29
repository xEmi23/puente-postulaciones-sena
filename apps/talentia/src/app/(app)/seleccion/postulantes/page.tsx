import Link from "next/link";
import { fecha } from "@/lib/fechas";
import { listarPostulantes } from "@/modules/seleccion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Postulantes" };

export default async function Postulantes({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { q, pagina } = await searchParams;
  const r = await listarPostulantes({ q, pagina: Number(pagina) || 1, porPagina: 20 });
  const paginas = Math.max(1, Math.ceil(r.total / r.porPagina));
  const enlace = (n: number) => `/seleccion/postulantes?${new URLSearchParams({ ...(q ? { q } : {}), pagina: String(n) })}`;
  return (
    <>
      <p className="a-migas">Desarrollo organizacional / Selección / Postulantes</p>
      <div className="a-encabezado">
        <div>
          <h1>Base de postulantes</h1>
          <p className="a-sub">Una persona aparece una sola vez aunque esté en varios procesos (se identifica por su correo).</p>
        </div>
      </div>
      <form className="a-buscar" role="search">
        <label htmlFor="q" className="visualmente-oculto">
          Buscar por nombre, apellido o correo
        </label>
        <input id="q" name="q" className="a-input" placeholder="Buscar por nombre, apellido o correo" defaultValue={q} />
        <button type="submit" className="a-boton">
          Buscar
        </button>
      </form>
      {r.filas.length === 0 ? (
        <p className="vacio">{q ? `No hay postulantes que coincidan con «${q}».` : "Aún no hay postulantes."}</p>
      ) : (
        <>
          <div className="a-tabla-contenedor">
            <table className="a-tabla">
              <caption className="visualmente-oculto">Postulantes</caption>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Ciudad</th>
                  <th scope="col">Procesos</th>
                  <th scope="col">Registrado</th>
                </tr>
              </thead>
              <tbody>
                {r.filas.map((p) => (
                  <tr key={p.id} data-testid="fila-postulante">
                    <td>
                      <Link href={`/seleccion/postulantes/${p.id}`}>
                        {p.nombre} {p.apellido}
                      </Link>
                    </td>
                    <td>{p.correo}</td>
                    <td>{p.ciudad ?? "—"}</td>
                    <td>{p._count.postulaciones}</td>
                    <td>{fecha(p.creadoEn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="a-paginacion" aria-label="Paginación">
            {r.pagina > 1 && <Link href={enlace(r.pagina - 1)}>← Anterior</Link>}
            <span>
              Página {r.pagina} de {paginas} · {r.total} postulantes
            </span>
            {r.pagina < paginas && <Link href={enlace(r.pagina + 1)}>Siguiente →</Link>}
          </nav>
        </>
      )}
    </>
  );
}
