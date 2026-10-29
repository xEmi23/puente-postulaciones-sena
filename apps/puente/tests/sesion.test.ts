import { afterEach, describe, expect, it } from "vitest";
import { crearTokenSesion, credencialesValidas, destinoSeguro, estadoAuthDemo, tokenValido } from "@/lib/sesion";
import { modoPrueba } from "@/lib/config";
import { configurarFallo, conFalloSimulado } from "@/modules/fallos";
import { prisma, reiniciarBd } from "./utilidades";

const base = {
  DEMO_AUTH_ENABLED: "true",
  DEMO_ADMIN_USER: "demo",
  DEMO_ADMIN_PASSWORD: "clave-larga-de-prueba",
  SESSION_SECRET: "s".repeat(40),
  APP_BASE_URL: "http://localhost:3100",
};

const original = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(base)) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe("autenticación de demostración: imposible de dejar activa por accidente", () => {
  it("solo está disponible con la variable activa, credenciales completas y host local", () => {
    expect(estadoAuthDemo(base)).toEqual({ disponible: true });
    expect(estadoAuthDemo({ ...base, DEMO_AUTH_ENABLED: "false" })).toEqual({ disponible: false, motivo: "desactivada" });
    expect(estadoAuthDemo({ ...base, DEMO_ADMIN_PASSWORD: "corta" })).toEqual({ disponible: false, motivo: "incompleta" });
    expect(estadoAuthDemo({ ...base, SESSION_SECRET: "corto" })).toEqual({ disponible: false, motivo: "incompleta" });
    expect(estadoAuthDemo({ ...base, APP_BASE_URL: "https://talentos.empresa.com" })).toEqual({ disponible: false, motivo: "no_local" });
    expect(estadoAuthDemo({ ...base, APP_BASE_URL: "http://localhost.empresa.com" })).toEqual({ disponible: false, motivo: "no_local" });
  });

  it("emite y verifica tokens firmados; rechaza alterados, vencidos o con otro secreto", async () => {
    Object.assign(process.env, base);
    const token = await crearTokenSesion("demo");
    expect(await tokenValido(token)).toBe(true);
    expect(await tokenValido(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"))).toBe(false);
    expect(await tokenValido(token, Date.now() + 9 * 3600 * 1000)).toBe(false);
    expect(await tokenValido(await crearTokenSesion("otro-usuario"))).toBe(false);
    process.env.SESSION_SECRET = "x".repeat(40);
    expect(await tokenValido(token)).toBe(false);
  });

  it("un token válido deja de servir si la app pasa a un host no local", async () => {
    Object.assign(process.env, base);
    const token = await crearTokenSesion("demo");
    process.env.APP_BASE_URL = "https://talentos.empresa.com";
    expect(await tokenValido(token)).toBe(false);
  });

  it("valida credenciales", async () => {
    Object.assign(process.env, base);
    expect(await credencialesValidas("demo", "clave-larga-de-prueba")).toBe(true);
    expect(await credencialesValidas("demo", "otra")).toBe(false);
    expect(await credencialesValidas("admin", "clave-larga-de-prueba")).toBe(false);
  });

  it("no permite redirecciones abiertas", () => {
    expect(destinoSeguro("/operaciones/abc")).toBe("/operaciones/abc");
    expect(destinoSeguro("https://malo.example")).toBe("/");
    expect(destinoSeguro("//malo.example")).toBe("/");
    expect(destinoSeguro("/\\malo.example")).toBe("/");
  });
});

describe("fallos inyectables de los conectores", () => {
  it("son inertes fuera de un entorno local aunque la variable esté activa", async () => {
    await reiniciarBd();
    await configurarFallo("candidatos", "NO_DISPONIBLE", 1);
    process.env.APP_BASE_URL = "https://talentos.empresa.com";
    expect(modoPrueba()).toBe(false);
    const r = await conFalloSimulado("candidatos", null, async () => new Response("{}", { status: 201 }));
    expect(r.status).toBe(201);
    expect((await prisma.falloSimulado.findUniqueOrThrow({ where: { ruta: "candidatos" } })).restantes).toBe(1);
  });
});
