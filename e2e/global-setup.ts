import { iniciarApp, iniciarWorker, matarTodo, prepararBase } from "./procesos";

export default async function globalSetup() {
  matarTodo();
  prepararBase();
  await iniciarApp();
  iniciarWorker();
}
