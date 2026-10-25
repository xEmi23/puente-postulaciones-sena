import { beforeEach, describe, expect, it } from "vitest";
import { despacharPendientes, entregarUno } from "@/modules/origen/despachador";
import { cerrarVacante, editarVacante, reabrirVacante } from "@/modules/origen/vacantes";
import { crearPostulacion } from "@/modules/origen/postulacion";
import { procesarPendientes, procesarTrabajo, reclamarTrabajos, CaidaSimulada } from "@/modules/puente/procesador";
import { reintentar } from "@/modules/puente/operaciones";
import { explicarError } from "@/modules/puente/mensajes";
import { configurarFallo } from "@/modules/ats/fallos";
import { sha256Hex } from "@/lib/archivos";
import { drenar, enviarWebhook, leerCv, opcionesRapidas, payloadValido, postularEnOrigen, prisma, reiniciarBd, vacante } from "./utilidades";

beforeEach(reiniciarBd);

async function conteoAts() {
  return { candidatos: await prisma.candidato.count(), documentos: await prisma.documento.count(), postulaciones: await prisma.postulacionAts.count() };
}

describe("P5.1 · editar y cerrar vacantes en el origen", () => {
  it("editar cambia los datos pero no el código (externalJobId)", async () => {
    const r = await editarVacante("RT-2026-101", { titulo: "Desarrollador/a Backend Java Sénior", area: "Ingeniería", ciudad: "Medellín", modalidad: "Remoto", descripcion: "d".repeat(80) });
    expect(r.ok).toBe(true);
    const v = await vacante("RT-2026-101");
    expect(v.titulo).toBe("Desarrollador/a Backend Java Sénior");
    expect(v.modalidad).toBe("Remoto");
    expect((await editarVacante("RT-2026-101", { titulo: "x" })).ok).toBe(false);
  });

  it("cerrar: el portal rechaza nuevas postulaciones y el puente responde JOB_POSTING_CLOSED a las posteriores al cierre", async () => {
    await cerrarVacante("RT-2026-101");
    const evento = await prisma.outboxOrigen.findFirstOrThrow({ where: { tipo: "JOB_POSTING_STATUS" } });
    expect(JSON.parse(evento.payload)).toMatchObject({ externalJobId: "RT-2026-101", estado: "CERRADA" });

    await despacharPendientes(opcionesRapidas);
    expect((await prisma.outboxOrigen.findUniqueOrThrow({ where: { id: evento.id } })).estado).toBe("ENVIADO");
    const corr = await prisma.correspondencia.findUniqueOrThrow({ where: { externalJobId: "RT-2026-101" } });
    expect(corr).toMatchObject({ activa: false, motivoCierre: "ORIGEN" });

    // El formulario del portal ya no la acepta.
    const v = await vacante("RT-2026-101");
    const r = await crearPostulacion(v.id, { nombre: "Ana", apellido: "Prueba", correo: "ana@demo.test", ciudad: "Medellín" }, { nombre: "cv.pdf", bytes: leerCv() });
    expect(r.ok).toBe(false);

    // Una postulación posterior al cierre que llegue al puente recibe JOB_POSTING_CLOSED, sin escrituras.
    const tarde = await enviarWebhook(JSON.stringify(payloadValido({ appliedAt: Date.now() + 1000 })));
    expect(tarde.status).toBe(422);
    expect((tarde.body.errors as { errorCode: string }[])[0].errorCode).toBe("JOB_POSTING_CLOSED");
    expect(await prisma.recepcion.count()).toBe(0);
  });

  it("una postulación hecha ANTES del cierre pero entregada después se respeta y llega al ATS", async () => {
    await postularEnOrigen("RT-2026-101"); // queda en la outbox
    await new Promise((ok) => setTimeout(ok, 10));
    await cerrarVacante("RT-2026-101");
    // El cierre llega primero (p. ej., la entrega de la postulación estaba reintentándose).
    const evento = await prisma.outboxOrigen.findFirstOrThrow({ where: { tipo: "JOB_POSTING_STATUS" } });
    await entregarUno(evento.id, opcionesRapidas);
    await drenar();
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("COMPLETADO");
    expect(await conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });

  it("reabrir reactiva la correspondencia; un evento viejo que llega tarde se ignora", async () => {
    await cerrarVacante("RT-2026-101");
    await new Promise((ok) => setTimeout(ok, 10));
    await reabrirVacante("RT-2026-101");
    const [cierre, apertura] = await prisma.outboxOrigen.findMany({ where: { tipo: "JOB_POSTING_STATUS" }, orderBy: { creadoEn: "asc" } });
    // Llegan en desorden: primero la reapertura, después el cierre (más viejo).
    await entregarUno(apertura.id, opcionesRapidas);
    await entregarUno(cierre.id, opcionesRapidas);
    const corr = await prisma.correspondencia.findUniqueOrThrow({ where: { externalJobId: "RT-2026-101" } });
    expect(corr.activa).toBe(true);
    expect((await prisma.intentoEntregaOrigen.findFirstOrThrow({ where: { outboxId: cierre.id } })).respuesta).toContain("IGNORADO_EVENTO_ANTERIOR");
    expect((await enviarWebhook(JSON.stringify(payloadValido({ appliedAt: Date.now() })))).status).toBe(200);
  });

  it("reabrir en el origen no reactiva una vacante desvinculada a mano en el panel", async () => {
    await prisma.correspondencia.update({ where: { externalJobId: "RT-2026-102" }, data: { activa: false, motivoCierre: "MANUAL" } });
    await cerrarVacante("RT-2026-102");
    await reabrirVacante("RT-2026-102");
    await drenar();
    expect((await prisma.correspondencia.findUniqueOrThrow({ where: { externalJobId: "RT-2026-102" } })).activa).toBe(false);
  });

  it("el evento de cierre exige firma válida", async () => {
    const r = await (await import("./utilidades")).fetchEnProceso("http://app.test/api/puente/vacantes/estado", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-LI-Signature": "0".repeat(64) },
      body: JSON.stringify({ type: "JOB_POSTING_STATUS", externalJobId: "RT-2026-101", estado: "CERRADA", cambiadoEn: Date.now() }),
    });
    expect(r.status).toBe(401);
    expect((await prisma.correspondencia.findUniqueOrThrow({ where: { externalJobId: "RT-2026-101" } })).activa).toBe(true);
  });
});

