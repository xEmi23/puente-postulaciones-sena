import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Crea un cliente Prisma con el adaptador pg. La sesión se fija en UTC: el adaptador envía las fechas
 * sin zona horaria y, con la zona del servidor (p. ej. America/Bogota), se guardarían desplazadas.
 */
export function crearClientePrisma(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, options: "-c TimeZone=UTC" }) });
}

function clientePorDefecto() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL");
  return crearClientePrisma(connectionString);
}

export const prisma: PrismaClient = globalParaPrisma.prisma ?? clientePorDefecto();
if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = prisma;

/** Código de error de Prisma por violación de restricción única. */
export function esViolacionUnica(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";
}
