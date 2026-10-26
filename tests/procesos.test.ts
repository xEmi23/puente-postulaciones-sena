import { beforeEach, describe, expect, it } from "vitest";
import { crearProceso, crearPostulacion } from "@/modules/ats/servicio";
import { etiquetaEstadoProceso, textoVigencia, vigenciaDias } from "@/modules/ats/procesos";
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

  it("los procesos sembrados tienen prioridad, fecha de inicio y estado Iniciado", async () => {
    const procesos = await prisma.proceso.findMany({ orderBy: { id: "asc" } });
    expect(procesos.map((p) => [p.id, p.prioridad, p.estado, vigenciaDias(p.fechaInicio)])).toEqual([
      [9001, "Alta", "INICIADO", 10],
      [9002, "Media", "INICIADO", 3],
    ]);
  });

  it("«Nuevo proceso» guarda prioridad y fecha de inicio, y valida la prioridad", async () => {
    const r = await crearProceso({ nombre: "Proceso de prueba", area: "Datos", ciudad: "Medellín", prioridad: "Baja", fechaInicio: "2026-10-20" });
    expect(r.ok).toBe(true);
    const p = await prisma.proceso.findUniqueOrThrow({ where: { id: 9003 } });
    expect(p.prioridad).toBe("Baja");
    expect(p.estado).toBe("INICIADO");
    expect(p.fechaInicio.toISOString().slice(0, 10)).toBe("2026-10-20");
    const mal = await crearProceso({ nombre: "Proceso de prueba", area: "Datos", ciudad: "Medellín", prioridad: "Urgente" });
    expect(mal.ok).toBe(false);
  });

  it("un proceso que no está Iniciado no recibe postulaciones (PROCESO_CERRADO)", async () => {
    await prisma.proceso.update({ where: { id: 9001 }, data: { estado: "CERRADO" } });
    const cand = await prisma.candidato.create({ data: { nombre: "Ana", apellido: "Prueba", correo: "ana@demo.test" } });
    const r = await crearPostulacion(JSON.stringify({ procesoId: 9001, candidatoId: cand.id, fuente: "Portal simulado (tipo LinkedIn)", referenciaExterna: "x" }));
    expect(r.status).toBe(422);
    expect((r.body as { codigo: string }).codigo).toBe("PROCESO_CERRADO");
  });
});
