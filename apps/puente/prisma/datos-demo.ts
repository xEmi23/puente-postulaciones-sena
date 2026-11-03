import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import { CLAVE_DEMO, USUARIOS_DEMO } from "../src/modules/demo";

// Datos de demostración del puente (ESPECIFICACION §5): solo las cuentas. SIN conexiones configuradas: la demo las
// configura en vivo en /conexiones, o `npm run demo:conectar` las configura solo (pruebas y plan B).

/**
 * Borra lo marcado como demo y también las conexiones y publicaciones (apuntan a credenciales de Vínculo y Talentia
 * que su propio demo:reset borra), y vuelve a sembrar las cuentas.
 */
export async function sembrarDemo(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.recepcion.deleteMany({ where: { demo: true } }),
    prisma.entregaRechazada.deleteMany({ where: { demo: true } }),
    prisma.correspondencia.deleteMany({ where: { demo: true } }),
    prisma.publicacion.deleteMany({}),
    prisma.conexion.deleteMany({}),
    prisma.falloSimulado.deleteMany({}),
    prisma.user.deleteMany({ where: { demo: true } }),
  ]);
  // V4: la fuente del sistema de Apply Connect (sin token; usa la firma HMAC del webhook).
  await prisma.fuente.upsert({
    where: { nombre: "apply-connect" },
    create: { nombre: "apply-connect", descripcion: "Apply Connect (Simulador LinkedIn): webhook firmado con HMAC", sistema: true },
    update: { sistema: true, activa: true, descripcion: "Apply Connect (Simulador LinkedIn): webhook firmado con HMAC" },
  });
  await prisma.fuente.upsert({
    where: { nombre: "importador" },
    create: { nombre: "importador", descripcion: "Importador manual del panel (sin token: actúa la persona con sesión)", sistema: true },
    update: { sistema: true, activa: true },
  });
  await prisma.configuracion.upsert({ where: { id: 1 }, create: { id: 1 }, update: { publicacionAutomatica: false, ultimoSondeoEn: null, resultadoSondeo: null } });
  const hash = await hashPassword(CLAVE_DEMO);
  for (const u of USUARIOS_DEMO) {
    const id = randomUUID();
    await prisma.user.create({
      data: { id, name: u.nombre, email: u.correo, emailVerified: true, rol: u.rol, accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: hash } } },
    });
  }
}
