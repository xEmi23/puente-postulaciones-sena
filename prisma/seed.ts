import "dotenv/config";
import { crearClientePrisma } from "../src/lib/db";
import { sembrarDemo } from "./datos-demo";

async function main() {
  const prisma = crearClientePrisma(process.env.DATABASE_URL!);
  try {
    await sembrarDemo(prisma);
    console.log("Datos de demostración sembrados: procesos 9001 y 9002, 3 vacantes (2 vinculadas).");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
