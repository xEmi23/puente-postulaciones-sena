import Link from "next/link";
import type { EstadoRecepcion } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { enmascararCorreo, referenciaCorta } from "@/lib/privacidad";
import { ActualizarCada } from "@/components/actualizar-cada";
import { calcularMetricas } from "@/modules/operaciones";
import { ETIQUETA_ESTADO, ETIQUETA_PASO } from "@/modules/mensajes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operaciones" };

const ESTADOS = Object.keys(ETIQUETA_ESTADO) as EstadoRecepcion[];

function segundos(s: number | null): string {
  if (s === null) return "—";
  return s < 60 ? `${s.toFixed(1)} s` : `${(s / 60).toFixed(1)} min`;
}

export default async function Operaciones({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const filtro = ESTADOS.includes(estado as EstadoRecepcion) ? (estado as EstadoRecepcion) : undefined;
  const [m, operaciones, correspondencias] = await Promise.all([
    calcularMetricas(),
    prisma.recepcion.findMany({ where: filtro ? { estado: filtro } : {}, orderBy: { recibidaEn: "desc" }, take: 100 }),
    prisma.correspondencia.findMany(),
  ]);
  const procesoDe = new Map(correspondencias.map((c) => [c.externalJobId, c.procesoAtsId]));

  return (
    <>
      <ActualizarCada ms={3000} />
      <h1>Operaciones del puente</h1>
      <p className="p-sub">Cada postulación recibida de Vínculo y su avance hasta Talentia. Se actualiza solo.</p>

      <section aria-labelledby="t-metricas">
        <h2 id="t-metricas" className="visualmente-oculto">
          Métricas medidas
        </h2>
        <dl className="p-metricas" data-testid="metricas">
          <div className="p-metrica">
            <dt>Recibidas</dt>
            <dd data-metrica="recibidas">{m.recibidas}</dd>
          </div>
          <div className="p-metrica">
            <dt>Completadas</dt>
            <dd data-metrica="completadas">{m.completadas}</dd>
          </div>
          <div className="p-metrica">
            <dt>Rechazadas</dt>
            <dd data-metrica="rechazadas">
              {m.rechazadasProcesamiento + m.rechazadasEntrada}
              <small>
                {m.rechazadasEntrada} en la entrada · {m.rechazadasProcesamiento} al procesar
              </small>
            </dd>
          </div>
          <div className="p-metrica">
            <dt>Duplicados evitados</dt>
            <dd data-metrica="duplicados">{m.duplicadosEvitados}</dd>
          </div>
          <div className="p-metrica">
            <dt>Requieren atención</dt>
            <dd data-metrica="atencion">{m.requierenAtencion}</dd>
          </div>
          <div className="p-metrica">
            <dt>Recepción → completado</dt>
            <dd data-metrica="tiempos">
              {segundos(m.medianaSegundos)}
              <small>
                mediana · p95 {segundos(m.p95Segundos)} · n = {m.muestra}
              </small>
            </dd>
          </div>
        </dl>
      </section>

      <section className="p-tarjeta" aria-labelledby="t-lista">
        <h2 id="t-lista">Operaciones recientes</h2>
        <nav className="p-filtros" aria-label="Filtrar por estado">
          <Link href="/operaciones" aria-current={!filtro ? "true" : undefined}>
            Todas
          </Link>
          {ESTADOS.map((e) => (
            <Link key={e} href={`/operaciones?estado=${e}`} aria-current={filtro === e ? "true" : undefined}>
              {ETIQUETA_ESTADO[e]}
            </Link>
          ))}
        </nav>
        {operaciones.length === 0 ? (
          <p className="vacio">
            {filtro ? "No hay operaciones en este estado." : "Aún no llegan postulaciones. Cuando alguien postule con «Solicitud sencilla» en Vínculo, aparecerá aquí."}
          </p>
        ) : (
          <div className="p-tabla-contenedor">
            <table className="p-tabla">
              <caption className="visualmente-oculto">Operaciones</caption>
              <thead>
                <tr>
                  <th scope="col">Referencia</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Último paso</th>
                  <th scope="col">Recibida</th>
                  <th scope="col">Vacante → proceso</th>
                  <th scope="col">Postulante</th>
                </tr>
              </thead>
              <tbody>
                {operaciones.map((o) => (
                  <tr key={o.id} data-testid="fila-operacion" data-job-application-id={o.jobApplicationId}>
                    <td>
                      <Link href={`/operaciones/${o.id}`} className="mono">
                        {referenciaCorta(o.jobApplicationId)}
                      </Link>
                    </td>
                    <td>
                      <span className={`p-estado p-estado-${o.estado}`}>{ETIQUETA_ESTADO[o.estado]}</span>
                    </td>
                    <td>{o.paso ? ETIQUETA_PASO[o.paso] : "—"}</td>
                    <td>{fechaHora(o.recibidaEn)}</td>
                    <td>
                      <span className="mono">{o.externalJobId}</span> → {o.procesoAtsId ?? procesoDe.get(o.externalJobId) ?? "sin proceso"}
                    </td>
                    <td>
                      {o.nombre} {o.apellido.charAt(0)}. · {enmascararCorreo(o.correo)}
                    </td>
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
