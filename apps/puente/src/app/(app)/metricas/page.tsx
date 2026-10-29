import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { calcularMetricas } from "@/modules/operaciones";
import { ETIQUETA_RECHAZO_ENTRADA } from "@/modules/mensajes";
import { ActualizarCada } from "@/components/actualizar-cada";

export const dynamic = "force-dynamic";
export const metadata = { title: "Métricas" };

const segundos = (s: number | null) => (s === null ? "—" : s < 60 ? `${s.toFixed(1)} s` : `${(s / 60).toFixed(1)} min`);

/** Métricas medidas sobre los datos reales de la base (no estimadas). */
export default async function Metricas() {
  await exigirUsuario("/metricas");
  const [m, publicaciones] = await Promise.all([calcularMetricas(), prisma.publicacion.findMany({ select: { procesoId: true, titulo: true } })]);
  const titulo = new Map(publicaciones.map((p) => [p.procesoId, p.titulo]));
  const tarjetas: [string, string, string | number, string?][] = [
    ["recibidas", "Recibidas", m.recibidas],
    ["completadas", "Completadas (postulación creada en Talentia)", m.completadas],
    ["rechazadas", "Rechazadas", m.rechazadasEntrada + m.rechazadasProcesamiento, `${m.rechazadasEntrada} en la entrada · ${m.rechazadasProcesamiento} al procesar`],
    ["duplicados", "Duplicados evitados", m.duplicadosEvitados],
    ["reintento", "En reintento", m.enReintento],
    ["verificacion", "Requieren verificación", m.requierenVerificacion],
    ["tiempos", "Recepción → completado (mediana)", segundos(m.medianaSegundos), `p95 ${segundos(m.p95Segundos)} · n = ${m.muestra}`],
  ];
  return (
    <>
      <ActualizarCada ms={5000} />
      <h1>Métricas</h1>
      <p className="p-sub">Calculadas sobre las operaciones guardadas. Solo cuenta como transferida una postulación creada en Talentia (recibido ≠ completado).</p>
      <dl className="p-metricas" data-testid="metricas">
        {tarjetas.map(([clave, etiqueta, valor, nota]) => (
          <div className="p-metrica" key={clave}>
            <dt>{etiqueta}</dt>
            <dd data-metrica={clave}>
              {valor}
              {nota && <small>{nota}</small>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="p-rejilla-2">
        <section className="p-tarjeta" aria-labelledby="t-por-proceso">
          <h2 id="t-por-proceso">Por proceso</h2>
          {m.porProceso.length === 0 ? (
            <p className="vacio">Aún no hay operaciones asociadas a procesos.</p>
          ) : (
            <table className="p-tabla">
              <caption className="visualmente-oculto">Operaciones por proceso</caption>
              <thead>
                <tr>
                  <th scope="col">Proceso</th>
                  <th scope="col">Recibidas</th>
                  <th scope="col">Completadas</th>
                  <th scope="col">Mediana</th>
                </tr>
              </thead>
              <tbody>
                {m.porProceso.map((p) => (
                  <tr key={p.procesoId} data-testid="metrica-proceso">
                    <td>
                      <span className="mono">{p.procesoId}</span> {titulo.get(p.procesoId) ?? ""}
                    </td>
                    <td>{p.recibidas}</td>
                    <td>{p.completadas}</td>
                    <td>{segundos(p.medianaSegundos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="p-tarjeta" aria-labelledby="t-rechazos">
          <h2 id="t-rechazos">Rechazos en la entrada por código</h2>
          {m.rechazosPorCodigo.length === 0 ? (
            <p className="vacio">Sin rechazos.</p>
          ) : (
            <ul>
              {m.rechazosPorCodigo.map((r) => (
                <li key={r.codigo}>
                  <span className="mono">{r.codigo}</span> ({ETIQUETA_RECHAZO_ENTRADA[r.codigo] ?? r.codigo}): {r.total}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
