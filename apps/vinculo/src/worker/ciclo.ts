import { despacharPendientes } from "@/modules/despachador";

// Despachador de Vínculo: entrega la outbox al webhook del integrador (como LinkedIn con Apply Connect).
// Todo el estado vive en PostgreSQL; si el proceso muere, al volver retoma lo pendiente.
// Corre dentro del proceso web (instrumentation.ts, como en Render) o aparte (npm run worker).

export interface Worker {
  detener: () => Promise<void>;
}

export function iniciarWorker(): Worker {
  const intervalo = Number(process.env.WORKER_INTERVALO_MS ?? 1000);
  let activo = true;
  const ciclo = (async () => {
    while (activo) {
      let hechos = 0;
      try {
        hechos = await despacharPendientes();
      } catch (e) {
        console.error("[vinculo:despachador]", e instanceof Error ? e.message : e);
      }
      if (hechos > 0) console.log(`[vinculo:despachador] ${hechos} entrega(s) intentada(s)`);
      else await new Promise((ok) => setTimeout(ok, intervalo));
    }
  })();
  console.log(`[vinculo:despachador] iniciado (pid ${process.pid}); intervalo ${intervalo} ms`);
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
