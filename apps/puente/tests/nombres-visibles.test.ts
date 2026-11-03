import { describe, expect, it } from "vitest";
import { etiquetaFuente } from "@/nucleo/fuentes";
import { prisma } from "@/lib/db";
import { asegurarFuenteSistema } from "@/entradas/generica/fuentes";

// D-74: la interfaz rotula las fuentes como simulador; el identificador interno no cambia.
describe("nombres visibles de las fuentes", () => {
  it("el bot, el importador y Apply Connect se muestran rotulados; el identificador queda igual", () => {
    expect(etiquetaFuente("vinculo-bot")).toBe("LinkedIn (bot, simulador)");
    expect(etiquetaFuente("importador")).toBe("Importador manual");
    expect(etiquetaFuente("apply-connect")).toBe("Simulador LinkedIn (Apply Connect)");
    expect(etiquetaFuente("otra-fuente")).toBe("Puente · fuente «otra-fuente»");
  });

  it("ninguna etiqueta usa los nombres anteriores ni presenta LinkedIn sin decir que es simulado", () => {
    for (const f of ["vinculo-bot", "importador", "apply-connect", "linkedin-bot"]) {
      const e = etiquetaFuente(f);
      expect(e).not.toMatch(/Vínculo|Talentia/);
      if (/LinkedIn/.test(e)) expect(e).toMatch(/[Ss]imulador|experimental/);
    }
  });
});

describe("descripción guardada de la fuente del sistema", () => {
  it("la migración la guardó con «Vínculo»: asegurarFuenteSistema la reescribe con el nombre visible actual", async () => {
    await asegurarFuenteSistema();
    await prisma.fuente.update({ where: { nombre: "apply-connect" }, data: { descripcion: "Apply Connect (Vínculo, simulado): webhook firmado con HMAC" } });
    await asegurarFuenteSistema();
    const f = await prisma.fuente.findUniqueOrThrow({ where: { nombre: "apply-connect" } });
    expect(f.descripcion).toBe("Apply Connect (Simulador LinkedIn): webhook firmado con HMAC");
    expect(f.sistema).toBe(true);
  });
});
