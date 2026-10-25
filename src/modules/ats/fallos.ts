import { prisma } from "@/lib/db";
import { modoPrueba } from "@/lib/config";
import type { RespuestaAts } from "./servicio";

// Controles de fallos del simulador. Inertes salvo con SIMULADOR_MODO_PRUEBA=true y NODE_ENV distinto de production:
// el recorrido normal nunca pasa por aquí con un fallo activo.

export const RUTAS_FALLO = ["candidatos", "documentos", "postulaciones", "consulta"] as const;
export type RutaFallo = (typeof RUTAS_FALLO)[number];
export const MODOS_FALLO = ["NO_DISPONIBLE", "PERDER_RESPUESTA", "LENTO", "CREDENCIALES"] as const;
export type ModoFallo = (typeof MODOS_FALLO)[number];

const DEMORA_LENTO_MS = 12_000;

async function consumir(ruta: RutaFallo): Promise<ModoFallo | null> {
  const fallo = await prisma.falloSimulado.findUnique({ where: { ruta } });
  if (!fallo || fallo.restantes === 0) return null;
  if (fallo.restantes > 0) {
    await prisma.falloSimulado.update({ where: { ruta }, data: { restantes: { decrement: 1 } } });
  }
  return fallo.modo as ModoFallo;
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
      await new Promise((ok) => setTimeout(ok, DEMORA_LENTO_MS));
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
