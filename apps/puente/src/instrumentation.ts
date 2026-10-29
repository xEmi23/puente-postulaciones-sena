// Arranca el procesador dentro del proceso web cuando WORKER_EN_PROCESO=1 (Render gratuito no permite workers aparte).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.WORKER_EN_PROCESO !== "1") return;
  const { iniciarWorkerEnProceso } = await import("./worker/ciclo");
  iniciarWorkerEnProceso();
}
