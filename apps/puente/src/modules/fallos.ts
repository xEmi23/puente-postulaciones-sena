import { prisma } from "@/lib/db";
import { modoPrueba } from "@/lib/config";

// Fallos inyectables en los conectores del puente. Inertes salvo con PUENTE_MODO_PRUEBAS=1 en un entorno local (D-12):
// el recorrido normal nunca pasa por aquí con un fallo activo. Se aplican del lado del puente, sobre la llamada HTTP
// saliente, así simulan lo que el puente vería si Talentia o Vínculo fallaran, sin tocar esos sistemas.

export const RUTAS_FALLO = ["candidatos", "documentos", "postulaciones", "consulta", "media"] as const;
export type RutaFallo = (typeof RUTAS_FALLO)[number];
export const MODOS_FALLO = ["NO_DISPONIBLE", "PERDER_RESPUESTA", "LENTO", "CREDENCIALES", "INTERRUMPIR"] as const;
export type ModoFallo = (typeof MODOS_FALLO)[number];

const demoraLentoMs = () => Number(process.env.PUENTE_DEMORA_LENTO_MS ?? 12_000);

/** Consume una unidad del fallo de forma atómica (restantes = -1 significa indefinido). */
export async function consumir(ruta: RutaFallo): Promise<ModoFallo | null> {
  const filas = await prisma.$queryRaw<{ modo: string }[]>`
    UPDATE "FalloSimulado"
    SET restantes = CASE WHEN restantes > 0 THEN restantes - 1 ELSE restantes END
    WHERE ruta = ${ruta} AND restantes <> 0
    RETURNING modo`;
  return (filas[0]?.modo as ModoFallo | undefined) ?? null;
}

const respuestaJson = (status: number, codigo: string, mensaje: string) =>
  new Response(JSON.stringify({ codigo, mensaje }), { status, headers: { "Content-Type": "application/json" } });

function esperar(ms: number, senal?: AbortSignal | null): Promise<void> {
  return new Promise((ok, rechazar) => {
    const t = setTimeout(ok, ms);
    senal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        rechazar(senal.reason);
      },
      { once: true },
    );
  });
}

/** Devuelve la respuesta con los mismos encabezados (incluido Content-Length) pero corta el cuerpo a la mitad. */
async function interrumpir(r: Response): Promise<Response> {
  const bytes = new Uint8Array(await r.arrayBuffer());
  const mitad = bytes.subarray(0, Math.floor(bytes.length / 2));
  const cortado = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(mitad);
      setTimeout(() => c.error(new Error("Transferencia interrumpida (fallo simulado)")), 50);
    },
  });
  return new Response(cortado, { status: r.status, headers: r.headers });
}

/**
 * Ejecuta una llamada HTTP saliente aplicando el fallo configurado para esa operación (solo en modo prueba local).
 * - NO_DISPONIBLE: responde 503 sin llamar (el sistema remoto está caído).
 * - CREDENCIALES: responde 401 sin llamar.
 * - PERDER_RESPUESTA: llama (la escritura ocurre) y luego falla como un corte de red: el puente no sabe el resultado.
 * - LENTO: llama y retiene la respuesta más que el tiempo de espera del puente.
 * - INTERRUMPIR: llama y corta el cuerpo a la mitad (pensado para la descarga del CV).
 */
export async function conFalloSimulado(ruta: RutaFallo, senal: AbortSignal | null | undefined, llamada: () => Promise<Response>): Promise<Response> {
  if (!modoPrueba()) return llamada();
  const modo = await consumir(ruta);
  switch (modo) {
    case "NO_DISPONIBLE":
      return respuestaJson(503, "NO_DISPONIBLE", "Servicio no disponible (fallo simulado en el puente).");
    case "CREDENCIALES":
      return respuestaJson(401, "NO_AUTORIZADO", "Credenciales rechazadas (fallo simulado en el puente).");
    case "PERDER_RESPUESTA": {
      const r = await llamada();
      await r.arrayBuffer();
      throw new TypeError("fetch failed: la respuesta se perdió después de la escritura (fallo simulado)");
    }
    case "LENTO": {
      const r = await llamada();
      await esperar(demoraLentoMs(), senal);
      return r;
    }
    case "INTERRUMPIR":
      return interrumpir(await llamada());
    default:
      return llamada();
  }
}

export async function configurarFallo(ruta: RutaFallo, modo: ModoFallo, restantes: number) {
  if (!modoPrueba()) throw new Error("Los fallos inyectables solo existen en modo prueba.");
  await prisma.falloSimulado.upsert({ where: { ruta }, create: { ruta, modo, restantes }, update: { modo, restantes } });
}

export async function limpiarFallos() {
  await prisma.falloSimulado.deleteMany({});
}
