import { beforeEach, describe, expect, it } from "vitest";
import { verificarEntornoSeguro } from "../scripts/demo-reset";
import { sembrarDemo } from "../prisma/datos-demo";
import { crearProceso } from "@/modules/servicio";
import { prisma, reiniciarBd } from "./utilidades";

beforeEach(reiniciarBd);

describe("demo:reset de Talentia", () => {
  it("se niega con NODE_ENV=production o con una base que no es local", () => {
    expect(verificarEntornoSeguro({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@localhost:5435/tb2_dev" })).toMatch(/producción/);
    expect(verificarEntornoSeguro({ DATABASE_URL: "postgresql://u:p@db.empresa.com:5432/x" })).toMatch(/no es local/);
  });

  it("borra y re-siembra solo los datos marcados como demo", async () => {
    await prisma.candidato.create({ data: { nombre: "Real", apellido: "No demo", correo: "real@demo.test", demo: false } });
    await crearProceso({ nombre: "Proceso temporal", area: "Datos", ciudad: "Medellín" });
    await sembrarDemo(prisma);
    expect(await prisma.proceso.count()).toBe(2);
    expect(await prisma.candidato.findUnique({ where: { correo: "real@demo.test" } })).not.toBeNull();
  });

  it("crea procesos con id consecutivo y la etapa Postulantes primero", async () => {
    const r = await crearProceso({ nombre: "Desarrollador/a Frontend", area: "Ingeniería", ciudad: "Remoto" });
    expect(r).toEqual({ ok: true, id: 9003 });
    const etapas = await prisma.etapa.findMany({ where: { procesoId: 9003 }, orderBy: { orden: "asc" } });
    expect(etapas[0].nombre).toBe("Postulantes");
    expect(etapas.at(-1)!.nombre).toBe("Contratados");
    expect((await crearProceso({ nombre: "x", area: "", ciudad: "" })).ok).toBe(false);
  });
});
