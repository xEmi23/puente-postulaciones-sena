import { etiquetaFuente } from "@/nucleo/fuentes";
import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { urlPublica } from "@/lib/config";
import { asegurarFuenteSistema } from "@/entradas/generica/fuentes";
import { revocar } from "./acciones";
import { FormularioFuente, GenerarToken } from "./componentes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fuentes" };

export default async function Fuentes() {
  await exigirUsuario("/fuentes", "ADMIN");
  await asegurarFuenteSistema();
  const fuentes = await prisma.fuente.findMany({ orderBy: [{ sistema: "desc" }, { nombre: "asc" }] });
  const base = urlPublica();

  return (
    <>
      <h1>Fuentes de postulaciones</h1>
      <p className="p-sub">
        Cada adaptador de entrada (importador, bot experimental u otra fuente) envía postulaciones a la entrada genérica con su propio token. La fuente sale del token, nunca del cuerpo. El token se muestra una sola vez; se guarda
        solo su SHA-256.
      </p>

      <section className="p-tarjeta" aria-labelledby="t-entrada">
        <h2 id="t-entrada">Entrada genérica</h2>
        <dl className="p-datos">
          <dt>Postulaciones</dt>
          <dd className="mono">POST {base}/api/entradas/v1/postulaciones</dd>
          <dt>Vacantes de la fuente</dt>
          <dd className="mono">GET {base}/api/entradas/v1/vacantes</dd>
          <dt>Autenticación</dt>
          <dd className="mono">Authorization: Bearer &lt;token&gt;</dd>
          <dt>Límite</dt>
          <dd>60 peticiones por minuto por token</dd>
        </dl>
        <p className="p-nota">Contrato: docs/contratos.md §8 (multipart con «datos» y «cv»). Luego vincula cada vacante de la fuente con su proceso en Correspondencias.</p>
      </section>

      <section className="p-tarjeta" aria-labelledby="t-nueva">
        <h2 id="t-nueva">Nueva fuente</h2>
        <FormularioFuente />
      </section>

      <section className="p-tarjeta" aria-labelledby="t-lista">
        <h2 id="t-lista">Fuentes</h2>
        <div className="p-tabla-contenedor">
          <table className="p-tabla">
            <caption className="visualmente-oculto">Fuentes de postulaciones</caption>
            <thead>
              <tr>
                <th scope="col">Fuente</th>
                <th scope="col">Estado</th>
                <th scope="col">Token</th>
                <th scope="col">Último uso</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {fuentes.map((f) => (
                <tr key={f.id} data-testid="fila-fuente" data-fuente={f.nombre}>
                  <td>
                    <strong>{etiquetaFuente(f.nombre)}</strong> <span className="mono p-nota">{f.nombre}</span>
                    {f.descripcion && <div className="p-nota">{f.descripcion}</div>}
                  </td>
                  <td>{f.sistema ? "Del sistema (firma HMAC)" : f.activa && f.tokenHash ? "Activa" : f.revocadaEn ? "Revocada" : "Sin token"}</td>
                  <td className="mono">{f.sistema ? "—" : f.tokenPrefijo && f.tokenHash ? `pf_${f.tokenPrefijo}.••••` : "—"}</td>
                  <td>{f.ultimoUsoEn ? fechaHora(f.ultimoUsoEn) : "Nunca"}</td>
                  <td>
                    {!f.sistema && (
                      <div className="p-acciones">
                        <GenerarToken nombre={f.nombre} tieneToken={!!f.tokenHash} />
                        {f.tokenHash && (
                          <form action={revocar}>
                            <input type="hidden" name="nombre" value={f.nombre} />
                            <button className="p-boton-texto" type="submit" aria-label={`Revocar la fuente ${f.nombre}`}>
                              Revocar
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
