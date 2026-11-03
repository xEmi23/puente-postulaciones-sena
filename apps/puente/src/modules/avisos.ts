import { prisma } from "@/lib/db";
import { avisarCicloDeVida, ErrorVinculo } from "./vinculo-cliente";

// Aviso RESUME_DOWNLOADED a Vínculo (§4.3, paso 7): el candidato ve «CV descargado» en «Mis postulaciones».
// Va aparte del procesamiento: no bloquea el COMPLETADO y, si falla, se reintenta solo, con espera creciente.

export const MAX_INTENTOS_AVISO = 8;

export async function procesarAvisos(opciones: { fetchImpl?: typeof fetch; baseBackoffMs?: number } = {}): Promise<number> {
  // Reserva optimista: se adelanta el próximo intento para que otro worker no tome el mismo aviso a la vez.
  const filas = await prisma.$queryRaw<{ id: string; jobApplicationId: string; avisoIntentos: number }[]>`
    UPDATE "Recepcion" SET "avisoProximoEn" = now() + interval '2 minutes'
    WHERE id IN (
      SELECT id FROM "Recepcion"
      WHERE "avisoEstado" = 'PENDIENTE' AND "avisoProximoEn" <= now()
      ORDER BY "avisoProximoEn" LIMIT 10 FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "jobApplicationId", "avisoIntentos"`;
  for (const f of filas) {
    const intento = f.avisoIntentos + 1;
    try {
      await avisarCicloDeVida(f.jobApplicationId, "RESUME_DOWNLOADED", opciones.fetchImpl);
      await prisma.$transaction([
        prisma.recepcion.update({ where: { id: f.id }, data: { avisoEstado: "ENVIADO", avisoIntentos: intento, avisoError: null, avisoProximoEn: null } }),
        prisma.eventoRecepcion.create({ data: { recepcionId: f.id, tipo: "AVISO", detalle: "El Simulador LinkedIn informó al candidato «CV descargado» (RESUME_DOWNLOADED)." } }),
      ]);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      const definitivo = (e instanceof ErrorVinculo && (e.tipo === "validacion" || e.tipo === "sin_conexion")) || intento >= MAX_INTENTOS_AVISO;
      const espera = Math.min((opciones.baseBackoffMs ?? 5000) * 2 ** (intento - 1), 10 * 60_000);
      await prisma.$transaction([
        prisma.recepcion.update({
          where: { id: f.id },
          data: definitivo
            ? { avisoEstado: "FALLIDO", avisoIntentos: intento, avisoError: mensaje, avisoProximoEn: null }
            : { avisoIntentos: intento, avisoError: mensaje, avisoProximoEn: new Date(Date.now() + espera) },
        }),
        prisma.eventoRecepcion.create({ data: { recepcionId: f.id, tipo: "AVISO", detalle: `Aviso al Simulador LinkedIn, intento ${intento}: ${mensaje}${definitivo ? " No se reintenta más." : ""}` } }),
      ]);
    }
  }
  return filas.length;
}
