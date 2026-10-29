import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { despacharPendientes, MAX_INTENTOS_ENTREGA } from "@/modules/despachador";
import { fetchEnProceso, postularEnOrigen, prisma, reiniciarBd } from "./utilidades";

// PRUEBAS DE CONTRATO INDEPENDIENTES del origen simulado.
// La referencia es la documentación de LinkedIn registrada en docs/contratos.md (F1 receive-applications, F2 webhooks),
// escrita aquí a mano. NO se usa el esquema Zod del puente (src/modules/contrato-apply-connect.ts) ni el código del puente:
// así, un error compartido entre origen y puente no pasa como correcto.

beforeEach(reiniciarBd);

interface Capturada {
  url: string;
  headers: Headers;
  cuerpo: string;
}

/** fetch falso que registra lo que envía el origen y responde lo que se le indique. */
function capturador(respuestas: { status: number; body?: unknown }[]) {
  const enviadas: Capturada[] = [];
  let i = 0;
  const f: typeof fetch = async (entrada, init) => {
    const req = new Request(entrada, init);
    enviadas.push({ url: req.url, headers: req.headers, cuerpo: await req.text() });
    const r = respuestas[Math.min(i++, respuestas.length - 1)];
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { "Content-Type": "application/json" } });
  };
  return { f, enviadas };
}

const esTexto = (v: unknown) => typeof v === "object" && v !== null && typeof (v as { value?: unknown }).value === "string";

/** Validación escrita desde las tablas de F1 (campos y tipos del payload). Devuelve la lista de incumplimientos. */
function incumplimientosF1(p: Record<string, unknown>): string[] {
  const e: string[] = [];
  const camposF1 = ["type", "externalJobId", "jobApplicationId", "appliedAt", "questionResponses", "applicantSkills", "jobApplicant", "verificationData"];
  for (const k of Object.keys(p)) if (!camposF1.includes(k)) e.push(`campo no documentado: ${k}`);
  if (p.type !== "EXPORT_JOB_APPLICATION") e.push("type debe ser EXPORT_JOB_APPLICATION");
  if (typeof p.externalJobId !== "string") e.push("externalJobId debe ser String");
  if (typeof p.jobApplicationId !== "string") e.push("jobApplicationId debe ser String");
  if (typeof p.jobApplicant !== "string" || !/^urn:li:person:.+$/.test(p.jobApplicant)) e.push("jobApplicant debe ser urn:li:person:{id}");
  if (!Number.isInteger(p.appliedAt) || String(p.appliedAt).length < 13) e.push("appliedAt debe ser Long en milisegundos");
  const qr = p.questionResponses as Record<string, unknown> | undefined;
  const contacto = qr?.contactInformationQuestionResponses as Record<string, unknown> | undefined;
  if (!contacto) e.push("contactInformationQuestionResponses siempre presente");
  for (const k of ["firstNameAnswer", "lastNameAnswer", "emailAnswer"]) if (!esTexto(contacto?.[k])) e.push(`${k} debe ser TextAnswerValue`);
  const tel = contacto?.cellphoneNumberQuestionAnswer as Record<string, unknown> | undefined;
  if (tel !== undefined && tel !== null) {
    if (typeof tel.nationalNumber !== "string") e.push("nationalNumber debe ser String");
    if (tel.countryCode !== undefined && (typeof tel.countryCode !== "string" || !/^\d+$/.test(tel.countryCode))) e.push("countryCode es un entero en formato string");
  }
  const cv = (qr?.resumeQuestionResponses as Record<string, unknown> | undefined)?.resumeQuestionAnswer as Record<string, unknown> | undefined;
  if (cv && (typeof cv.mediaUrl !== "string" || typeof cv.mediaUrn !== "string")) e.push("DocumentAnswerValue requiere mediaUrl y mediaUrn");
  return e;
}

