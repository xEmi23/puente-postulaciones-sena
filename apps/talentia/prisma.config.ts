import "dotenv/config";
import { defineConfig } from "prisma/config";

// Cada sistema tiene su propio esquema en la base (aquí: "talentia"). La tabla de migraciones de Prisma
// también queda dentro del esquema, así las tres apps comparten base sin mezclar su historial.
const esquema = process.env.DB_SCHEMA || "talentia";
const url = new URL(process.env.DATABASE_URL || "postgresql://localhost:5435/sin_configurar");
url.searchParams.set("schema", esquema);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: url.toString(),
  },
});
