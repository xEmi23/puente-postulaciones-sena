import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { formatoTamano } from "@/lib/archivos";
import { enmascararCorreo, referenciaCorta } from "@/lib/privacidad";
import { exigirUsuarioAccion, usuarioActual } from "@/lib/sesion-servidor";
import { ActualizarCada } from "@/components/actualizar-cada";
import { reconciliar, reintentar } from "@/modules/operaciones";
import { ETIQUETA_AVISO, ETIQUETA_ESTADO, ETIQUETA_PASO, PASOS, explicarError } from "@/modules/mensajes";
import { aprobarRevision, borrarDatosCandidato, completarRevision, descartarRevision } from "@/modules/revision";
import { ETIQUETA_MOTIVO, type MotivoRevision } from "@/nucleo/recepcion/registrar";
import { ETIQUETA_ESTADO_V4, estadoV4 } from "@/nucleo/estados";
import { etiquetaFuente } from "@/nucleo/fuentes";

export const dynamic = "force-dynamic";

// Fuera del componente: las acciones de servidor solo pueden capturar valores serializables, no funciones locales.
const volver = (id: string, r: { ok: boolean; mensaje: string }) => redirect(`/operaciones/${id}?${r.ok ? "ok" : "error"}=${encodeURIComponent(r.mensaje)}`);
const actorDe = (u: { id: string }) => ({ tipo: "usuario" as const, id: u.id });

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
  const usuario = await usuarioActual();
  const auditoria = await prisma.eventoAuditoria.findMany({ where: { recepcionId: id }, orderBy: { creadoEn: "asc" }, take: 100 });
  const enRevision = rec.estado === "REQUIERE_REVISION";
  const motivos = (rec.motivoRevision ? rec.motivoRevision.split(",") : []) as MotivoRevision[];

  const indicePaso = rec.paso ? PASOS.indexOf(rec.paso) : -1;
  const explicacion = explicarError(rec.errorCodigo);
  const puedeReintentar = rec.estado === "FALLIDO_REINTENTABLE" && rec.trabajo?.estado === "DETENIDO";
  const puedeReconciliar = rec.estado === "REQUIERE_VERIFICACION";
  const enMovimiento = rec.estado === "RECIBIDO" || rec.estado === "PROCESANDO" || (rec.estado === "FALLIDO_REINTENTABLE" && rec.trabajo?.estado === "PENDIENTE");

  async function accionReintentar() {
    "use server";
    const u = await exigirUsuarioAccion();
    const r = await reintentar(id, actorDe(u));
    redirect(`/operaciones/${id}?${r.ok ? "ok" : "error"}=${encodeURIComponent(r.mensaje)}`);
  }
  async function accionReconciliar() {
    "use server";
    const u = await exigirUsuarioAccion();
    const r = await reconciliar(id, {}, actorDe(u));
    redirect(`/operaciones/${id}?${r.ok ? "ok" : "error"}=${encodeURIComponent(r.mensaje)}`);
  }

  async function accionCompletar(formData: FormData) {
    "use server";
    const u = await exigirUsuarioAccion();
    const archivo = formData.get("cv");
    const cv = archivo instanceof File && archivo.size > 0 ? { bytes: new Uint8Array(await archivo.arrayBuffer()), nombre: archivo.name } : undefined;
    volver(id, await completarRevision(id, { correo: String(formData.get("correo") ?? ""), cv }, actorDe(u)));
  }
  async function accionAprobar() {
    "use server";
    const u = await exigirUsuarioAccion();
    volver(id, await aprobarRevision(id, actorDe(u)));
  }
  async function accionDescartar() {
    "use server";
    const u = await exigirUsuarioAccion();
    volver(id, await descartarRevision(id, actorDe(u)));
  }
  async function accionBorrarDatos() {
    "use server";
    const u = await exigirUsuarioAccion("ADMIN");
    volver(id, await borrarDatosCandidato(id, actorDe(u)));
  }

  return (
    <>
      {enMovimiento && <ActualizarCada ms={2000} />}
      <nav aria-label="Ruta de navegación" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        <Link href="/">Operaciones</Link> / <span aria-current="page">{referenciaCorta(rec.jobApplicationId)}</span>
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

      {rec.advertencia && (
        <p className="alerta alerta-aviso" data-testid="advertencia">
          ⚠ {rec.advertencia}. El CV queda en el Puente hasta su retención.
        </p>
      )}

      {enRevision && (
        <section className="p-tarjeta" aria-labelledby="t-revision" data-testid="revision">
          <h2 id="t-revision">Requiere revisión</h2>
          <ul data-testid="motivos-revision">
            {motivos.map((m) => (
              <li key={m}>{ETIQUETA_MOTIVO[m] ?? m}</li>
            ))}
          </ul>
          <p className="p-nota">Nada se envía al ATS hasta que una persona apruebe. Un posible duplicado nunca se fusiona solo.</p>
          <form action={accionCompletar} className="p-form-conexion">
            <div className="p-campo">
              <label htmlFor="rev-correo">Correo del candidato</label>
              <input id="rev-correo" name="correo" type="email" defaultValue={rec.correo ?? ""} />
            </div>
            <div className="p-campo">
              <label htmlFor="rev-cv">CV (PDF, máximo 5 MB)</label>
              <input id="rev-cv" name="cv" type="file" accept="application/pdf,.pdf" />
            </div>
            <button className="p-boton p-boton-secundario" type="submit">
              Guardar datos
            </button>
          </form>
          <div className="p-acciones" style={{ marginTop: "0.8rem" }}>
            <form action={accionAprobar}>
              <button className="p-boton" type="submit">
                Aprobar y enviar al ATS
              </button>
            </form>
            <form action={accionDescartar}>
              <button className="p-boton p-boton-secundario" type="submit">
                Descartar
              </button>
            </form>
          </div>
        </section>
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
                Reconciliar con Talentia
              </button>
            </form>
          )}
          <span className="p-nota">
            {puedeReintentar
              ? "Seguro: cada escritura en Talentia usa Idempotency-Key y el postulante se busca por correo."
              : "Consulta a Talentia por la referencia externa antes de volver a escribir."}
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
          <dt>Fuente</dt>
          <dd data-testid="fuente-operacion">
            {rec.fuente} · {etiquetaFuente(rec.fuente)}
          </dd>
          <dt>Estado (V4)</dt>
          <dd data-testid="estado-v4">{ETIQUETA_ESTADO_V4[estadoV4(rec.estado, rec.trabajo?.estado)]}</dd>
          <dt>Id en la fuente</dt>
          <dd className="mono">{rec.idExterno}</dd>
          <dt>jobApplicationId</dt>
          <dd className="mono">{rec.jobApplicationId}</dd>
          <dt>Vacante (externalJobId)</dt>
          <dd className="mono">{rec.externalJobId}</dd>
          <dt>Proceso de Talentia</dt>
          <dd>{rec.procesoAtsId ?? "—"}</dd>
          <dt>Postulante</dt>
          <dd>
            {rec.nombre} {rec.apellido} · {enmascararCorreo(rec.correo)}
          </dd>
          <dt>CV</dt>
          <dd>
            {rec.cvSha256 ? `${rec.cvNombreArchivo} · ${formatoTamano(rec.cvTamano ?? 0)} · SHA-256 ${rec.cvSha256}` : "Aún no descargado"}
            {rec.cvBorradoEn ? ` · binario borrado el ${fechaHora(rec.cvBorradoEn)} (queda el hash)` : ""}
          </dd>
          <dt>Intentos del trabajo</dt>
          <dd>
            {rec.trabajo?.intentos ?? 0}
            {rec.trabajo?.estado === "PENDIENTE" && rec.estado === "FALLIDO_REINTENTABLE" ? ` · próximo intento ${fechaHora(rec.trabajo.proximoIntentoEn)}` : ""}
          </dd>
          <dt>Duplicados evitados</dt>
          <dd>{rec.duplicadosEvitados}</dd>
          <dt>Aviso «CV descargado» a Vínculo</dt>
          <dd data-testid="estado-aviso">
            {ETIQUETA_AVISO[rec.avisoEstado] ?? rec.avisoEstado}
            {rec.avisoError && rec.avisoEstado !== "ENVIADO" ? ` · ${rec.avisoError}` : ""}
          </dd>
        </dl>
      </section>

      {usuario?.rol === "ADMIN" && !rec.datosBorradosEn && (
        <section className="p-tarjeta" aria-labelledby="t-supresion">
          <h2 id="t-supresion">Datos del candidato</h2>
          <p className="p-nota">Supresión a pedido: borra nombre, correo, teléfono, ciudad y el CV del Puente. Quedan los metadatos, el hash y los eventos.</p>
          <form action={accionBorrarDatos}>
            <button className="p-boton-texto" type="submit">
              Borrar datos del candidato
            </button>
          </form>
        </section>
      )}

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

      <section className="p-tarjeta" aria-labelledby="t-auditoria">
        <h2 id="t-auditoria">Auditoría</h2>
        {auditoria.length === 0 ? (
          <p className="vacio">Sin eventos de auditoría.</p>
        ) : (
          <ol className="p-linea" data-testid="auditoria">
            {auditoria.map((a) => (
              <li key={a.id}>
                <time dateTime={a.creadoEn.toISOString()}>{fechaHora(a.creadoEn)}</time>
                {a.accion} · {a.actorTipo === "usuario" ? "usuario del panel" : `${a.actorTipo} «${a.actorId}»`}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