describe("contrato del origen frente a la documentación de LinkedIn", () => {
  it("la validación escrita desde F1 acepta el ejemplo oficial (control de la propia referencia)", async () => {
    const { default: ejemplo } = await import("./linkedin-receive-applications.ejemplo.json");
    const payload = { ...(ejemplo as Record<string, unknown>) };
    delete payload._fuente;
    expect(incumplimientosF1(payload)).toEqual([]);
  });

  it("el POST del origen cumple F1: método, Content-Type, tipo de evento, campos y tipos", async () => {
    await postularEnOrigen("RT-2026-101", { nombre: "Camila", apellido: "Ejemplo", correo: "camila@demo.test", telefono: "3000000001", ciudad: "Medellín" });
    const { f, enviadas } = capturador([{ status: 200 }]);
    await despacharPendientes({ fetchImpl: f, baseBackoffMs: 1 });
    expect(enviadas).toHaveLength(1);
    const e = enviadas[0];
    expect(e.url).toBe(process.env.PUENTE_WEBHOOK_URL);
    expect(e.headers.get("content-type")).toBe("application/json");
    const p = JSON.parse(e.cuerpo);
    expect(incumplimientosF1(p)).toEqual([]);
    expect(p.externalJobId).toBe("RT-2026-101");
    expect(p.jobApplicationId).toMatch(/^urn:li:jobApplication:\d+$/);
    expect(p.questionResponses.contactInformationQuestionResponses.cellphoneNumberQuestionAnswer).toEqual({ countryCode: "57", nationalNumber: "3000000001" });
  });

  it("la firma cumple F2: hex(HMAC-SHA256('hmacsha256=' + cuerpo crudo, clientSecret)), solo el hex en X-LI-Signature", async () => {
    await postularEnOrigen();
    const { f, enviadas } = capturador([{ status: 200 }]);
    await despacharPendientes({ fetchImpl: f });
    const { headers, cuerpo } = enviadas[0];
    const esperada = createHmac("sha256", process.env.SIM_CLIENT_SECRET!).update(`hmacsha256=${cuerpo}`, "utf8").digest("hex");
    expect(headers.get("x-li-signature")).toBe(esperada);
    expect(headers.get("x-li-signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reintenta ante respuestas no 200 hasta 6 veces en total (F1: 'LinkedIn will attempt to re-send the application 6 times')", async () => {
    await postularEnOrigen();
    const { f, enviadas } = capturador([{ status: 500 }]);
    for (let i = 0; i < 10; i++) {
      await new Promise((ok) => setTimeout(ok, 5));
      await despacharPendientes({ fetchImpl: f, baseBackoffMs: 1 });
    }
    expect(MAX_INTENTOS_ENTREGA).toBe(6);
    expect(enviadas).toHaveLength(6);
    expect((await prisma.outbox.findFirstOrThrow()).estado).toBe("FALLIDO");
    expect(await prisma.intentoEntrega.count()).toBe(6);
  });

  it("no reintenta SIGNATURE_MISMATCH (F1: fatal) y sí reintenta TRANSIENT_ERROR", async () => {
    await postularEnOrigen("RT-2026-101");
    const fatal = capturador([{ status: 401, body: { errors: [{ errorCode: "SIGNATURE_MISMATCH" }] } }]);
    for (let i = 0; i < 3; i++) await despacharPendientes({ fetchImpl: fatal.f, baseBackoffMs: 1 });
    expect(fatal.enviadas).toHaveLength(1);

    await postularEnOrigen("RT-2026-102");
    const transitorio = capturador([{ status: 503, body: { errors: [{ errorCode: "TRANSIENT_ERROR" }] } }, { status: 200 }]);
    for (let i = 0; i < 3; i++) {
      await new Promise((ok) => setTimeout(ok, 5));
      await despacharPendientes({ fetchImpl: transitorio.f, baseBackoffMs: 1 });
    }
    expect(transitorio.enviadas).toHaveLength(2);
  });

  it("el mediaUrl exige Authorization: Bearer y devuelve el PDF con su content-type (F1 'Retrieve applicant media files')", async () => {
    await postularEnOrigen();
    const payload = JSON.parse((await prisma.outbox.findFirstOrThrow()).payload);
    const url = payload.questionResponses.resumeQuestionResponses.resumeQuestionAnswer.mediaUrl;
    expect((await fetchEnProceso(url)).status).toBe(401);
    expect((await fetchEnProceso(url, { headers: { Authorization: "Bearer token-equivocado-123456" } })).status).toBe(401);
    const ok = await fetchEnProceso(url, { headers: { Authorization: `Bearer ${process.env.ORIGEN_MEDIA_ACCESS_TOKEN}` } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
  });

  it("el enlace del CV expira (F1: 'available for 30 days')", async () => {
    await postularEnOrigen();
    const archivo = await prisma.archivoCv.findFirstOrThrow();
    const dias = (archivo.expiraEn.getTime() - archivo.creadoEn.getTime()) / 86_400_000;
    expect(Math.round(dias)).toBe(30);
    await prisma.archivoCv.update({ where: { id: archivo.id }, data: { expiraEn: new Date(Date.now() - 1000) } });
    const url = `http://vinculo.test/api/origen/media/${archivo.id}`;
    expect((await fetchEnProceso(url, { headers: { Authorization: `Bearer ${process.env.ORIGEN_MEDIA_ACCESS_TOKEN}` } })).status).toBe(410);
  });
});
