import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { config } from "@/lib/config";
import { exigirSesionAccion } from "@/lib/sesion-servidor";
import { enviarAlWebhook } from "@/modules/despachador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consola de pruebas del webhook" };

// Equivale a enviar payloads con Postman (ficha 2.8): cada caso construye una entrega real al webhook del puente.
const CASOS = {
  firma_invalida: "Firma X-LI-Signature inválida",
  falta_correo: "Falta el correo (respuesta obligatoria)",
  correo_invalido: "Correo con formato inválido",
  sin_vincular: "Vacante sin correspondencia (RT-2026-103)",
  host_no_autorizado: "mediaUrl de un host no autorizado",
  json_ilegible: "Cuerpo que no es JSON",
} as const;
type Caso = keyof typeof CASOS;

function payloadBase(externalJobId = "RT-2026-101") {
  const base = config().APP_BASE_URL;
  const id = "00000000-0000-4000-8000-000000000000";
  return {
    type: "EXPORT_JOB_APPLICATION",
    externalJobId,
    jobApplicationId: `urn:li:jobApplication:${randomInt(1_000_000_000, 9_999_999_999)}`,
    jobApplicant: "urn:li:person:consolaprueba",
    appliedAt: Date.now(),
    questionResponses: {
      contactInformationQuestionResponses: {
        firstNameAnswer: { value: "Persona" },
        lastNameAnswer: { value: "De Prueba" },
        emailAnswer: { value: "consola@demo.test" } as { value: string } | undefined,
      },
      resumeQuestionResponses: { resumeQuestionAnswer: { mediaUrl: `${base}/api/origen/media/${id}`, mediaUrn: `urn:li:media:${id}` } },
    },
  };
}

function construir(caso: Caso): { cuerpo: string; firma?: string } {
  const p = payloadBase(caso === "sin_vincular" ? "RT-2026-103" : undefined);
  switch (caso) {
    case "firma_invalida":
      return { cuerpo: JSON.stringify(p), firma: "0".repeat(64) };
    case "falta_correo":
      delete p.questionResponses.contactInformationQuestionResponses.emailAnswer;
      return { cuerpo: JSON.stringify(p) };
    case "correo_invalido":
      p.questionResponses.contactInformationQuestionResponses.emailAnswer = { value: "esto-no-es-un-correo" };
      return { cuerpo: JSON.stringify(p) };
    case "host_no_autorizado":
      p.questionResponses.resumeQuestionResponses.resumeQuestionAnswer.mediaUrl = "http://169.254.169.254/latest/meta-data";
      return { cuerpo: JSON.stringify(p) };
    case "json_ilegible":
      return { cuerpo: '{"type": "EXPORT_JOB_APPLICATION", ' };
    default:
      return { cuerpo: JSON.stringify(p) };
  }
}

async function enviar(formData: FormData) {
  "use server";
  await exigirSesionAccion();
  const caso = String(formData.get("caso")) as Caso;
  if (!(caso in CASOS)) redirect("/admin/consola");
  const { cuerpo, firma } = construir(caso);
  const r = await enviarAlWebhook(cuerpo, fetch, firma);
  const q = new URLSearchParams({ caso, status: String(r.httpStatus ?? "sin respuesta"), cuerpo: r.respuesta || r.error || "" });
  redirect(`/admin/consola?${q}`);
}

export default async function Consola({ searchParams }: { searchParams: Promise<{ caso?: string; status?: string; cuerpo?: string }> }) {
  const { caso, status, cuerpo } = await searchParams;
  let bonito = cuerpo ?? "";
  try {
    bonito = JSON.stringify(JSON.parse(cuerpo ?? ""), null, 2);
  } catch {
    /* se muestra tal cual */
  }
  return (
    <section className="o-panel">
      <h1 style={{ marginTop: 0, fontSize: "1.4rem" }}>Consola de pruebas del webhook</h1>
      <p className="o-ayuda">
        Envía al webhook del puente entregas inválidas a propósito para comprobar el rechazo controlado (código de error de LinkedIn y
        cero escrituras en el ATS). Los rechazos aparecen en el panel del puente → «Rechazos en la entrada».
      </p>
      <form action={enviar} className="o-consola-form">
        <div className="o-campo">
          <label htmlFor="caso">Caso</label>
          <select id="caso" name="caso" className="o-select" defaultValue={caso ?? "firma_invalida"}>
            {Object.entries(CASOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button className="o-boton" type="submit">
          Enviar al webhook
        </button>
      </form>
      {status && (
        <div role="status" aria-live="polite" style={{ marginTop: "1rem" }}>
          <p>
            Respuesta del puente: <strong data-testid="consola-status">HTTP {status}</strong>
          </p>
          <pre className="o-pre" data-testid="consola-cuerpo">
            {bonito}
          </pre>
        </div>
      )}
    </section>
  );
}
