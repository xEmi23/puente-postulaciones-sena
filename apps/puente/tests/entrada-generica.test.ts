import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { POST as postular } from "@/app/api/entradas/v1/postulaciones/route";
import { GET as vacantes } from "@/app/api/entradas/v1/vacantes/route";
import { asegurarFuenteSistema, crearFuente, generarToken, revocarFuente } from "@/entradas/generica/fuentes";
import { reiniciarCupos } from "@/entradas/generica/limite";
import { aprobarRevision, borrarDatosCandidato, completarRevision, descartarRevision } from "@/modules/revision";
import { reintentar, calcularMetricas } from "@/modules/operaciones";
import { aplicarRetencion } from "@/modules/retencion";
import { configurarFallo } from "@/modules/fallos";
import { procesarPendientes } from "@/modules/procesador";
import { estadoV4 } from "@/nucleo/estados";
import { conectorATS, usarConectorDePrueba } from "@/salidas";
import { drenar, fetchEnProceso, leerCv, opcionesRapidas, postular as postularPorVinculo, prisma, reiniciarBd, talentia } from "./utilidades";

// F2: entrada genérica, fuentes y tokens, revisión humana, auditoría y retención (ESPECIFICACION_V4 §7, §8.1, §11).

const ADMIN = { tipo: "usuario" as const, id: "usuario-admin-pruebas" };
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
let token = "";

async function enviar(datos: unknown, opciones: { cv?: Uint8Array | null; nombreCv?: string; token?: string } = {}) {
  const fd = new FormData();
  fd.set("datos", JSON.stringify(datos));
  const cv = opciones.cv === undefined ? leerCv() : opciones.cv;
  if (cv) fd.set("cv", new File([cv.slice()], opciones.nombreCv ?? "cv-ficticio.pdf", { type: "application/pdf" }));
  const r = await postular(
    new Request("http://puente.test/api/entradas/v1/postulaciones", { method: "POST", headers: { authorization: `Bearer ${opciones.token ?? token}` }, body: fd }),
  );
  return { status: r.status, body: (await r.json()) as Record<string, unknown>, headers: r.headers };
}

const datos = (idExterno: string, cambios: Record<string, unknown> = {}) => ({
  version: "1",
  idExterno,
  vacanteExterna: "VAC-BOT-1",
  candidato: { nombres: "Valeria", apellidos: "Prueba Ficticia", correo: "valeria.prueba@demo.test", telefono: "300 555 0101" },
  ...cambios,
});

beforeEach(async () => {
  await reiniciarBd();
  await prisma.$executeRawUnsafe(`TRUNCATE "Fuente", "EventoAuditoria" CASCADE`);
  await asegurarFuenteSistema();
  reiniciarCupos();
  await crearFuente("linkedin-bot", "Fuente de pruebas", ADMIN);
  const g = await generarToken("linkedin-bot", ADMIN);
  token = g.ok && g.token ? g.token : "";
  await prisma.correspondencia.create({ data: { fuente: "linkedin-bot", vacanteExterna: "VAC-BOT-1", externalJobId: "linkedin-bot:VAC-BOT-1", procesoAtsId: 9001, descripcion: "VAC-BOT-1 → 9001" } });
});

afterEach(() => usarConectorDePrueba(null));

describe("fuentes y tokens", () => {
  it("el token se muestra una vez y se guarda solo su SHA-256 con un prefijo visible", async () => {
    const f = await prisma.fuente.findUniqueOrThrow({ where: { nombre: "linkedin-bot" } });
    expect(token).toMatch(/^pf_[0-9a-f]{10}\./);
    expect(f.tokenHash).toBe(sha(new TextEncoder().encode(token)));
    expect(f.tokenPrefijo).toBe(token.slice(3, 13));
    expect(JSON.stringify(f)).not.toContain(token.split(".")[1]);
  });

  it("GET /api/entradas/v1/vacantes devuelve las vacantes vinculadas a la fuente del token y marca el último uso", async () => {
    const r = await vacantes(new Request("http://puente.test/api/entradas/v1/vacantes", { headers: { authorization: `Bearer ${token}` } }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ fuente: "linkedin-bot", vacantes: [{ vacanteExterna: "VAC-BOT-1", idProceso: "9001", descripcion: "VAC-BOT-1 → 9001" }] });
    expect((await prisma.fuente.findUniqueOrThrow({ where: { nombre: "linkedin-bot" } })).ultimoUsoEn).not.toBeNull();
  });
});

