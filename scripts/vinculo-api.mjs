// `npm run vinculo:api -- on|off|estado`: prende o apaga la API tipo Apply Connect de Vínculo (D-68) en apps/vinculo/.env.
// Apagada (por defecto) Vínculo se comporta como el LinkedIn real para la empresa: sin portal de desarrolladores,
// OAuth y /api/v1 responden 404 y no salen webhooks. Prendida se muestra como «vía oficial futura» (demo:conectar).
// Vínculo lee la variable al arrancar: después de cambiarla, reinicia las apps (Ctrl+C y npm run dev).
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import { fijarApiVinculo } from "./demo-bot-lib.mjs";

const RAIZ = path.resolve(import.meta.dirname, "..");
const orden = (process.argv[2] ?? "estado").toLowerCase();
const actual = () => ["true", "1"].includes(String(parse(readFileSync(path.join(RAIZ, "apps", "vinculo", ".env"))).VINCULO_API_HABILITADA ?? "").toLowerCase());

if (orden === "estado") {
  console.log(`API de Vínculo en apps/vinculo/.env: ${actual() ? "PRENDIDA (vía oficial futura)" : "APAGADA (como el LinkedIn real para la empresa)"}`);
} else if (orden === "on" || orden === "off") {
  fijarApiVinculo(RAIZ, orden === "on");
  console.log(`✔ API de Vínculo ${orden === "on" ? "PRENDIDA" : "APAGADA"} en apps/vinculo/.env. Reinicia las apps (Ctrl+C y npm run dev) para que tome efecto.`);
  if (orden === "on") console.log("  Luego: npm run demo:conectar (conecta el Puente por la API y publica 9001 y 9002).");
} else {
  console.error("Uso: npm run vinculo:api -- on|off|estado");
  process.exit(2);
}
