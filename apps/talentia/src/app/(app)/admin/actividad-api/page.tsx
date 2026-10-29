import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { ActualizarCada } from "@/components/actualizar-cada";

export const dynamic = "force-dynamic";
export const metadata = { title: "Actividad de la API" };

export default async function ActividadApi() {
  await exigirUsuario("/admin/actividad-api", "ADMIN");
  const filas = await prisma.actividadApi.findMany({ orderBy: { creadaEn: "desc" }, take: 200, include: { apiKey: { select: { nombre: true } } } });
  return (
    <>
      <ActualizarCada ms={5000} />
      <p className="a-migas">Administración / Actividad de la API</p>
      <div className="a-encabezado">
        <div>
          <h1>Actividad de la API</h1>
          <p className="a-sub">Últimas 200 llamadas. Se registran método, ruta, estado y duración; nunca los cuerpos ni datos personales.</p>
        </div>
      </div>
      {filas.length === 0 ? (
        <p className="vacio">Todavía no hay llamadas a la API.</p>
      ) : (
        <div className="a-tabla-contenedor">
          <table className="a-tabla">
            <caption className="visualmente-oculto">Registro de llamadas a la API</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Llave</th>
                <th scope="col">Método</th>
                <th scope="col">Ruta</th>
                <th scope="col">Estado</th>
                <th scope="col">Duración</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} data-testid="fila-actividad">
                  <td>{fechaHora(f.creadaEn)}</td>
                  <td>
                    <span className="mono">{f.prefijo ? `${f.prefijo}…` : "—"}</span>
                    {f.apiKey && <div className="a-sub">{f.apiKey.nombre}</div>}
                  </td>
                  <td className="mono">{f.metodo}</td>
                  <td className="mono">{f.ruta}</td>
                  <td>
                    <span className={`a-etiqueta${f.estado >= 400 ? " a-etiqueta-roja" : " a-etiqueta-verde"}`}>{f.estado}</span>
                  </td>
                  <td>{f.duracionMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
