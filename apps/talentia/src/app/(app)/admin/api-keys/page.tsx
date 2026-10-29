import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { ENCABEZADO_LLAVE } from "@/modules/api/http";
import { revocarLlave } from "./acciones";
import { FormularioLlave } from "./formulario";

export const dynamic = "force-dynamic";
export const metadata = { title: "API Keys" };

export default async function ApiKeys() {
  await exigirUsuario("/admin/api-keys", "ADMIN");
  const llaves = await prisma.apiKey.findMany({ orderBy: { creadaEn: "desc" }, include: { creadaPor: { select: { name: true } } } });
  return (
    <>
      <p className="a-migas">Administración / API Keys</p>
      <div className="a-encabezado">
        <div>
          <h1>API Keys</h1>
          <p className="a-sub">
            Para integrar sistemas externos con la API de Talentia. Se envían en el encabezado <code>{ENCABEZADO_LLAVE}</code>. Ver la{" "}
            <a href="/apidocs">documentación</a>.
          </p>
        </div>
      </div>
      <FormularioLlave />
      <h2 style={{ fontSize: "1rem", marginTop: "1.5rem" }}>Llaves de la empresa</h2>
      {llaves.length === 0 ? (
        <p className="vacio">Aún no hay llaves.</p>
      ) : (
        <div className="a-tabla-contenedor">
          <table className="a-tabla">
            <caption className="visualmente-oculto">API Keys</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Prefijo</th>
                <th scope="col">Permisos</th>
                <th scope="col">Creada</th>
                <th scope="col">Último uso</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {llaves.map((l) => (
                <tr key={l.id} data-testid="fila-llave" data-prefijo={l.prefijo}>
                  <td>{l.nombre}</td>
                  <td className="mono">{l.prefijo}…</td>
                  <td>
                    {l.permisoLectura && <span className="a-etiqueta">Lectura</span>}
                    {l.permisoModificacion && <span className="a-etiqueta">Modificación</span>}
                  </td>
                  <td>
                    {fechaHora(l.creadaEn)}
                    {l.creadaPor && <div className="a-sub">por {l.creadaPor.name}</div>}
                  </td>
                  <td>{l.ultimoUsoEn ? fechaHora(l.ultimoUsoEn) : "Nunca"}</td>
                  <td>
                    {l.revocadaEn ? (
                      <span className="a-etiqueta a-etiqueta-roja">Revocada</span>
                    ) : (
                      <form action={revocarLlave}>
                        <input type="hidden" name="id" value={l.id} />
                        <span className="a-etiqueta a-etiqueta-verde">Activa</span>{" "}
                        <button type="submit" className="a-boton-texto" aria-label={`Revocar la llave ${l.nombre}`}>
                          Revocar
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
