import { prisma } from "@/lib/db";
import { modoPrueba } from "@/lib/config";
import type { RespuestaAts } from "./servicio";

// Controles de fallos del simulador. Inertes salvo con SIMULADOR_MODO_PRUEBA=true en un entorno local (D-12):
// el recorrido normal nunca pasa por aquí con un fallo activo.

// "media" es la URL del CV en el origen: los controles de prueba son infraestructura de pruebas, no parte de ningún contrato.
export const RUTAS_FALLO = ["candidatos", "documentos", "postulaciones", "consulta", "media"] as const;
export type RutaFallo = (typeof RUTAS_FALLO)[number];
export const MODOS_FALLO = ["NO_DISPONIBLE", "PERDER_RESPUESTA", "LENTO", "CREDENCIALES", "INTERRUMPIR"] as const;
export type ModoFallo = (typeof MODOS_FALLO)[number];

const demoraLentoMs = () => Number(process.env.SIMULADOR_DEMORA_LENTO_MS ?? 12_000);

/** Consume una unidad del fallo de forma atómica (restantes = -1 significa indefinido). */
export async function consumir(ruta: RutaFallo): Promise<ModoFallo | null> {
  const filas = await prisma.$queryRaw<{ modo: string }[]>`
    UPDATE ats."FalloSimulado"
    SET restantes = CASE WHEN restantes > 0 THEN restantes - 1 ELSE restantes END
    WHERE ruta = ${ruta} AND restantes <> 0
    RETURNING modo`;
  return (filas[0]?.modo as ModoFallo | undefined) ?? null;
}

export async function falloSimulado(ruta: RutaFallo, operacion: () => Promise<RespuestaAts>): Promise<RespuestaAts> {
  if (!modoPrueba()) return operacion();
  const modo = await consumir(ruta);
  switch (modo) {
    case "NO_DISPONIBLE":
      return { status: 503, body: { codigo: "NO_DISPONIBLE", mensaje: "ATS no disponible (fallo simulado)." } };
    case "CREDENCIALES":
      return { status: 401, body: { codigo: "NO_AUTORIZADO", mensaje: "Credenciales rechazadas (fallo simulado)." } };
    case "PERDER_RESPUESTA": {
      await operacion();
      return { status: 503, body: { codigo: "RESPUESTA_PERDIDA", mensaje: "La escritura ocurrió pero la respuesta se perdió (fallo simulado)." } };
    }
    case "LENTO": {
      const r = await operacion();
      await new Promise((ok) => setTimeout(ok, demoraLentoMs()));
      return r;
    }
    default:
      return operacion();
  }
}

export async function configurarFallo(ruta: RutaFallo, modo: ModoFallo, restantes: number) {
  if (!modoPrueba()) throw new Error("Los controles de fallos solo existen en modo prueba.");
  await prisma.falloSimulado.upsert({ where: { ruta }, create: { ruta, modo, restantes }, update: { modo, restantes } });
}

export async function limpiarFallos() {
  await prisma.falloSimulado.deleteMany({});
}
