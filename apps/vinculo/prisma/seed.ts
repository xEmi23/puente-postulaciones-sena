import "dotenv/config";
import { crearClientePrisma } from "../src/lib/db";
import { sembrarDemo } from "./datos-demo";

async function main() {
  const prisma = crearClientePrisma(process.env.DATABASE_URL!);
  try {
    await sembrarDemo(prisma);
    console.log("Vínculo: datos de demostración sembrados.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
