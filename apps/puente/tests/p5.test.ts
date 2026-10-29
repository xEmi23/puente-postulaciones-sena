import { beforeEach, describe, expect, it } from "vitest";
import { procesarPendientes, procesarTrabajo, reclamarTrabajos, CaidaSimulada } from "@/modules/procesador";
import { reintentar } from "@/modules/operaciones";
import { explicarError } from "@/modules/mensajes";
import { configurarFallo } from "@/modules/fallos";
import { sha256Hex } from "@/lib/archivos";
import { cerrarPublicacion, publicarProceso } from "@/modules/publicacion";
import { construirEntrega, drenar, enviarWebhook, fetchEnProceso, leerCv, opcionesRapidas, payloadValido, postular, prisma, reiniciarBd, talentia } from "./utilidades";

beforeEach(reiniciarBd);

const conteoAts = () => talentia.conteo();

describe("P5.1 · cierre de vacantes (publicación del puente o correspondencia desvinculada)", () => {
  it("cerrar en Vínculo: las postulaciones posteriores al cierre se rechazan con JOB_POSTING_CLOSED", async () => {
    expect((await publicarProceso(9001, { fetchImpl: fetchEnProceso })).ok).toBe(true);
    expect((await cerrarPublicacion(9001, fetchEnProceso)).ok).toBe(true);
    expect(await prisma.publicacion.findUniqueOrThrow({ where: { procesoId: 9001 } })).toMatchObject({ estado: "CERRADA" });

    const tarde = await enviarWebhook(JSON.stringify(payloadValido({ externalJobId: "9001", appliedAt: Date.now() + 1000 })));
    expect(tarde.status).toBe(422);
    expect((tarde.body.errors as { errorCode: string }[])[0].errorCode).toBe("JOB_POSTING_CLOSED");
    expect(await prisma.recepcion.count()).toBe(0);
  });

  it("una postulación hecha ANTES del cierre pero entregada después se respeta y llega a Talentia", async () => {
    await publicarProceso(9001, { fetchImpl: fetchEnProceso });
    const antes = construirEntrega({ codigo: "9001", appliedAt: Date.now() - 60_000 });
    await cerrarPublicacion(9001, fetchEnProceso);
    expect((await enviarWebhook(antes.cuerpo)).status).toBe(200);
    await drenar();
    expect(await prisma.recepcion.findFirstOrThrow()).toMatchObject({ estado: "COMPLETADO", procesoAtsId: 9001 });
    expect(conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });

  it("«Publicar de nuevo» reabre la vacante y vuelve a aceptar postulaciones", async () => {
    await publicarProceso(9001, { fetchImpl: fetchEnProceso });
    await cerrarPublicacion(9001, fetchEnProceso);
    expect((await publicarProceso(9001, { fetchImpl: fetchEnProceso })).ok).toBe(true);
    expect((await enviarWebhook(JSON.stringify(payloadValido({ externalJobId: "9001", appliedAt: Date.now() })))).status).toBe(200);
  });

  it("una correspondencia desvinculada a mano solo admite lo postulado antes de desvincular", async () => {
    const antes = construirEntrega({ codigo: "RT-2026-102", appliedAt: Date.now() - 60_000 });
    await prisma.correspondencia.update({ where: { externalJobId: "RT-2026-102" }, data: { activa: false, cerradaEn: new Date() } });
    expect((await enviarWebhook(antes.cuerpo)).status).toBe(200);
    const tarde = await enviarWebhook(JSON.stringify(payloadValido({ externalJobId: "RT-2026-102", appliedAt: Date.now() + 1000 })));
    expect(tarde.status).toBe(422);
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
    expect(explicarError("ATS_AUTENTICACION")!.hacer).toMatch(/API Key/);

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
    expect(rec.eventos.filter((e) => e.paso === "postulante_listo")).toHaveLength(1);
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
