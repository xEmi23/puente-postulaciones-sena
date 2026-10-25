// Genera .env a partir de .env.example con secretos aleatorios. No sobrescribe un .env existente.
// Elige el primer puerto libre desde 5433 para el PostgreSQL local del proyecto.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";

if (existsSync(".env")) {
  console.log(".env ya existe; no se modifica.");
  process.exit(0);
}

const libre = (puerto) =>
  new Promise((ok) => {
    const s = createServer()
      .once("error", () => ok(false))
      .once("listening", () => s.close(() => ok(true)))
      .listen(puerto, "127.0.0.1");
  });

let puerto = 5433;
while (!(await libre(puerto)) && puerto < 5450) puerto++;

const secreto = () => randomBytes(24).toString("hex");
const pgPassword = secreto();
let contenido = readFileSync(".env.example", "utf8");
contenido = contenido.replace(/talentbridge:CAMBIAR@localhost:5433\//g, `talentbridge:${pgPassword}@localhost:${puerto}/`);
contenido = contenido.replace(/"CAMBIAR"/g, () => `"${secreto()}"`);
writeFileSync(".env", contenido);
console.log(`.env creado con secretos aleatorios (no se versiona). PostgreSQL local en el puerto ${puerto}.`);
