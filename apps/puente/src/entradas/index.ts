import { descargarCv, type CvDescargado } from "./apply-connect/cv";
import { ErrorProcesamiento } from "@/nucleo/errores";

// Lo que el núcleo necesita de una fuente durante el procesamiento: obtener el CV cuando no llegó en bytes.
// Hoy solo Apply Connect envía un enlace (mediaUrl); las demás fuentes entregan el binario al recibir.

export async function obtenerCvRemoto(rec: { fuente: string; mediaUrl: string | null }, fetchImpl?: typeof fetch): Promise<CvDescargado> {
  if (rec.fuente === "apply-connect" && rec.mediaUrl) return descargarCv({ mediaUrl: rec.mediaUrl }, fetchImpl);
  throw new ErrorProcesamiento("CV_NO_DISPONIBLE", "La recepción no tiene CV que descargar.", "detener");
}
