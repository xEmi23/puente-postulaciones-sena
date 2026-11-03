-- V4 F6: formulario público. Prueba del consentimiento de cada postulación que llega por el formulario (fecha,
-- versión del aviso y origen resumido con HMAC, nunca la IP en claro). Columnas opcionales; no toca datos existentes.
-- Reversión: ALTER TABLE "Recepcion" DROP COLUMN "consentimientoEn", DROP COLUMN "consentimientoVersion", DROP COLUMN "consentimientoOrigen";

-- AlterTable
ALTER TABLE "Recepcion" ADD COLUMN "consentimientoEn" TIMESTAMPTZ(3),
ADD COLUMN "consentimientoVersion" TEXT,
ADD COLUMN "consentimientoOrigen" TEXT;
