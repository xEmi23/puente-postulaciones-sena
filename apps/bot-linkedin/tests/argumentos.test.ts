import { describe, expect, it } from "vitest";
import { leerArgumentos } from "../src/argumentos";

// Auditoría F4-V: en PowerShell, npm.ps1 quita el `--` y npm se queda `--seco` y `--vacante` (npm_config_*).
// --seco NUNCA debe terminar enviando: se aceptan las dos formas.
describe("argumentos del bot (cmd, bash y PowerShell)", () => {
  it("forma directa: --seco, --vacante <id>, --vacante=<id> y login", () => {
    expect(leerArgumentos(["--seco", "--vacante", "VIN-DEMO-BOT"], {})).toEqual({ login: false, seco: true, vacante: "VIN-DEMO-BOT" });
    expect(leerArgumentos(["--vacante=VIN-1"], {}).vacante).toBe("VIN-1");
    expect(leerArgumentos(["login"], {})).toEqual({ login: true, seco: false });
    expect(leerArgumentos([], {})).toEqual({ login: false, seco: false });
  });

  it("como llega desde PowerShell: npm_config_seco=true y npm_config_vacante=true con el código suelto", () => {
    expect(leerArgumentos([], { npm_config_seco: "true" })).toEqual({ login: false, seco: true });
    expect(leerArgumentos(["VIN-DEMO-BOT"], { npm_config_vacante: "true" })).toEqual({ login: false, seco: false, vacante: "VIN-DEMO-BOT" });
    expect(leerArgumentos(["VIN-DEMO-BOT"], { npm_config_seco: "true", npm_config_vacante: "true" })).toEqual({ login: false, seco: true, vacante: "VIN-DEMO-BOT" });
    expect(leerArgumentos([], { npm_config_vacante: "VIN-2" }).vacante).toBe("VIN-2");
  });

  it("--vacante sin código se rechaza con un mensaje claro (no recorre todo por error)", () => {
    expect(() => leerArgumentos([], { npm_config_vacante: "true" })).toThrow(/Falta el código de la vacante/);
    expect(() => leerArgumentos(["--vacante"], {})).toThrow(/Falta el código de la vacante/);
    expect(() => leerArgumentos(["--vacante", "--seco"], {})).toThrow(/Falta el código de la vacante/);
  });
});
