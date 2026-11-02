import { config } from "@/lib/config";
import { pareceUnPdf, sha256Hex, nombreArchivoSeguro } from "@/lib/archivos";
import { conexionVinculo } from "@/modules/conexiones";
import { conFalloSimulado } from "@/modules/fallos";
import * as vinculo from "@/modules/vinculo-cliente";
import { urlDeMediaPermitida } from "@/modules/webhook";
import { ErrorProcesamiento } from "@/nucleo/errores";

// Adaptador Apply Connect (Vínculo, simulado): obtiene el CV por mediaUrl con el token de la aplicación. Es lo único
// propio de esta fuente que ocurre durante el procesamiento; el núcleo solo recibe los bytes verificados.

export interface CvDescargado {
  bytes: Uint8Array;
  sha256: string;
  nombre: string;
}

/** Descarga el CV del mediaUrl con Bearer, solo desde el origen configurado, con límite de tamaño y validación de PDF. */
export async function descargarCv(rec: { mediaUrl: string }, fetchImpl: typeof fetch = fetch): Promise<CvDescargado> {
  const cfg = config();
  const c = await conexionVinculo();
  if (!c) throw new ErrorProcesamiento("PUENTE_SIN_CONEXION", "El puente no tiene configurada la conexión con Vínculo.", "detener");
  if (!urlDeMediaPermitida(rec.mediaUrl, c.urlBase)) {
    throw new ErrorProcesamiento("CV_URL_NO_PERMITIDA", "El enlace del CV no pertenece al origen autorizado.", "rechazar");
  }
  let r: Response | null = null;
  // Si Vínculo rechaza el token (vencido o invalidado al regenerar el secreto), se pide uno nuevo una sola vez.
  for (let intento = 0; intento < 2; intento++) {
    let token: string;
    try {
      token = await vinculo.obtenerToken(fetchImpl, { forzar: intento > 0 });
    } catch (e) {
      if (e instanceof vinculo.ErrorVinculo && e.tipo === "credenciales") throw new ErrorProcesamiento("ORIGEN_AUTENTICACION", e.message, "detener");
      if (e instanceof vinculo.ErrorVinculo && e.tipo === "sin_conexion") throw new ErrorProcesamiento("PUENTE_SIN_CONEXION", e.message, "detener");
      throw new ErrorProcesamiento("ORIGEN_NO_DISPONIBLE", e instanceof Error ? e.message : "Vínculo no está disponible.", "reintentar");
    }
    try {
      const senal = AbortSignal.timeout(Number(process.env.PUENTE_TIMEOUT_MS ?? 0) || 75_000);
      r = await conFalloSimulado("media", senal, () =>
        fetchImpl(rec.mediaUrl, {
          headers: { Authorization: `Bearer ${token}` },
          redirect: "manual",
          signal: senal,
        }),
      );
    } catch {
      throw new ErrorProcesamiento("ORIGEN_NO_DISPONIBLE", "No fue posible descargar el CV del origen.", "reintentar");
    }
    if (r.status !== 401) break;
  }
  if (!r) throw new ErrorProcesamiento("ORIGEN_NO_DISPONIBLE", "No fue posible descargar el CV del origen.", "reintentar");
  if (r.status >= 300 && r.status < 400) throw new ErrorProcesamiento("CV_URL_NO_PERMITIDA", "El origen intentó redirigir la descarga del CV.", "rechazar");
  if (r.status === 401 || r.status === 403) {
    vinculo.olvidarToken();
    throw new ErrorProcesamiento("ORIGEN_AUTENTICACION", "Vínculo rechazó el token del puente al descargar el CV.", "detener");
  }
  if (r.status === 404 || r.status === 410) throw new ErrorProcesamiento("CV_NO_DISPONIBLE", "El enlace del CV expiró o no existe.", "rechazar");
  if (!r.ok) throw new ErrorProcesamiento("ORIGEN_NO_DISPONIBLE", `El origen respondió ${r.status} al descargar el CV.`, "reintentar");

  const max = cfg.CV_MAX_BYTES;
  const declarado = Number(r.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(declarado) && declarado > max) {
    throw new ErrorProcesamiento("CV_DEMASIADO_GRANDE", `El CV supera el máximo de ${max} bytes.`, "rechazar");
  }
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    const lector = r.body?.getReader();
    if (!lector) throw new Error("sin cuerpo");
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await lector.cancel();
        throw new ErrorProcesamiento("CV_DEMASIADO_GRANDE", `El CV supera el máximo de ${max} bytes.`, "rechazar");
      }
      partes.push(value);
    }
  } catch (e) {
    if (e instanceof ErrorProcesamiento) throw e;
    throw new ErrorProcesamiento("CV_TRANSFERENCIA_INCOMPLETA", "La descarga del CV se interrumpió.", "reintentar");
  }
  const bytes = Buffer.concat(partes);
  if (Number.isFinite(declarado) && declarado !== bytes.length) {
    throw new ErrorProcesamiento("CV_TRANSFERENCIA_INCOMPLETA", `Se recibieron ${bytes.length} de ${declarado} bytes del CV.`, "reintentar");
  }
  if (!pareceUnPdf(bytes)) throw new ErrorProcesamiento("CV_INVALIDO", "El archivo descargado no es un PDF válido.", "rechazar");

  const disposicion = r.headers.get("content-disposition") ?? "";
  const nombre = /filename="?([^";]+)"?/i.exec(disposicion)?.[1] ?? "cv.pdf";
  return { bytes, sha256: sha256Hex(bytes), nombre: nombreArchivoSeguro(decodeURIComponent(nombre)) };
}