describe("P5.2 · transferencia del CV interrumpida", () => {
  it("se detecta (bytes recibidos ≠ Content-Length), se reintenta y termina con el CV íntegro", async () => {
    await configurarFallo("media", "INTERRUMPIR", 1);
    await postularEnOrigen();
    await despacharPendientes(opcionesRapidas);
    await procesarPendientes(opcionesRapidas);
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec.estado).toBe("FALLIDO_REINTENTABLE");
    expect(rec.errorCodigo).toBe("CV_TRANSFERENCIA_INCOMPLETA");
    expect(rec.paso).toBeNull(); // no se avanzó con un archivo a medias
    expect(await conteoAts()).toEqual({ candidatos: 0, documentos: 0, postulaciones: 0 });

    await drenar();
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("COMPLETADO");
    expect((await prisma.documento.findFirstOrThrow()).sha256).toBe(sha256Hex(leerCv()));
  });
});

describe("P5.3 · error de autenticación entre puente y ATS", () => {
  it("no reintenta: marca FALLIDO_REINTENTABLE detenido con explicación; tras corregir, «Reintentar» completa", async () => {
    await configurarFallo("candidatos", "CREDENCIALES", -1);
    await postularEnOrigen();
    await despacharPendientes(opcionesRapidas);
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
    expect(await conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });
});

describe("P5.4 · candidato creado pero postulación pendiente", () => {
  it("si el proceso muere tras subir el documento, al volver solo crea la postulación (sin repetir candidato ni documento)", async () => {
    await postularEnOrigen();
    await despacharPendientes(opcionesRapidas);
    const [t] = await reclamarTrabajos("w-muere", 1, 60);
    await expect(procesarTrabajo(t.id, { ...opcionesRapidas, simularCaidaDespuesDe: "documento_subido" })).rejects.toBeInstanceOf(CaidaSimulada);
    expect(await conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 0 });

    await prisma.trabajo.update({ where: { id: t.id }, data: { leaseHasta: new Date(Date.now() - 1000) } });
    await drenar();
    const rec = await prisma.recepcion.findFirstOrThrow({ include: { eventos: true } });
    expect(rec.estado).toBe("COMPLETADO");
    expect(rec.eventos.filter((e) => e.paso === "candidato_creado")).toHaveLength(1);
    expect(rec.eventos.filter((e) => e.paso === "documento_subido")).toHaveLength(1);
    expect(await conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });

  it("si el ATS falla al crear la postulación, reanuda desde documento_subido", async () => {
    await configurarFallo("postulaciones", "NO_DISPONIBLE", 2);
    await postularEnOrigen();
    await despacharPendientes(opcionesRapidas);
    await procesarPendientes(opcionesRapidas);
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec.paso).toBe("documento_subido");
    expect(rec.estado).toBe("FALLIDO_REINTENTABLE");
    await drenar();
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("COMPLETADO");
    expect(await conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });
});
