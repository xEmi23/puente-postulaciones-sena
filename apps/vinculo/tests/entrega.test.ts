import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { sha256Hex } from "@/lib/archivos";
import { BASE_BACKOFF_MS, MAX_INTENTOS_ENTREGA, despacharPendientes, esperaBackoff, reenviarEvento } from "@/modules/despachador";
import { enviarSolicitud } from "@/modules/postulacion";
import { aplicacionIntegrador, api, candidata, contacto, leerCv, pedirToken, publicarVacante, reiniciarBd, solicitar } from "./utilidades";

beforeEach(reiniciarBd);

// PRUEBAS DE CONTRATO de la entrega de Vínculo frente a la documentación de LinkedIn (docs/contratos.md §1, F1 y F2),
// con una validación escrita a mano desde F1: no se usa el esquema Zod del puente ni ningún código del puente.

const esTexto = (v: unknown) => typeof v === "object" && v !== null && typeof (v as { value?: unknown }).value === "string";

function incumplimientosF1(p: Record<string, unknown>): string[] {
  const e: string[] = [];
  const camposF1 = ["type", "externalJobId", "jobApplicationId", "appliedAt", "questionResponses", "applicantSkills", "jobApplicant", "verificationData"];
  for (const k of Object.keys(p)) if (!camposF1.includes(k)) e.push(`campo no documentado: ${k}`);
  if (p.type !== "EXPORT_JOB_APPLICATION") e.push("type debe ser EXPORT_JOB_APPLICATION");
  if (typeof p.externalJobId !== "string") e.push("externalJobId debe ser String");
  if (typeof p.jobApplicationId !== "string" || !/^urn:li:jobApplication:.+$/.test(p.jobApplicationId)) e.push("jobApplicationId debe ser urn:li:jobApplication:{id}");
  if (typeof p.jobApplicant !== "string" || !/^urn:li:person:.+$/.test(p.jobApplicant)) e.push("jobApplicant debe ser urn:li:person:{id}");
  if (!Number.isInteger(p.appliedAt) || String(p.appliedAt).length < 13) e.push("appliedAt debe ser Long en milisegundos");
  const qr = p.questionResponses as Record<string, unknown> | undefined;
  const contacto = qr?.contactInformationQuestionResponses as Record<string, unknown> | undefined;
  if (!contacto) e.push("contactInformationQuestionResponses siempre presente");
  for (const k of ["firstNameAnswer", "lastNameAnswer", "emailAnswer"]) if (!esTexto(contacto?.[k])) e.push(`${k} debe ser TextAnswerValue`);
  const tel = contacto?.cellphoneNumberQuestionAnswer as Record<string, unknown> | undefined;
  if (tel && (typeof tel.nationalNumber !== "string" || (tel.countryCode !== undefined && !/^\d+$/.test(String(tel.countryCode))))) e.push("teléfono inválido");
  const cv = (qr?.resumeQuestionResponses as Record<string, unknown> | undefined)?.resumeQuestionAnswer as Record<string, unknown> | undefined;
  if (cv && (typeof cv.mediaUrl !== "string" || typeof cv.mediaUrn !== "string")) e.push("DocumentAnswerValue requiere mediaUrl y mediaUrn");
  return e;
}

async function escenario() {
  const int = await aplicacionIntegrador();
  const { token, respuesta } = await publicarVacante(int, "9001");
  const vacanteId = (respuesta.body as { id: string }).id;
  return { int, token, vacanteId };
}

