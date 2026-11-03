import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { GET as salud } from "@/app/api/salud/route";
import { estadoDestino, usarConectorDePrueba, conectorATS } from "@/salidas";
import { iniciarWorker } from "@/worker/ciclo";
import { registrarRecepcion } from "@/nucleo/recepcion/registrar";
import { drenar, fetchEnProceso, leerCv, postular, prisma, reiniciarBd, talentia } from "./utilidades";

// F1: el núcleo no conoce la fuente ni el ATS.

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

afterEach(() => {
  delete process.env.ATS_DESTINO;
  usarConectorDePrueba(null);
});

describe("F1-4 · ATS_DESTINO=buk: el procesador no arranca y /api/salud lo informa", () => {
  it("por defecto el destino es talentia (simulado) y /api/salud responde 200", async () => {
    expect(estadoDestino()).toMatchObject({ destino: "talentia", implementado: true, mensaje: "ATS Simulador BUK activo" });
    const r = salud();
    expect(r.status).toBe(200);
    expect((await r.json()).ats).toMatchObject({ destino: "talentia", implementado: true });
  });

  it("con buk: /api/salud dice «ATS buk no implementado» (503) y el worker arranca sin el procesador", async () => {
    process.env.ATS_DESTINO = "buk";
    const r = salud();
    expect(r.status).toBe(503);
    expect((await r.json()).ats.mensaje).toBe("ATS buk no implementado");
    const w = iniciarWorker();
    try {
      expect(w.ciclos).not.toContain("procesador");
      expect(w.ciclos).toEqual(["avisos", "publicacion", "retencion"]);
    } finally {
      await w.detener();
    }
    delete process.env.ATS_DESTINO;
    const w2 = iniciarWorker();
    expect(w2.ciclos).toContain("procesador");
    await w2.detener();
  });
});

describe("F1-6 · nadie fuera de src/salidas importa el adaptador de Talentia (además de la regla de lint)", () => {
  it("ningún archivo de src (salvo src/salidas) ni de scripts importa salidas/talentia", () => {
    const raiz = path.resolve(__dirname, "..");
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = path.join(dir, n);
        if (n === "generated" || n === "node_modules") continue;
        if (statSync(p).isDirectory()) recorrer(p);
        else if (/\.(ts|tsx)$/.test(n)) archivos.push(p);
      }
    };
    recorrer(path.join(raiz, "src"));
    recorrer(path.join(raiz, "scripts"));
    const infractores = archivos.filter((a) => !a.includes(`${path.sep}salidas${path.sep}`) && /from\s+["'][^"']*salidas\/(talentia|buk)/.test(readFileSync(a, "utf8")));
    expect(infractores).toEqual([]);
    // Y el cliente de la v2 ya no existe fuera de salidas/.
    expect(archivos.some((a) => a.endsWith(`${path.sep}ats-cliente.ts`))).toBe(false);
  });
});

