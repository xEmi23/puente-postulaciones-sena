import "dotenv/config";
import { prisma } from "../src/lib/db";
import { crearApiKey } from "../src/modules/api/llaves";
import { USUARIOS_DEMO } from "../src/modules/demo";

// Parte de Talentia de `npm run demo:conectar`: la administradora demo crea una API Key con Lectura y Modificación de
// Selección para el puente. Imprime la llave UNA vez en la salida estándar (JSON) para el script que orquesta.

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: USUARIOS_DEMO[0].correo } });
  const r = await crearApiKey({ nombre: "Puente de postulaciones (demo:conectar)", lectura: true, modificacion: true }, admin?.id ?? null, true);
  if (!r.ok) throw new Error(r.error);
  process.stdout.write(JSON.stringify({ apiKey: r.llave }));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
