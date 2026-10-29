import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { destinoSeguro } from "@/lib/sesion-servidor";
import { CLAVE_DEMO, USUARIOS_DEMO } from "@/modules/demo";
import { prisma, reiniciarBd } from "./utilidades";

beforeEach(reiniciarBd);

describe("autenticación de Talentia (Better Auth)", () => {
  it("las cuentas de demostración inician sesión con su rol; la contraseña se guarda con hash", async () => {
    for (const u of USUARIOS_DEMO) {
      const r = await auth.api.signInEmail({ body: { email: u.correo, password: CLAVE_DEMO } });
      expect((r.user as { rol?: string }).rol).toBe(u.rol);
    }
    const cuenta = await prisma.account.findFirstOrThrow({ where: { providerId: "credential" } });
    expect(cuenta.password).not.toContain(CLAVE_DEMO);
  });

  it("rechaza una contraseña equivocada y no permite registrarse", async () => {
    await expect(auth.api.signInEmail({ body: { email: USUARIOS_DEMO[0].correo, password: "otra-clave" } })).rejects.toThrow();
    await expect(auth.api.signUpEmail({ body: { email: "nuevo@demo.test", password: "ClaveLarga123", name: "Nuevo" } })).rejects.toThrow();
  });

  it("la cookie de sesión es propia de Talentia (prefijo tal_)", async () => {
    const r = await auth.api.signInEmail({ body: { email: USUARIOS_DEMO[1].correo, password: CLAVE_DEMO }, asResponse: true });
    const cookie = r.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/(^|, )tal_sesion=/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toMatch(/(vin|pue)_/);
  });

  it("no permite redirecciones abiertas", () => {
    expect(destinoSeguro("/seleccion/procesos/9001")).toBe("/seleccion/procesos/9001");
    expect(destinoSeguro("https://malo.example")).toBe("/");
    expect(destinoSeguro("//malo.example")).toBe("/");
    expect(destinoSeguro("/\\malo.example")).toBe("/");
  });
});
