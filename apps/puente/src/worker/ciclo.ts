import { procesarPendientes } from "@/modules/procesador";
import { procesarAvisos } from "@/modules/avisos";
import { sondearProcesosNuevos } from "@/modules/publicacion";
import { estadoDestino } from "@/salidas";
import { aplicarRetencion } from "@/modules/retencion";

// Worker del puente con tres ciclos independientes; todo el estado vive en PostgreSQL y si el proceso muere,
// al volver retoma lo pendiente:
//  1. Procesador: trabajos persistentes (CV → postulante → documento → postulación).
//  2. Avisos RESUME_DOWNLOADED a Vínculo.
//  3. Publicación automática de procesos nuevos (si está activada; cada 2 minutos).
// Corre dentro del proceso web (instrumentation.ts, como en Render) o aparte (npm run worker).

export interface Worker {
  detener: () => Promise<void>;
  /** Ciclos que arrancaron (sin «procesador» si el ATS de destino no está implementado). */
  ciclos: string[];
}

export function iniciarWorker(): Worker {
  const intervalo = Number(process.env.WORKER_INTERVALO_MS ?? 1000);
  const opciones = {
    maxIntentos: Number(process.env.PUENTE_MAX_INTENTOS ?? 5),
    baseBackoffMs: Number(process.env.PUENTE_BACKOFF_BASE_MS ?? 2000),
    leaseSegundos: Number(process.env.PUENTE_LEASE_S ?? 120),
  };
  let activo = true;
  // Las esperas entre vueltas se pueden cortar: al detener, el worker termina en cuanto acaba la tarea en curso.
  const despertadores = new Set<() => void>();
  const esperar = (ms: number) =>
    new Promise<void>((ok) => {
      if (!activo) return ok();
      const t = setTimeout(() => {
        despertadores.delete(despertar);
        ok();
      }, ms);
      const despertar = () => {
        clearTimeout(t);
        ok();
      };
      despertadores.add(despertar);
    });
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
        else await esperar(espera);
      }
    })();
  // Con un ATS de destino sin implementar (ATS_DESTINO=buk) el procesador NO arranca: nada se envía a ningún lado
  // y /api/salud lo informa. Las postulaciones se siguen recibiendo y esperan en la cola.
  const ats = estadoDestino();
  if (!ats.implementado) console.error(`[puente:worker] ${ats.mensaje}: el procesador no arranca.`);
  const nombres = [...(ats.implementado ? ["procesador"] : []), "avisos", "publicacion", "retencion"];
  const ciclos = [
    ...(ats.implementado ? [ciclo("procesador", () => procesarPendientes(opciones), intervalo)] : []),
    ciclo("avisos", () => procesarAvisos({ baseBackoffMs: Number(process.env.PUENTE_AVISO_BACKOFF_MS ?? 5000) }), intervalo),
    ciclo("publicacion", () => sondearProcesosNuevos(), 15_000),
    // Retención de CV (V4): revisa cada hora; si borró algo, vuelve a mirar enseguida.
    ciclo("retencion", () => aplicarRetencion(), Number(process.env.PUENTE_RETENCION_INTERVALO_MS ?? 3_600_000)),
  ];
  console.log(`[puente:worker] iniciado (pid ${process.pid}); intervalo ${intervalo} ms`);
  return {
    ciclos: nombres,
    detener: async () => {
      activo = false;
      for (const d of despertadores) d();
      despertadores.clear();
      await Promise.all(ciclos);
    },
  };
}

/** Dentro del proceso web: el ciclo en curso termina antes de que el proceso salga (apagado ordenado). */
export function iniciarWorkerEnProceso() {
  const worker = iniciarWorker();
  process.once("SIGTERM", () => void worker.detener());
}
