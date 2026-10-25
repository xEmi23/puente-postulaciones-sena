import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { despacharPendientes } from "@/modules/origen/despachador";
import { procesarPendientes, procesarTrabajo, reclamarTrabajos, CaidaSimulada } from "@/modules/puente/procesador";
import { configurarFallo } from "@/modules/ats/fallos";
import { reconciliar, reintentar, calcularMetricas } from "@/modules/puente/operaciones";
import { sha256Hex } from "@/lib/archivos";
import { drenar, enviarWebhook, fetchEnProceso, leerCv, opcionesRapidas, payloadValido, postularEnOrigen, prisma, reiniciarBd } from "./utilidades";

beforeEach(reiniciarBd);

/** Entrega la outbox al puente (sin procesar todavía) y devuelve el cuerpo exacto enviado. */
async function entregarAlPuente() {
  await despacharPendientes(opcionesRapidas);
  const o = await prisma.outboxOrigen.findFirstOrThrow({ orderBy: { creadoEn: "desc" } });
  return o.payload;
}

async function conteoAts() {
  return {
    candidatos: await prisma.candidato.count(),
    documentos: await prisma.documento.count(),
    postulaciones: await prisma.postulacionAts.count(),
  };
}

describe("P2.1 · mismo jobApplicationId reenviado", () => {
  it("no duplica: el puente responde 200 DUPLICADO y el ATS conserva una sola postulación", async () => {
    await postularEnOrigen();
    const cuerpo = await entregarAlPuente();
    await drenar();
    const r = await enviarWebhook(cuerpo);
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe("DUPLICADO");
    await drenar();
    expect(await prisma.recepcion.count()).toBe(1);
    expect(await prisma.trabajo.count()).toBe(1);
    expect(await conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
    expect((await prisma.recepcion.findFirstOrThrow()).duplicadosEvitados).toBe(1);
  });
});

describe("P2.2 · entregas simultáneas del mismo evento", () => {
  it("5 entregas concurrentes crean una sola recepción y un solo trabajo (restricción única)", async () => {
    await postularEnOrigen();
    const o = await prisma.outboxOrigen.findFirstOrThrow();
    const respuestas = await Promise.all(Array.from({ length: 5 }, () => enviarWebhook(o.payload)));
    expect(respuestas.every((r) => r.status === 200)).toBe(true);
    expect(respuestas.filter((r) => r.body.estado === "RECIBIDO")).toHaveLength(1);
    expect(respuestas.filter((r) => r.body.estado === "DUPLICADO")).toHaveLength(4);
    expect(await prisma.recepcion.count()).toBe(1);
    expect(await prisma.trabajo.count()).toBe(1);
  });

  it("dos workers reclamando a la vez obtienen el trabajo una sola vez (FOR UPDATE SKIP LOCKED + lease)", async () => {
    for (let i = 0; i < 3; i++) {
      await enviarWebhook(JSON.stringify(payloadValido({ jobApplicationId: `urn:li:jobApplication:77${i}` })));
    }
    const [a, b, c] = await Promise.all([reclamarTrabajos("w-a", 10), reclamarTrabajos("w-b", 10), reclamarTrabajos("w-c", 10)]);
    const ids = [...a, ...b, ...c].map((t) => t.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    // Con el lease vigente nadie más los puede tomar.
    expect(await reclamarTrabajos("w-d", 10)).toHaveLength(0);
  });
});

describe("P2.3 · la misma persona en dos vacantes", () => {
  it("un candidato, dos postulaciones (una por proceso)", async () => {
    await postularEnOrigen("RT-2026-101");
    await postularEnOrigen("RT-2026-102");
    await drenar();
    expect(await prisma.candidato.count()).toBe(1);
    const posts = await prisma.postulacionAts.findMany({ orderBy: { procesoId: "asc" } });
    expect(posts.map((p) => p.procesoId)).toEqual([9001, 9002]);
    expect(new Set(posts.map((p) => p.candidatoId)).size).toBe(1);
  });
});

describe("P2.4 · vacante sin correspondencia o cerrada", () => {
  it("vacante desvinculada → JOB_POSTING_CLOSED, sin adivinar proceso y sin escrituras en el ATS", async () => {
    await prisma.correspondencia.update({ where: { externalJobId: "RT-2026-102" }, data: { activa: false } });
    await postularEnOrigen("RT-2026-102");
    await drenar();
    const outbox = await prisma.outboxOrigen.findFirstOrThrow({ include: { intentosEntrega: true } });
    expect(outbox.estado).toBe("FALLIDO"); // JOB_POSTING_CLOSED no se reintenta
    expect(outbox.intentosEntrega).toHaveLength(1);
    expect(outbox.intentosEntrega[0].codigoError).toBe("JOB_POSTING_CLOSED");
    expect(await prisma.recepcion.count()).toBe(0);
    expect(await conteoAts()).toEqual({ candidatos: 0, documentos: 0, postulaciones: 0 });
  });

  it("si la correspondencia se desactiva después de recibir, la operación termina RECHAZADA sin tocar el ATS", async () => {
    await postularEnOrigen("RT-2026-101");
    await entregarAlPuente();
    await prisma.correspondencia.update({ where: { externalJobId: "RT-2026-101" }, data: { activa: false } });
    await drenar();
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec.estado).toBe("RECHAZADO");
    expect(rec.errorCodigo).toBe("JOB_POSTING_CLOSED");
    expect(await conteoAts()).toEqual({ candidatos: 0, documentos: 0, postulaciones: 0 });
  });
});

describe("P2.5 · entradas inválidas: rechazo con código y cero escrituras en el ATS", () => {
  async function recepcionConArchivo(contenido: Uint8Array) {
    const id = randomUUID();
    await prisma.archivoCv.create({
      data: { id, nombreArchivo: "x.pdf", mime: "application/pdf", tamano: contenido.length, sha256: sha256Hex(contenido), contenido: Buffer.from(contenido), mediaUrn: `urn:li:media:${id}`, expiraEn: new Date(Date.now() + 86_400_000) },
    });
    const p = payloadValido({ jobApplicationId: `urn:li:jobApplication:${Date.now()}` });
    p.questionResponses.resumeQuestionResponses = { resumeQuestionAnswer: { mediaUrl: `http://app.test/api/origen/media/${id}`, mediaUrn: `urn:li:media:${id}` } };
    expect((await enviarWebhook(JSON.stringify(p))).status).toBe(200);
  }

  it("PDF inválido en el mediaUrl → RECHAZADO CV_INVALIDO", async () => {
    await recepcionConArchivo(new TextEncoder().encode("esto no es un pdf"));
    await drenar();
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec.estado).toBe("RECHAZADO");
    expect(rec.errorCodigo).toBe("CV_INVALIDO");
    expect(await conteoAts()).toEqual({ candidatos: 0, documentos: 0, postulaciones: 0 });
  });

  it("PDF demasiado grande → RECHAZADO CV_DEMASIADO_GRANDE", async () => {
    const grande = new Uint8Array(1_100_000); // CV_MAX_BYTES de pruebas = 1 MiB
    grande.set(new TextEncoder().encode("%PDF-1.4"));
    await recepcionConArchivo(grande);
    await drenar();
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec.estado).toBe("RECHAZADO");
    expect(rec.errorCodigo).toBe("CV_DEMASIADO_GRANDE");
    expect(await conteoAts()).toEqual({ candidatos: 0, documentos: 0, postulaciones: 0 });
  });

  it("enlace del CV inexistente o expirado → RECHAZADO CV_NO_DISPONIBLE", async () => {
    await enviarWebhook(JSON.stringify(payloadValido()));
    await drenar();
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec.estado).toBe("RECHAZADO");
    expect(rec.errorCodigo).toBe("CV_NO_DISPONIBLE");
    expect(await conteoAts()).toEqual({ candidatos: 0, documentos: 0, postulaciones: 0 });
  });

  it("firma inválida y datos incompletos → rechazados en la entrada (ver webhook.test.ts) y cero escrituras", async () => {
    expect((await enviarWebhook(JSON.stringify(payloadValido()), "f".repeat(64))).status).toBe(401);
    const sinCorreo = payloadValido();
    delete (sinCorreo.questionResponses.contactInformationQuestionResponses as Record<string, unknown>).emailAnswer;
    expect((await enviarWebhook(JSON.stringify(sinCorreo))).status).toBe(400);
    await drenar();
    expect(await prisma.recepcion.count()).toBe(0);
    expect(await conteoAts()).toEqual({ candidatos: 0, documentos: 0, postulaciones: 0 });
  });
});

