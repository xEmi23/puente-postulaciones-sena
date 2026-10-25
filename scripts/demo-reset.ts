import "dotenv/config";
import { crearClientePrisma } from "../src/lib/db";
import { sembrarDemo } from "../prisma/datos-demo";

// Restablece la demostración: borra y re-siembra SOLO los datos marcados demo = true.
// Se niega a correr en producción o contra una base que no sea local.

export function verificarEntornoSeguro(env: { NODE_ENV?: string; DATABASE_URL?: string }): string | null {
  if (env.NODE_ENV === "production") return "NODE_ENV=production: demo:reset no se ejecuta en producción.";
  const url = env.DATABASE_URL;
  if (!url) return "Falta DATABASE_URL.";
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return "DATABASE_URL no es una URL válida.";
  }
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    return `La base de datos no es local (${host}); demo:reset se niega a ejecutarse.`;
  }
  return null;
}

async function main() {
  const motivo = verificarEntornoSeguro(process.env);
  if (motivo) {
    console.error(`✖ ${motivo}`);
    process.exit(2);
  }
  const prisma = crearClientePrisma(process.env.DATABASE_URL!);
  try {
    await sembrarDemo(prisma);
    console.log("✔ Demostración restablecida (solo datos marcados como demo).");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("demo-reset")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
