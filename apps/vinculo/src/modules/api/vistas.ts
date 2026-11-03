import { z } from "zod";
import type { VacanteConEmpresa } from "@/modules/vacantes";

// Forma JSON de una vacante en la API de Vínculo (contrato del simulador). El esquema Zod alimenta el OpenAPI.

export const esquemaJobPostingRespuesta = z.object({
  id: z.uuid(),
  externalJobId: z.string(),
  companyId: z.uuid(),
  companyName: z.string(),
  title: z.string(),
  state: z.enum(["DRAFT", "LISTED", "CLOSED"]),
  applyMethod: z.enum(["ONSITE_APPLY", "COMPANY_SITE"]).describe("ONSITE_APPLY = «Solicitud sencilla» en el Simulador LinkedIn"),
  jobApplicationWebhookUrl: z.string().nullable(),
  companyApplyUrl: z.string().nullable(),
  notOnsiteReason: z.string().nullable(),
  url: z.string(),
  listedAt: z.iso.datetime({ offset: true }).nullable(),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
});

const ESTADO = { BORRADOR: "DRAFT", PUBLICADA: "LISTED", CERRADA: "CLOSED" } as const;

export const vistaJobPosting = (v: VacanteConEmpresa, base: string) => ({
  id: v.id,
  externalJobId: v.externalJobId,
  companyId: v.empresaId,
  companyName: v.empresa.nombre,
  title: v.titulo,
  state: ESTADO[v.estado],
  applyMethod: v.solicitudSencilla ? ("ONSITE_APPLY" as const) : ("COMPANY_SITE" as const),
  jobApplicationWebhookUrl: v.webhookUrl,
  companyApplyUrl: v.urlEmpresa,
  notOnsiteReason: v.motivoSinSolicitud,
  url: `${base}/empleos/${v.id}`,
  listedAt: v.publicadaEn?.toISOString() ?? null,
  closedAt: v.cerradaEn?.toISOString() ?? null,
});
