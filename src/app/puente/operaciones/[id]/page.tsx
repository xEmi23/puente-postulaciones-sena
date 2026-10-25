import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { formatoTamano } from "@/lib/archivos";
import { enmascararCorreo, referenciaCorta } from "@/lib/privacidad";
import { exigirSesionAccion } from "@/lib/sesion-servidor";
import { ActualizarCada } from "@/components/actualizar-cada";
import { reconciliar, reintentar } from "@/modules/puente/operaciones";
import { ETIQUETA_ESTADO, ETIQUETA_PASO, PASOS, explicarError } from "@/modules/puente/mensajes";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> };

export default async function DetalleOperacion({ params, searchParams }: Props) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const rec = await prisma.recepcion.findUnique({
    where: { id },
    include: { trabajo: true, eventos: { orderBy: { creadoEn: "asc" } } },
  });
  if (!rec) notFound();

  const indicePaso = rec.paso ? PASOS.indexOf(rec.paso) : -1;
  const explicacion = explicarError(rec.errorCodigo);
  const puedeReintentar = rec.estado === "FALLIDO_REINTENTABLE" && rec.trabajo?.estado === "DETENIDO";
  const puedeReconciliar = rec.estado === "REQUIERE_VERIFICACION";
  const enMovimiento = rec.estado === "RECIBIDO" || rec.estado === "PROCESANDO" || (rec.estado === "FALLIDO_REINTENTABLE" && rec.trabajo?.estado === "PENDIENTE");

  async function accionReintentar() {
    "use server";
    await exigirSesionAccion();
    const r = await reintentar(id);
    redirect(`/puente/operaciones/${id}?${r.ok ? "ok" : "error"}=${encodeURIComponent(r.mensaje)}`);
  }
  async function accionReconciliar() {
    "use server";
    await exigirSesionAccion();
    const r = await reconciliar(id);
    redirect(`/puente/operaciones/${id}?${r.ok ? "ok" : "error"}=${encodeURIComponent(r.mensaje)}`);
  }

  return (
    <>
      {enMovimiento && <ActualizarCada ms={2000} />}
      <nav aria-label="Ruta de navegación" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        <Link href="/puente">Operaciones</Link> / <span aria-current="page">{referenciaCorta(rec.jobApplicationId)}</span>
      </nav>
      <h1>
        Operación <span className="mono">{referenciaCorta(rec.jobApplicationId)}</span>{" "}
        <span className={`p-estado p-estado-${rec.estado}`} data-testid="estado-operacion">
          {ETIQUETA_ESTADO[rec.estado]}
        </span>
      </h1>
      <p className="p-sub">
        Recibida el {fechaHora(rec.recibidaEn)}
        {rec.completadaEn ? ` · completada el ${fechaHora(rec.completadaEn)} (${((rec.completadaEn.getTime() - rec.recibidaEn.getTime()) / 1000).toFixed(1)} s)` : ""}
      </p>

      <div role="status" aria-live="polite">
        {ok && <div className="alerta alerta-exito">{ok}</div>}
        {error && <div className="alerta alerta-error">{error}</div>}
      </div>

      {explicacion && rec.estado !== "COMPLETADO" && (
        <div className="p-error-explicado" role="alert">
          <p>
            <strong>Qué pasó:</strong> {explicacion.que}
          </p>
          <p>
            <strong>Qué hacer:</strong> {explicacion.hacer}
          </p>
          {rec.errorDetalle && <p className="p-nota">Detalle técnico: {rec.errorDetalle}</p>}
        </div>
      )}

      {(puedeReintentar || puedeReconciliar) && (
        <div className="p-tarjeta p-acciones">
          {puedeReintentar && (
            <form action={accionReintentar}>
              <button className="p-boton" type="submit">
                Reintentar
              </button>
            </form>
          )}
          {puedeReconciliar && (
            <form action={accionReconciliar}>
              <button className="p-boton" type="submit">
                Reconciliar con el ATS
              </button>
            </form>
          )}
          <span className="p-nota">
            {puedeReintentar
              ? "Seguro: cada escritura en el ATS usa Idempotency-Key y el candidato se busca por correo."
              : "Consulta al ATS por la referencia externa antes de volver a escribir."}
          </span>
        </div>
      )}

      <section className="p-tarjeta" aria-labelledby="t-pasos">
        <h2 id="t-pasos">Pasos</h2>
        <ol className="p-pasos">
          {PASOS.map((p, i) => (
            <li key={p} data-hecho={i <= indicePaso ? "true" : "false"}>
              {i <= indicePaso ? "✓ " : ""}
              {ETIQUETA_PASO[p]}
            </li>
          ))}
        </ol>
        <dl className="p-datos">
          <dt>jobApplicationId</dt>
          <dd className="mono">{rec.jobApplicationId}</dd>
          <dt>Vacante (externalJobId)</dt>
          <dd className="mono">{rec.externalJobId}</dd>
          <dt>Proceso ATS</dt>
          <dd>{rec.procesoAtsId ?? "—"}</dd>
          <dt>Postulante</dt>
          <dd>
            {rec.nombre} {rec.apellido} · {enmascararCorreo(rec.correo)}
          </dd>
          <dt>CV</dt>
          <dd>{rec.cvSha256 ? `${rec.cvNombreArchivo} · ${formatoTamano(rec.cvTamano ?? 0)} · SHA-256 ${rec.cvSha256}` : "Aún no descargado"}</dd>
          <dt>Intentos del trabajo</dt>
          <dd>
            {rec.trabajo?.intentos ?? 0}
            {rec.trabajo?.estado === "PENDIENTE" && rec.estado === "FALLIDO_REINTENTABLE" ? ` · próximo intento ${fechaHora(rec.trabajo.proximoIntentoEn)}` : ""}
          </dd>
          <dt>Duplicados evitados</dt>
          <dd>{rec.duplicadosEvitados}</dd>
        </dl>
      </section>

      <section className="p-tarjeta" aria-labelledby="t-linea">
        <h2 id="t-linea">Línea de tiempo</h2>
        <ol className="p-linea" data-testid="linea-tiempo">
          {rec.eventos.map((e) => (
            <li key={e.id} data-tipo={e.tipo}>
              <time dateTime={e.creadoEn.toISOString()}>{fechaHora(e.creadoEn)}</time>
              {e.detalle}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
