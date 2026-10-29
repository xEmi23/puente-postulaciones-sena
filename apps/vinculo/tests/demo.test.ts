import { beforeEach, describe, expect, it } from "vitest";
import { verificarEntornoSeguro } from "../scripts/demo-reset";
import { sembrarDemo } from "../prisma/datos-demo";
import { crearVacante, siguienteCodigo } from "@/modules/vacantes";
import { prisma, reiniciarBd } from "./utilidades";

beforeEach(reiniciarBd);

describe("demo:reset", () => {
  const local = "postgresql://u:p@localhost:5435/tb2_dev";

  it("se niega con NODE_ENV=production o con una base que no es local", () => {
    expect(verificarEntornoSeguro({ NODE_ENV: "production", DATABASE_URL: local })).toMatch(/producción/);
    expect(verificarEntornoSeguro({ DATABASE_URL: "postgresql://u:p@db.empresa.com:5432/x" })).toMatch(/no es local/);
    expect(verificarEntornoSeguro({})).toMatch(/Falta DATABASE_URL/);
    expect(verificarEntornoSeguro({ DATABASE_URL: "no-es-url" })).toMatch(/no es una URL/);
    expect(verificarEntornoSeguro({ DATABASE_URL: local })).toBeNull();
    expect(verificarEntornoSeguro({ DATABASE_URL: "postgresql://u:p@127.0.0.1:5435/tb2_dev" })).toBeNull();
  });

  it("borra y re-siembra solo los datos marcados como demo", async () => {
    await prisma.vacante.create({
      data: { codigo: "REAL-V", titulo: "Vacante no demo", area: "x", ciudad: "x", modalidad: "Remoto", descripcion: "x", demo: false },
    });
    await crearVacante({ titulo: "Vacante demo temporal", area: "Ingeniería", ciudad: "Medellín", modalidad: "Remoto", descripcion: "d".repeat(80) });
    expect(await prisma.vacante.count()).toBe(5);

    await sembrarDemo(prisma);
    expect(await prisma.vacante.count()).toBe(4); // 3 sembradas + la no demo
    expect(await prisma.vacante.findUnique({ where: { codigo: "REAL-V" } })).not.toBeNull();
  });
});

describe("preparar vacantes", () => {
  it("crea vacantes con código consecutivo y valida los campos", async () => {
    expect(await siguienteCodigo(new Date("2026-10-25"))).toBe("RT-2026-104");
    const ok = await crearVacante({ titulo: "Desarrollador/a Frontend", area: "Ingeniería", ciudad: "Medellín", modalidad: "Híbrido", descripcion: "x".repeat(70) });
    expect(ok).toEqual({ ok: true, codigo: "RT-2026-104" });
    const mal = await crearVacante({ titulo: "X", area: "", ciudad: "M", modalidad: "Otra", descripcion: "corta" });
    expect(mal.ok).toBe(false);
    if (!mal.ok) expect(Object.keys(mal.errores).sort()).toEqual(["area", "ciudad", "descripcion", "modalidad", "titulo"]);
  });
});
