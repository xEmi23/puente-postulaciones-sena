import "dotenv/config";
import { crearClientePrisma } from "../src/lib/db";
import { sembrarDemo } from "./datos-demo";

async function main() {
  const prisma = crearClientePrisma(process.env.DATABASE_URL!);
  try {
    // --si-vacio: solo siembra si aún no hay usuarios (arranque en Render: no borra lo que se hizo en la demo).
    if (process.argv.includes("--si-vacio") && (await prisma.user.count()) > 0) {
      console.log("Ya hay datos: no se vuelve a sembrar.");
      return;
    }
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