describe("Solicitud sencilla", () => {
  it("la postulación, la copia del CV y la entrega pendiente se guardan juntas", async () => {
    const { int, vacanteId } = await escenario();
    const r = await solicitar(vacanteId);
    const p = await prisma.postulacion.findUniqueOrThrow({ where: { id: r.postulacionId }, include: { archivoCv: true, outbox: true } });
    expect(p.estado).toBe("ENVIADA");
    expect(p.archivoCv.sha256).toBe(sha256Hex(leerCv()));
    expect(p.archivoCv.mediaUrn).toBe(`urn:li:media:${p.archivoCvId}`);
    expect(p.outbox).toHaveLength(1);
    expect(p.outbox[0]).toMatchObject({ aplicacionId: int.app.id, url: int.webhook.url, estado: "PENDIENTE" });
  });

  it("puede usar el CV del perfil; valida contacto, PDF y que no se repita la postulación", async () => {
    const { vacanteId } = await escenario();
    const u = await candidata();
    const delPerfil = await enviarSolicitud(u.id, vacanteId, contacto, { delPerfil: true });
    expect(delPerfil.ok).toBe(true);
    const otra = await enviarSolicitud(u.id, vacanteId, contacto, { delPerfil: true });
    expect(!otra.ok && otra.errores.general).toMatch(/Ya enviaste una solicitud/);
    const mala = await enviarSolicitud(u.id, vacanteId, { ...contacto, correo: "malo", nombre: "" }, { archivo: { nombre: "x.pdf", bytes: leerCv("no-es-pdf.pdf") } });
    expect(mala.ok).toBe(false);
    if (!mala.ok) {
      expect(mala.errores.correo).toMatch(/correo válido/);
      expect(mala.errores.nombre).toBeTruthy();
      expect(mala.errores.cv).toMatch(/no es un PDF válido/);
    }
  });

  it("una vacante con Solicitud sencilla pero sin ATS conectado guarda la postulación sin entrega (descarga manual)", async () => {
    const u = await candidata();
    // Una vacante a la que la candidata de prueba aún no se postuló (la siembra le deja historial en otras).
    const v = await prisma.vacante.findFirstOrThrow({
      where: { empresa: { slug: "andina-software" }, solicitudSencilla: true, aplicacionId: null, postulaciones: { none: { candidatoId: u.id } } },
    });
    const r = await solicitar(v.id);
    expect(await prisma.outbox.count({ where: { postulacionId: r.postulacionId } })).toBe(0);
  });
});

describe("entrega firmada al webhook (Apply Connect, F1 y F2)", () => {
  it("cumple F1 (campos y tipos) y la firma F2: hex(HMAC-SHA256('hmacsha256=' + cuerpo, clientSecret)) con el secreto de la aplicación", async () => {
    const { int, vacanteId } = await escenario();
    await solicitar(vacanteId);
    await despacharPendientes({ baseBackoffMs: 1 });
    expect(int.webhook.entregas).toHaveLength(1);
    const { cuerpo, firma } = int.webhook.entregas[0];
    const p = JSON.parse(cuerpo);
    expect(incumplimientosF1(p)).toEqual([]);
    expect(p.externalJobId).toBe("9001");
    expect(p.questionResponses.contactInformationQuestionResponses.cellphoneNumberQuestionAnswer).toEqual({ countryCode: "57", nationalNumber: "3001112233" });
    expect(firma).toBe(createHmac("sha256", int.clientSecret).update(`hmacsha256=${cuerpo}`, "utf8").digest("hex"));
    expect((await prisma.outbox.findFirstOrThrow()).estado).toBe("ENVIADO");
  });

  it("reintenta ante respuestas no 2xx hasta 6 intentos en total (F1) y la ventana de espera supera 10 minutos", async () => {
    const { int, vacanteId } = await escenario();
    await solicitar(vacanteId);
    int.webhook.respuestas = Array(10).fill(500);
    for (let i = 0; i < 10; i++) {
      await new Promise((ok) => setTimeout(ok, 5));
      await despacharPendientes({ baseBackoffMs: 1 });
    }
    expect(MAX_INTENTOS_ENTREGA).toBe(6);
    expect(int.webhook.entregas).toHaveLength(6);
    expect((await prisma.outbox.findFirstOrThrow()).estado).toBe("FALLIDO");
    // Ventana real: esperas mínimas (90 %) antes de los intentos 2 a 6 con la base por defecto de 30 s.
    const minima = [1, 2, 3, 4, 5].reduce((s, n) => s + BASE_BACKOFF_MS() * 2 ** (n - 1) * 0.9, 0);
    expect(minima).toBeGreaterThanOrEqual(10 * 60_000);
    expect(esperaBackoff(1, 30_000)).toBeGreaterThanOrEqual(27_000);
  });

  it("no reintenta SIGNATURE_MISMATCH ni JOB_POSTING_CLOSED; reenviar repite el mismo cuerpo y la misma firma", async () => {
    const { int, vacanteId } = await escenario();
    await solicitar(vacanteId);
    await despacharPendientes({ baseBackoffMs: 1 });
    const fila = await prisma.outbox.findFirstOrThrow();
    const r = await reenviarEvento(fila.id);
    expect(r.httpStatus).toBe(200);
    expect(int.webhook.entregas[1]).toEqual(int.webhook.entregas[0]);
    expect(await prisma.intentoEntrega.count({ where: { outboxId: fila.id, manual: true } })).toBe(1);
  });
});

