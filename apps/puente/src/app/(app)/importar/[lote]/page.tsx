import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatoTamano } from "@/lib/archivos";
import { exigirUsuario, exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { confirmarLote, type FilaConfirmada } from "@/entradas/importador/servicio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revisar importación" };

const RESULTADO: Record<string, string> = {
  RECIBIDA: "Enviada al ATS",
  REQUIERE_REVISION: "En revisión",
  DUPLICADA: "Duplicada (ya estaba)",
  ERROR: "Error",
  RECHAZADO: "Rechazado",
  OMITIDO: "Omitido",
};

type Props = { params: Promise<{ lote: string }>; searchParams: Promise<{ ok?: string; error?: string }> };

export default async function RevisarImportacion({ params, searchParams }: Props) {
  const { lote: loteId } = await params;
  await exigirUsuario(`/importar/${loteId}`);
  const { ok, error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(loteId)) notFound();
  const lote = await prisma.loteImportacion.findUnique({ where: { id: loteId }, include: { archivos: { orderBy: { orden: "asc" } } } });
  if (!lote) notFound();
  const confirmado = !!lote.confirmadoEn;

  async function confirmar(formData: FormData) {
    "use server";
    const u = await exigirUsuarioAccion();
    const ids = formData.getAll("id").map(String);
    const filas: FilaConfirmada[] = ids.map((id) => ({
      id,
      incluir: formData.get(`incluir-${id}`) === "on",
      nombres: String(formData.get(`nombres-${id}`) ?? "").trim(),
      apellidos: String(formData.get(`apellidos-${id}`) ?? "").trim(),
      correo: String(formData.get(`correo-${id}`) ?? "").trim(),
      telefono: String(formData.get(`telefono-${id}`) ?? "").trim(),
    }));
    const sinNombre = filas.find((f) => f.incluir && !f.nombres);
    if (sinNombre) redirect(`/importar/${loteId}?error=${encodeURIComponent("Cada fila incluida necesita al menos el nombre.")}`);
    const r = await confirmarLote(loteId, filas, { tipo: "usuario", id: u.id });
    redirect(`/importar/${loteId}?${r.ok ? "ok" : "error"}=${encodeURIComponent(r.mensaje)}`);
  }

  return (
    <>
      <nav aria-label="Ruta de navegación" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        <Link href="/importar">Importar</Link> / <span aria-current="page">Revisión</span>
      </nav>
      <h1>{confirmado ? "Importación confirmada" : "2 · Revisa y confirma"}</h1>
      <p className="p-sub">
        Proceso del ATS <span className="mono">{lote.procesoAtsId}</span>.{" "}
        {confirmado
          ? "Cada fila confirmada entró al Puente; mira su avance en Operaciones."
          : "Corrige lo que haga falta. Los datos confirmados quedan como «confirmados por una persona». Sin correo, la postulación queda en revisión y no se envía al ATS."}
      </p>
      <div role="status" aria-live="polite">
        {ok && <div className="alerta alerta-exito">{ok}</div>}
        {error && <div className="alerta alerta-error">{error}</div>}
      </div>

      <form action={confirmar}>
        <div className="p-tabla-contenedor">
          <table className="p-tabla" data-testid="tabla-importacion">
            <caption className="visualmente-oculto">Archivos de la importación</caption>
            <thead>
              <tr>
                <th scope="col">{confirmado ? "Resultado" : "Incluir"}</th>
                <th scope="col">Archivo</th>
                <th scope="col">Nombres</th>
                <th scope="col">Apellidos</th>
                <th scope="col">Correo</th>
                <th scope="col">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {lote.archivos.map((a) => (
                <tr key={a.id} data-testid="fila-importacion" data-archivo={a.nombreArchivo} data-resultado={a.resultado ?? ""}>
                  <td>
                    {confirmado ? (
                      <>
                        <span data-testid="resultado-fila">{RESULTADO[a.resultado ?? ""] ?? "—"}</span>
                        {a.recepcionId && (
                          <div>
                            <Link href={`/operaciones/${a.recepcionId}`}>Ver operación</Link>
                          </div>
                        )}
                      </>
                    ) : a.error ? (
                      "—"
                    ) : (
                      <>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="checkbox" name={`incluir-${a.id}`} defaultChecked aria-label={`Incluir ${a.nombreArchivo}`} />
                      </>
                    )}
                  </td>
                  <td>
                    <span className="mono">{a.nombreArchivo}</span>
                    <div className="p-nota">
                      {formatoTamano(a.tamano)}
                      {a.error ? "" : a.textoLeido ? " · texto leído" : " · sin texto legible (escaneado): completa los datos"}
                      {a.origenNombre === "csv" ? " · nombre del CSV" : ""}
                    </div>
                    {a.error && (
                      <p className="p-mal" role="alert" data-testid="error-archivo">
                        ✗ {a.error}
                      </p>
                    )}
                  </td>
                  {(["nombres", "apellidos", "correo", "telefono"] as const).map((campo) => (
                    <td key={campo}>
                      {confirmado || a.error ? (
                        <span>{a[campo] || "—"}</span>
                      ) : (
                        <input
                          name={`${campo}-${a.id}`}
                          defaultValue={a[campo]}
                          type={campo === "correo" ? "email" : "text"}
                          aria-label={`${campo === "telefono" ? "Teléfono" : campo.charAt(0).toUpperCase() + campo.slice(1)} de ${a.nombreArchivo}`}
                          style={{ minWidth: campo === "correo" ? "14rem" : "8rem" }}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!confirmado && lote.archivos.some((a) => !a.error) && (
          <div className="p-acciones" style={{ marginTop: "1rem" }}>
            <button className="p-boton" type="submit">
              Confirmar e importar
            </button>
            <Link href="/importar">Cancelar</Link>
          </div>
        )}
      </form>
    </>
  );
}
