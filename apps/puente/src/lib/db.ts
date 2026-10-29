import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Esquema propio de este sistema. Ningún otro sistema lee ni escribe aquí. */
export const ESQUEMA = process.env.DB_SCHEMA || "puente";
if (!/^[a-z_][a-z0-9_]*$/.test(ESQUEMA)) throw new Error("DB_SCHEMA inválido");

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Crea un cliente Prisma con el adaptador pg en el esquema del sistema. La sesión se fija en UTC: el adaptador
 * envía las fechas sin zona horaria y, con la zona del servidor (p. ej. America/Bogota), se guardarían desplazadas.
 * El search_path permite que las consultas SQL crudas usen nombres de tabla sin esquema.
 */
export function crearClientePrisma(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, options: `-c TimeZone=UTC -c search_path=${ESQUEMA}` }, { schema: ESQUEMA }),
  });
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
