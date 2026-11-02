import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { pareceUnPdf } from "@/lib/archivos";
import { validarEntrada } from "@/nucleo/contrato/canonica";
import { registrarRecepcion } from "@/nucleo/recepcion/registrar";
import { autenticarToken, tokenDeSolicitud } from "./fuentes";
import { consumirCupo } from "./limite";

// Entrada genérica del Puente (ESPECIFICACION_V4 §8.1; contrato en docs/contratos.md §8). Cualquier fuente nueva se
// conecta con su token, sin endpoints nuevos. Respuestas: 202 RECIBIDA · 202 REQUIERE_REVISION · 200 DUPLICADA ·
// 400 validación · 401 token · 413 tamaño · 415 no PDF · 422 vacante sin correspondencia · 429 demasiadas peticiones.

const responder = (status: number, body: Record<string, unknown>, encabezados: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...encabezados } });

const noAutorizado = () => responder(401, { estado: "NO_AUTORIZADO", mensaje: "Token de fuente ausente, inválido o revocado (Authorization: Bearer <token>)." });

async function autenticar(req: Request): Promise<{ fuente: string } | { error: Response }> {
  const fuente = await autenticarToken(tokenDeSolicitud(req));
  if (!fuente) return { error: noAutorizado() };
  const espera = consumirCupo(fuente);
  if (espera !== null) {
    return { error: responder(429, { estado: "DEMASIADAS_PETICIONES", mensaje: "Se superaron 60 peticiones por minuto para este token." }, { "Retry-After": String(espera) }) };
  }
  return { fuente };
}

/** POST /api/entradas/v1/postulaciones — multipart: `datos` (canónica sin `fuente`, JSON) + `cv` (PDF ≤ 5 MB, opcional). */
export async function recibirPorEntradaGenerica(req: Request): Promise<Response> {
  const a = await autenticar(req);
  if ("error" in a) return a.error;
  const max = config().CV_MAX_BYTES;
  const declarado = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declarado) && declarado > max + 256 * 1024) {
    return responder(413, { estado: "DEMASIADO_GRANDE", mensaje: `La petición supera el máximo (CV de ${max} bytes).` });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return responder(400, { estado: "INVALIDA", mensaje: "Se espera multipart/form-data con los campos «datos» (JSON) y «cv» (PDF)." });
  }
  const textoDatos = form.get("datos");
  if (typeof textoDatos !== "string") return responder(400, { estado: "INVALIDA", mensaje: "Falta el campo «datos» (JSON de la PostulacionCanonica sin «fuente»)." });
  let json: unknown;
  try {
    json = JSON.parse(textoDatos);
  } catch {
    return responder(400, { estado: "INVALIDA", mensaje: "El campo «datos» no es JSON válido." });
  }

  const archivo = form.get("cv");
  let cv: { bytes: Uint8Array; nombre: string } | null = null;
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > max) return responder(413, { estado: "DEMASIADO_GRANDE", mensaje: `El CV supera el máximo de ${max} bytes (5 MB).` });
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    if (!pareceUnPdf(bytes)) return responder(415, { estado: "NO_ES_PDF", mensaje: "El CV debe ser un PDF (el archivo no empieza por %PDF)." });
    cv = { bytes, nombre: archivo.name || "cv.pdf" };
  }

  const v = validarEntrada(json, a.fuente);
  if (!v.ok) return responder(400, { estado: "INVALIDA", mensaje: "La postulación no cumple el contrato canónico v1.", errores: v.errores });

  const r = await registrarRecepcion(v.datos, cv ? { tipo: "binario", bytes: cv.bytes, nombreArchivo: cv.nombre } : null, { tipo: "fuente", id: a.fuente }, {
    detalleRecibido: `Postulación recibida por la entrada genérica (token de la fuente «${a.fuente}» verificado).`,
  });
  switch (r.resultado) {
    case "RECIBIDA":
      return responder(202, { estado: "RECIBIDA", idRecepcion: r.recepcionId });
    case "REQUIERE_REVISION":
      return responder(202, { estado: "REQUIERE_REVISION", idRecepcion: r.recepcionId, motivos: r.motivos });
    case "DUPLICADA":
      return responder(200, { estado: "DUPLICADA", idRecepcion: r.recepcionId });
    case "SIN_CORRESPONDENCIA":
      return responder(422, { estado: "VACANTE_SIN_CORRESPONDENCIA", mensaje: r.motivo });
    case "INVALIDA":
      return responder(400, { estado: "INVALIDA", mensaje: "La postulación no cumple el contrato canónico v1.", errores: r.errores });
    case "CV_INVALIDO":
      if (r.codigo === "NO_PDF") return responder(415, { estado: "NO_ES_PDF", mensaje: r.mensaje });
      if (r.codigo === "DEMASIADO_GRANDE") return responder(413, { estado: "DEMASIADO_GRANDE", mensaje: r.mensaje });
      return responder(400, { estado: "INVALIDA", mensaje: r.mensaje });
  }
}

/** GET /api/entradas/v1/vacantes — vacantes vinculadas a la fuente del token. */
export async function vacantesDeLaFuente(req: Request): Promise<Response> {
  const a = await autenticar(req);
  if ("error" in a) return a.error;
  const filas = await prisma.correspondencia.findMany({ where: { fuente: a.fuente, activa: true }, orderBy: { creadaEn: "asc" } });
  return responder(200, {
    fuente: a.fuente,
    vacantes: filas.map((c) => ({ vacanteExterna: c.vacanteExterna ?? c.externalJobId, idProceso: String(c.procesoAtsId), descripcion: c.descripcion })),
  });
}
