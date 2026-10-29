import { beforeEach, describe, expect, it } from "vitest";
import { procesarPendientes, procesarTrabajo, reclamarTrabajos, CaidaSimulada } from "@/modules/procesador";
import { reintentar } from "@/modules/operaciones";
import { explicarError } from "@/modules/mensajes";
import { configurarFallo } from "@/modules/fallos";
import { sha256Hex } from "@/lib/archivos";
import { construirEntrega, drenar, enviarEstadoVacante, enviarWebhook, leerCv, opcionesRapidas, payloadValido, postular, prisma, reiniciarBd, talentia } from "./utilidades";

beforeEach(reiniciarBd);

const conteoAts = () => talentia.conteo();

describe("P5.1 · cierre de vacantes propagado desde Vínculo (JOB_POSTING_STATUS)", () => {
  it("cerrar: el puente marca la correspondencia y responde JOB_POSTING_CLOSED a las postulaciones posteriores al cierre", async () => {
    expect((await enviarEstadoVacante("RT-2026-101", "CERRADA")).status).toBe(200);
    const corr = await prisma.correspondencia.findUniqueOrThrow({ where: { externalJobId: "RT-2026-101" } });
    expect(corr).toMatchObject({ activa: false, motivoCierre: "ORIGEN" });

    const tarde = await enviarWebhook(JSON.stringify(payloadValido({ appliedAt: Date.now() + 1000 })));
    expect(tarde.status).toBe(422);
    expect((tarde.body.errors as { errorCode: string }[])[0].errorCode).toBe("JOB_POSTING_CLOSED");
    expect(await prisma.recepcion.count()).toBe(0);
  });

  it("una postulación hecha ANTES del cierre pero entregada después se respeta y llega al ATS", async () => {
    const antes = construirEntrega({ appliedAt: Date.now() - 60_000 });
    await enviarEstadoVacante("RT-2026-101", "CERRADA");
    expect((await enviarWebhook(antes.cuerpo)).status).toBe(200);
    await drenar();
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("COMPLETADO");
    expect(conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });

  it("reabrir reactiva la correspondencia; un evento viejo que llega tarde se ignora", async () => {
    const cierre = Date.now();
    await enviarEstadoVacante("RT-2026-101", "PUBLICADA", cierre + 10);
    const r = await enviarEstadoVacante("RT-2026-101", "CERRADA", cierre);
    expect(r.body.estado).toBe("IGNORADO_EVENTO_ANTERIOR");
    expect((await prisma.correspondencia.findUniqueOrThrow({ where: { externalJobId: "RT-2026-101" } })).activa).toBe(true);
    expect((await enviarWebhook(JSON.stringify(payloadValido({ appliedAt: Date.now() })))).status).toBe(200);
  });

  it("reabrir en Vínculo no reactiva una vacante desvinculada a mano en el panel", async () => {
    await prisma.correspondencia.update({ where: { externalJobId: "RT-2026-102" }, data: { activa: false, motivoCierre: "MANUAL" } });
    await enviarEstadoVacante("RT-2026-102", "CERRADA");
    await enviarEstadoVacante("RT-2026-102", "PUBLICADA", Date.now() + 10);
    expect((await prisma.correspondencia.findUniqueOrThrow({ where: { externalJobId: "RT-2026-102" } })).activa).toBe(false);
  });

  it("el evento de cierre exige firma válida", async () => {
    const r = await enviarEstadoVacante("RT-2026-101", "CERRADA", Date.now(), "0".repeat(64));
    expect(r.status).toBe(401);
    expect((await prisma.correspondencia.findUniqueOrThrow({ where: { externalJobId: "RT-2026-101" } })).activa).toBe(true);
  });
});

describe("P5.2 · transferencia del CV interrumpida", () => {
  it("se detecta (bytes recibidos ≠ Content-Length), se reintenta y termina con el CV íntegro", async () => {
    await configurarFallo("media", "INTERRUMPIR", 1);
    await postular();
    await procesarPendientes(opcionesRapidas);
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec.estado).toBe("FALLIDO_REINTENTABLE");
    expect(rec.errorCodigo).toBe("CV_TRANSFERENCIA_INCOMPLETA");
    expect(rec.paso).toBeNull(); // no se avanzó con un archivo a medias
    expect(conteoAts()).toEqual({ candidatos: 0, documentos: 0, postulaciones: 0 });

    await drenar();
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("COMPLETADO");
    expect(talentia.documentos[0].sha256).toBe(sha256Hex(leerCv()));
  });
});

describe("P5.3 · error de autenticación entre puente y ATS", () => {
  it("no reintenta: marca FALLIDO_REINTENTABLE detenido con explicación; tras corregir, «Reintentar» completa", async () => {
    await configurarFallo("candidatos", "CREDENCIALES", -1);
    await postular();
    for (let i = 0; i < 4; i++) {
      await new Promise((ok) => setTimeout(ok, 5));
      await procesarPendientes(opcionesRapidas);
    }
    const rec = await prisma.recepcion.findFirstOrThrow({ include: { trabajo: true, eventos: true } });
    expect(rec.estado).toBe("FALLIDO_REINTENTABLE");
    expect(rec.errorCodigo).toBe("ATS_AUTENTICACION");
    expect(rec.trabajo!.estado).toBe("DETENIDO");
    expect(rec.trabajo!.intentos).toBe(1); // un solo intento: no insiste con credenciales malas
    expect(rec.eventos.some((e) => e.detalle.includes("Se detienen los reintentos automáticos"))).toBe(true);
    expect(explicarError("ATS_AUTENTICACION")!.hacer).toMatch(/ATS_API_KEY/);

    await prisma.falloSimulado.deleteMany({});
    expect((await reintentar(rec.id)).ok).toBe(true);
    await drenar();
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("COMPLETADO");
    expect(conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });
});

describe("P5.4 · candidato creado pero postulación pendiente", () => {
  it("si el proceso muere tras subir el documento, al volver solo crea la postulación (sin repetir candidato ni documento)", async () => {
    await postular();
    const [t] = await reclamarTrabajos("w-muere", 1, 60);
    await expect(procesarTrabajo(t.id, { ...opcionesRapidas, simularCaidaDespuesDe: "documento_subido" })).rejects.toBeInstanceOf(CaidaSimulada);
    expect(conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 0 });

    await prisma.trabajo.update({ where: { id: t.id }, data: { leaseHasta: new Date(Date.now() - 1000) } });
    await drenar();
    const rec = await prisma.recepcion.findFirstOrThrow({ include: { eventos: true } });
    expect(rec.estado).toBe("COMPLETADO");
    expect(rec.eventos.filter((e) => e.paso === "candidato_creado")).toHaveLength(1);
    expect(rec.eventos.filter((e) => e.paso === "documento_subido")).toHaveLength(1);
    expect(conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });

  it("si el ATS falla al crear la postulación, reanuda desde documento_subido", async () => {
    await configurarFallo("postulaciones", "NO_DISPONIBLE", 2);
    await postular();
    await procesarPendientes(opcionesRapidas);
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec.paso).toBe("documento_subido");
    expect(rec.estado).toBe("FALLIDO_REINTENTABLE");
    await drenar();
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("COMPLETADO");
    expect(conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });
});
