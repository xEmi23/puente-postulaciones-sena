import { beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { ConectorATS } from "@/salidas/conector-ats";
import { ErrorConectorATS } from "@/salidas/conector-ats";
// Las pruebas de contrato son la excepción a la regla de lint: ejercitan cada adaptador concreto por su nombre.
// eslint-disable-next-line no-restricted-imports
import { crearConectorTalentia } from "@/salidas/talentia";
// eslint-disable-next-line no-restricted-imports
import { crearConectorBuk } from "@/salidas/buk";
import { fetchEnProceso, leerCv, reiniciarBd, talentia } from "./utilidades";

// F1-3: pruebas de contrato de ConectorATS (ESPECIFICACION_V4 §9). Se escriben UNA vez y se ejecutan contra cada
// adaptador implementado. Hoy: Talentia (simulado, contra el doble de contrato de su API v1). El día que haya una
// API de BUK de pruebas, se agrega a IMPLEMENTADOS sin escribir pruebas nuevas.

const IMPLEMENTADOS: [string, () => ConectorATS, string][] = [["talentia", () => crearConectorTalentia({ fetchImpl: fetchEnProceso }), "9001"]];

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

for (const [nombre, crear, procesoAbierto] of IMPLEMENTADOS) {
  describe(`ConectorATS · contrato · ${nombre}`, () => {
    let c: ConectorATS;
    beforeEach(async () => {
      await reiniciarBd();
      c = crear();
    });

    it("declara su nombre y sus capacidades", () => {
      expect(c.nombre).toBe(nombre);
      expect(c.capacidades).toEqual({ adjuntarCV: expect.any(Boolean), buscarPorCorreo: expect.any(Boolean), idempotencia: expect.any(Boolean) });
    });

    it("verificarConexion responde ok con un detalle legible", async () => {
      const r = await c.verificarConexion();
      expect(r.ok).toBe(true);
      expect(r.detalle.length).toBeGreaterThan(5);
    });

    it("listarProcesos devuelve procesos con id (texto), título y estado", async () => {
      const procesos = await c.listarProcesos();
      expect(procesos.length).toBeGreaterThan(0);
      const p = procesos.find((x) => x.id === procesoAbierto)!;
      expect(p).toMatchObject({ id: procesoAbierto, titulo: expect.any(String), estado: expect.any(String) });
    });

    it("crearPostulante crea; con el mismo correo devuelve la misma persona (existente) y buscarPostulante la encuentra", async () => {
      expect(await c.buscarPostulante({ correo: "contrato@demo.test" })).toBeNull();
      const a = await c.crearPostulante({ nombres: "Contrato", apellidos: "De Prueba", correo: "contrato@demo.test" }, "contrato:postulante");
      const b = await c.crearPostulante({ nombres: "Contrato", apellidos: "De Prueba", correo: "contrato@demo.test" }, "contrato-2:postulante");
      expect(b.id).toBe(a.id);
      expect(b.existente).toBe(true);
      if (c.capacidades.buscarPorCorreo) expect((await c.buscarPostulante({ correo: "contrato@demo.test" }))?.id).toBe(a.id);
    });

    it("adjuntarCV sube el PDF y el ATS conserva el mismo SHA-256 (si la capacidad existe)", async () => {
      const p = await c.crearPostulante({ nombres: "Contrato", correo: "cv@demo.test" }, "cv:postulante");
      const bytes = leerCv();
      if (!c.capacidades.adjuntarCV) return;
      await c.adjuntarCV(p.id, { nombreArchivo: "cv.pdf", tipo: "application/pdf", bytes, sha256: sha(bytes) }, "cv:documento");
      if (nombre === "talentia") expect(talentia.documentos.map((d) => d.sha256)).toContain(sha(bytes));
    });

    it("crearPostulacion deja a la persona en el proceso; consultarPostulacion la encuentra (reconciliación)", async () => {
      const p = await c.crearPostulante({ nombres: "Contrato", correo: "post@demo.test" }, "post:postulante");
      expect(await c.consultarPostulacion(p.id, procesoAbierto)).toBeNull();
      const post = await c.crearPostulacion(p.id, procesoAbierto, "post:postulacion", { referenciaExterna: "contrato-post" });
      expect(post).toMatchObject({ id: expect.any(String), idProceso: procesoAbierto, idPostulante: p.id });
      expect((await c.consultarPostulacion(p.id, procesoAbierto))?.id).toBe(post.id);
    });

    it("con idempotencia, repetir la misma clave no duplica la postulación", async () => {
      if (!c.capacidades.idempotencia) return;
      const p = await c.crearPostulante({ nombres: "Contrato", correo: "idem@demo.test" }, "idem:postulante");
      const a = await c.crearPostulacion(p.id, procesoAbierto, "idem:postulacion", { referenciaExterna: "contrato-idem" });
      const b = await c.crearPostulacion(p.id, procesoAbierto, "idem:postulacion", { referenciaExterna: "contrato-idem" });
      expect(b.id).toBe(a.id);
      if (nombre === "talentia") expect(talentia.conteo().postulaciones).toBe(1);
    });

    it("los fallos llegan como ErrorConectorATS clasificados (401 → autenticacion)", async () => {
      talentia.revocada = true;
      const e = await c.listarProcesos().catch((x) => x);
      expect(e).toBeInstanceOf(ErrorConectorATS);
      expect(e.tipo).toBe("autenticacion");
    });
  });
}

describe("ConectorATS · buk (esqueleto deshabilitado)", () => {
  const c = crearConectorBuk();

  it("todas las capacidades en false hasta verificarlas con la documentación oficial", () => {
    expect(c.nombre).toBe("buk");
    expect(c.capacidades).toEqual({ adjuntarCV: false, buscarPorCorreo: false, idempotencia: false });
  });

  it("verificarConexion responde «no configurado» sin llamar a nada", async () => {
    const r = await c.verificarConexion();
    expect(r.ok).toBe(false);
    expect(r.detalle).toMatch(/^no configurado/);
  });

  it("los demás métodos lanzan «no implementado: pendiente de la documentación oficial de /apidocs»", async () => {
    const llamadas = [
      () => c.listarProcesos(),
      () => c.buscarPostulante({ correo: "x@demo.test" }),
      () => c.crearPostulante({ nombres: "X" }, "k"),
      () => c.adjuntarCV("1", { nombreArchivo: "a.pdf", tipo: "application/pdf", bytes: new Uint8Array(), sha256: "0".repeat(64) }, "k"),
      () => c.crearPostulacion("1", "1", "k"),
      () => c.consultarPostulacion("1", "1"),
    ];
    for (const llamar of llamadas) {
      await expect(llamar()).rejects.toThrow("no implementado: pendiente de la documentación oficial de /apidocs");
    }
  });
});
