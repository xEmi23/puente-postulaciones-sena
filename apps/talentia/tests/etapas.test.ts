import { beforeEach, expect, it } from "vitest";
import { crearProceso } from "@/modules/seleccion";
import { prisma, reiniciarBd } from "./utilidades";

beforeEach(reiniciarBd);

// Orden y tipos observados en el ATS de la empresa (15/10/2026) + «Contratados» verificado en el centro de ayuda de BUK.
const ORDEN = ["Postulantes", "Por contactar", "Referidos", "Sagrilaft", "Prueba técnica", "Entrevista técnica", "Valoración psicológica", "Suspendido", "Contratados"];

it("los procesos sembrados y los nuevos tienen las etapas de la referencia, en orden y con su tipo", async () => {
  await crearProceso({ titulo: "Proceso de prueba", area: "Ingeniería", ciudad: "Medellín" });
  for (const id of [9001, 9002, 9006, 9007]) {
    const etapas = await prisma.etapa.findMany({ where: { procesoId: id }, orderBy: { orden: "asc" } });
    expect(etapas.map((e) => e.nombre)).toEqual(ORDEN);
    // Tipos según la tabla de docs/referencia-ats.md; entrada y etapa final sin tipo.
    expect(etapas.map((e) => e.tipo)).toEqual([null, "Filtro", "Validaciones", "Validaciones", "Filtro", "Entrevistas", "Entrevistas", "Filtro", null]);
  }
});

it("una postulación nueva entra en «Postulantes» sin descartar", async () => {
  const etapa = await prisma.etapa.findFirstOrThrow({ where: { procesoId: 9001, orden: 1 } });
  expect(etapa.nombre).toBe("Postulantes");
});
