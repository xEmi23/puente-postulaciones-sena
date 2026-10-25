import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { referenciaCorta } from "@/lib/privacidad";
import { ETIQUETA_RECHAZO_ENTRADA } from "@/modules/puente/mensajes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rechazos en la entrada" };

export default async function Rechazos() {
  const rechazos = await prisma.entregaRechazada.findMany({ orderBy: { recibidaEn: "desc" }, take: 200 });
  return (
    <>
      <h1>Rechazos en la entrada</h1>
      <p className="p-sub">
        Entregas que el webhook rechazó antes de crear una operación (firma inválida, datos incompletos o inválidos, vacante sin
        correspondencia). Ninguna produjo escrituras en el ATS.
      </p>
      <section className="p-tarjeta">
        {rechazos.length === 0 ? (
          <p className="vacio">No hay rechazos registrados.</p>
        ) : (
          <div className="p-tabla-contenedor">
            <table className="p-tabla">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Código</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Referencia</th>
                  <th scope="col">Vacante</th>
                </tr>
              </thead>
              <tbody>
                {rechazos.map((r) => (
                  <tr key={r.id} data-testid="fila-rechazo">
                    <td>{fechaHora(r.recibidaEn)}</td>
                    <td>
                      <span className="mono">{r.codigo}</span>
                      <br />
                      <small>{ETIQUETA_RECHAZO_ENTRADA[r.codigo] ?? ""}</small>
                    </td>
                    <td>{r.motivo}</td>
                    <td className="mono">{r.jobApplicationId ? referenciaCorta(r.jobApplicationId) : "—"}</td>
                    <td className="mono">{r.externalJobId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
