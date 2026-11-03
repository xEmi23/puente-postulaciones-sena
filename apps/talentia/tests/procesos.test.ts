import { beforeEach, describe, expect, it } from "vitest";
import { cambiarPostulacion, crearPostulacion, crearPostulante, crearProceso } from "@/modules/seleccion";
import { etiquetaEstadoProceso, textoVigencia, vigenciaDias } from "@/modules/procesos";
import { prisma, reiniciarBd } from "./utilidades";

beforeEach(reiniciarBd);

describe("atributos del proceso (como en el ATS de referencia)", () => {
  it("vigencia en días completos desde el inicio", () => {
    const inicio = new Date("2026-10-15T12:00:00Z");
    expect(vigenciaDias(inicio, new Date("2026-10-15T23:00:00Z"))).toBe(0);
    expect(vigenciaDias(inicio, new Date("2026-10-16T12:00:00Z"))).toBe(1);
    expect(vigenciaDias(inicio, new Date("2026-10-25T13:00:00Z"))).toBe(10);
    expect(vigenciaDias(inicio, new Date("2026-10-01T00:00:00Z"))).toBe(0); // inicio futuro
    expect(textoVigencia(1)).toBe("1 día");
    expect(textoVigencia(10)).toBe("10 días");
    expect(etiquetaEstadoProceso("INICIADO")).toBe("Iniciado");
  });

  it("los 6 procesos sembrados (9001–9006) tienen prioridad, fecha de inicio y estado Iniciado", async () => {
    const procesos = await prisma.proceso.findMany({ orderBy: { id: "asc" } });
    expect(procesos.map((p) => p.id)).toEqual([9001, 9002, 9003, 9004, 9005, 9006]);
    expect(procesos.slice(0, 2).map((p) => [p.prioridad, p.estado, vigenciaDias(p.fechaInicio)])).toEqual([
      ["Alta", "INICIADO", 10],
      ["Media", "INICIADO", 3],
    ]);
    expect(await prisma.postulante.count()).toBe(15);
  });

  it("«Nuevo proceso» guarda prioridad y fecha de inicio, y valida la prioridad", async () => {
    const r = await crearProceso({ titulo: "Proceso de prueba", area: "Datos", ciudad: "Medellín", prioridad: "Baja", fecha_inicio: "2026-10-20" });
    expect(r.ok && r.datos.id).toBe(9007);
    const p = await prisma.proceso.findUniqueOrThrow({ where: { id: 9007 } });
    expect(p.prioridad).toBe("Baja");
    expect(p.estado).toBe("INICIADO");
    expect(p.fechaInicio.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect((await crearProceso({ titulo: "Proceso de prueba", area: "Datos", ciudad: "Medellín", prioridad: "Urgente" })).ok).toBe(false);
  });

  it("un proceso que no está Iniciado no recibe postulaciones (PROCESO_CERRADO)", async () => {
    await prisma.proceso.update({ where: { id: 9001 }, data: { estado: "CERRADO" } });
    const p = await crearPostulante({ nombre: "Ana", apellido: "Prueba", correo: "ana@demo.test" });
    if (!p.ok) throw new Error("no se creó");
    const r = await crearPostulacion({ proceso_id: 9001, postulante_id: p.datos.id, fuente: "Simulador LinkedIn (Apply Connect)", referencia_externa: "x" }, "prueba");
    expect(r.ok).toBe(false);
    if (!r.ok) expect([r.status, r.codigo]).toEqual([422, "PROCESO_CERRADO"]);
  });
});

describe("mover tarjetas y descartar (con historial)", () => {
  it("mueve entre etapas del mismo proceso, rechaza etapas ajenas y registra cada movimiento", async () => {
    const p = await crearPostulante({ nombre: "Ana", apellido: "Prueba", correo: "ana@demo.test" });
    if (!p.ok) throw new Error("no se creó");
    const post = await crearPostulacion({ proceso_id: 9002, postulante_id: p.datos.id, fuente: "Simulador LinkedIn (Apply Connect)", referencia_externa: "ref-1" }, "API · tal_x");
    if (!post.ok) throw new Error("no se creó");
    expect(post.datos.etapa.nombre).toBe("Postulantes");

    const r = await cambiarPostulacion(post.datos.id, { etapa: "Entrevista técnica" }, "Julián Herrera");
    expect(r.ok && r.datos.etapa.nombre).toBe("Entrevista técnica");
    const ajena = await prisma.etapa.findFirstOrThrow({ where: { procesoId: 9001, orden: 2 } });
    const mala = await cambiarPostulacion(post.datos.id, { etapa_id: ajena.id }, "Julián Herrera");
    expect(!mala.ok && mala.codigo).toBe("ETAPA_INVALIDA");
    await cambiarPostulacion(post.datos.id, { descartada: true }, "Julián Herrera");
    await cambiarPostulacion(post.datos.id, { descartada: false }, "Julián Herrera");

    const h = await prisma.movimientoEtapa.findMany({ where: { postulacionId: post.datos.id }, orderBy: { creadoEn: "asc" } });
    expect(h.map((m) => [m.tipo, m.deEtapa, m.aEtapa, m.autor])).toEqual([
      ["CREADA", null, "Postulantes", "API · tal_x"],
      ["MOVIDA", "Postulantes", "Entrevista técnica", "Julián Herrera"],
      ["DESCARTADA", "Entrevista técnica", null, "Julián Herrera"],
      ["RESTAURADA", "Entrevista técnica", null, "Julián Herrera"],
    ]);
  });
});