describe("G-1 · postulación válida → 202 RECIBIDA y llega a Talentia", () => {
  it("con token y CV: 202, se procesa y queda en Postulantes del proceso 9001 con el mismo SHA-256", async () => {
    const r = await enviar(datos("bot-1"));
    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ estado: "RECIBIDA", idRecepcion: expect.any(String) });
    await drenar();
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec).toMatchObject({ fuente: "linkedin-bot", idExterno: "bot-1", estado: "COMPLETADO", procesoAtsId: 9001, telefono: "+573005550101" });
    expect(talentia.postulaciones[0]).toMatchObject({ procesoId: 9001, fuente: "Bot experimental (LinkedIn)" });
    expect(talentia.documentos[0].sha256).toBe(sha(leerCv()));
  });
});

describe("G-2 · repetirla → 200 DUPLICADA y no crea nada", () => {
  it("la misma (fuente, idExterno) dos veces", async () => {
    await enviar(datos("bot-2"));
    await drenar();
    const r = await enviar(datos("bot-2"));
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe("DUPLICADA");
    await drenar();
    expect(await prisma.recepcion.count()).toBe(1);
    expect(talentia.conteo()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });
});

describe("G-3 · sin correo o sin CV → 202 REQUIERE_REVISION y no llega al ATS hasta aprobarla", () => {
  it("sin correo: espera; completar el correo y aprobar la envía", async () => {
    const r = await enviar(datos("bot-3", { candidato: { nombres: "Valeria" } }));
    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ estado: "REQUIERE_REVISION", motivos: ["sin_correo"] });
    await drenar();
    expect(talentia.conteo().postulaciones).toBe(0);
    const id = r.body.idRecepcion as string;
    expect((await aprobarRevision(id, ADMIN)).ok).toBe(false); // falta el correo
    expect((await completarRevision(id, { correo: " Valeria.Completa@Demo.Test " }, ADMIN)).ok).toBe(true);
    expect((await aprobarRevision(id, ADMIN)).ok).toBe(true);
    await drenar();
    expect(await prisma.recepcion.findUniqueOrThrow({ where: { id } })).toMatchObject({ estado: "COMPLETADO", correo: "valeria.completa@demo.test" });
    expect(talentia.conteo().postulaciones).toBe(1);
  });

  it("sin CV: espera; adjuntar el CV y aprobar la envía", async () => {
    const r = await enviar(datos("bot-4"), { cv: null });
    expect(r.body).toMatchObject({ estado: "REQUIERE_REVISION", motivos: ["sin_cv"] });
    await drenar();
    expect(talentia.conteo().postulaciones).toBe(0);
    const id = r.body.idRecepcion as string;
    expect((await completarRevision(id, { cv: { bytes: leerCv(), nombre: "cv.pdf" } }, ADMIN)).ok).toBe(true);
    expect((await aprobarRevision(id, ADMIN)).ok).toBe(true);
    await drenar();
    expect((await prisma.recepcion.findUniqueOrThrow({ where: { id } })).estado).toBe("COMPLETADO");
    expect(talentia.documentos[0].sha256).toBe(sha(leerCv()));
  });

  it("datos extraídos sin confirmar también van a revisión", async () => {
    const r = await enviar(datos("bot-5", { origenDatos: "extraido-del-cv" }));
    expect(r.body).toMatchObject({ estado: "REQUIERE_REVISION", motivos: ["datos_sin_confirmar"] });
  });

  it("descartar no envía nada y borra el CV", async () => {
    const r = await enviar(datos("bot-6", { candidato: { nombres: "Valeria" } }));
    expect((await descartarRevision(r.body.idRecepcion as string, ADMIN)).ok).toBe(true);
    await drenar();
    expect(await prisma.recepcion.findFirstOrThrow()).toMatchObject({ estado: "RECHAZADO", errorCodigo: "DESCARTADA", cvContenido: null });
    expect(talentia.conteo().postulaciones).toBe(0);
  });
});

