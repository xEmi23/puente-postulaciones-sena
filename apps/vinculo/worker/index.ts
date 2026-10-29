import "dotenv/config";
import { iniciarWorker } from "@/worker/ciclo";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";

// Worker de Vínculo como proceso aparte (npm run worker). En Render corre dentro del proceso web.

config(); // falla rápido si falta configuración
const worker = iniciarWorker();
const terminar = async (senal: string) => {
  console.log(`[vinculo:worker] ${senal} recibido; terminando el ciclo en curso…`);
  await worker.detener();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", () => void terminar("SIGINT"));
process.on("SIGTERM", () => void terminar("SIGTERM"));
