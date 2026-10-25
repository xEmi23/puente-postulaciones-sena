import { iniciarApp, iniciarSupervisor, iniciarWorker, prepararBase } from "./procesos";

export default async function globalSetup() {
  prepararBase();
  await iniciarSupervisor();
  await iniciarApp();
  await iniciarWorker();
}