describe("registrarRecepcion · única puerta de entrada al núcleo", () => {
  // V4 F2: las correspondencias son por fuente; estas fuentes de prueba tienen la suya (RT-2026-101 → 9001).
  beforeEach(async () => {
    await reiniciarBd();
    for (const fuente of ["importador", "otra-fuente"]) {
      await prisma.correspondencia.create({ data: { fuente, vacanteExterna: "RT-2026-101", externalJobId: `${fuente}:RT-2026-101`, procesoAtsId: 9001, descripcion: "prueba" } });
    }
  });

  const canonica = (fuente: string, idExterno: string) => ({
    version: "1",
    fuente,
    idExterno,
    vacanteExterna: "RT-2026-101",
    candidato: { nombres: "Prueba", apellidos: "Núcleo", correo: "nucleo@demo.test" },
  });
  const pdf = () => ({ tipo: "binario" as const, bytes: leerCv(), nombreArchivo: "cv.pdf" });
  const actor = { tipo: "fuente" as const, id: "prueba" };

  it("deduplicación dura UNIQUE(fuente, idExterno): la segunda llegada es DUPLICADA y no crea nada", async () => {
    const a = await registrarRecepcion(canonica("importador", "x-1"), pdf(), actor);
    const b = await registrarRecepcion(canonica("importador", "x-1"), pdf(), actor);
    expect(a.resultado).toBe("RECIBIDA");
    expect(b).toMatchObject({ resultado: "DUPLICADA" });
    expect(await prisma.recepcion.count()).toBe(1);
    expect((await prisma.recepcion.findFirstOrThrow()).duplicadosEvitados).toBe(1);
  });

  it("el mismo idExterno en otra fuente es otra postulación", async () => {
    await registrarRecepcion(canonica("importador", "x-1"), pdf(), actor);
    expect((await registrarRecepcion(canonica("otra-fuente", "x-1"), pdf(), actor)).resultado).toBe("RECIBIDA");
    expect(await prisma.recepcion.count()).toBe(2);
  });

  it("un CV en bytes queda verificado al recibir (PDF y SHA-256) y el procesador lo lleva al ATS sin descargar nada", async () => {
    const bytes = leerCv();
    const r = await registrarRecepcion({ ...canonica("importador", "x-2"), cv: { nombreArchivo: "cv.pdf", tipo: "application/pdf", sha256: sha(bytes), bytes: bytes.length } }, pdf(), actor);
    expect(r.resultado).toBe("RECIBIDA");
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec).toMatchObject({ fuente: "importador", paso: "cv_descargado", cvSha256: sha(bytes), jobApplicationId: "importador:x-2" });
    await drenar();
    expect(await prisma.recepcion.findFirstOrThrow()).toMatchObject({ estado: "COMPLETADO", procesoAtsId: 9001 });
    expect(talentia.documentos[0].sha256).toBe(sha(bytes));
  });

  it("rechaza un archivo que no es PDF, uno demasiado grande y un SHA-256 que no coincide", async () => {
    const noPdf = await registrarRecepcion(canonica("importador", "x-3"), { tipo: "binario", bytes: new TextEncoder().encode("hola"), nombreArchivo: "a.pdf" }, actor);
    expect(noPdf).toMatchObject({ resultado: "CV_INVALIDO", codigo: "NO_PDF" });
    const grande = new Uint8Array(Number(process.env.CV_MAX_BYTES) + 1);
    grande.set(new TextEncoder().encode("%PDF-1.4"));
    expect(await registrarRecepcion(canonica("importador", "x-4"), { tipo: "binario", bytes: grande, nombreArchivo: "a.pdf" }, actor)).toMatchObject({ codigo: "DEMASIADO_GRANDE" });
    const otro = await registrarRecepcion({ ...canonica("importador", "x-5"), cv: { nombreArchivo: "cv.pdf", tipo: "application/pdf", sha256: "0".repeat(64), bytes: 10 } }, pdf(), actor);
    expect(otro).toMatchObject({ codigo: "HASH_NO_COINCIDE" });
    expect(await prisma.recepcion.count()).toBe(0);
  });

  it("vacante sin proceso → SIN_CORRESPONDENCIA (el núcleo nunca adivina)", async () => {
    expect((await registrarRecepcion({ ...canonica("importador", "x-6"), vacanteExterna: "NO-EXISTE" }, pdf(), actor)).resultado).toBe("SIN_CORRESPONDENCIA");
  });
});

describe("capacidades del ATS · si no admite el CV, se omite documento_subido y se completa con advertencia", () => {
  beforeEach(reiniciarBd);

  it("completa sin subir el documento, deja la advertencia visible y conserva el CV en el Puente", async () => {
    const real = conectorATS({ fetchImpl: fetchEnProceso });
    usarConectorDePrueba({ ...real, capacidades: { ...real.capacidades, adjuntarCV: false } });
    await postular();
    await drenar();
    const rec = await prisma.recepcion.findFirstOrThrow({ include: { eventos: true } });
    expect(rec).toMatchObject({ estado: "COMPLETADO", advertencia: "CV no enviado: el ATS no lo admite por API", atsDocumentoId: null });
    expect(rec.cvContenido).not.toBeNull();
    expect(talentia.conteo()).toEqual({ candidatos: 1, documentos: 0, postulaciones: 1 });
    expect(rec.eventos.some((e) => e.detalle.startsWith("CV no enviado: el ATS no lo admite por API"))).toBe(true);
  });
});
