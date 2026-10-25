// Genera .env a partir de .env.example con secretos aleatorios. No sobrescribe un .env existente.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env")) {
  console.log(".env ya existe; no se modifica.");
  process.exit(0);
}
const secreto = () => randomBytes(24).toString("hex");
const pgPassword = secreto();
let contenido = readFileSync(".env.example", "utf8");
contenido = contenido.replace(/talentbridge:CAMBIAR@/g, `talentbridge:${pgPassword}@`);
contenido = contenido.replace(/"CAMBIAR"/g, () => `"${secreto()}"`);
writeFileSync(".env", contenido);
console.log(".env creado con secretos aleatorios (no se versiona).");
