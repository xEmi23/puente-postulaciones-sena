import "dotenv/config";
import { despacharPendientes } from "@/modules/origen/despachador";
import { procesarPendientes } from "@/modules/puente/procesador";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";

// Worker único con dos responsabilidades independientes:
//  1. Despachador del origen: entrega la outbox al webhook del puente (simula a LinkedIn).
//  2. Procesador del puente: ejecuta los trabajos persistentes (CV → candidato → documento → postulación).
// Todo el estado vive en PostgreSQL; si el proceso muere, al volver retoma lo pendiente.

const INTERVALO_MS = Number(process.env.WORKER_INTERVALO_MS ?? 1000);
// Ajustables para demos y pruebas E2E; por defecto 8 intentos y backoff desde 2 s.
const opcionesPuente = {
  maxIntentos: Number(process.env.PUENTE_MAX_INTENTOS ?? 8),
  baseBackoffMs: Number(process.env.PUENTE_BACKOFF_BASE_MS ?? 2000),
  leaseSegundos: Number(process.env.PUENTE_LEASE_S ?? 60),
};
let detener = false;

async function ciclo(nombre: string, tarea: () => Promise<number>) {
  while (!detener) {
    let hechos = 0;
    try {
      hechos = await tarea();
    } catch (e) {
      console.error(`[worker:${nombre}]`, e instanceof Error ? e.message : e);
    }
    if (hechos > 0) console.log(`[worker:${nombre}] ${hechos} elemento(s) procesado(s)`);
    else await new Promise((ok) => setTimeout(ok, INTERVALO_MS));
  }
}

async function main() {
  config(); // falla rápido si falta configuración
  console.log(`[worker] iniciado (pid ${process.pid}); intervalo ${INTERVALO_MS} ms`);
  const terminar = (senal: string) => {
    console.log(`[worker] ${senal} recibido; terminando el ciclo en curso…`);
    detener = true;
  };
  process.on("SIGINT", () => terminar("SIGINT"));
  process.on("SIGTERM", () => terminar("SIGTERM"));

  await Promise.all([ciclo("origen", () => despacharPendientes()), ciclo("puente", () => procesarPendientes(opcionesPuente))]);
  await prisma.$disconnect();
  console.log("[worker] detenido");
}

main().catch((e) => {
  console.error("[worker] error fatal", e);
  process.exit(1);
});
