-- V4 F1: fuente e identificadores externos en Recepcion (deduplicación dura UNIQUE(fuente, idExterno)).
-- Los registros existentes vienen todos de Apply Connect (Vínculo): fuente = 'apply-connect',
-- idExterno = jobApplicationId, vacanteExterna = externalJobId.
--
-- Reversión (manual; no se pierden datos porque las columnas nuevas se derivan de las existentes):
--   DROP INDEX "Recepcion_fuente_idExterno_key";
--   ALTER TABLE "Recepcion" DROP COLUMN "fuente", DROP COLUMN "idExterno", DROP COLUMN "vacanteExterna", DROP COLUMN "advertencia";
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20261102120000_v4_f1_fuente';

ALTER TABLE "Recepcion" ADD COLUMN "fuente" TEXT NOT NULL DEFAULT 'apply-connect';
ALTER TABLE "Recepcion" ADD COLUMN "idExterno" TEXT;
ALTER TABLE "Recepcion" ADD COLUMN "vacanteExterna" TEXT;
ALTER TABLE "Recepcion" ADD COLUMN "advertencia" TEXT;

UPDATE "Recepcion" SET "idExterno" = "jobApplicationId", "vacanteExterna" = "externalJobId";

ALTER TABLE "Recepcion" ALTER COLUMN "idExterno" SET NOT NULL;
ALTER TABLE "Recepcion" ALTER COLUMN "vacanteExterna" SET NOT NULL;

CREATE UNIQUE INDEX "Recepcion_fuente_idExterno_key" ON "Recepcion"("fuente", "idExterno");