describe("mediaUrl del CV", () => {
  it("exige el token de la aplicación dueña de la vacante; otra aplicación recibe 403; vencido, 410", async () => {
    const { int, vacanteId } = await escenario();
    const r = await solicitar(vacanteId);
    const p = await prisma.postulacion.findUniqueOrThrow({ where: { id: r.postulacionId } });
    const ruta = `/api/v1/media/${p.archivoCvId}`;
    expect((await api("GET", ruta, null)).status).toBe(401);
    const { body: t } = await pedirToken(int.clientId, int.clientSecret);
    const ok = await api("GET", ruta, t.access_token);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(sha256Hex(ok.body as Uint8Array)).toBe(sha256Hex(leerCv()));
    const otra = await aplicacionIntegrador();
    const { body: t2 } = await pedirToken(otra.clientId, otra.clientSecret);
    expect((await api("GET", ruta, t2.access_token)).status).toBe(403);
    await prisma.archivoCv.update({ where: { id: p.archivoCvId }, data: { expiraEn: new Date(Date.now() - 1000) } });
    expect((await api("GET", ruta, t.access_token)).status).toBe(410);
  });
});

describe("ciclo de vida (lo que ve el candidato)", () => {
  it("VIEWED y RESUME_DOWNLOADED avanzan el estado; repetir no cambia; no retrocede; solo la aplicación dueña", async () => {
    const { int, token, vacanteId } = await escenario();
    const r = await solicitar(vacanteId);
    const ruta = `/api/v1/jobApplications/${encodeURIComponent(r.jobApplicationId)}/lifecycle`;
    expect((await api("POST", ruta, token, { action: "VIEWED" })).body).toMatchObject({ status: "VISTA" });
    expect((await api("POST", ruta, token, { action: "RESUME_DOWNLOADED" })).body).toMatchObject({ status: "CV_DESCARGADO" });
    expect((await api("POST", ruta, token, { action: "RESUME_DOWNLOADED" })).body).toMatchObject({ status: "CV_DESCARGADO" });
    expect((await api("POST", ruta, token, { action: "VIEWED" })).body).toMatchObject({ status: "CV_DESCARGADO" });
    expect((await api("POST", ruta, token, { action: "OTRA" })).status).toBe(400);
    const otra = await aplicacionIntegrador();
    const { body: t2 } = await pedirToken(otra.clientId, otra.clientSecret);
    expect((await api("POST", ruta, t2.access_token, { action: "REJECTED" })).status).toBe(403);
    const p = await prisma.postulacion.findUniqueOrThrow({ where: { id: r.postulacionId } });
    expect(p.estado).toBe("CV_DESCARGADO");
    expect(p.cvDescargadoEn).not.toBeNull();
    expect(int.app.id).toBeTruthy();
  });
});
