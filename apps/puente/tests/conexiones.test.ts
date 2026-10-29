import { beforeEach, describe, expect, it } from "vitest";
import { conexionTalentia, conexionVinculo, desconectar, enmascarar, guardarVinculo } from "@/modules/conexiones";
import { probarTalentia, probarVinculo } from "@/modules/prueba-conexion";
import { olvidarToken } from "@/modules/vinculo-cliente";
import { publicarProceso, sondearProcesosNuevos } from "@/modules/publicacion";
import { procesarAvisos, MAX_INTENTOS_AVISO } from "@/modules/avisos";
import { procesarPendientes } from "@/modules/procesador";
import { respuestaDesafio } from "@/lib/firma";
import { CREDENCIALES, drenar, enviarWebhook, fetchEnProceso, opcionesRapidas, payloadValido, postular, prisma, reiniciarBd, talentia, vinculo } from "./utilidades";

// F3: conexiones configurables, publicación desde el puente, aviso RESUME_DOWNLOADED y errores de Talentia (401/403/429).

beforeEach(reiniciarBd);

const rapido = { fetchImpl: fetchEnProceso, baseBackoffMs: 1 };
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

describe("conexiones · secretos cifrados y enmascarados", () => {
  it("el Client Secret y la API Key se guardan cifrados (nunca en claro) y solo se muestran sus 4 últimos caracteres", async () => {
    const filas = await prisma.conexion.findMany();
    expect(filas).toHaveLength(2);
    for (const f of filas) {
      const secreto = f.tipo === "VINCULO" ? CREDENCIALES.clientSecret : CREDENCIALES.apiKey;
      expect(f.secretoCifrado).not.toContain(secreto);
      expect(f.secretoFinal).toBe(secreto.slice(-4));
      expect(enmascarar(f.secretoFinal)).toBe(`••••${secreto.slice(-4)}`);
    }
    expect((await conexionVinculo())!.clientSecret).toBe(CREDENCIALES.clientSecret);
    expect((await conexionTalentia())!.apiKey).toBe(CREDENCIALES.apiKey);
  });

  it("rechaza URLs que no son http(s) y datos incompletos", async () => {
    expect(await guardarVinculo({ urlBase: "file:///etc/passwd", clientId: "vin_x", clientSecret: "y".repeat(20) })).toMatchObject({ ok: false, error: expect.stringMatching(/http/) });
    expect(await guardarVinculo({ urlBase: "ftp://vinculo.test", clientId: "vin_x", clientSecret: "y".repeat(20) })).toMatchObject({ ok: false });
    expect((await guardarVinculo({ urlBase: "http://vinculo.test", clientId: "", clientSecret: "" })).ok).toBe(false);
  });
});

describe("conexiones · «Probar conexión»", () => {
  it("Vínculo: obtiene token, identifica la empresa que autorizó al puente y deja el resultado guardado", async () => {
    await prisma.conexion.update({ where: { tipo: "VINCULO" }, data: { empresaId: null, estadoPrueba: "SIN_PROBAR" } });
    const r = await probarVinculo(fetchEnProceso);
    expect(r.ok).toBe(true);
    expect(r.detalle).toContain("Andina Software");
    expect(await prisma.conexion.findUniqueOrThrow({ where: { tipo: "VINCULO" } })).toMatchObject({ estadoPrueba: "OK", empresaId: vinculo.empresa.companyId });
  });

  it("Vínculo con Client Secret incorrecto: falla con un mensaje claro", async () => {
    await guardarVinculo({ urlBase: "http://vinculo.test", clientId: CREDENCIALES.clientId, clientSecret: "otro-secreto-que-no-es-el-bueno-000" });
    const r = await probarVinculo(fetchEnProceso);
    expect(r).toMatchObject({ ok: false });
    expect(r.detalle).toMatch(/Client ID o el Client Secret/);
    expect((await prisma.conexion.findUniqueOrThrow({ where: { tipo: "VINCULO" } })).estadoPrueba).toBe("FALLIDA");
  });

  it("Talentia: lee los permisos de la llave y lista los procesos; sin Modificación la prueba no pasa", async () => {
    expect((await probarTalentia(fetchEnProceso)).ok).toBe(true);
    talentia.permisos = { lectura: true, modificacion: false };
    const r = await probarTalentia(fetchEnProceso);
    expect(r.ok).toBe(false);
    expect(r.detalle).toMatch(/Modificación no/);
  });

  it("Talentia con llave revocada: la prueba falla y lo dice", async () => {
    talentia.revocada = true;
    const r = await probarTalentia(fetchEnProceso);
    expect(r.ok).toBe(false);
    expect(r.detalle).toMatch(/revocada|no es válida/i);
  });
});

