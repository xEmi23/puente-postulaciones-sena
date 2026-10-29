import { procesarPendientes } from "@/modules/procesador";
import { procesarAvisos } from "@/modules/avisos";
import { sondearProcesosNuevos } from "@/modules/publicacion";

// Worker del puente con tres ciclos independientes; todo el estado vive en PostgreSQL y si el proceso muere,
// al volver retoma lo pendiente:
//  1. Procesador: trabajos persistentes (CV → postulante → documento → postulación).
//  2. Avisos RESUME_DOWNLOADED a Vínculo.
//  3. Publicación automática de procesos nuevos (si está activada; cada 2 minutos).
// Corre dentro del proceso web (instrumentation.ts, como en Render) o aparte (npm run worker).

export interface Worker {
  detener: () => Promise<void>;
}

export function iniciarWorker(): Worker {
  const intervalo = Number(process.env.WORKER_INTERVALO_MS ?? 1000);
  const opciones = {
    maxIntentos: Number(process.env.PUENTE_MAX_INTENTOS ?? 10),
    baseBackoffMs: Number(process.env.PUENTE_BACKOFF_BASE_MS ?? 2000),
    leaseSegundos: Number(process.env.PUENTE_LEASE_S ?? 120),
  };
  let activo = true;
  const ciclo = (nombre: string, tarea: () => Promise<number>, espera: number) =>
    (async () => {
      while (activo) {
        let hechos = 0;
        try {
          hechos = await tarea();
        } catch (e) {
          console.error(`[puente:${nombre}]`, e instanceof Error ? e.message : e);
        }
        if (hechos > 0) console.log(`[puente:${nombre}] ${hechos} elemento(s) procesado(s)`);
        else await new Promise((ok) => setTimeout(ok, espera));
      }
    })();
  const ciclos = [
    ciclo("procesador", () => procesarPendientes(opciones), intervalo),
    ciclo("avisos", () => procesarAvisos({ baseBackoffMs: Number(process.env.PUENTE_AVISO_BACKOFF_MS ?? 5000) }), intervalo),
    ciclo("publicacion", () => sondearProcesosNuevos(), 15_000),
  ];
  console.log(`[puente:worker] iniciado (pid ${process.pid}); intervalo ${intervalo} ms`);
  return {
    detener: async () => {
      activo = false;
      await Promise.all(ciclos);
    },
  };
}

/** Dentro del proceso web: el ciclo en curso termina antes de que el proceso salga (apagado ordenado). */
export function iniciarWorkerEnProceso() {
  const worker = iniciarWorker();
  process.once("SIGTERM", () => void worker.detener());
}
