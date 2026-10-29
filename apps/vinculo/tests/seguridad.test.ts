import { beforeEach, describe, expect, it } from "vitest";
import { cifrar, descifrar } from "@/lib/cifrado";
import { ipPrivada, motivoUrlNoPermitida } from "@/lib/red";
import { auth } from "@/lib/auth";
import { destinoSeguro } from "@/lib/sesion-servidor";
import { prisma } from "@/lib/db";
import { CLAVE_DEMO, CUENTAS_DEMO } from "@/modules/demo";
import { verificarEntornoSeguro } from "../scripts/demo-reset";
import { reiniciarBd } from "./utilidades";

beforeEach(reiniciarBd);

describe("cifrado de secretos (AES-256-GCM)", () => {
  it("descifra lo cifrado, usa IV aleatorio y detecta manipulación", () => {
    const a = cifrar("secreto");
    expect(descifrar(a)).toBe("secreto");
    expect(cifrar("secreto")).not.toBe(a);
    const partes = a.split(".");
    partes[3] = Buffer.from("otro texto").toString("base64url");
    expect(() => descifrar(partes.join("."))).toThrow();
  });
});

describe("SSRF: URL de webhook", () => {
  it("en un despliegue público exige https y rechaza destinos privados o internos", async () => {
    expect(await motivoUrlNoPermitida("http://puente.example.com/x", false)).toMatch(/https/);
    expect(await motivoUrlNoPermitida("https://localhost/x", false)).toMatch(/interna/);
    expect(await motivoUrlNoPermitida("https://169.254.169.254/latest", false)).toMatch(/privada/);
    expect(await motivoUrlNoPermitida("https://10.0.0.5/x", false)).toMatch(/privada/);
    expect(await motivoUrlNoPermitida("https://[::1]/x", false)).toMatch(/privada/);
    expect(await motivoUrlNoPermitida("https://usuario:clave@puente.example.com/", false)).toMatch(/usuario/);
    expect(await motivoUrlNoPermitida("ftp://x", true)).toMatch(/http/);
    expect(await motivoUrlNoPermitida("http://localhost:3003/api/webhooks/vinculo", true)).toBeNull();
    expect([ipPrivada("192.168.1.1"), ipPrivada("172.20.0.1"), ipPrivada("8.8.8.8"), ipPrivada("::ffff:127.0.0.1")]).toEqual([true, true, false, true]);
  });
});

describe("autenticación de Vínculo (Better Auth)", () => {
  it("las cuentas de demostración ingresan; la reclutadora pertenece a Andina; la cookie es vin_sesion", async () => {
    for (const c of CUENTAS_DEMO) {
      const r = await auth.api.signInEmail({ body: { email: c.correo, password: CLAVE_DEMO }, asResponse: true });
      expect(r.status).toBe(200);
      expect(r.headers.get("set-cookie") ?? "").toMatch(/(^|, )vin_sesion=/);
    }
    const rec = await prisma.user.findUniqueOrThrow({ where: { email: CUENTAS_DEMO[2].correo }, include: { empresa: true } });
    expect([rec.rol, rec.empresa?.nombre]).toEqual(["RECLUTADOR", "Andina Software S.A.S."]);
  });

  it("el registro crea una cuenta de candidato con su perfil público; contraseña equivocada → error", async () => {
    await auth.api.signUpEmail({ body: { name: "Persona Nueva Ficticia", email: "nueva@demo.test", password: "ClaveSegura123" } });
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "nueva@demo.test" }, include: { perfil: true } });
    expect(u.rol).toBe("CANDIDATO");
    expect(u.perfil?.slug).toBe("persona-nueva-ficticia");
    await expect(auth.api.signInEmail({ body: { email: "nueva@demo.test", password: "otra-clave-x" } })).rejects.toThrow();
  });

  it("no permite redirecciones abiertas", () => {
    expect(destinoSeguro("/mis-postulaciones")).toBe("/mis-postulaciones");
    expect(destinoSeguro("https://malo.example")).toBe("/");
    expect(destinoSeguro("//malo.example")).toBe("/");
  });
});

describe("datos de demostración", () => {
  it("6 empresas, 18 vacantes (6 de Andina), 40 candidatos con perfil y CV PDF; demo:reset solo en local", async () => {
    expect(await prisma.empresa.count()).toBe(6);
    expect(await prisma.vacante.count()).toBe(18);
    expect(await prisma.vacante.count({ where: { empresa: { slug: "andina-software" } } })).toBe(6);
    const candidatos = await prisma.user.findMany({ where: { rol: "CANDIDATO" }, include: { perfil: { include: { cv: { select: { contenido: true } } } } } });
    expect(candidatos).toHaveLength(40);
    expect(candidatos.every((c) => c.email.endsWith("@demo.test") && c.perfil?.cv && Buffer.from(c.perfil.cv.contenido).subarray(0, 5).toString() === "%PDF-")).toBe(true);
    expect(verificarEntornoSeguro({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@localhost/x" })).toMatch(/producción/);
    expect(verificarEntornoSeguro({ DATABASE_URL: "postgresql://u:p@db.ejemplo.com/x" })).toMatch(/no es local/);
  });
});