describe("G-4 · errores de la entrada", () => {
  it("token inválido o revocado → 401", async () => {
    expect((await enviar(datos("x"), { token: "pf_0000000000.no-es-un-token-valido-0000" })).status).toBe(401);
    expect((await enviar(datos("x"), { token: "" })).status).toBe(401);
    await revocarFuente("linkedin-bot", ADMIN);
    expect((await enviar(datos("x"))).status).toBe(401);
  });

  it("vacante sin correspondencia → 422", async () => {
    const r = await enviar(datos("bot-7", { vacanteExterna: "NO-EXISTE" }));
    expect(r.status).toBe(422);
    expect(r.body.estado).toBe("VACANTE_SIN_CORRESPONDENCIA");
  });

  it("archivo que no es PDF → 415; más de 5 MB → 413; cuerpo inválido → 400", async () => {
    expect((await enviar(datos("bot-8"), { cv: new TextEncoder().encode("esto no es un PDF") })).status).toBe(415);
    const grande = new Uint8Array(5 * 1024 * 1024 + 1);
    grande.set(new TextEncoder().encode("%PDF-1.4"));
    expect((await enviar(datos("bot-9"), { cv: grande })).status).toBe(413);
    const invalida = await enviar({ ...datos("bot-10"), fuente: "otra" });
    expect(invalida.status).toBe(400);
    expect(await prisma.recepcion.count()).toBe(0);
  });

  it("más de 60 peticiones por minuto con el mismo token → 429 con Retry-After", async () => {
    const pedir = () => vacantes(new Request("http://puente.test/api/entradas/v1/vacantes", { headers: { authorization: `Bearer ${token}` } }));
    for (let i = 0; i < 60; i++) expect((await pedir()).status).toBe(200);
    const r = await pedir();
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("G-5 · el mismo correo por dos fuentes en la misma vacante → posible duplicado", () => {
  it("llega por Apply Connect y luego por el bot al mismo proceso: la segunda queda en revisión y no se fusiona", async () => {
    await postularPorVinculo(); // camila.ejemplo@demo.test → RT-2026-101 → 9001
    await drenar();
    const r = await enviar(datos("bot-11", { candidato: { nombres: "Camila", correo: "CAMILA.EJEMPLO@demo.test" } }));
    expect(r.body).toMatchObject({ estado: "REQUIERE_REVISION", motivos: ["posible_duplicado"] });
    await drenar();
    expect(talentia.conteo().postulaciones).toBe(1);
    expect(await prisma.recepcion.count()).toBe(2);
  });
});

describe("G-6 · cinco fallos temporales seguidos → FALLIDA_DEFINITIVA; «reintentar» la recupera", () => {
  it("con el máximo por defecto (5)", async () => {
    // Fallo temporal sin ambigüedad (búsqueda del postulante): un 5xx al CREAR la postulación sería «requiere verificación».
    await configurarFallo("candidatos", "NO_DISPONIBLE", -1);
    const r = await enviar(datos("bot-12"));
    for (let i = 0; i < 8; i++) {
      await new Promise((ok) => setTimeout(ok, 5));
      await procesarPendientes(opcionesRapidas);
    }
    const rec = await prisma.recepcion.findUniqueOrThrow({ where: { id: r.body.idRecepcion as string }, include: { trabajo: true } });
    expect(rec.trabajo!.intentos).toBe(5);
    expect(estadoV4(rec.estado, rec.trabajo!.estado)).toBe("FALLIDA_DEFINITIVA");
    await prisma.falloSimulado.deleteMany({});
    expect((await reintentar(rec.id, ADMIN)).ok).toBe(true);
    await drenar();
    expect((await prisma.recepcion.findUniqueOrThrow({ where: { id: rec.id } })).estado).toBe("COMPLETADO");
  });
});

describe("G-7 · la retención borra el binario y conserva el hash (reloj simulado)", () => {
  it("un CV que el Puente conserva se borra RETENCION_CV_DIAS después de completar", async () => {
    const real = conectorATS({ fetchImpl: fetchEnProceso });
    usarConectorDePrueba({ ...real, capacidades: { ...real.capacidades, adjuntarCV: false } }); // el ATS no lo admite: el Puente lo guarda
    await enviar(datos("bot-13"));
    await drenar();
    const antes = await prisma.recepcion.findFirstOrThrow();
    expect(antes.cvContenido).not.toBeNull();
    expect(await aplicarRetencion(new Date())).toBe(0);
    expect(await aplicarRetencion(new Date(Date.now() + 31 * 86_400_000))).toBe(1);
    const despues = await prisma.recepcion.findFirstOrThrow({ include: { eventos: true } });
    expect(despues.cvContenido).toBeNull();
    expect(despues.cvSha256).toBe(antes.cvSha256);
    expect(despues.cvBorradoEn).not.toBeNull();
    expect(despues.eventos.some((e) => e.tipo === "RETENCION")).toBe(true);
  });

  it("«borrar datos del candidato» elimina los datos personales y el CV y deja un evento", async () => {
    const r = await enviar(datos("bot-14", { candidato: { nombres: "Valeria" } }));
    expect((await borrarDatosCandidato(r.body.idRecepcion as string, ADMIN)).ok).toBe(true);
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec).toMatchObject({ nombre: "[datos borrados]", correo: null, telefono: null, cvContenido: null, estado: "RECHAZADO" });
    expect(rec.cvSha256).not.toBeNull();
    expect(await prisma.eventoAuditoria.count({ where: { accion: "candidato.datos_borrados", actorId: ADMIN.id } })).toBe(1);
  });
});

describe("G-8 · cada acción manual deja un evento con actor", () => {
  it("crear fuente, generar token, completar, aprobar, reintentar, descartar y borrar quedan auditados", async () => {
    const a = await enviar(datos("bot-15", { candidato: { nombres: "Valeria" } }));
    await completarRevision(a.body.idRecepcion as string, { correo: "valeria.audit@demo.test" }, ADMIN);
    await aprobarRevision(a.body.idRecepcion as string, ADMIN);
    const b = await enviar(datos("bot-16", { candidato: { nombres: "Valeria" } }));
    await descartarRevision(b.body.idRecepcion as string, ADMIN);
    await borrarDatosCandidato(b.body.idRecepcion as string, ADMIN);
    const acciones = (await prisma.eventoAuditoria.findMany({ where: { actorTipo: "usuario", actorId: ADMIN.id } })).map((e) => e.accion);
    expect(acciones).toEqual(
      expect.arrayContaining(["fuente.creada", "fuente.token_generado", "revision.completada", "revision.aprobada", "revision.descartada", "candidato.datos_borrados"]),
    );
    // Las llegadas quedan con la fuente como actor y los cambios de estado del procesador con el sistema.
    expect(await prisma.eventoAuditoria.count({ where: { actorTipo: "fuente", actorId: "linkedin-bot" } })).toBeGreaterThanOrEqual(2);
    await drenar();
    expect(await prisma.eventoAuditoria.count({ where: { actorTipo: "sistema", accion: "recepcion.completada" } })).toBe(1);
    // Sin datos personales en la auditoría.
    const todo = JSON.stringify(await prisma.eventoAuditoria.findMany());
    expect(todo).not.toContain("valeria");
    expect(todo).not.toContain("Valeria");
  });
});

describe("G-9 · los logs de una corrida no contienen el correo ni el nombre de prueba", () => {
  it("registro completo por la entrada genérica hasta Talentia", async () => {
    const lineas: string[] = [];
    const capturar = (...a: unknown[]) => void lineas.push(a.map(String).join(" "));
    const espias = [vi.spyOn(console, "log").mockImplementation(capturar), vi.spyOn(console, "error").mockImplementation(capturar), vi.spyOn(console, "warn").mockImplementation(capturar)];
    try {
      await enviar(datos("bot-17", { candidato: { nombres: "Ximena", apellidos: "Secreta Ficticia", correo: "ximena.secreta@demo.test" } }));
      await drenar();
    } finally {
      espias.forEach((s) => s.mockRestore());
    }
    expect(lineas.length).toBeGreaterThan(0);
    expect(lineas.some((l) => l.includes("idRecepcion="))).toBe(true);
    const salida = lineas.join("\n");
    expect(salida).not.toContain("ximena.secreta@demo.test");
    expect(salida).not.toContain("Ximena");
    expect(salida).not.toContain("Secreta");
  });
});

describe("métricas por fuente", () => {
  it("cuenta recibidas, completadas, en revisión y duplicadas por fuente", async () => {
    await enviar(datos("bot-18"));
    await enviar(datos("bot-18"));
    await enviar(datos("bot-19", { candidato: { nombres: "Valeria" } }));
    await drenar();
    const m = await calcularMetricas();
    expect(m.porFuente.find((f) => f.fuente === "linkedin-bot")).toMatchObject({ recibidas: 2, completadas: 1, enRevision: 1, duplicadas: 1, fallidas: 0 });
  });
});
