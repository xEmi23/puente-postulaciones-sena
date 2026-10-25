import { execSync } from "node:child_process";
import { prepararEntornoPruebas } from "./entorno-pruebas";

export default function () {
  prepararEntornoPruebas();
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: process.env });
}