describe("P2.6 · ATS no disponible (5xx o timeout)", () => {
  it("5xx: reintenta con backoff conservando el progreso por paso y termina sin duplicar", async () => {
    await configurarFallo("documentos", "NO_DISPONIBLE", 2);
    await postularEnOrigen();
    await entregarAlPuente();

    await procesarPendientes(opcionesRapidas);
    const rec = await prisma.recepcion.findFirstOrThrow({ include: { trabajo: true } });
    expect(rec.estado).toBe("FALLIDO_REINTENTABLE");
    expect(rec.paso).toBe("candidato_creado"); // progreso conservado
    expect(rec.errorCodigo).toBe("ATS_NO_DISPONIBLE");
    expect(rec.trabajo!.estado).toBe("PENDIENTE");
    expect(rec.trabajo!.proximoIntentoEn.getTime()).toBeGreaterThan(Date.now() - 1000);

    await drenar();
    const fin = await prisma.recepcion.findFirstOrThrow({ include: { trabajo: true, eventos: true } });
    expect(fin.estado).toBe("COMPLETADO");
    expect(fin.trabajo!.intentos).toBe(3);
    expect(fin.eventos.filter((e) => e.tipo === "INTENTO_FALLIDO")).toHaveLength(2);
    expect(await conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });

  it("timeout: el puente corta la espera, reintenta y la Idempotency-Key evita el documento duplicado", async () => {
    process.env.ATS_TIMEOUT_MS = "300";
    process.env.SIMULADOR_DEMORA_LENTO_MS = "800";
    try {
      await configurarFallo("documentos", "LENTO", 1);
      await postularEnOrigen();
      await entregarAlPuente();
      await procesarPendientes(opcionesRapidas);
      const rec = await prisma.recepcion.findFirstOrThrow();
      expect(rec.estado).toBe("FALLIDO_REINTENTABLE");
      expect(rec.paso).toBe("candidato_creado");
      await new Promise((ok) => setTimeout(ok, 900)); // deja terminar la escritura lenta del ATS
      await drenar();
    } finally {
      delete process.env.ATS_TIMEOUT_MS;
      delete process.env.SIMULADOR_DEMORA_LENTO_MS;
    }
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("COMPLETADO");
    expect(await conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });

  it("agotados los reintentos queda FALLIDO_REINTENTABLE detenido y el reintento manual lo completa", async () => {
    await configurarFallo("candidatos", "NO_DISPONIBLE", -1);
    await postularEnOrigen();
    await entregarAlPuente();
    for (let i = 0; i < 3; i++) {
      await new Promise((ok) => setTimeout(ok, 5));
      await procesarPendientes({ ...opcionesRapidas, maxIntentos: 3 });
    }
    let rec = await prisma.recepcion.findFirstOrThrow({ include: { trabajo: true } });
    expect(rec.estado).toBe("FALLIDO_REINTENTABLE");
    expect(rec.trabajo!.estado).toBe("DETENIDO");

    await prisma.falloSimulado.deleteMany({});
    expect((await reintentar(rec.id)).ok).toBe(true);
    await drenar();
    rec = await prisma.recepcion.findFirstOrThrow({ include: { trabajo: true } });
    expect(rec.estado).toBe("COMPLETADO");
    expect(await conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });
});

describe("P2.7 · reinicio del worker a mitad del recorrido", () => {
  it("retoma desde el último paso confirmado sin crear otro candidato", async () => {
    await postularEnOrigen();
    await entregarAlPuente();
    const [t] = await reclamarTrabajos("worker-que-muere", 1, 60);
    await expect(procesarTrabajo(t.id, { ...opcionesRapidas, simularCaidaDespuesDe: "candidato_creado" })).rejects.toBeInstanceOf(CaidaSimulada);

    const rec = await prisma.recepcion.findFirstOrThrow({ include: { trabajo: true } });
    expect(rec.paso).toBe("candidato_creado");
    expect(rec.trabajo!.estado).toBe("EN_CURSO"); // quedó tomado por el proceso muerto
    expect(await reclamarTrabajos("otro", 1)).toHaveLength(0); // lease vigente

    // Vence el lease (equivale a que pasen 60 s) y un worker nuevo lo retoma.
    await prisma.trabajo.update({ where: { id: t.id }, data: { leaseHasta: new Date(Date.now() - 1000) } });
    await drenar();
    const fin = await prisma.recepcion.findFirstOrThrow({ include: { eventos: true } });
    expect(fin.estado).toBe("COMPLETADO");
    expect(fin.eventos.filter((e) => e.paso === "candidato_creado")).toHaveLength(1); // no se repitió el paso
    expect(await conteoAts()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });

  it("si muere justo después de crear el candidato en el ATS pero antes de confirmar, no se duplica (búsqueda por correo)", async () => {
    await postularEnOrigen();
    await entregarAlPuente();
    const [t] = await reclamarTrabajos("w1", 1, 60);
    await expect(procesarTrabajo(t.id, { ...opcionesRapidas, simularCaidaDespuesDe: "cv_descargado" })).rejects.toBeInstanceOf(CaidaSimulada);
    // El candidato ya existe en el ATS (por ejemplo, creado por otra vacante): el puente lo reutiliza.
    await fetchEnProceso("http://app.test/api/ats/v1/candidatos", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.ATS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Camila", apellido: "Ejemplo", correo: "camila.ejemplo@demo.test" }),
    });
    await prisma.trabajo.update({ where: { id: t.id }, data: { leaseHasta: new Date(Date.now() - 1000) } });
    await drenar();
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("COMPLETADO");
    expect(await prisma.candidato.count()).toBe(1);
  });
});

describe("P2.8 · respuesta perdida tras una escritura en el ATS", () => {
  it("no repite a ciegas: reconcilia por referencia externa y completa con una sola postulación", async () => {
    await configurarFallo("postulaciones", "PERDER_RESPUESTA", 1);
    await postularEnOrigen();
    await entregarAlPuente();
    await procesarPendientes(opcionesRapidas);
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec.estado).toBe("FALLIDO_REINTENTABLE");
    expect(rec.errorCodigo).toBe("ATS_SIN_RESPUESTA");
    expect(await prisma.postulacionAts.count()).toBe(1); // la escritura sí ocurrió

    await drenar();
    const fin = await prisma.recepcion.findFirstOrThrow({ include: { eventos: true } });
    expect(fin.estado).toBe("COMPLETADO");
    expect(fin.eventos.some((e) => e.detalle.startsWith("Reconciliado"))).toBe(true);
    expect(await prisma.postulacionAts.count()).toBe(1);
  });

  it("si no se puede saber (consulta caída y reintentos agotados) → REQUIERE_VERIFICACION; luego se reconcilia desde el panel", async () => {
    await configurarFallo("postulaciones", "PERDER_RESPUESTA", 1);
    await configurarFallo("consulta", "NO_DISPONIBLE", -1);
    await postularEnOrigen();
    await entregarAlPuente();
    for (let i = 0; i < 3; i++) {
      await new Promise((ok) => setTimeout(ok, 5));
      await procesarPendientes({ ...opcionesRapidas, maxIntentos: 3 });
    }
    let rec = await prisma.recepcion.findFirstOrThrow({ include: { trabajo: true } });
    expect(rec.estado).toBe("REQUIERE_VERIFICACION");
    expect(rec.trabajo!.estado).toBe("DETENIDO");
    expect(await prisma.postulacionAts.count()).toBe(1);

    // Reintentar no está permitido aquí: primero hay que reconciliar.
    expect((await reintentar(rec.id)).ok).toBe(false);
    // Con la consulta todavía caída, la reconciliación no adivina.
    expect((await reconciliar(rec.id, { fetchImpl: fetchEnProceso })).ok).toBe(false);
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("REQUIERE_VERIFICACION");

    await prisma.falloSimulado.deleteMany({});
    const r = await reconciliar(rec.id, { fetchImpl: fetchEnProceso });
    expect(r.ok).toBe(true);
    rec = await prisma.recepcion.findFirstOrThrow({ include: { trabajo: true } });
    expect(rec.estado).toBe("COMPLETADO");
    expect(await prisma.postulacionAts.count()).toBe(1);
  });

  it("si la reconciliación confirma que NO existe, se programa crearla de nuevo (seguro)", async () => {
    await configurarFallo("postulaciones", "NO_DISPONIBLE", 1);
    await configurarFallo("consulta", "NO_DISPONIBLE", -1);
    await postularEnOrigen();
    await entregarAlPuente();
    // Forzamos el estado de incertidumbre: escritura sin respuesta y reintentos agotados.
    for (let i = 0; i < 3; i++) {
      await new Promise((ok) => setTimeout(ok, 5));
      await procesarPendientes({ ...opcionesRapidas, maxIntentos: 2 });
    }
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec.estado).toBe("REQUIERE_VERIFICACION");
    expect(await prisma.postulacionAts.count()).toBe(0);
    await prisma.falloSimulado.deleteMany({});
    expect((await reconciliar(rec.id, { fetchImpl: fetchEnProceso })).ok).toBe(true);
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("FALLIDO_REINTENTABLE");
    await drenar();
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("COMPLETADO");
    expect(await prisma.postulacionAts.count()).toBe(1);
  });
});

describe("métricas medidas", () => {
  it("cuentan recibidas, completadas, rechazos, duplicados y tiempos con tamaño de muestra", async () => {
    await postularEnOrigen("RT-2026-101");
    const cuerpo = await entregarAlPuente();
    await drenar();
    await enviarWebhook(cuerpo); // duplicado
    await enviarWebhook(JSON.stringify(payloadValido()), "0".repeat(64)); // firma inválida
    const m = await calcularMetricas();
    expect(m.recibidas).toBe(1);
    expect(m.completadas).toBe(1);
    expect(m.duplicadosEvitados).toBe(1);
    expect(m.rechazadasEntrada).toBe(1);
    expect(m.rechazosPorCodigo).toEqual([{ codigo: "SIGNATURE_MISMATCH", total: 1 }]);
    expect(m.muestra).toBe(1);
    expect(m.medianaSegundos).not.toBeNull();
    expect(m.p95Segundos!).toBeGreaterThanOrEqual(m.medianaSegundos!);
  });
});

describe("integridad del CV", () => {
  it("el hash guardado por el ATS coincide con el del origen", async () => {
    await postularEnOrigen();
    await drenar();
    const doc = await prisma.documento.findFirstOrThrow();
    const archivo = await prisma.archivoCv.findFirstOrThrow();
    expect(doc.sha256).toBe(archivo.sha256);
    expect(doc.sha256).toBe(sha256Hex(leerCv()));
  });
});