describe("conexiones · webhook y token", () => {
  it("el desafío del webhook se responde con el Client Secret guardado y marca el webhook como validado", async () => {
    const r = await fetchEnProceso("http://puente.test/api/webhooks/vinculo?challengeCode=abc123");
    expect(r.status).toBe(200);
    expect((await r.json()).challengeResponse).toBe(respuestaDesafio("abc123", CREDENCIALES.clientSecret));
    expect((await prisma.conexion.findUniqueOrThrow({ where: { tipo: "VINCULO" } })).webhookValidadoEn).not.toBeNull();
  });

  it("sin conexión con Vínculo: desafío y entregas responden 503 (Vínculo reintenta) y no se guarda nada", async () => {
    await desconectar("VINCULO");
    expect((await fetchEnProceso("http://puente.test/api/webhooks/vinculo?challengeCode=abc")).status).toBe(503);
    const r = await enviarWebhook(JSON.stringify(payloadValido()), "0".repeat(64));
    expect(r.status).toBe(503);
    expect(await prisma.recepcion.count()).toBe(0);
  });

  it("reutiliza el access token entre llamadas y pide uno nuevo si Vínculo lo invalida", async () => {
    olvidarToken();
    await postular();
    await postular();
    await drenar();
    expect(vinculo.tokensEmitidos).toBe(1);
    vinculo.invalidarTokens();
    await postular();
    await drenar();
    expect(vinculo.tokensEmitidos).toBe(2);
    expect(await prisma.recepcion.count({ where: { estado: "COMPLETADO" } })).toBe(3);
  });
});

describe("publicación en Vínculo desde el puente", () => {
  it("«Publicar en Vínculo» crea la vacante con externalJobId = id del proceso y el webhook del puente", async () => {
    const r = await publicarProceso(9001, { fetchImpl: fetchEnProceso });
    expect(r.ok).toBe(true);
    const v = vinculo.publicaciones.get("9001")!;
    expect(v).toMatchObject({ companyId: vinculo.empresa.companyId, webhook: "http://puente.test/api/webhooks/vinculo", estado: "LISTED" });
    expect(await prisma.publicacion.findUniqueOrThrow({ where: { procesoId: 9001 } })).toMatchObject({ estado: "PUBLICADA", solicitudSencilla: true, externalJobId: "9001" });

    // Las postulaciones a esa vacante van al proceso sin correspondencia manual.
    await postular({ codigo: "9001" });
    await drenar();
    expect(await prisma.recepcion.findFirstOrThrow()).toMatchObject({ estado: "COMPLETADO", procesoAtsId: 9001 });
    expect(talentia.postulaciones[0].procesoId).toBe(9001);
  });

  it("publicar dos veces no duplica la vacante (idempotente por externalJobId)", async () => {
    await publicarProceso(9002, { fetchImpl: fetchEnProceso });
    await publicarProceso(9002, { fetchImpl: fetchEnProceso });
    expect(vinculo.publicaciones.size).toBe(1);
    expect(await prisma.publicacion.count()).toBe(1);
  });

  it("no publica un proceso que no está «Iniciado» en Talentia", async () => {
    const r = await publicarProceso(9003, { fetchImpl: fetchEnProceso });
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/no está «Iniciado»/);
    expect(vinculo.publicaciones.size).toBe(0);
  });

  it("la publicación automática publica los procesos iniciados que faltan (y nada si está apagada)", async () => {
    expect(await sondearProcesosNuevos({ fetchImpl: fetchEnProceso, forzar: true })).toBe(0);
    await prisma.configuracion.update({ where: { id: 1 }, data: { publicacionAutomatica: true } });
    const iniciados = talentia.procesos.filter((p) => p.estado === "INICIADO").length;
    expect(await sondearProcesosNuevos({ fetchImpl: fetchEnProceso, forzar: true })).toBe(iniciados);
    expect(await sondearProcesosNuevos({ fetchImpl: fetchEnProceso, forzar: true })).toBe(0);
    expect(await prisma.publicacion.count({ where: { automatica: true } })).toBe(iniciados);
  });
});

