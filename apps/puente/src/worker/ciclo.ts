import { procesarPendientes } from "@/modules/procesador";

// Procesador del puente: ejecuta los trabajos persistentes (CV → candidato → documento → postulación).
// Todo el estado vive en PostgreSQL; si el proceso muere, al volver retoma lo pendiente.
// Corre dentro del proceso web (instrumentation.ts, como en Render) o aparte (npm run worker).

export interface Worker {
  detener: () => Promise<void>;
}

export function iniciarWorker(): Worker {
  const intervalo = Number(process.env.WORKER_INTERVALO_MS ?? 1000);
  // Ajustables para demos y pruebas E2E; por defecto 8 intentos y backoff desde 2 s.
  const opciones = {
    maxIntentos: Number(process.env.PUENTE_MAX_INTENTOS ?? 8),
    baseBackoffMs: Number(process.env.PUENTE_BACKOFF_BASE_MS ?? 2000),
    leaseSegundos: Number(process.env.PUENTE_LEASE_S ?? 60),
  };
  let activo = true;
  const ciclo = (async () => {
    while (activo) {
      let hechos = 0;
      try {
        hechos = await procesarPendientes(opciones);
      } catch (e) {
        console.error("[puente:procesador]", e instanceof Error ? e.message : e);
      }
      if (hechos > 0) console.log(`[puente:procesador] ${hechos} trabajo(s) procesado(s)`);
      else await new Promise((ok) => setTimeout(ok, intervalo));
    }
  })();
  console.log(`[puente:procesador] iniciado (pid ${process.pid}); intervalo ${intervalo} ms`);
  return {
    detener: async () => {
      activo = false;
      await ciclo;
    },
  };
}

/** Dentro del proceso web: el ciclo en curso termina antes de que el proceso salga (apagado ordenado). */
export function iniciarWorkerEnProceso() {
  const worker = iniciarWorker();
  process.once("SIGTERM", () => void worker.detener());
}