describe("aviso RESUME_DOWNLOADED a Vínculo", () => {
  it("al completar, el puente avisa a Vínculo una sola vez", async () => {
    const e = await postular();
    await drenar();
    expect((await prisma.recepcion.findFirstOrThrow()).avisoEstado).toBe("PENDIENTE");
    expect(await procesarAvisos(rapido)).toBe(1);
    expect(vinculo.avisos).toEqual([{ jobApplicationId: e.jobApplicationId, action: "RESUME_DOWNLOADED" }]);
    expect((await prisma.recepcion.findFirstOrThrow()).avisoEstado).toBe("ENVIADO");
    expect(await procesarAvisos(rapido)).toBe(0);
  });

  it("si Vínculo falla, se reintenta solo; el COMPLETADO no depende del aviso", async () => {
    vinculo.fallosAviso = [503, 503];
    await postular();
    await drenar();
    for (let i = 0; i < 3; i++) {
      await procesarAvisos(rapido);
      await esperar(10);
    }
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec).toMatchObject({ estado: "COMPLETADO", avisoEstado: "ENVIADO", avisoIntentos: 3 });
    expect(vinculo.avisos).toHaveLength(1);
  });

  it(`tras ${MAX_INTENTOS_AVISO} fallos queda FALLIDO y visible, sin tocar la transferencia`, async () => {
    vinculo.fallosAviso = Array(MAX_INTENTOS_AVISO).fill(503);
    await postular();
    await drenar();
    for (let i = 0; i < MAX_INTENTOS_AVISO; i++) {
      await prisma.recepcion.updateMany({ data: { avisoProximoEn: new Date(Date.now() - 1000) } });
      await procesarAvisos(rapido);
    }
    expect(await prisma.recepcion.findFirstOrThrow()).toMatchObject({ estado: "COMPLETADO", avisoEstado: "FALLIDO" });
  });
});

describe("errores de Talentia", () => {
  it("API Key revocada (401): se detiene sin reintentar, con mensaje claro; con una llave nueva y «Reintentar» completa", async () => {
    talentia.revocada = true;
    await postular();
    for (let i = 0; i < 3; i++) {
      await procesarPendientes(opcionesRapidas);
      await esperar(5);
    }
    const rec = await prisma.recepcion.findFirstOrThrow({ include: { trabajo: true } });
    expect(rec).toMatchObject({ estado: "FALLIDO_REINTENTABLE", errorCodigo: "ATS_AUTENTICACION" });
    expect(rec.errorDetalle).toMatch(/revocada|no es válida/i);
    expect(rec.trabajo).toMatchObject({ estado: "DETENIDO", intentos: 1 });
    expect(talentia.conteo()).toEqual({ candidatos: 0, documentos: 0, postulaciones: 0 });
  });

  it("llave sin permiso de Modificación (403): se detiene con ATS_PERMISO", async () => {
    talentia.permisos = { lectura: true, modificacion: false };
    await postular();
    await procesarPendientes(opcionesRapidas);
    const rec = await prisma.recepcion.findFirstOrThrow({ include: { trabajo: true } });
    expect(rec.errorCodigo).toBe("ATS_PERMISO");
    expect(rec.trabajo!.estado).toBe("DETENIDO");
  });

  it("límite de Talentia (429): reintenta respetando Retry-After y completa sin duplicar", async () => {
    talentia.limitar = 1;
    talentia.retryAfter = 2;
    await postular();
    const antes = Date.now();
    await procesarPendientes(opcionesRapidas);
    const rec = await prisma.recepcion.findFirstOrThrow({ include: { trabajo: true } });
    expect(rec.errorCodigo).toBe("ATS_LIMITE");
    expect(rec.trabajo!.proximoIntentoEn.getTime() - antes).toBeGreaterThanOrEqual(1900);
    await prisma.trabajo.updateMany({ data: { proximoIntentoEn: new Date() } });
    await drenar();
    expect((await prisma.recepcion.findFirstOrThrow()).estado).toBe("COMPLETADO");
    expect(talentia.conteo()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });

  it("sin conexión con Talentia: se detiene con PUENTE_SIN_CONEXION", async () => {
    await desconectar("TALENTIA");
    await postular();
    await procesarPendientes(opcionesRapidas);
    expect((await prisma.recepcion.findFirstOrThrow()).errorCodigo).toBe("PUENTE_SIN_CONEXION");
  });
});
